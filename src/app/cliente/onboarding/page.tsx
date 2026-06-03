import { redirect } from "next/navigation";
import { getActiveClient } from "@/lib/client-session";
import { getOnboardingFormConfig } from "@/lib/onboardingFormConfig";
import { CONTRACT_TEXT } from "@/lib/contract";
import { Field, SectionTitle, TextInput } from "@/components/form-ui";
import { BrandMark } from "@/components/brand-mark";
import { OnboardingFormRenderer } from "@/components/OnboardingFormRenderer";
import { submitOnboarding } from "../actions";

export const metadata = { title: "Onboarding · Al Fallo" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const client = await getActiveClient();
  if (!client) redirect("/cliente/login");
  if (client.onboardingComplete) redirect("/cliente");

  const config = await getOnboardingFormConfig();

  return (
    <main className="shell-cliente min-h-screen bg-bg text-text">
      <div className="mx-auto max-w-lg px-5 py-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={40} />
          <h1 className="mt-3 text-xl font-extrabold">¡Bienvenido/a, {client.fullName.split(" ")[0]}!</h1>
          <p className="mt-1 text-sm text-muted">
            Completa este cuestionario y acepta el contrato para empezar.
          </p>
        </div>

        <form action={submitOnboarding} className="space-y-8 rounded-2xl border border-border bg-surface p-5">
          {/* Bloques configurables desde /biblioteca/onboarding */}
          <OnboardingFormRenderer config={config} />

          {/* Contrato (no configurable: protege a la empresa, vive en lib/contract) */}
          <section>
            <SectionTitle>Contrato y consentimiento</SectionTitle>
            <div className="max-h-48 overflow-y-auto whitespace-pre-line rounded-xl border border-border bg-bg p-4 text-xs text-muted">
              {CONTRACT_TEXT}
            </div>
            <div className="mt-4 space-y-4">
              <Field label="Tu DNI / NIE" htmlFor="contractDNI">
                <TextInput id="contractDNI" name="contractDNI" required />
              </Field>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="acceptContract" required className="mt-1 h-4 w-4 accent-[#e6197e]" />
                <span>He leído y acepto el contrato, y consiento el tratamiento de mis datos de salud.</span>
              </label>
            </div>
          </section>

          <button className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-fg transition hover:opacity-90">
            Empezar
          </button>
        </form>
      </div>
    </main>
  );
}
