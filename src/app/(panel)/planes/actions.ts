"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES, isManagerRole, parseNumber, parseStr } from "@/lib/clients";

async function requireAccess() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/");
  return prof;
}

// Comprueba acceso a un cliente (manager o nutricionista asignado).
async function assertClientAccess(clientId: string, prof: { id: string; role: string }) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) redirect("/clientes");
  if (!isManagerRole(prof.role) && client.nutritionistId !== prof.id) redirect("/clientes");
  return client;
}

// Carga un plan y verifica acceso vía su cliente. Devuelve { plan }.
async function loadPlanForEdit(planId: string, prof: { id: string; role: string }) {
  const plan = await prisma.nutritionPlan.findUnique({ where: { id: planId } });
  if (!plan) redirect("/clientes");
  await assertClientAccess(plan.clientId, prof);
  return plan;
}

export async function createPlan(formData: FormData) {
  const prof = await requireAccess();
  const clientId = String(formData.get("clientId"));
  await assertClientAccess(clientId, prof);

  // Override de consideración especial: viene como single-select. Si tiene
  // valor, se guarda como array de 1 elemento (el schema permite ampliar).
  const considerationId = parseStr(formData.get("specialConsiderationOverrideId"));
  const overrideIds = considerationId ? [considerationId] : [];

  // Tipo de plan:
  //  - "regular" → pauta nutricional. Si autoGenerate=true, la IA genera el
  //    plan y devolvemos draft para que el nutri lo revise.
  //  - "competition" → plan puntual de una prueba. Ya NO se genera con IA;
  //    se aplica una plantilla (CompetitionPlanTemplate) tal cual y el
  //    nutri ajusta a mano. El form trae competitionTemplateId.
  const kindRaw = parseStr(formData.get("kind"));
  const isCompetition = kindRaw === "competition";

  const plan = await prisma.nutritionPlan.create({
    data: {
      clientId,
      name: parseStr(formData.get("name")) ?? "Plan nutricional",
      description: parseStr(formData.get("description")),
      goal: parseStr(formData.get("goal")),
      createdById: prof.id,
      instructions: parseStr(formData.get("instructions")),
      goalOverride: parseStr(formData.get("goalOverride")),
      specialConsiderationOverrideIds: overrideIds,
      // Override de macros SOLO para este plan. Si vienen los cuatro a la
      // vez, ganan sobre la ficha del cliente. Si vienen parciales/ninguno,
      // se ignoran y se usan los de la ficha.
      kcalOverride: parseNumber(formData.get("kcalOverride")),
      proteinOverride: parseNumber(formData.get("proteinOverride")),
      carbsOverride: parseNumber(formData.get("carbsOverride")),
      fatOverride: parseNumber(formData.get("fatOverride")),
      kind: isCompetition ? "competition" : "regular",
      // Los campos legacy competitionName/competitionContext (input de IA)
      // ya no se usan en el nuevo flujo. Quedan a null.
      competitionName: null,
      competitionContext: null,
    },
  });

  // Competición → aplicar plantilla y volver directo al plan (sin modal).
  if (isCompetition) {
    const templateId = parseStr(formData.get("competitionTemplateId"));
    if (templateId) {
      try {
        const { applyCompetitionTemplateToPlan } = await import(
          "@/lib/competitionTemplates"
        );
        await applyCompetitionTemplateToPlan(templateId, plan.id);
      } catch (e) {
        console.warn("[createPlan] applyTemplate failed:", (e as Error).message);
      }
    }
    return {
      ok: true as const,
      planId: plan.id,
      clientId,
      draftId: null,
      payload: null,
    };
  }

  // Pauta nutricional con autoGenerate: la IA genera draft, lo devolvemos
  // para que la UI abra el modal de revisión.
  const autoGenerate = parseStr(formData.get("autoGenerate")) === "true";
  if (autoGenerate) {
    try {
      const result = await runDraftGeneration({ planId: plan.id, prof });
      if (result) {
        return {
          ok: true as const,
          planId: plan.id,
          clientId,
          draftId: result.draftId,
          payload: result.payload,
        };
      }
    } catch (e) {
      console.warn("[createPlan] auto-generate failed:", (e as Error).message);
    }
  }

  return {
    ok: true as const,
    planId: plan.id,
    clientId,
    draftId: null,
    payload: null,
  };
}

export async function deletePlan(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  const plan = await loadPlanForEdit(planId, prof);
  await prisma.nutritionPlan.delete({ where: { id: planId } });
  redirect(`/clientes/${plan.clientId}?tab=plan`);
}

export async function renamePlan(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);
  await prisma.nutritionPlan.update({
    where: { id: planId },
    data: {
      name: parseStr(formData.get("name")) ?? "Plan nutricional",
      goal: parseStr(formData.get("goal")),
      notes: parseStr(formData.get("notes")),
    },
  });
  revalidatePath(`/planes/${planId}`);
}

/** Edita la descripción del plan (texto corto visible al cliente en la
 *  galería de /cliente/plan). Se llama desde el editor inline de la card. */
