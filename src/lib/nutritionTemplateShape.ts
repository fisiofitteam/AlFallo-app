/**
 * Tipos y helpers PUROS de plantilla nutricional. Sin acceso a base de
 * datos ni a server-only. Importable desde Server Components, Client
 * Components y server actions sin restricciones.
 *
 * El módulo con server-only (queries, applyToPlan) vive en
 * src/lib/nutritionTemplates.ts y reexporta estos tipos.
 */

export const TEMPLATE_SEXES = ["hombre", "mujer"] as const;
export type TemplateSex = (typeof TEMPLATE_SEXES)[number];

export const TEMPLATE_GOALS = [
  "recomposicion",
  "perdida-grasa",
  "ganancia-musculo",
] as const;
export type TemplateGoal = (typeof TEMPLATE_GOALS)[number];

export const TEMPLATE_GOAL_LABELS: Record<TemplateGoal, string> = {
  recomposicion: "Recomposición",
  "perdida-grasa": "Pérdida de grasa",
  "ganancia-musculo": "Ganancia de masa muscular",
};

export const TEMPLATE_SEX_LABELS: Record<TemplateSex, string> = {
  hombre: "Hombre",
  mujer: "Mujer",
};

export function isTemplateSex(v: string | null | undefined): v is TemplateSex {
  return !!v && (TEMPLATE_SEXES as readonly string[]).includes(v);
}
export function isTemplateGoal(v: string | null | undefined): v is TemplateGoal {
  return !!v && (TEMPLATE_GOALS as readonly string[]).includes(v);
}

// JSON estructurado de la plantilla. Mismo shape que el editor.
export type TemplateOption = {
  text: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  subType?: string | null;
  /** Nota libre del nutri para el atleta (elaboración, tip, aclaración).
   *  No entra en el cálculo de macros. */
  note?: string | null;
};
export type TemplateMeal = {
  name: string;
  options: TemplateOption[];
};
export type TemplateDay = {
  name: string;
  dayType: string;
  meals: TemplateMeal[];
};
export type TemplateStructure = {
  days: TemplateDay[];
};

const COMPOSED_SUBTYPES = ["intro", "grasas", "carbos", "proteina", "postre"] as const;

/** Una comida es "compuesta" (con subgrupos intro/grasas/carbos/proteina/
 *  postre) si alguna de sus opciones lleva subType. Antes se inferíamos por
 *  el nombre ("comida"/"cena") pero el nutri puede renombrar libremente, así
 *  que ahora va por los datos — igual que el PlanBuilder y la vista del
 *  cliente. */
export function isComposedMeal(meal: TemplateMeal): boolean {
  return meal.options.some((o) => o.subType != null && o.subType !== "");
}

/** Suma la combinación canónica del día (1 opción de cada comida simple +
 *  1 opción de cada subgrupo de comida/cena). */
export function sumCanonicalDay(day: TemplateDay): {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  let kcal = 0,
    protein = 0,
    carbs = 0,
    fat = 0;
  for (const meal of day.meals) {
    if (isComposedMeal(meal)) {
      for (const sub of COMPOSED_SUBTYPES) {
        const pick = meal.options.find((o) => o.subType === sub);
        if (!pick) continue;
        kcal += pick.kcal || 0;
        protein += pick.protein || 0;
        carbs += pick.carbs || 0;
        fat += pick.fat || 0;
      }
    } else {
      const pick = meal.options[0];
      if (!pick) continue;
      kcal += pick.kcal || 0;
      protein += pick.protein || 0;
      carbs += pick.carbs || 0;
      fat += pick.fat || 0;
    }
  }
  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  };
}

export function sumCanonical(structure: TemplateStructure): {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  const first = structure.days?.[0];
  if (!first) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  return sumCanonicalDay(first);
}

/** Plantilla vacía con la estructura estándar:
 *  desayuno · media_manana · comida (con subgrupos) · merienda · cena. */
export function emptyStructure(): TemplateStructure {
  const composedSubs = COMPOSED_SUBTYPES.map((s) => ({
    text: "",
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    subType: s,
  }));
  return {
    days: [
      {
        name: "Día tipo",
        dayType: "entreno",
        meals: [
          { name: "desayuno", options: [{ text: "", kcal: 0, protein: 0, carbs: 0, fat: 0 }] },
          {
            name: "media_manana",
            options: [{ text: "", kcal: 0, protein: 0, carbs: 0, fat: 0 }],
          },
          { name: "comida", options: composedSubs },
          { name: "merienda", options: [{ text: "", kcal: 0, protein: 0, carbs: 0, fat: 0 }] },
          { name: "cena", options: composedSubs.map((o) => ({ ...o })) },
        ],
      },
    ],
  };
}
