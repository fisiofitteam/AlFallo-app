import type { NutritionProfile } from "@prisma/client";
import {
  DIETARY_STYLE_OPTIONS,
  GOAL_OPTIONS,
  LEVEL_OPTIONS,
  SEX_OPTIONS,
} from "@/lib/clients";
import { Field, SectionTitle, Select, TextArea, TextInput } from "@/components/form-ui";
import { SpecialConsiderationsSelector } from "@/components/SpecialConsiderationsSelector";
import type { SpecialConsiderationDTO } from "@/lib/specialConsiderations";
import { updateNutritionProfile } from "../actions";

function dateValue(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export function FichaForm({
  clientId,
  profile,
  specialConsiderations,
  selectedConsiderationIds,
}: {
  clientId: string;
  profile: NutritionProfile | null;
  specialConsiderations: SpecialConsiderationDTO[];
  selectedConsiderationIds: string[];
}) {
  const p = profile;
  return (
    <form action={updateNutritionProfile} className="space-y-8">
      <input type="hidden" name="clientId" value={clientId} />

      {/* Antropometría */}
      <section>
        <SectionTitle>Antropometría</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Sexo" htmlFor="sex">
            <Select id="sex" name="sex" options={SEX_OPTIONS} defaultValue={p?.sex ?? ""} />
          </Field>
          <Field label="Fecha de nacimiento" htmlFor="birthDate">
            <TextInput id="birthDate" name="birthDate" type="date" defaultValue={dateValue(p?.birthDate ?? null)} />
          </Field>
          <Field label="Altura (cm)" htmlFor="heightCm">
            <TextInput id="heightCm" name="heightCm" inputMode="numeric" defaultValue={p?.heightCm ?? ""} />
          </Field>
          <Field label="Peso (kg)" htmlFor="weightKg">
            <TextInput id="weightKg" name="weightKg" inputMode="decimal" defaultValue={p?.weightKg ?? ""} />
          </Field>
          <Field label="% Grasa" htmlFor="bodyFatPct">
            <TextInput id="bodyFatPct" name="bodyFatPct" inputMode="decimal" defaultValue={p?.bodyFatPct ?? ""} />
          </Field>
          <Field label="Cintura (cm)" htmlFor="waistCm">
            <TextInput id="waistCm" name="waistCm" inputMode="decimal" defaultValue={p?.waistCm ?? ""} />
          </Field>
          <Field label="Cadera (cm)" htmlFor="hipCm">
            <TextInput id="hipCm" name="hipCm" inputMode="decimal" defaultValue={p?.hipCm ?? ""} />
          </Field>
          <Field label="Brazo (cm)" htmlFor="armCm">
            <TextInput id="armCm" name="armCm" inputMode="decimal" defaultValue={p?.armCm ?? ""} />
          </Field>
        </div>
      </section>

      {/* Deporte */}
      <section>
        <SectionTitle>Deporte</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Box / gimnasio" htmlFor="boxName">
            <TextInput id="boxName" name="boxName" defaultValue={p?.boxName ?? ""} />
          </Field>
          <Field label="Nivel" htmlFor="level">
            <Select id="level" name="level" options={LEVEL_OPTIONS} defaultValue={p?.level ?? ""} />
          </Field>
          <Field label="Años entrenando" htmlFor="yearsTraining">
            <TextInput id="yearsTraining" name="yearsTraining" inputMode="numeric" defaultValue={p?.yearsTraining ?? ""} />
          </Field>
          <Field label="Días/semana" htmlFor="weeklyFrequency">
            <TextInput id="weeklyFrequency" name="weeklyFrequency" inputMode="numeric" defaultValue={p?.weeklyFrequency ?? ""} />
          </Field>
          <Field label="Horario de entrenos" htmlFor="trainingSchedule" hint="Ej. mañanas, tardes, doblar los sábados…">
            <TextInput id="trainingSchedule" name="trainingSchedule" defaultValue={p?.trainingSchedule ?? ""} />
          </Field>
        </div>
      </section>

      {/* Restricciones */}
      <section>
        <SectionTitle>Restricciones y hábitos</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Estilo dietético" htmlFor="dietaryStyle">
            <Select id="dietaryStyle" name="dietaryStyle" options={DIETARY_STYLE_OPTIONS} defaultValue={p?.dietaryStyle ?? ""} />
          </Field>
          <Field label="Alergias" htmlFor="allergies" hint="Separadas por comas">
            <TextInput id="allergies" name="allergies" defaultValue={(p?.allergies ?? []).join(", ")} />
          </Field>
          <Field label="Intolerancias" htmlFor="intolerances" hint="Separadas por comas">
            <TextInput id="intolerances" name="intolerances" defaultValue={(p?.intolerances ?? []).join(", ")} />
          </Field>
          <Field label="Alimentos que no quiere" htmlFor="dislikes" hint="Separados por comas">
            <TextInput id="dislikes" name="dislikes" defaultValue={(p?.dislikes ?? []).join(", ")} />
          </Field>
          <Field label="Suplementos" htmlFor="supplements" hint="Separados por comas">
            <TextInput id="supplements" name="supplements" defaultValue={(p?.supplements ?? []).join(", ")} />
          </Field>
          <Field label="Medicación" htmlFor="medication">
            <TextInput id="medication" name="medication" defaultValue={p?.medication ?? ""} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Condiciones médicas" htmlFor="medicalConditions">
            <TextArea id="medicalConditions" name="medicalConditions" defaultValue={p?.medicalConditions ?? ""} />
          </Field>
        </div>
      </section>

      {/* Objetivo */}
      <section>
        <SectionTitle>Objetivo</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Objetivo" htmlFor="goal">
            <Select id="goal" name="goal" options={GOAL_OPTIONS} defaultValue={p?.goal ?? ""} />
          </Field>
          <Field label="Peso objetivo (kg)" htmlFor="targetWeightKg">
            <TextInput id="targetWeightKg" name="targetWeightKg" inputMode="decimal" defaultValue={p?.targetWeightKg ?? ""} />
          </Field>
          <Field label="Plazo" htmlFor="timeframe" hint="Ej. 12 semanas">
            <TextInput id="timeframe" name="timeframe" defaultValue={p?.timeframe ?? ""} />
          </Field>
        </div>
      </section>

      {/* Consideraciones especiales: la gestionan los managers en la
          Biblioteca → Brief IA; aquí solo se marcan las que apliquen. */}
      <section>
        <SectionTitle>Consideraciones especiales</SectionTitle>
        <SpecialConsiderationsSelector
          available={specialConsiderations}
          initialSelectedIds={selectedConsiderationIds}
        />
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition hover:opacity-90"
        >
          Guardar ficha
        </button>
      </div>
    </form>
  );
}