export async function updatePlanDescription(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  const plan = await loadPlanForEdit(planId, prof);
  await prisma.nutritionPlan.update({
    where: { id: planId },
    data: { description: parseStr(formData.get("description")) },
  });
  revalidatePath(`/clientes/${plan.clientId}`);
}

export async function addDay(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);
  const count = await prisma.planDay.count({ where: { planId } });
  await prisma.planDay.create({
    data: { planId, name: parseStr(formData.get("name")) ?? `Día ${count + 1}`, order: count },
  });
  revalidatePath(`/planes/${planId}`);
}

// setDayType retirado: ya no diferenciamos entreno/descanso/mixto. Todos los
// días nuevos se crean como "entreno"; los antiguos siguen como estén pero se
// pintan contra los macros únicos (ver lib/nutrition.targetsForDayType).

export async function deleteDay(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);
  await prisma.planDay.delete({ where: { id: String(formData.get("dayId")) } });
  revalidatePath(`/planes/${planId}`);
}

export async function addMeal(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);
  const planDayId = String(formData.get("dayId"));
  const count = await prisma.meal.count({ where: { planDayId } });
  await prisma.meal.create({
    data: { planDayId, name: parseStr(formData.get("name")) ?? "comida", order: count },
  });
  revalidatePath(`/planes/${planId}`);
}

// Renombra una comida (texto libre). Autosave desde la UI.
export async function renameMeal(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);
  const mealId = String(formData.get("mealId"));
  const name = parseStr(formData.get("name")) ?? "";
  if (!name.trim()) return;
  await prisma.meal.update({
    where: { id: mealId },
    data: { name: name.trim().slice(0, 100) },
  });
}

// Mueve una comida arriba/abajo dentro de su día (intercambia order con el
// vecino). Devuelve sin error si ya está en el extremo correspondiente.
export async function moveMeal(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);
  const mealId = String(formData.get("mealId"));
  const direction = String(formData.get("direction")); // "up" | "down"
  const meal = await prisma.meal.findUnique({ where: { id: mealId } });
  if (!meal) return;
  const neighbor = await prisma.meal.findFirst({
    where: {
      planDayId: meal.planDayId,
      order: direction === "up" ? { lt: meal.order } : { gt: meal.order },
    },
    orderBy: { order: direction === "up" ? "desc" : "asc" },
  });
  if (!neighbor) return;
  await prisma.$transaction([
    prisma.meal.update({ where: { id: meal.id }, data: { order: neighbor.order } }),
    prisma.meal.update({ where: { id: neighbor.id }, data: { order: meal.order } }),
  ]);
}

export async function deleteMeal(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);
  await prisma.meal.delete({ where: { id: String(formData.get("mealId")) } });
  revalidatePath(`/planes/${planId}`);
}

// Genera un plan completo CON IA: borra estructura previa, calcula objetivos
// con Harris-Benedict (los guarda en MacroTargets) y pide a Claude que
// rellene 1 día tipo con 5 comidas × 3 opciones reales (alimentos + gramos).
//
// Genera un borrador con IA y lo deja en estado "preview" para que el nutri
// lo revise en el modal. Sustituye al antiguo generatePlanFromAI: ya no
// persiste days/meals; eso lo hace acceptPlanDraft.
export async function previewPlanGeneration(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);

  const kindRaw = parseStr(formData.get("kind"));
  const overrideKind = kindRaw === "competition" ? "competition" : kindRaw === "regular" ? "regular" : null;
  const competitionName = parseStr(formData.get("competitionName"));
  const competitionContext = parseStr(formData.get("competitionContext"));

  const result = await runDraftGeneration({
    planId,
    prof,
    overrideKind,
    competitionName,
    competitionContext,
  });
  if (!result) return { error: "No se pudo generar el plan." } as const;
  return { ok: true as const, draftId: result.draftId, payload: result.payload };
}

// Acepta un borrador y persiste el plan. Si el nutri marcó "guardar como
// ejemplo de referencia" + razón, archiva además un feedback "good".
export async function acceptPlanDraft(formData: FormData) {
  const prof = await requireAccess();
  const draftId = String(formData.get("draftId"));
  const saveAsExample = parseStr(formData.get("saveAsExample")) === "true";
  const reason = parseStr(formData.get("reason"));

  const draftRow = await prisma.planGenerationDraft.findUnique({
    where: { id: draftId },
  });
  if (!draftRow) return { error: "El borrador ya no existe." } as const;
  const payload = draftRow.payload as unknown as DraftPayload;

  if (saveAsExample && reason && reason.trim().length > 0) {
    await prisma.planGenerationFeedback.create({
      data: {
        verdict: "good",
        reason: reason.trim(),
        planSnapshot: payload.draft as unknown as Prisma.InputJsonValue,
        planContextSnapshot: payload.contextSnapshot as unknown as Prisma.InputJsonValue,
        clientId: payload.contextSnapshot.clientId,
        planId: draftRow.planId,
        createdById: prof.id,
      },
    });
  }

  const result = await commitDraft(draftId, prof);
  if (!result) return { error: "No se pudo guardar el plan." } as const;
  return { ok: true as const, planId: result.planId };
}

