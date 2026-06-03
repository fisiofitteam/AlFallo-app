"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import { getMacroConfig, resetMacroConfig, saveMacroConfig } from "@/lib/macroConfig";
import { type MacroCalcConfigShape } from "@/lib/harrisBenedict";

async function requireManager() {
  const prof = await requireProfessional();
  if (!isManager(prof.role)) redirect("/biblioteca");
  return prof;
}

function num(value: FormDataEntryValue | null, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function saveMacroConfigAction(formData: FormData) {
  await requireManager();

  // Reusamos las claves actuales (no permitimos crear/borrar brackets desde
  // la UI v1 — solo editar valores). Cargamos para conservar las labels.
  const current = await getMacroConfig();

  const next: MacroCalcConfigShape = {
    formula: current.formula,
    activityMultipliers: { ...current.activityMultipliers },
    goalAdjustments: { ...current.goalAdjustments },
    macroDistribution: { ...current.macroDistribution },
  };

  // Factores de actividad: minFreq, maxFreq, factor
  for (const key of Object.keys(next.activityMultipliers)) {
    const cur = next.activityMultipliers[key];
    next.activityMultipliers[key] = {
      label: cur.label,
      minFreq: num(formData.get(`act_${key}_min`), cur.minFreq),
      maxFreq: num(formData.get(`act_${key}_max`), cur.maxFreq),
      factor: num(formData.get(`act_${key}_factor`), cur.factor),
    };
  }

  // Ajustes por objetivo: kcalDeltaPct
  for (const key of Object.keys(next.goalAdjustments)) {
    const cur = next.goalAdjustments[key];
    next.goalAdjustments[key] = {
      label: cur.label,
      kcalDeltaPct: num(formData.get(`goal_${key}_delta`), cur.kcalDeltaPct),
    };
  }

  // Distribución macros: protein/carbs/fat (en %)
  for (const key of Object.keys(next.macroDistribution)) {
    const cur = next.macroDistribution[key];
    next.macroDistribution[key] = {
      protein: num(formData.get(`split_${key}_protein`), cur.protein),
      carbs: num(formData.get(`split_${key}_carbs`), cur.carbs),
      fat: num(formData.get(`split_${key}_fat`), cur.fat),
    };
  }

  await saveMacroConfig(next);
  revalidatePath("/biblioteca/macros");
}

export async function resetMacroConfigAction() {
  await requireManager();
  await resetMacroConfig();
  revalidatePath("/biblioteca/macros");
}

