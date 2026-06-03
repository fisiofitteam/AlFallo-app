// Cálculo de macros objetivo (kcal/protein/carbs/fat) por el método
// Harris-Benedict revisado (Roza-Shizgal 1984), con factor de actividad y
// ajuste por objetivo. Los parámetros (multiplicadores, ajustes, distribución)
// son CONFIGURABLES desde /biblioteca/macros — el helper recibe la config
// que ya viene resuelta del DB.

export type ActivityBracket = {
  label: string;
  minFreq: number; // sesiones/semana (inclusive)
  maxFreq: number; // sesiones/semana (inclusive)
  factor: number;
};

export type GoalAdjustment = {
  label: string;
  kcalDeltaPct: number; // p.ej. -15 = -15% sobre TDEE
};

export type MacroSplit = {
  protein: number; // % de kcal
  carbs: number;
  fat: number;
};

export type MacroCalcConfigShape = {
  activityMultipliers: Record<string, ActivityBracket>;
  goalAdjustments: Record<string, GoalAdjustment>;
  macroDistribution: Record<string, MacroSplit>;
  formula: string;
};

export const DEFAULT_MACRO_CONFIG: MacroCalcConfigShape = {
  formula: "roza-shizgal",
  activityMultipliers: {
    sedentario: { label: "Sedentario (0-1 d/sem)", minFreq: 0, maxFreq: 1, factor: 1.2 },
    ligero: { label: "Ligero (2-3 d/sem)", minFreq: 2, maxFreq: 3, factor: 1.375 },
    moderado: { label: "Moderado (3-5 d/sem)", minFreq: 3, maxFreq: 5, factor: 1.55 },
    alto: { label: "Alto (6 d/sem)", minFreq: 6, maxFreq: 6, factor: 1.725 },
    muy_alto: { label: "Muy alto (7+ d/sem)", minFreq: 7, maxFreq: 99, factor: 1.9 },
  },
  goalAdjustments: {
    perdida_grasa: { label: "Pérdida de grasa", kcalDeltaPct: -15 },
    recomposicion: { label: "Recomposición", kcalDeltaPct: -5 },
    ganancia_masa: { label: "Ganancia de masa", kcalDeltaPct: 10 },
    rendimiento: { label: "Rendimiento", kcalDeltaPct: 5 },
    definicion: { label: "Definición", kcalDeltaPct: -10 },
  },
  macroDistribution: {
    perdida_grasa: { protein: 35, carbs: 35, fat: 30 },
    recomposicion: { protein: 30, carbs: 40, fat: 30 },
    ganancia_masa: { protein: 25, carbs: 50, fat: 25 },
    rendimiento: { protein: 25, carbs: 50, fat: 25 },
    definicion: { protein: 35, carbs: 35, fat: 30 },
  },
};

// Edad en años a partir de una fecha de nacimiento.
function ageFrom(birthDate: Date | null | undefined, ref: Date = new Date()): number {
  if (!birthDate) return 30; // fallback conservador
  let age = ref.getUTCFullYear() - birthDate.getUTCFullYear();
  const m = ref.getUTCMonth() - birthDate.getUTCMonth();
  if (m < 0 || (m === 0 && ref.getUTCDate() < birthDate.getUTCDate())) age--;
  return Math.max(15, Math.min(90, age));
}

// BMR por fórmula. Por ahora solo "roza-shizgal" (HB revisada).
function bmr(
  formula: string,
  sex: string | null,
  weightKg: number,
  heightCm: number,
  age: number,
): number {
  const isMale = (sex ?? "").toLowerCase().startsWith("m");
  // Roza-Shizgal (1984). Para "other" usamos la media de ambos sexos.
  const male = 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age;
  const female = 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.330 * age;
  if (sex === "male") return male;
  if (sex === "female") return female;
  // sex desconocido o "other"
  return (male + female) / 2;
}

// Selecciona el bracket de actividad que cubre la frecuencia semanal dada.
// Si nada matchea, cae al de menor factor (= sedentario).
function pickActivityFactor(
  config: MacroCalcConfigShape,
  weeklyFrequency: number | null | undefined,
): number {
  const freq = weeklyFrequency ?? 0;
  const brackets = Object.values(config.activityMultipliers);
  const hit = brackets.find((b) => freq >= b.minFreq && freq <= b.maxFreq);
  if (hit) return hit.factor;
  // Caer al mínimo.
  return Math.min(...brackets.map((b) => b.factor));
}

export type MacroTargets = {
  kcal: number;
  protein: number; // gramos
  carbs: number;
  fat: number;
};

export type HBInput = {
  sex: string | null;
  birthDate: Date | null;
  heightCm: number | null;
  weightKg: number | null;
  weeklyFrequency: number | null;
  goal: string | null;
};

/**
 * Calcula los macros objetivo del cliente con la config dada.
 * Si faltan datos críticos (peso, altura) devuelve null.
 */
export function computeTargets(
  profile: HBInput,
  config: MacroCalcConfigShape = DEFAULT_MACRO_CONFIG,
): MacroTargets | null {
  if (!profile.weightKg || !profile.heightCm) return null;
  const age = ageFrom(profile.birthDate ?? null);
  const baseBmr = bmr(config.formula, profile.sex, profile.weightKg, profile.heightCm, age);
  const activityFactor = pickActivityFactor(config, profile.weeklyFrequency);
  const tdee = baseBmr * activityFactor;

  const goalKey = profile.goal && config.goalAdjustments[profile.goal] ? profile.goal : "recomposicion";
  const adj = config.goalAdjustments[goalKey];
  const kcal = Math.round(tdee * (1 + adj.kcalDeltaPct / 100));

  const split = config.macroDistribution[goalKey] ?? { protein: 30, carbs: 40, fat: 30 };
  // 1g proteína = 4 kcal, 1g carbo = 4 kcal, 1g grasa = 9 kcal.
  const protein = Math.round((kcal * split.protein) / 100 / 4);
  const carbs = Math.round((kcal * split.carbs) / 100 / 4);
  const fat = Math.round((kcal * split.fat) / 100 / 9);
  return { kcal, protein, carbs, fat };
}