// Rechaza un borrador: archiva feedback "bad" con la razón obligatoria y
// marca el draft como rejected (no se persisten days/meals).
export async function rejectPlanDraft(formData: FormData) {
  const prof = await requireAccess();
  const draftId = String(formData.get("draftId"));
  const reason = parseStr(formData.get("reason"));
  if (!reason || reason.trim().length === 0) {
    return { error: "Explica por qué el plan no sirve para que la IA aprenda." } as const;
  }
  const draftRow = await prisma.planGenerationDraft.findUnique({
    where: { id: draftId },
  });
  if (!draftRow) return { error: "El borrador ya no existe." } as const;
  const payload = draftRow.payload as unknown as DraftPayload;

  await prisma.planGenerationFeedback.create({
    data: {
      verdict: "bad",
      reason: reason.trim(),
      planSnapshot: payload.draft as unknown as Prisma.InputJsonValue,
      planContextSnapshot: payload.contextSnapshot as unknown as Prisma.InputJsonValue,
      clientId: payload.contextSnapshot.clientId,
      planId: draftRow.planId,
      createdById: prof.id,
    },
  });

  await prisma.planGenerationDraft.update({
    where: { id: draftId },
    data: { status: "rejected" },
  });

  return { ok: true as const };
}

// Regenera el borrador con una instrucción nueva. Opcionalmente guarda la
// instrucción como PlanGenerationRule activa para que se aplique a TODAS
// las generaciones futuras.
export async function regeneratePlanDraft(formData: FormData) {
  const prof = await requireAccess();
  const draftId = String(formData.get("draftId"));
  const instruction = parseStr(formData.get("instruction"));
  if (!instruction || instruction.trim().length === 0) {
    return { error: "Escribe qué ajuste quieres que aplique la IA." } as const;
  }
  const saveAsRule = parseStr(formData.get("saveAsRule")) === "true";

  const draftRow = await prisma.planGenerationDraft.findUnique({
    where: { id: draftId },
  });
  if (!draftRow || draftRow.status !== "preview") {
    return { error: "El borrador ya no existe." } as const;
  }
  const planId = draftRow.planId;
  await loadPlanForEdit(planId, prof);

  if (saveAsRule) {
    const lastOrder = await prisma.planGenerationRule.aggregate({
      _max: { order: true },
    });
    await prisma.planGenerationRule.create({
      data: {
        text: instruction.trim(),
        order: (lastOrder._max.order ?? 0) + 10,
        createdById: prof.id,
      },
    });
  }

  // Recuperamos el kind/competition del plan persistidos (no cambian entre
  // intentos del mismo borrador) y lanzamos otra generación pasando la
  // nueva instrucción como attemptInstruction (que entra en el prompt).
  const plan = await prisma.nutritionPlan.findUnique({ where: { id: planId } });
  if (!plan) return { error: "El plan ya no existe." } as const;

  const result = await runDraftGeneration({
    planId,
    prof,
    overrideKind: plan.kind === "competition" ? "competition" : "regular",
    competitionName: plan.competitionName ?? null,
    competitionContext: plan.competitionContext ?? null,
    attemptInstruction: instruction.trim(),
  });
  if (!result) return { error: "No se pudo regenerar." } as const;
  return { ok: true as const, draftId: result.draftId, payload: result.payload };
}

// CRUD reglas de IA (las inyecta lib/planFeedback.buildLearningPromptBlocks).
export async function upsertPlanGenerationRule(formData: FormData) {
  const prof = await requireAccess();
  const id = parseStr(formData.get("id"));
  const text = parseStr(formData.get("text"));
  if (!text) return;
  if (id) {
    await prisma.planGenerationRule.update({
      where: { id },
      data: { text: text.trim() },
    });
  } else {
    const lastOrder = await prisma.planGenerationRule.aggregate({
      _max: { order: true },
    });
    await prisma.planGenerationRule.create({
      data: {
        text: text.trim(),
        order: (lastOrder._max.order ?? 0) + 10,
        createdById: prof.id,
      },
    });
  }
  revalidatePath("/biblioteca/brief-ia");
}

export async function togglePlanGenerationRule(formData: FormData) {
  await requireAccess();
  const id = String(formData.get("id"));
  const row = await prisma.planGenerationRule.findUnique({ where: { id } });
  if (!row) return;
  await prisma.planGenerationRule.update({
    where: { id },
    data: { active: !row.active },
  });
  revalidatePath("/biblioteca/brief-ia");
}

export async function deletePlanGenerationRule(formData: FormData) {
  await requireAccess();
  const id = String(formData.get("id"));
  await prisma.planGenerationRule.delete({ where: { id } });
  revalidatePath("/biblioteca/brief-ia");
}

export async function deletePlanGenerationFeedback(formData: FormData) {
  await requireAccess();
  const id = String(formData.get("id"));
  await prisma.planGenerationFeedback.delete({ where: { id } });
  revalidatePath("/biblioteca/brief-ia");
}

// Payload que guardamos en PlanGenerationDraft.payload. Lo necesitamos del
// lado cliente para pintar el modal de revisión sin tener que recargar.
export type DraftPayload = {
  draft: import("@/lib/planGenerator").GeneratedPlan;
  targets: { kcal: number; protein: number; carbs: number; fat: number } | null;
  contextSnapshot: {
    clientId: string;
    clientName: string;
    planName: string;
    isCompetition: boolean;
    goal: string | null;
    considerationIds: string[];
    competitionName: string | null;
    competitionContext: string | null;
    /** Última instrucción usada en este intento (para mostrarla al revisar). */
    lastInstruction: string | null;
  };
};

