// Constantes y cálculo de macros para la biblioteca de alimentos y los planes.

import type { Option } from "@/lib/clients";

export const FOOD_CATEGORY_OPTIONS: Option[] = [
  { value: "proteina", label: "Proteína" },
  { value: "carbohidrato", label: "Carbohidrato" },
  { value: "grasa", label: "Grasa" },
  { value: "verdura", label: "Verdura / Fruta" },
  { value: "lacteo", label: "Lácteo" },
  { value: "suplemento", label: "Suplemento" },
  { value: "otro", label: "Otro" },
];

// Tipos de comida típicos de un atleta (incluye pre/post-WOD).
export const MEAL_TYPE_OPTIONS: Option[] = [
  { value: "desayuno", label: "Desayuno" },
  { value: "media_manana", label: "Media mañana" },
  { value: "pre_wod", label: "Pre-WOD" },
  { value: "post_wod", label: "Post-WOD" },
  { value: "comida", label: "Comida" },
  { value: "merienda", label: "Merienda" },
  { value: "cena", label: "Cena" },
  { value: "snack", label: "Snack" },
  { value: "otro", label: "Otro" },
];

export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

export const ZERO_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

// Tipos de día del plan, para comparar contra los objetivos del cliente.
export const DAY_TYPES = [
  { value: "entreno", label: "Día de entreno", emoji: "💪" },
  { value: "descanso", label: "Día de descanso", emoji: "🛌" },
  { value: "mixto", label: "Día mixto", emoji: "🔄" },
] as const;

export type DayType = (typeof DAY_TYPES)[number]["value"];

export function dayTypeLabel(value: string): string {
  return DAY_TYPES.find((d) => d.value === value)?.label ?? value;
}

export function dayTypeEmoji(value: string): string {
  return DAY_TYPES.find((d) => d.value === value)?.emoji ?? "";
}

// Calcula kcal a partir de macros con la fórmula clásica 4-9-4.
// Sirve para validar coherencia entre el kcal mostrado y los macros.
export function kcalFromMacros(protein: number, carbs: number, fat: number): number {
  return protein * 4 + fat * 9 + carbs * 4;
}

// Objetivos diarios para un tipo de día concreto, sacados del modelo MacroTargets.
export type DayTargets = { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null };

export function targetsForDayType(
  mt: {
    kcalTraining: number | null;
    proteinTraining: number | null;
    carbsTraining: number | null;
    fatTraining: number | null;
    kcalRest: number | null;
    proteinRest: number | null;
    carbsRest: number | null;
    fatRest: number | null;
  } | null,
  dayType: string,
): DayTargets {
  if (!mt) return { kcal: null, protein: null, carbs: null, fat: null };
  if (dayType === "descanso") {
    return {
      kcal: mt.kcalRest ?? mt.kcalTraining ?? null,
      protein: mt.proteinRest ?? mt.proteinTraining ?? null,
      carbs: mt.carbsRest ?? mt.carbsTraining ?? null,
      fat: mt.fatRest ?? mt.fatTraining ?? null,
    };
  }
  // entreno o mixto → usa el de entreno por defecto
  return {
    kcal: mt.kcalTraining ?? null,
    protein: mt.proteinTraining ?? null,
    carbs: mt.carbsTraining ?? null,
    fat: mt.fatTraining ?? null,
  };
}

// Compara una macro real con su objetivo. Devuelve el porcentaje y un estado
// (bajo / ok / alto) según el margen de tolerancia (±7% por defecto).
export type Comparison = { pct: number | null; state: "low" | "ok" | "high" | "none" };

export function compareToTarget(actual: number, target: number | null, marginPct = 7): Comparison {
  if (target == null || target <= 0) return { pct: null, state: "none" };
  const pct = (actual / target) * 100;
  if (pct < 100 - marginPct) return { pct, state: "low" };
  if (pct > 100 + marginPct) return { pct, state: "high" };
  return { pct, state: "ok" };
}

type PerHundred = {
  kcalPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
};

// Macros de un item del plan a partir de sus valores por 100 g y la cantidad.
export function itemMacros(item: PerHundred & { quantityG: number }): Macros {
  const f = item.quantityG / 100;
  return {
    kcal: item.kcalPer100 * f,
    protein: item.proteinPer100 * f,
    carbs: item.carbsPer100 * f,
    fat: item.fatPer100 * f,
  };
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
    }),
    { ...ZERO_MACROS },
  );
}

// Redondeo para mostrar (kcal entero, macros con 1 decimal).
export function fmtMacros(m: Macros): { kcal: string; protein: string; carbs: string; fat: string } {
  return {
    kcal: String(Math.round(m.kcal)),
    protein: round1(m.protein),
    carbs: round1(m.carbs),
    fat: round1(m.fat),
  };
}

function round1(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}
