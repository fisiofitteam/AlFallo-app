import { redirect } from "next/navigation";
import { getActiveClient } from "@/lib/client-session";
import { DIETARY_STYLE_OPTIONS, GOAL_OPTIONS, LEVEL_OPTIONS } from "@/lib/clients";
import { CONTRACT_TEXT } from "@/lib/contract";
import { Field, SectionTitle, Select, TextArea, TextInput } from "@/components/form-ui";
import { BrandMark } from "@/components/brand-mark";
import { submitOnboarding } from "../actions";

export const metadata = { title: "Onboarding · Al Fallo" };

export default async function OnboardingPage() {
  const client = await getActiveClient();
  if (!client) redirect("/cliente/login");
  if (client.onboardingComplete) redirect("/cliente");

  return (
    <main className="shell min-h-screen bg-bg text-text">
      <div className="mx-auto max-w-lg px-5 py-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={40} />
          <h1 className="mt-3 text-xl font-extrabold">¡Bienvenido/a, {client.fullName.split(" ")[0]}!</h1>
          <p className="mt-1 text-sm text-muted">
            Completa este cuestionario y acepta el contrato para empezar.
          </p>
        </div>

        <form action={submitOnboarding} className="space-y-8 rounded-2xl border border-border bg-surface p-5">
          {/* Objetivo y datos */}
          <section>
            <SectionTitle>Tu objetivo</SectionTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="¿Qué quieres conseguir?" htmlFor="goal">
                <Select id="goal" name="goal" options={GOAL_OPTIONS} />
              </Field>
              <Field label="Plazo deseado" htmlFor="timeframe" hint="Opcional">
                <TextInput id="timeframe" name="timeframe" placeholder="Ej. 12 semanas" />
              </Field>
              <Field label="Peso actual (kg)" htmlFor="weightKg">
                <TextInput id="weightKg" name="weightKg" inputMode="decimal" />
              </Field>
              <Field label="Peso objetivo (kg)" htmlFor="targetWeightKg">
                <TextInput id="targetWeightKg" name="targetWeightKg" inputMode="decimal" />
              </Field>
              <Field label="Altura (cm)" htmlFor="heightCm">
                <TextInput id="heightCm" name="heightCm" inputMode="numeric" />
              </Field>
            </div>
          </section>

          {/* Deporte */}
          <section>
            <SectionTitle>Entrenamiento</SectionTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Box / gimnasio" htmlFor="boxName">
                <TextInput id="boxName" name="boxName" />
              </Field>
              <Field label="Nivel" htmlFor="level">
                <Select id="level" name="level" options={LEVEL_OPTIONS} />
              </Field>
              <Field label="Días de entreno / semana" htmlFor="weeklyFrequency">
                <TextInput id="weeklyFrequency" name="weeklyFrequency" inputMode="numeric" />
              </Field>
            </div>
          </section>

          {/* Restricciones */}
          <section>
            <SectionTitle>Alimentación</SectionTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Estilo dietético" htmlFor="dietaryStyle">
                <Select id="dietaryStyle" name="dietaryStyle" options={DIETARY_STYLE_OPTIONS} />
              </Field>
              <Field label="Alergias" htmlFor="allergies" hint="Separadas por comas">
                <TextInput id="allergies" name="allergies" />
              </Field>
              <Field label="Intolerancias" htmlFor="intolerances" hint="Separadas por comas">
                <TextInput id="intolerances" name="intolerances" />
              </Field>
              <Field label="Alimentos que no te gustan" htmlFor="dislikes" hint="Separados por comas">
                <TextInput id="dislikes" name="dislikes" />
              </Field>
              <Field label="Suplementos que tomas" htmlFor="supplements" hint="Separados por comas">
                <TextInput id="supplements" name="supplements" />
              </Field>
              <Field label="Medicación" htmlFor="medication">
                <TextInput id="medication" name="medication" />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Condiciones médicas a tener en cuenta" htmlFor="medicalConditions">
                <TextArea id="medicalConditions" name="medicalConditions" />
              </Field>
            </div>
          </section>

          {/* Contrato */}
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