// TTL del borrador en BD: si el nutri cierra la pestaña sin aceptar/rechazar,
// el draft se queda muerto. Lo expiramos a las 24h.
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

// Helper interno: ejecuta HB → Claude pero NO toca days/meals/items. Crea
// una fila en PlanGenerationDraft y devuelve su id + payload. Lo usan tanto
// previewPlanGeneration (botón "Generar plan") como createPlan (autoGenerate
// al crear). El commit a la estructura real del plan ocurre en commitDraft
// cuando el nutri acepta desde el modal de revisión.
async function runDraftGeneration(opts: {
  planId: string;
  prof: { id: string; role: string };
  overrideKind?: "regular" | "competition" | null;
  competitionName?: string | null;
  competitionContext?: string | null;
  attemptInstruction?: string | null;
}): Promise<{ draftId: string; payload: DraftPayload } | null> {
  const { planId, prof } = opts;
  const plan = await prisma.nutritionPlan.findUnique({ where: { id: planId } });
  if (!plan) return null;

  // Resuelve los flags efectivos: si el formulario "Generar plan" pasó algo,
  // gana; si no, se usa lo persistido en el plan.
  const kind = opts.overrideKind ?? plan.kind ?? "regular";
  const competitionName = opts.competitionName ?? plan.competitionName ?? null;
  const competitionContext = opts.competitionContext ?? plan.competitionContext ?? null;
  const isCompetition = kind === "competition" && !!competitionContext;

  const client = await prisma.client.findUnique({
    where: { id: plan.clientId },
    include: { profile: true, macroTargets: true },
  });
  if (!client) return null;

  // 1) Macros target del cliente.
  //    Prioridad:
  //      a) Override por plan (kcalOverride etc.) → gana si están los 4.
  //      b) Ficha del cliente (macroTargets.kcalTraining) → si está set.
  //      c) HB → solo si no hay nada y existen datos antropométricos.
  //    En plan de competición NO tocamos macroTargets persistidos.
  const planHasOverrides =
    plan.kcalOverride != null &&
    plan.proteinOverride != null &&
    plan.carbsOverride != null &&
    plan.fatOverride != null;

  const existingTargets = client.macroTargets;
  const hasManualTargets =
    existingTargets != null && existingTargets.kcalTraining != null;

  let effectiveTargets: { kcal: number; protein: number; carbs: number; fat: number } | null =
    null;

  if (planHasOverrides) {
    effectiveTargets = {
      kcal: plan.kcalOverride as number,
      protein: plan.proteinOverride as number,
      carbs: plan.carbsOverride as number,
      fat: plan.fatOverride as number,
    };
  } else if (hasManualTargets) {
    effectiveTargets = {
      kcal: existingTargets!.kcalTraining as number,
      protein: existingTargets!.proteinTraining ?? 0,
      carbs: existingTargets!.carbsTraining ?? 0,
      fat: existingTargets!.fatTraining ?? 0,
    };
  } else {
    const { getMacroConfig } = await import("@/lib/macroConfig");
    const { computeTargets } = await import("@/lib/harrisBenedict");
    const config = await getMacroConfig();
    const hb = computeTargets(
      {
        sex: client.profile?.sex ?? null,
        birthDate: client.profile?.birthDate ?? null,
        heightCm: client.profile?.heightCm ?? null,
        weightKg: client.profile?.weightKg ?? null,
        weeklyFrequency: client.profile?.weeklyFrequency ?? null,
        goal: isCompetition ? "rendimiento" : (client.profile?.goal ?? null),
      },
      config,
    );
    if (hb) {
      effectiveTargets = {
        kcal: hb.kcal,
        protein: hb.protein,
        carbs: hb.carbs,
        fat: hb.fat,
      };
      // Persistimos solo si NO es competición (en competición no tocamos los
      // macros base del cliente, son macros del evento puntual).
      if (!isCompetition) {
        await prisma.macroTargets.upsert({
          where: { clientId: client.id },
          create: {
            clientId: client.id,
            kcalTraining: hb.kcal,
            proteinTraining: hb.protein,
            carbsTraining: hb.carbs,
            fatTraining: hb.fat,
            kcalRest: null,
            proteinRest: null,
            carbsRest: null,
            fatRest: null,
          },
          update: {
            kcalTraining: hb.kcal,
            proteinTraining: hb.protein,
            carbsTraining: hb.carbs,
            fatTraining: hb.fat,
          },
        });
      }
    }
  }

  // Persistimos kind + contexto en el plan para tener trazabilidad.
  await prisma.nutritionPlan.update({
    where: { id: planId },
    data: {
      kind,
      competitionName: isCompetition ? competitionName : null,
      competitionContext: isCompetition ? competitionContext : null,
    },
  });

  // Goal y consideraciones efectivas para este plan:
  // - goal: si el plan tiene goalOverride, gana; si no, el del cliente.
  // - considerations: si el plan tiene override (no vacío), gana; si no,
  //   las del cliente. Sigue siendo aditivo si el manager lo prefiere
  //   marcando varios en la ficha del cliente.
  const effectiveGoal = plan.goalOverride ?? client.profile?.goal ?? null;
  const effectiveConsiderationIds =
    plan.specialConsiderationOverrideIds.length > 0
      ? plan.specialConsiderationOverrideIds
      : client.profile?.specialConsiderationIds ?? [];

  // 2) Llamamos al generador. Usa el brief de /biblioteca/brief-ia (textos +
  //    adjuntos PDF/Excel/CSV) y los targets recién recalculados.
  const { generatePlanDraft } = await import("@/lib/planGenerator");
  const draft = await generatePlanDraft({
    clientName: client.fullName,
    sex: client.profile?.sex ?? null,
    birthDate: client.profile?.birthDate ?? null,
    heightCm: client.profile?.heightCm ?? null,
    weightKg: client.profile?.weightKg ?? null,
    weeklyFrequency: client.profile?.weeklyFrequency ?? null,
    level: client.profile?.level ?? null,
    boxName: client.profile?.boxName ?? null,
    goal: effectiveGoal,
    targetWeightKg: client.profile?.targetWeightKg ?? null,
    dietaryStyle: client.profile?.dietaryStyle ?? null,
    allergies: client.profile?.allergies ?? [],
    intolerances: client.profile?.intolerances ?? [],
    dislikes: client.profile?.dislikes ?? [],
    medicalConditions: client.profile?.medicalConditions ?? null,
    medication: client.profile?.medication ?? null,
    kcalTraining: effectiveTargets?.kcal ?? null,
    proteinTraining: effectiveTargets?.protein ?? null,
    carbsTraining: effectiveTargets?.carbs ?? null,
    fatTraining: effectiveTargets?.fat ?? null,
    specialConsiderationIds: effectiveConsiderationIds,
    competitionContext: isCompetition ? competitionContext : null,
    competitionName: isCompetition ? competitionName : null,
    userInstructions: plan.instructions ?? null,
    attemptInstruction: opts.attemptInstruction ?? null,
  });

  // 3) Persistimos el borrador en BD. Limpiamos primero cualquier draft
  //    previo en estado "preview" del mismo plan para no acumular basura
  //    si el nutri regeneró varias veces sin cerrar.
  await prisma.planGenerationDraft.deleteMany({
    where: { planId, status: "preview" },
  });

  const payload: DraftPayload = {
    draft,
    targets: effectiveTargets,
    contextSnapshot: {
      clientId: client.id,
      clientName: client.fullName,
      planName: plan.name,
      isCompetition,
      goal: effectiveGoal,
      considerationIds: effectiveConsiderationIds,
      competitionName: isCompetition ? competitionName : null,
      competitionContext: isCompetition ? competitionContext : null,
      lastInstruction: opts.attemptInstruction ?? null,
    },
  };

  const draftRow = await prisma.planGenerationDraft.create({
    data: {
      planId,
      payload: payload as unknown as Prisma.InputJsonValue,
      createdById: prof.id,
      expiresAt: new Date(Date.now() + DRAFT_TTL_MS),
    },
  });

  return { draftId: draftRow.id, payload };
}

