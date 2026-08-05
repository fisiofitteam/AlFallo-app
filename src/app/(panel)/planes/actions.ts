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

  // Tipo de plan:
  //  - "regular" → pauta nutricional. Se aplica una plantilla nutricional
  //    (NutritionTemplate) seleccionada por el nutri (sex × goal).
  //  - "competition" → plan puntual de una prueba. Se aplica una plantilla
  //    de competición (CompetitionPlanTemplate).
  // En ambos casos se copia la estructura tal cual al plan y el nutri la
  // ajusta en el builder. NO hay generación con IA.
  const kindRaw = parseStr(formData.get("kind"));
  const isCompetition = kindRaw === "competition";

  // Validamos que venga la plantilla correspondiente ANTES de crear nada.
  const nutritionTemplateId = parseStr(formData.get("nutritionTemplateId"));
  const competitionTemplateId = parseStr(formData.get("competitionTemplateId"));
  if (isCompetition && !competitionTemplateId) {
    return { error: "Selecciona una plantilla de competición." };
  }
  if (!isCompetition && !nutritionTemplateId) {
    return { error: "Selecciona una plantilla nutricional." };
  }

  const plan = await prisma.nutritionPlan.create({
    data: {
      clientId,
      name: parseStr(formData.get("name")) ?? "Plan nutricional",
      description: parseStr(formData.get("description")),
      createdById: prof.id,
      kind: isCompetition ? "competition" : "regular",
      competitionName: null,
      competitionContext: null,
    },
  });

  try {
    if (isCompetition && competitionTemplateId) {
      const { applyCompetitionTemplateToPlan } = await import(
        "@/lib/competitionTemplates"
      );
      await applyCompetitionTemplateToPlan(competitionTemplateId, plan.id);
    } else if (nutritionTemplateId) {
      const { applyTemplateToPlan } = await import("@/lib/nutritionTemplates");
      await applyTemplateToPlan(nutritionTemplateId, plan.id);
    }
  } catch (e) {
    console.warn("[createPlan] applyTemplate failed:", (e as Error).message);
  }

  return {
    ok: true as const,
    planId: plan.id,
    clientId,
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

/** Editar el override de macros de un plan existente. Si los 4 vienen con
 *  valor, se persisten y se usarán en la próxima generación. Si los 4 vienen
 *  en blanco, se LIMPIAN (vuelven a null) y el plan pasa a usar los macros
 *  oficiales de la ficha. Mixtos se ignoran (todo o nada).
 *  Devuelve el estado final por si la UI quiere reflejarlo. */
export async function updatePlanMacroOverride(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  const plan = await loadPlanForEdit(planId, prof);

  const kcal = parseNumber(formData.get("kcalOverride"));
  const protein = parseNumber(formData.get("proteinOverride"));
  const carbs = parseNumber(formData.get("carbsOverride"));
  const fat = parseNumber(formData.get("fatOverride"));

  const allFilled = kcal != null && protein != null && carbs != null && fat != null;
  const allEmpty = kcal == null && protein == null && carbs == null && fat == null;

  if (!allFilled && !allEmpty) {
    // Parcial → ignoramos (todo o nada). Devolvemos sin tocar BD.
    return { ok: false as const, error: "Rellena los cuatro o déjalos todos en blanco." };
  }

  await prisma.nutritionPlan.update({
    where: { id: planId },
    data: {
      kcalOverride: allEmpty ? null : kcal,
      proteinOverride: allEmpty ? null : protein,
      carbsOverride: allEmpty ? null : carbs,
      fatOverride: allEmpty ? null : fat,
    },
  });
  revalidatePath(`/clientes/${plan.clientId}`);
  revalidatePath(`/planes/${planId}`);
  return { ok: true as const };
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

// (Eliminado el flujo de generación con IA: previewPlanGeneration,
//  acceptPlanDraft, rejectPlanDraft, regeneratePlanDraft y el CRUD de
//  PlanGenerationRule / PlanGenerationFeedback / PlanGenerationDraft.
//  Los planes ahora se crean desde plantillas (NutritionTemplate /
//  CompetitionPlanTemplate). La IA solo recalcula macros de UNA opción
//  cuando el nutri edita su texto — esa lógica vive en
//  updateOptionTextAndEstimate, intacta.)

// (Eliminado: DraftPayload, DRAFT_TTL_MS, runDraftGeneration, commitDraft.
//  Todo el ciclo "preview → revisar → commit" desaparece con el flujo IA.)

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
  const rawCtx = parseStr(formData.get("dayContext"));
  const dayContext = rawCtx === "training" || rawCtx === "rest" ? rawCtx : null;
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
      dayContext,
      order: count,
    },
  });
  revalidatePath(`/planes/${planId}`);
}

// Mueve una opción arriba/abajo DENTRO de su grupo (mismo mealId + subType +
// dayContext). Antes de intercambiar reindexamos el grupo a 0..n-1 para
// auto-reparar planes viejos cuyos items podían tener order=0 todos (los
// addOptionToMeal originales asignaban count() pero plantillas y migraciones
// no siempre respetaban orden). Así el primer clic ya deja el grupo estable.
export async function moveMealItem(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);
  const itemId = String(formData.get("itemId"));
  const direction = String(formData.get("direction")); // "up" | "down"
  const item = await prisma.mealItem.findUnique({
    where: { id: itemId },
    select: { id: true, mealId: true, subType: true, dayContext: true },
  });
  if (!item) return;

  const siblings = await prisma.mealItem.findMany({
    where: {
      mealId: item.mealId,
      subType: item.subType,
      dayContext: item.dayContext,
    },
    orderBy: [{ order: "asc" }, { id: "asc" }],
    select: { id: true, order: true },
  });

  const idx = siblings.findIndex((s) => s.id === itemId);
  if (idx === -1) return;
  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= siblings.length) return;

  // Reindexado + swap en una sola transacción.
  const desired = [...siblings];
  [desired[idx], desired[target]] = [desired[target], desired[idx]];
  await prisma.$transaction(
    desired.map((s, i) =>
      prisma.mealItem.update({ where: { id: s.id }, data: { order: i } }),
    ),
  );
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

// Edita la nota libre de una opción. Texto que ve el atleta bajo la opción,
// sin efecto sobre macros ni compra. Autosave desde la UI.
export async function updateOptionNote(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);
  const itemId = String(formData.get("itemId"));
  const raw = formData.get("note");
  const note = typeof raw === "string" && raw.trim().length > 0 ? raw.slice(0, 1000) : null;
  await prisma.mealItem.update({ where: { id: itemId }, data: { note } });
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

// (Eliminado: generatePlanFromHB. Se basaba en Harris-Benedict + porcentajes
//  de /biblioteca/macros — pantalla y helpers ya borrados. El cálculo de
//  macros vive ahora 100% en la IA siguiendo el brief global.)
