"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

  const plan = await prisma.nutritionPlan.create({
    data: {
      clientId,
      name: parseStr(formData.get("name")) ?? "Plan nutricional",
      goal: parseStr(formData.get("goal")),
      createdById: prof.id,
    },
  });

  // El builder se ve embebido dentro de la ficha del cliente; tras crear,
  // aterrizamos en la pestaña Plan con el nuevo plan seleccionado.
  redirect(`/clientes/${clientId}?tab=plan&planId=${plan.id}`);
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

// Cambia el tipo del día (entreno / descanso / mixto) para comparar macros
// contra los objetivos del cliente.
export async function setDayType(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);
  const dayType = parseStr(formData.get("dayType")) ?? "entreno";
  await prisma.planDay.update({
    where: { id: String(formData.get("dayId")) },
    data: { dayType },
  });
  revalidatePath(`/planes/${planId}`);
}

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
// Diferencia con generatePlanFromHB: aquí la IA escribe el contenido. HB
// solo crea placeholders vacíos con pista de macros.
export async function generatePlanFromAI(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  const plan = await loadPlanForEdit(planId, prof);

  const client = await prisma.client.findUnique({
    where: { id: plan.clientId },
    include: { profile: true, macroTargets: true },
  });
  if (!client) return;

  // 1) Calculamos/actualizamos los objetivos con HB para que la IA tenga
  //    cifras concretas a las que apuntar (y queden guardadas para el cliente).
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
    await prisma.macroTargets.upsert({
      where: { clientId: client.id },
      create: {
        clientId: client.id,
        kcalTraining: targets.kcal,
        proteinTraining: targets.protein,
        carbsTraining: targets.carbs,
        fatTraining: targets.fat,
        kcalRest: Math.round(targets.kcal * 0.9),
        proteinRest: targets.protein,
        carbsRest: Math.round(targets.carbs * 0.85),
        fatRest: targets.fat,
      },
      update: {
        kcalTraining: targets.kcal,
        proteinTraining: targets.protein,
        carbsTraining: targets.carbs,
        fatTraining: targets.fat,
        kcalRest: Math.round(targets.kcal * 0.9),
        proteinRest: targets.protein,
        carbsRest: Math.round(targets.carbs * 0.85),
        fatRest: targets.fat,
      },
    });
  }

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
    goal: client.profile?.goal ?? null,
    targetWeightKg: client.profile?.targetWeightKg ?? null,
    dietaryStyle: client.profile?.dietaryStyle ?? null,
    allergies: client.profile?.allergies ?? [],
    intolerances: client.profile?.intolerances ?? [],
    dislikes: client.profile?.dislikes ?? [],
    medicalConditions: client.profile?.medicalConditions ?? null,
    medication: client.profile?.medication ?? null,
    kcalTraining: targets?.kcal ?? client.macroTargets?.kcalTraining ?? null,
    proteinTraining: targets?.protein ?? client.macroTargets?.proteinTraining ?? null,
    carbsTraining: targets?.carbs ?? client.macroTargets?.carbsTraining ?? null,
    fatTraining: targets?.fat ?? client.macroTargets?.fatTraining ?? null,
    kcalRest: client.macroTargets?.kcalRest ?? null,
    proteinRest: client.macroTargets?.proteinRest ?? null,
    carbsRest: client.macroTargets?.carbsRest ?? null,
    fatRest: client.macroTargets?.fatRest ?? null,
    specialConsiderationIds: client.profile?.specialConsiderationIds ?? [],
  });

  // 3) Reset de la estructura del plan (igual que HB).
  await prisma.planDay.deleteMany({ where: { planId } });

  // 4) Persistimos las opciones generadas. Cada opción se guarda como
  //    MealItem freestyle (foodId=null, quantityG=100, *Per100 = totales).
  //    La primera opción de cada comida queda seleccionada por defecto.
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
        const selected = sub
          ? isFirstOfGroup
          : oi === 0;
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
          },
        });
      }
    }
  }

  if (!plan.notes) {
    const noteBase =
      draft.source === "ai"
        ? "Borrador generado con IA. Revísalo y ajústalo antes de mostrar al cliente."
        : "Borrador genérico (sin IA). Edítalo para adaptarlo al cliente.";
    await prisma.nutritionPlan.update({ where: { id: planId }, data: { notes: noteBase } });
  }

  revalidatePath(`/planes/${planId}`);
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
    // -10% en kcal/carbos para día de descanso por defecto. Protein/Fat se mantienen.
    await prisma.macroTargets.upsert({
      where: { clientId: client.id },
      create: {
        clientId: client.id,
        kcalTraining: targets.kcal,
        proteinTraining: targets.protein,
        carbsTraining: targets.carbs,
        fatTraining: targets.fat,
        kcalRest: Math.round(targets.kcal * 0.9),
        proteinRest: targets.protein,
        carbsRest: Math.round(targets.carbs * 0.85),
        fatRest: targets.fat,
      },
      update: {
        kcalTraining: targets.kcal,
        proteinTraining: targets.protein,
        carbsTraining: targets.carbs,
        fatTraining: targets.fat,
        kcalRest: Math.round(targets.kcal * 0.9),
        proteinRest: targets.protein,
        carbsRest: Math.round(targets.carbs * 0.85),
        fatRest: targets.fat,
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