// Persiste un draft en el plan real: borra estructura previa, crea
// days/meals/items + plan.notes/supplementation. Marca el draft como
// accepted. Devuelve el planId para que la UI redirija o haga refresh.
async function commitDraft(
  draftId: string,
  prof: { id: string; role: string },
): Promise<{ planId: string } | null> {
  const draftRow = await prisma.planGenerationDraft.findUnique({
    where: { id: draftId },
  });
  if (!draftRow || draftRow.status !== "preview") return null;

  // Comprueba que el profesional tiene acceso al plan referenciado.
  const plan = await loadPlanForEdit(draftRow.planId, prof);
  const payload = draftRow.payload as unknown as DraftPayload;
  const { draft } = payload;
  const planId = draftRow.planId;

  // Reset y persistencia. Misma lógica que tenía runFullPlanGeneration.
  await prisma.planDay.deleteMany({ where: { planId } });

  for (let di = 0; di < draft.days.length; di++) {
    const d = draft.days[di];
    const newDay = await prisma.planDay.create({
      data: { planId, name: d.name, dayType: d.dayType, order: di },
    });
    for (let mi = 0; mi < d.meals.length; mi++) {
      const m = d.meals[mi];
      const newMeal = await prisma.meal.create({
        data: { planDayId: newDay.id, name: m.name, order: mi },
      });
      // Para comida/cena hay subgrupos (intro/grasas/carbos/proteina/postre):
      // marcamos como "selected" la primera opción DE CADA subgrupo. Para
      // otras comidas, solo la primera opción.
      const seenSubTypes = new Set<string>();
      for (let oi = 0; oi < m.options.length; oi++) {
        const o = m.options[oi];
        const sub = o.subType ?? null;
        const key = sub ?? "__nosub__";
        const isFirstOfGroup = !seenSubTypes.has(key);
        seenSubTypes.add(key);
        const selected = sub ? isFirstOfGroup : oi === 0;
        await prisma.mealItem.create({
          data: {
            mealId: newMeal.id,
            foodId: null,
            nameSnapshot: o.text,
            quantityG: 100,
            kcalPer100: o.kcal,
            proteinPer100: o.protein,
            carbsPer100: o.carbs,
            fatPer100: o.fat,
            subType: sub,
            selected,
            order: oi,
            // Descomposición en alimentos individuales (para la lista de
            // compra). Puede venir vacío si la IA no la devolvió; en ese
            // caso /cliente/compra cae a la opción entera como una línea.
            ingredients:
              o.ingredients && o.ingredients.length > 0
                ? (o.ingredients as unknown as Prisma.InputJsonValue)
                : undefined,
          },
        });
      }
    }
  }

  // Observaciones + Suplementación generadas por la IA. Si vinieron, las
  // escribimos (el nutri ya las revisó al ver el draft). Si vino de fallback,
  // solo rellenamos notes si estaba vacío para no pisar lo que tuviera.
  if (draft.source === "ai") {
    const data: { notes?: string; supplementation?: string } = {};
    if (draft.notes && draft.notes.trim()) data.notes = draft.notes.trim();
    if (draft.supplementation && draft.supplementation.trim())
      data.supplementation = draft.supplementation.trim();
    if (Object.keys(data).length > 0) {
      await prisma.nutritionPlan.update({ where: { id: planId }, data });
    }
  } else if (!plan.notes) {
    await prisma.nutritionPlan.update({
      where: { id: planId },
      data: {
        notes: draft.notes ?? "Borrador genérico (sin IA). Edítalo para adaptarlo al cliente.",
      },
    });
  }

  await prisma.planGenerationDraft.update({
    where: { id: draftId },
    data: { status: "accepted" },
  });

  revalidatePath(`/planes/${planId}`);
  revalidatePath(`/clientes/${plan.clientId}`);
  return { planId };
}

