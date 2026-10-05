import "server-only";
import { prisma } from "@/lib/prisma";
import {
  sumCanonical,
  type TemplateSex,
  type TemplateGoal,
  type TemplateStructure,
} from "@/lib/nutritionTemplateShape";

// Reexportamos los tipos puros para conveniencia: muchos sitios solo
// necesitan tirar de un único módulo.
export * from "@/lib/nutritionTemplateShape";

/**
 * Lectura/escritura de NutritionTemplate. Las queries que tocan BD viven
 * aquí (server-only). Tipos y helpers de cálculo: nutritionTemplateShape.ts.
 */

export async function listTemplates(filter?: {
  sex?: TemplateSex;
  goal?: TemplateGoal;
}) {
  const rows = await prisma.nutritionTemplate.findMany({
    where: {
      ...(filter?.sex ? { sex: filter.sex } : {}),
      ...(filter?.goal ? { goal: filter.goal } : {}),
    },
    orderBy: [{ sex: "asc" }, { goal: "asc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      sex: true,
      goal: true,
      name: true,
      description: true,
      structure: true,
      updatedAt: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    macros: sumCanonical(r.structure as unknown as TemplateStructure),
  }));
}

export async function getTemplate(id: string) {
  return prisma.nutritionTemplate.findUnique({ where: { id } });
}

/** Serializa un NutritionPlan a TemplateStructure para poder guardarlo como
 *  plantilla reutilizable. Se queda SOLO con la foto de los macros (lo que
 *  ya vive en MealItem) — no mantiene referencia a FoodLibrary para que la
 *  plantilla sea autosuficiente. */
export async function planToTemplateStructure(
  planId: string,
): Promise<TemplateStructure> {
  const days = await prisma.planDay.findMany({
    where: { planId },
    orderBy: { order: "asc" },
    include: {
      meals: {
        orderBy: { order: "asc" },
        include: { items: { orderBy: { order: "asc" } } },
      },
    },
  });
  return {
    days: days.map((d) => ({
      name: d.name,
      dayType: d.dayType,
      meals: d.meals.map((m) => ({
        name: m.name,
        options: m.items.map((it) => ({
          text: it.nameSnapshot,
          kcal: it.kcalPer100,
          protein: it.proteinPer100,
          carbs: it.carbsPer100,
          fat: it.fatPer100,
          subType: it.subType ?? null,
          dayContext: it.dayContext ?? null,
          note: it.note ?? null,
          selected: it.selected,
        })),
      })),
    })),
  };
}

/** Copia la plantilla seleccionada al NutritionPlan indicado. Borra los
 *  días/comidas/items existentes del plan y los crea desde la estructura
 *  de la plantilla. Usar al crear un plan con templateId. */
export async function applyTemplateToPlan(
  templateId: string,
  planId: string,
): Promise<void> {
  const template = await prisma.nutritionTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template) throw new Error("Plantilla no encontrada");

  const structure = template.structure as unknown as TemplateStructure;
  if (!structure?.days?.length) return;

  await prisma.planDay.deleteMany({ where: { planId } });

  const planFields: Record<string, string | null> = {};
  if (template.notes) planFields.notes = template.notes;
  if (template.supplementation) planFields.supplementation = template.supplementation;
  if (Object.keys(planFields).length > 0) {
    await prisma.nutritionPlan.update({ where: { id: planId }, data: planFields });
  }

  for (let di = 0; di < structure.days.length; di++) {
    const d = structure.days[di];
    const day = await prisma.planDay.create({
      data: {
        planId,
        name: d.name || "Día tipo",
        dayType: d.dayType || "entreno",
        order: di,
      },
    });
    for (let mi = 0; mi < d.meals.length; mi++) {
      const m = d.meals[mi];
      const meal = await prisma.meal.create({
        data: { planDayId: day.id, name: m.name, order: mi },
      });
      for (let oi = 0; oi < m.options.length; oi++) {
        const o = m.options[oi];
        await prisma.mealItem.create({
          data: {
            mealId: meal.id,
            foodId: null,
            nameSnapshot: o.text || "",
            quantityG: 100,
            kcalPer100: o.kcal || 0,
            proteinPer100: o.protein || 0,
            carbsPer100: o.carbs || 0,
            fatPer100: o.fat || 0,
            subType: o.subType ?? null,
            dayContext: o.dayContext ?? null,
            note: o.note ?? null,
            selected: oi === 0,
            order: oi,
          },
        });
      }
    }
  }
}
