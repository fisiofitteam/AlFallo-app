import "server-only";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ONBOARDING_CONFIG,
  withCriticalGuard,
  type OnboardingFormConfigShape,
} from "@/lib/onboarding-form";

const SINGLETON_ID = "default";

// Lee la config o la crea con los defaults si no existe. Aplica el guard de
// críticos en cada lectura, así una fila vieja en BD no rompe HB.
export async function getOnboardingFormConfig(): Promise<OnboardingFormConfigShape> {
  const row = await prisma.onboardingFormConfig.findUnique({ where: { id: SINGLETON_ID } });
  if (!row) {
    const created = await prisma.onboardingFormConfig.create({
      data: { id: SINGLETON_ID, sections: DEFAULT_ONBOARDING_CONFIG.sections },
    });
    return withCriticalGuard({ sections: created.sections as OnboardingFormConfigShape["sections"] });
  }
  return withCriticalGuard({
    sections: row.sections as OnboardingFormConfigShape["sections"],
  });
}

export async function saveOnboardingFormConfig(next: OnboardingFormConfigShape): Promise<void> {
  const safe = withCriticalGuard(next);
  await prisma.onboardingFormConfig.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, sections: safe.sections },
    update: { sections: safe.sections },
  });
}

export async function resetOnboardingFormConfig(): Promise<void> {
  await saveOnboardingFormConfig(DEFAULT_ONBOARDING_CONFIG);
}