// Añade un item "freestyle" con macros estimadas por IA (texto libre).
// Convención: para items freestyle (foodId === null), quantityG = 100 y los
// campos *Per100 contienen los TOTALES (la UI lo detecta por foodId === null).
export async function addItemFromText(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);
  const mealId = String(formData.get("mealId"));
  const text = parseStr(formData.get("text"));
  if (!text) return;

  const { estimateMacros } = await import("@/lib/macroEstimator");
  const macros = await estimateMacros(text);

  const count = await prisma.mealItem.count({ where: { mealId } });
  await prisma.mealItem.create({
    data: {
      mealId,
      foodId: null,
      nameSnapshot: text.slice(0, 200),
      quantityG: 100,
      kcalPer100: macros.kcal,
      proteinPer100: macros.protein,
      carbsPer100: macros.carbs,
      fatPer100: macros.fat,
      subType: parseStr(formData.get("subType")),
      order: count,
      ingredients:
        macros.ingredients && macros.ingredients.length > 0
          ? (macros.ingredients as unknown as Prisma.InputJsonValue)
          : undefined,
    },
  });
  revalidatePath(`/planes/${planId}`);
}

// Marca/desmarca un item como "elegido" (cuenta para los macros del día).
// Útil cuando se ofrecen varias alternativas dentro del mismo subType.
export async function toggleItemSelected(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);
  const itemId = String(formData.get("itemId"));
  const item = await prisma.mealItem.findUnique({ where: { id: itemId }, select: { selected: true } });
  if (!item) return;
  await prisma.mealItem.update({ where: { id: itemId }, data: { selected: !item.selected } });
  revalidatePath(`/planes/${planId}`);
}

// Cambia el subType de un item (intro/grasas/carbos/proteina/postre/otro).
export async function updateItemSubType(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);
  await prisma.mealItem.update({
    where: { id: String(formData.get("itemId")) },
    data: { subType: parseStr(formData.get("subType")) },
  });
  revalidatePath(`/planes/${planId}`);
}

// Edita las notas (informe) del plan — texto libre, lo ve el nutri y el cliente.
export async function updatePlanNotes(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);
  await prisma.nutritionPlan.update({
    where: { id: planId },
    data: { notes: parseStr(formData.get("notes")) },
  });
  revalidatePath(`/planes/${planId}`);
}

// Actualiza observaciones / suplementación a la vez. Recibe los textos
// directamente (no FormData) para que el builder pueda llamar a esto desde
// el cliente con debounce sin tener que armar FormData.
export async function updatePlanCopy(
  planId: string,
  notes: string | null,
  supplementation: string | null,
): Promise<void> {
  const prof = await requireAccess();
  await loadPlanForEdit(planId, prof);
  await prisma.nutritionPlan.update({
    where: { id: planId },
    data: {
      notes: notes && notes.trim() ? notes.slice(0, 5000) : null,
      supplementation:
        supplementation && supplementation.trim() ? supplementation.slice(0, 5000) : null,
    },
  });
}

