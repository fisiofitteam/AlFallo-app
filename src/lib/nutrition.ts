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
