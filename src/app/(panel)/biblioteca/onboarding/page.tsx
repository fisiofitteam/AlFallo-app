import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import { getOnboardingFormConfig } from "@/lib/onboardingFormConfig";
import { CONTRACT_TEXT } from "@/lib/contract";
import { OnboardingFormEditor } from "@/components/OnboardingFormEditor";

export const metadata = { title: "Formulario inicial · Biblioteca" };
export const dynamic = "force-dynamic";

export default async function OnboardingFormTab() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
        Solo el equipo de nutrición puede editar el formulario de onboarding.
      </p>
    );
  }
  const config = await getOnboardingFormConfig();
  return <OnboardingFormEditor initial={config} defaultContract={CONTRACT_TEXT} />;
}
