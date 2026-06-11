import "server-only";
import { prisma } from "@/lib/prisma";
import type { PlanBuilderDay, PlanBuilderTargets } from "@/components/PlanBuilder";

export type LoadedPlan = {
  plan: {
    id: string;
    name: string;
    clientId: string;
    client: { fullName: string };
    notes: string | null;
    supplementation: string | null;
  };
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
      client: { include: { macroTargets: true } },
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

  const targets: PlanBuilderTargets = {
    kcal: plan.client.macroTargets?.kcalTraining ?? null,
    protein: plan.client.macroTargets?.proteinTraining ?? null,
    carbs: plan.client.macroTargets?.carbsTraining ?? null,
    fat: plan.client.macroTargets?.fatTraining ?? null,
  };

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
        };
      }),
    })),
  }));

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      clientId: plan.clientId,
      client: { fullName: plan.client.fullName },
      notes: plan.notes,
      supplementation: plan.supplementation,
    },
    targets,
    days,
  };
}