// Añade un alimento de la biblioteca a una comida (con su cantidad en gramos).
export async function addItem(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);

  const mealId = String(formData.get("mealId"));
  const foodId = parseStr(formData.get("foodId"));
  if (!foodId) return;
  const food = await prisma.foodLibrary.findUnique({ where: { id: foodId } });
  if (!food) return;

  const count = await prisma.mealItem.count({ where: { mealId } });
  await prisma.mealItem.create({
    data: {
      mealId,
      foodId: food.id,
      nameSnapshot: food.name,
      quantityG: parseNumber(formData.get("quantityG")) ?? 0,
      kcalPer100: food.kcalPer100,
      proteinPer100: food.proteinPer100,
      carbsPer100: food.carbsPer100,
      fatPer100: food.fatPer100,
      subType: parseStr(formData.get("subType")),
      order: count,
    },
  });
  revalidatePath(`/planes/${planId}`);
}

export async function deleteItem(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);
  await prisma.mealItem.delete({ where: { id: String(formData.get("itemId")) } });
  revalidatePath(`/planes/${planId}`);
}

// ── Builder nuevo (3 opciones por comida) ───────────────────────────────

// Añade una opción vacía (freestyle, sin alimento) a una comida. Si la comida
// usa subgrupos (comida/cena → intro/grasas/carbos/proteina/postre), `subType`
// puede venir en formData para colocarla en el subgrupo correcto.
// Convención: foodId=null, quantityG=100, *Per100 = totales.
export async function addOptionToMeal(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);
  const mealId = String(formData.get("mealId"));
  const subType = parseStr(formData.get("subType"));
  const count = await prisma.mealItem.count({
    where: { mealId, subType: subType ?? null },
  });
  await prisma.mealItem.create({
    data: {
      mealId,
      foodId: null,
      nameSnapshot: "",
      quantityG: 100,
      kcalPer100: 0,
      proteinPer100: 0,
      carbsPer100: 0,
      fatPer100: 0,
      selected: false,
      subType: subType ?? null,
      order: count,
    },
  });
  revalidatePath(`/planes/${planId}`);
}

// Selección exclusiva dentro del subgrupo: marca esta opción como elegida y
// deselecciona el resto de opciones del mismo subType en la misma comida.
// Si ya estaba seleccionada, la desactiva (toggle limpio para volver al "nada
// elegido en este subgrupo").
export async function selectExclusiveOption(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);
  const itemId = String(formData.get("itemId"));
  const item = await prisma.mealItem.findUnique({
    where: { id: itemId },
    select: { mealId: true, subType: true, selected: true },
  });
  if (!item) return;

  if (item.selected) {
    await prisma.mealItem.update({ where: { id: itemId }, data: { selected: false } });
  } else {
    await prisma.$transaction([
      prisma.mealItem.updateMany({
        where: { mealId: item.mealId, subType: item.subType, NOT: { id: itemId } },
        data: { selected: false },
      }),
      prisma.mealItem.update({ where: { id: itemId }, data: { selected: true } }),
    ]);
  }
  revalidatePath(`/planes/${planId}`);
}

// Edita el texto descriptivo de una opción. Autosave desde la UI.
export async function updateOptionText(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);
  const itemId = String(formData.get("itemId"));
  const text = parseStr(formData.get("text")) ?? "";
  await prisma.mealItem.update({
    where: { id: itemId },
    data: { nameSnapshot: text.slice(0, 1000) },
  });
  // No revalidamos para no romper foco/scroll mientras teclean. El componente
  // ya tiene el estado local correcto.
}

// Edita el texto Y re-estima sus macros con IA en una sola operación. Se
// llama desde la UI cuando el nutri modifica el texto de una opción:
// el cliente debounce ~1.5 s y luego dispara esta acción. Devuelve los
// macros estimados para que la UI actualice los inputs sin recargar.
export async function updateOptionTextAndEstimate(
  planId: string,
  itemId: string,
  text: string,
): Promise<{ kcal: number; protein: number; carbs: number; fat: number; source: "ai" | "fallback" }> {
  const prof = await requireAccess();
  await loadPlanForEdit(planId, prof);
  const trimmed = text.slice(0, 1000);
  const { estimateMacros } = await import("@/lib/macroEstimator");
  const macros = await estimateMacros(trimmed);
  await prisma.mealItem.update({
    where: { id: itemId },
    data: {
      nameSnapshot: trimmed,
      // Convención freestyle: quantityG=100, *Per100 = totales.
      quantityG: 100,
      kcalPer100: macros.kcal,
      proteinPer100: macros.protein,
      carbsPer100: macros.carbs,
      fatPer100: macros.fat,
      // Si el estimador devolvió ingredientes, los pisamos. Si no devolvió
      // ninguno (texto raro), los dejamos como null para no enseñar al
      // cliente una lista con basura.
      ingredients:
        macros.ingredients && macros.ingredients.length > 0
          ? (macros.ingredients as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
    },
  });
  return {
    kcal: macros.kcal,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat,
    source: macros.source,
  };
}

// Edita los 4 macros (totales) de una opción. Autosave desde la UI.
export async function updateOptionMacros(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);
  const itemId = String(formData.get("itemId"));
  const kcal = parseNumber(formData.get("kcal")) ?? 0;
  const protein = parseNumber(formData.get("protein")) ?? 0;
  const carbs = parseNumber(formData.get("carbs")) ?? 0;
  const fat = parseNumber(formData.get("fat")) ?? 0;
  await prisma.mealItem.update({
    where: { id: itemId },
    data: {
      quantityG: 100,
      kcalPer100: kcal,
      proteinPer100: protein,
      carbsPer100: carbs,
      fatPer100: fat,
    },
  });
  // No revalidamos en cada teclazo; la suma se recalcula en cliente.
}

