import "server-only";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ONBOARDING_CONFIG,
  withCriticalGuard,
  type OnboardingFormConfigShape,
} from "@/lib/onboarding-form";

const SINGLETON_ID = "default";

export async function getOnboardingFormConfig(): Promise<OnboardingFormConfigShape> {
  const row = await prisma.onboardingFormConfig.findUnique({ where: { id: SINGLETON_ID } });
  if (!row) {
    const created = await prisma.onboardingFormConfig.create({
      data: {
        id: SINGLETON_ID,
        sections: DEFAULT_ONBOARDING_CONFIG.sections,
        contractText: null,
      },
    });
    return withCriticalGuard({
      sections: created.sections as OnboardingFormConfigShape["sections"],
      contractText: created.contractText,
    });
  }
  return withCriticalGuard({
    sections: row.sections as OnboardingFormConfigShape["sections"],
    contractText: row.contractText,
  });
}

export async function saveOnboardingFormConfig(next: OnboardingFormConfigShape): Promise<void> {
  const safe = withCriticalGuard(next);
  await prisma.onboardingFormConfig.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      sections: safe.sections,
      contractText: safe.contractText ?? null,
    },
    update: {
      sections: safe.sections,
      contractText: safe.contractText ?? null,
    },
  });
}

export async function resetOnboardingFormConfig(): Promise<void> {
  await saveOnboardingFormConfig(DEFAULT_ONBOARDING_CONFIG);
}
