import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Resumen ligero de cada plan de un cliente para pintar las cards de la
 * galería (tanto en /cliente/plan como en /clientes/[id]?tab=plan). Calcula
 * los macros del "día tipo" (el primero) sumando solo los items marcados
 * como `selected = true` — eso ya es lo que verá el atleta como su
 * combinación principal.
 *
 * Sirve también de fuente para los donuts/pills de la card sin tener que
 * cargar el plan completo con loadPlanForBuilder.
 */

export type PlanCardData = {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  competitionName: string | null;
  dayCount: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** true cuando el plan no tiene ninguna comida todavía (recién creado). */
  isEmpty: boolean;
};

export async function getPlanCardsForClient(clientId: string): Promise<PlanCardData[]> {
  const plans = await prisma.nutritionPlan.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    include: {
      days: {
        orderBy: { order: "asc" },
        take: 1, // solo el "día tipo" — es lo que necesitamos para la card.
        include: {
          meals: {
            include: {
              items: {
                where: { selected: true },
                select: {
                  quantityG: true,
                  foodId: true,
                  kcalPer100: true,
                  proteinPer100: true,
                  carbsPer100: true,
                  fatPer100: true,
                },
              },
            },
          },
        },
      },
      _count: { select: { days: true } },
    },
  });

  return plans.map((p) => {
    let kcal = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;
    let itemCount = 0;
    for (const day of p.days) {
      for (const meal of day.meals) {
        for (const it of meal.items) {
          // Convención: si es freestyle (foodId === null) los *Per100 son
          // TOTALES directos; si tiene foodId, son por 100 g y escalan con
          // quantityG. Misma lógica que en PlanBuilder.itemMacros.
          const factor = it.foodId ? it.quantityG / 100 : 1;
          kcal += it.kcalPer100 * factor;
          protein += it.proteinPer100 * factor;
          carbs += it.carbsPer100 * factor;
          fat += it.fatPer100 * factor;
          itemCount++;
        }
      }
    }
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      kind: p.kind,
      competitionName: p.competitionName,
      dayCount: p._count.days,
      kcal: Math.round(kcal),
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat),
      isEmpty: itemCount === 0,
    };
  });
}