// Genera la estructura inicial de un plan con Harris-Benedict:
// 1) Calcula objetivos (kcal/prot/carbs/grasa) a partir del perfil del cliente
//    y la config global de macros (/biblioteca/macros).
// 2) Persiste los objetivos en MacroTargets (campos *Training; rest = -10%).
// 3) Borra los días/comidas/items existentes del plan.
// 4) Crea 1 día con 5 comidas estándar (desayuno, media mañana, comida,
//    merienda, cena) y 3 opciones placeholder vacías por comida.
export async function generatePlanFromHB(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  const plan = await loadPlanForEdit(planId, prof);

  const client = await prisma.client.findUnique({
    where: { id: plan.clientId },
    include: { profile: true },
  });
  if (!client) return;

  const { getMacroConfig } = await import("@/lib/macroConfig");
  const { computeTargets } = await import("@/lib/harrisBenedict");
  const config = await getMacroConfig();
  const targets = computeTargets(
    {
      sex: client.profile?.sex ?? null,
      birthDate: client.profile?.birthDate ?? null,
      heightCm: client.profile?.heightCm ?? null,
      weightKg: client.profile?.weightKg ?? null,
      weeklyFrequency: client.profile?.weeklyFrequency ?? null,
      goal: client.profile?.goal ?? null,
    },
    config,
  );

  if (targets) {
    // Solo un set de macros (entreno). Las columnas *Rest quedan a null —
    // ya no diferenciamos día de descanso.
    await prisma.macroTargets.upsert({
      where: { clientId: client.id },
      create: {
        clientId: client.id,
        kcalTraining: targets.kcal,
        proteinTraining: targets.protein,
        carbsTraining: targets.carbs,
        fatTraining: targets.fat,
        kcalRest: null,
        proteinRest: null,
        carbsRest: null,
        fatRest: null,
      },
      update: {
        kcalTraining: targets.kcal,
        proteinTraining: targets.protein,
        carbsTraining: targets.carbs,
        fatTraining: targets.fat,
        kcalRest: null,
        proteinRest: null,
        carbsRest: null,
        fatRest: null,
      },
    });
  }

  // Limpiamos y recreamos la estructura del plan.
  await prisma.planDay.deleteMany({ where: { planId } });

  const day = await prisma.planDay.create({
    data: { planId, name: "Día tipo", dayType: "entreno", order: 0 },
  });

  const MEAL_TEMPLATES = [
    { name: "desayuno", order: 0 },
    { name: "media_manana", order: 1 },
    { name: "comida", order: 2 },
    { name: "merienda", order: 3 },
    { name: "cena", order: 4 },
  ];

  // Subgrupos por defecto para comida/cena (orden y nº de opciones placeholder).
  const COMPOSED_GROUPS: { subType: string; count: number }[] = [
    { subType: "intro", count: 1 },
    { subType: "grasas", count: 3 },
    { subType: "carbos", count: 3 },
    { subType: "proteina", count: 3 },
    { subType: "postre", count: 1 },
  ];

  for (const m of MEAL_TEMPLATES) {
    const meal = await prisma.meal.create({
      data: { planDayId: day.id, name: m.name, order: m.order },
    });
    const isComposed = m.name === "comida" || m.name === "cena";

    if (isComposed) {
      // 11 opciones repartidas por subgrupo, sin macros sugeridas (cada
      // alimento aporta solo su parte; sumarlas equivaldría a la comida).
      let order = 0;
      for (const g of COMPOSED_GROUPS) {
        for (let i = 0; i < g.count; i++) {
          await prisma.mealItem.create({
            data: {
              mealId: meal.id,
              foodId: null,
              nameSnapshot: "",
              quantityG: 100,
              kcalPer100: 0,
              proteinPer100: 0,
              carbsPer100: 0,
              fatPer100: 0,
              subType: g.subType,
              selected: i === 0, // primera de cada subgrupo
              order: order++,
            },
          });
        }
      }
    } else {
      // 3 opciones planas como hasta ahora, con pista de macros (1/5 del total).
      const splitKcal = targets ? Math.round(targets.kcal / 5) : 0;
      const splitProt = targets ? Math.round(targets.protein / 5) : 0;
      const splitCarb = targets ? Math.round(targets.carbs / 5) : 0;
      const splitFat = targets ? Math.round(targets.fat / 5) : 0;
      for (let i = 0; i < 3; i++) {
        await prisma.mealItem.create({
          data: {
            mealId: meal.id,
            foodId: null,
            nameSnapshot: "",
            quantityG: 100,
            kcalPer100: splitKcal,
            proteinPer100: splitProt,
            carbsPer100: splitCarb,
            fatPer100: splitFat,
            selected: i === 0,
            order: i,
          },
        });
      }
    }
  }

  revalidatePath(`/planes/${planId}`);
}
