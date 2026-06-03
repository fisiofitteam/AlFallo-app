import { requireProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import { getOnboardingFormConfig } from "@/lib/onboardingFormConfig";
import { OnboardingFormEditor } from "@/components/OnboardingFormEditor";

export const metadata = { title: "Formulario inicial · Biblioteca" };
export const dynamic = "force-dynamic";

export default async function OnboardingFormTab() {
  const prof = await requireProfessional();
  if (!isManager(prof.role)) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
        Solo CEO y Head Coach pueden editar el formulario de onboarding.
      </p>
    );
  }
  const config = await getOnboardingFormConfig();
  return <OnboardingFormEditor initial={config} />;
}
