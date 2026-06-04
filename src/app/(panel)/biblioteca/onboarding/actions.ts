"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import {
  getOnboardingFormConfig,
  resetOnboardingFormConfig,
  saveOnboardingFormConfig,
} from "@/lib/onboardingFormConfig";
import {
  isCriticalField,
  type OnboardingFormConfigShape,
} from "@/lib/onboarding-form";

async function requireManager() {
  const prof = await requireProfessional();
  if (!isManager(prof.role)) redirect("/biblioteca");
  return prof;
}

export async function saveOnboardingConfigAction(payload: OnboardingFormConfigShape) {
  await requireManager();
  // Saneo: criticos siempre required/visibles; trim de strings.
  const sanitized: OnboardingFormConfigShape = {
    contractText: payload.contractText?.trim() ? payload.contractText.trim() : null,
    sections: payload.sections.map((s) => ({
      id: s.id,
      title: s.title.trim() || "Sección",
      description: s.description?.trim() ? s.description.trim() : null,
      fields: s.fields.map((f) => {
        const critical = isCriticalField(f.id);
        return {
          id: f.id,
          label: f.label.trim() || f.id,
          hint: f.hint ?? null,
          type: f.type,
          options: f.options ?? undefined,
          required: critical ? true : !!f.required,
          hidden: critical ? false : !!f.hidden,
        };
      }),
    })),
  };
  await saveOnboardingFormConfig(sanitized);
  revalidatePath("/biblioteca/onboarding");
  revalidatePath("/cliente/onboarding");
}

export async function resetOnboardingConfigAction() {
  await requireManager();
  await resetOnboardingFormConfig();
  revalidatePath("/biblioteca/onboarding");
  revalidatePath("/cliente/onboarding");
}

export async function getCurrentOnboardingConfig(): Promise<OnboardingFormConfigShape> {
  await requireManager();
  return getOnboardingFormConfig();
}
