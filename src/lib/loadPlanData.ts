import "server-only";
import { prisma } from "@/lib/prisma";
import type { PlanBuilderDay, PlanBuilderTargets } from "@/components/PlanBuilder";

export type LoadedPlan = {
  plan: {
    id: string;
    name: string;
    kind: string;
    clientId: string;
    client: { fullName: string };
    notes: string | null;
    supplementation: string | null;
    // Overrides crudos por plan (si están set ganan sobre la ficha del
    // cliente). Permiten editar el target específico de este plan.
    kcalOverride: number | null;
    proteinOverride: number | null;
    carbsOverride: number | null;
    fatOverride: number | null;
  };
  /** Target efectivo contra el que se comparan los macros del plan. Si hay
   *  overrides del plan ganan; si no, los de la ficha del cliente. */
  targets: PlanBuilderTargets;
  days: PlanBuilderDay[];
};

/**
 * Carga un plan con toda la estructura que necesita <PlanBuilder> para
 * pintarse: targets del cliente + días con comidas y opciones (mealItems).
 * Reusado por /planes/[planId] (vista standalone) y por la pestaña Plan
 * dentro de /clientes/[id] (embebido).
 */
export async function loadPlanForBuilder(planId: string): Promise<LoadedPlan | null> {
  const plan = await prisma.nutritionPlan.findUnique({
    where: { id: planId },
    include: {
      client: true,
      days: {
        orderBy: { order: "asc" },
        include: {
          meals: {
            orderBy: { order: "asc" },
            include: { items: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });
  if (!plan) return null;

  // Override del plan. Si los 4 están set, son los targets que se muestran
  // en el SummaryCard. Si no, todo null y la UI dice "los calcula la IA".
  const hasOverride =
    plan.kcalOverride != null &&
    plan.proteinOverride != null &&
    plan.carbsOverride != null &&
    plan.fatOverride != null;
  const targets: PlanBuilderTargets = hasOverride
    ? {
        kcal: plan.kcalOverride,
        protein: plan.proteinOverride,
        carbs: plan.carbsOverride,
        fat: plan.fatOverride,
      }
    : { kcal: null, protein: null, carbs: null, fat: null };

  const days: PlanBuilderDay[] = plan.days.map((d) => ({
    id: d.id,
    name: d.name,
    dayType: d.dayType,
    meals: d.meals.map((m) => ({
      id: m.id,
      name: m.name,
      options: m.items.map((it) => {
        const factor = it.foodId ? it.quantityG / 100 : 1;
        return {
          id: it.id,
          text: it.nameSnapshot,
          kcal: Math.round(it.kcalPer100 * factor),
          protein: Math.round(it.proteinPer100 * factor * 10) / 10,
          carbs: Math.round(it.carbsPer100 * factor * 10) / 10,
          fat: Math.round(it.fatPer100 * factor * 10) / 10,
          selected: it.selected,
          subType: it.subType ?? null,
          dayContext: it.dayContext ?? null,
          note: it.note ?? null,
        };
      }),
    })),
  }));

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      kind: plan.kind,
      clientId: plan.clientId,
      client: { fullName: plan.client.fullName },
      notes: plan.notes,
      supplementation: plan.supplementation,
      kcalOverride: plan.kcalOverride,
      proteinOverride: plan.proteinOverride,
      carbsOverride: plan.carbsOverride,
      fatOverride: plan.fatOverride,
    },
    targets,
    days,
  };
}
