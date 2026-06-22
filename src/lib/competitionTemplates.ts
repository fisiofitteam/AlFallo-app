import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Plantillas de plan de competición. La idea: el equipo curra plantillas
 * realistas (Hyrox, CrossFit Open, Maratón…) y cada vez que un atleta va a
 * competir el nutri elige la plantilla más cercana y se la asigna como plan
 * nuevo. Después la ajusta en PlanBuilder para ese atleta concreto.
 *
 * La estructura completa (días/comidas/opciones) vive en `structure` (JSON)
 * para no inflar el schema con tablas paralelas. Al aplicar, se copian las
 * filas a NutritionPlan + PlanDay + Meal + MealItem como si las hubiera
 * generado la IA.
 */

export type TemplateOption = {
  text: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Solo en comida/cena: intro|grasas|carbos|proteina|postre. */
  subType?: string | null;
  /** Opción marcada como "selected" en el plan resultante. Por defecto, la
   *  primera de cada (sub)grupo. */
  selected?: boolean;
};

export type TemplateMeal = {
  /** desayuno | media_manana | comida | merienda | cena | snack_*  */
  name: string;
  options: TemplateOption[];
};

export type TemplateDay = {
  name: string;
  dayType: string; // "entreno" siempre (ver lib/nutrition.DAY_TYPES)
  meals: TemplateMeal[];
};

export type TemplateStructure = { days: TemplateDay[] };

export type CompetitionTemplateDTO = {
  id: string;
  name: string;
  description: string | null;
  notes: string | null;
  supplementation: string | null;
  structure: TemplateStructure;
  createdAt: string;
  updatedAt: string;
};

export const EMPTY_TEMPLATE_STRUCTURE: TemplateStructure = { days: [] };

export function isTemplateStructure(value: unknown): value is TemplateStructure {
  if (!value || typeof value !== "object") return false;
  const days = (value as { days?: unknown }).days;
  return Array.isArray(days);
}

export async function getAllCompetitionTemplates(): Promise<CompetitionTemplateDTO[]> {
  const rows = await prisma.competitionPlanTemplate.findMany({
    orderBy: { name: "asc" },
  });
  return rows.map(toDTO);
}

export async function getCompetitionTemplate(id: string): Promise<CompetitionTemplateDTO | null> {
  const row = await prisma.competitionPlanTemplate.findUnique({ where: { id } });
  return row ? toDTO(row) : null;
}

function toDTO(row: {
  id: string;
  name: string;
  description: string | null;
  notes: string | null;
  supplementation: string | null;
  structure: unknown;
  createdAt: Date;
  updatedAt: Date;
}): CompetitionTemplateDTO {
  const structure = isTemplateStructure(row.structure) ? row.structure : EMPTY_TEMPLATE_STRUCTURE;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    notes: row.notes,
    supplementation: row.supplementation,
    structure,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Copia la estructura de una plantilla en un NutritionPlan recién creado.
 *  Borra cualquier estructura previa del plan (se asume que es vacío al
 *  llamar). También copia notes y supplementation si la plantilla los trae. */
export async function applyCompetitionTemplateToPlan(
  templateId: string,
  planId: string,
): Promise<void> {
  const tpl = await prisma.competitionPlanTemplate.findUnique({
    where: { id: templateId },
  });
  if (!tpl) return;
  const structure = isTemplateStructure(tpl.structure)
    ? tpl.structure
    : EMPTY_TEMPLATE_STRUCTURE;

  // Limpiar estructura previa del plan (por seguridad, aunque normalmente
  // se aplica en planes recién creados sin días).
  await prisma.planDay.deleteMany({ where: { planId } });

  // Copiar días/comidas/items.
  for (let di = 0; di < structure.days.length; di++) {
    const d = structure.days[di];
    const newDay = await prisma.planDay.create({
      data: {
        planId,
        name: d.name || `Día ${di + 1}`,
        dayType: d.dayType || "entreno",
        order: di,
      },
    });
    for (let mi = 0; mi < d.meals.length; mi++) {
      const m = d.meals[mi];
      const newMeal = await prisma.meal.create({
        data: { planDayId: newDay.id, name: m.name, order: mi },
      });
      // Para comida/cena con subgrupos: marcamos selected en la primera
      // opción de cada subgrupo si la plantilla no lo dijo explícitamente.
      // Para comidas simples: selected en la primera del array.
      const seenSubTypes = new Set<string>();
      for (let oi = 0; oi < m.options.length; oi++) {
        const o = m.options[oi];
        const sub = o.subType ?? null;
        let selected: boolean;
        if (typeof o.selected === "boolean") {
          selected = o.selected;
        } else if (sub) {
          selected = !seenSubTypes.has(sub);
          seenSubTypes.add(sub);
        } else {
          selected = oi === 0;
        }
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

  // Copiar notes + supplementation al plan si la plantilla los trae y el
  // plan está vacío en esos campos (no pisar lo que el nutri hubiera puesto
  // a mano).
  const plan = await prisma.nutritionPlan.findUnique({ where: { id: planId } });
  const patch: { notes?: string; supplementation?: string } = {};
  if (tpl.notes && tpl.notes.trim() && !plan?.notes) patch.notes = tpl.notes;
  if (tpl.supplementation && tpl.supplementation.trim() && !plan?.supplementation)
    patch.supplementation = tpl.supplementation;
  if (Object.keys(patch).length > 0) {
    await prisma.nutritionPlan.update({ where: { id: planId }, data: patch });
  }
}
