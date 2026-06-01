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

  redirect(`/planes/${plan.id}`);
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

export async function deleteMeal(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  await loadPlanForEdit(planId, prof);
  await prisma.meal.delete({ where: { id: String(formData.get("mealId")) } });
  revalidatePath(`/planes/${planId}`);
}

// Genera un borrador completo del plan con IA (Claude) o plantilla fallback.
// Se aplica sobre un plan existente; añade los días/comidas/items respetando el orden.
export async function generatePlanFromAI(formData: FormData) {
  const prof = await requireAccess();
  const planId = String(formData.get("planId"));
  const plan = await loadPlanForEdit(planId, prof);

  const client = await prisma.client.findUnique({
    where: { id: plan.clientId },
    include: { profile: true, macroTargets: true },
  });
  if (!client) return;

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
    kcalTraining: client.macroTargets?.kcalTraining ?? null,
    proteinTraining: client.macroTargets?.proteinTraining ?? null,
    carbsTraining: client.macroTargets?.carbsTraining ?? null,
    fatTraining: client.macroTargets?.fatTraining ?? null,
    kcalRest: client.macroTargets?.kcalRest ?? null,
    proteinRest: client.macroTargets?.proteinRest ?? null,
    carbsRest: client.macroTargets?.carbsRest ?? null,
    fatRest: client.macroTargets?.fatRest ?? null,
  });

  const existingDaysCount = await prisma.planDay.count({ where: { planId } });
  for (let di = 0; di < draft.days.length; di++) {
    const d = draft.days[di];
    const newDay = await prisma.planDay.create({
      data: { planId, name: d.name, dayType: d.dayType, order: existingDaysCount + di },
    });
    for (let mi = 0; mi < d.meals.length; mi++) {
      const m = d.meals[mi];
      const newMeal = await prisma.meal.create({
        data: { planDayId: newDay.id, name: m.name, order: mi },
      });
      for (let ii = 0; ii < m.items.length; ii++) {
        const it = m.items[ii];
        await prisma.mealItem.create({
          data: {
            mealId: newMeal.id,
            foodId: null,
            nameSnapshot: it.text,
            quantityG: 100,
            kcalPer100: it.kcal,
            proteinPer100: it.protein,
            carbsPer100: it.carbs,
            fatPer100: it.fat,
            order: ii,
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
      order: count,
    },
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
