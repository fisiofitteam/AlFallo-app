import "server-only";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_MACRO_CONFIG,
  type MacroCalcConfigShape,
} from "@/lib/harrisBenedict";

// Singleton: id fijo "default". Si no existe, lo creamos con los valores
// recomendados. La forma se guarda como Json en la BD pero la usamos
// tipada en código.
const SINGLETON_ID = "default";

export async function getMacroConfig(): Promise<MacroCalcConfigShape> {
  const row = await prisma.macroCalcConfig.findUnique({ where: { id: SINGLETON_ID } });
  if (!row) {
    const created = await prisma.macroCalcConfig.create({
      data: {
        id: SINGLETON_ID,
        activityMultipliers: DEFAULT_MACRO_CONFIG.activityMultipliers,
        goalAdjustments: DEFAULT_MACRO_CONFIG.goalAdjustments,
        macroDistribution: DEFAULT_MACRO_CONFIG.macroDistribution,
        formula: DEFAULT_MACRO_CONFIG.formula,
      },
    });
    return shape(created);
  }
  return shape(row);
}

export async function saveMacroConfig(next: MacroCalcConfigShape): Promise<void> {
  await prisma.macroCalcConfig.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      activityMultipliers: next.activityMultipliers,
      goalAdjustments: next.goalAdjustments,
      macroDistribution: next.macroDistribution,
      formula: next.formula,
    },
    update: {
      activityMultipliers: next.activityMultipliers,
      goalAdjustments: next.goalAdjustments,
      macroDistribution: next.macroDistribution,
      formula: next.formula,
    },
  });
}

export async function resetMacroConfig(): Promise<void> {
  await saveMacroConfig(DEFAULT_MACRO_CONFIG);
}

function shape(row: {
  activityMultipliers: unknown;
  goalAdjustments: unknown;
  macroDistribution: unknown;
  formula: string;
}): MacroCalcConfigShape {
  // Coerción defensiva: si en la BD hay algo viejo o corrupto, caemos al default.
  return {
    activityMultipliers: (row.activityMultipliers as MacroCalcConfigShape["activityMultipliers"]) ?? DEFAULT_MACRO_CONFIG.activityMultipliers,
    goalAdjustments: (row.goalAdjustments as MacroCalcConfigShape["goalAdjustments"]) ?? DEFAULT_MACRO_CONFIG.goalAdjustments,
    macroDistribution: (row.macroDistribution as MacroCalcConfigShape["macroDistribution"]) ?? DEFAULT_MACRO_CONFIG.macroDistribution,
    formula: row.formula ?? DEFAULT_MACRO_CONFIG.formula,
  };
}
