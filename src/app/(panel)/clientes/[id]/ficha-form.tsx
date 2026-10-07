"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import type { NutritionProfile } from "@prisma/client";
import {
  DIETARY_STYLE_OPTIONS,
  GOAL_OPTIONS,
  LEVEL_OPTIONS,
  SEX_OPTIONS,
  displayMetric,
} from "@/lib/clients";
import { Field, SectionTitle, Select, TextArea, TextInput } from "@/components/form-ui";
import { SpecialConsiderationsSelector } from "@/components/SpecialConsiderationsSelector";
import type { SpecialConsiderationDTO } from "@/lib/specialConsiderations";
import { updateNutritionProfile } from "../actions";

function dateValue(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

type SaveState = "idle" | "pending" | "ok" | "err";

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
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [, startTransition] = useTransition();

  function flush() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    setSaveState("pending");
    startTransition(async () => {
      try {
        await updateNutritionProfile(fd);
        setSaveState("ok");
        setTimeout(() => setSaveState((s) => (s === "ok" ? "idle" : s)), 1600);
      } catch {
        setSaveState("err");
        setTimeout(() => setSaveState((s) => (s === "err" ? "idle" : s)), 3000);
      }
    });
  }

  function schedule() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 1500);
  }

  // Flush al desmontar por si queda algo pendiente.
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        // No flush aquí — React se desmonta sin esperar async; mejor
        // confiar en el blur + el botón manual.
      }
    };
  }, []);

  return (
    <form
      ref={formRef}
      action={flush}
      onInput={schedule}
      onBlur={flush}
      className="space-y-8"
    >
      <input type="hidden" name="clientId" value={clientId} />

      <div className="flex items-center justify-end gap-2 text-xs">
        {saveState === "pending" ? (
          <span className="inline-flex items-center gap-1 text-muted">
            <Loader2 size={12} className="animate-spin" /> guardando…
          </span>
        ) : saveState === "ok" ? (
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <Check size={12} /> guardado
          </span>
        ) : saveState === "err" ? (
          <span className="inline-flex items-center gap-1 text-red-600">
            <X size={12} /> error al guardar
          </span>
        ) : (
          <span className="text-muted">Autoguardado activo</span>
        )}
      </div>

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
            <TextInput id="heightCm" name="heightCm" inputMode="numeric" defaultValue={displayMetric("heightCm", p?.heightCm)} />
          </Field>
          <Field label="Peso (kg)" htmlFor="weightKg">
            <TextInput id="weightKg" name="weightKg" inputMode="decimal" defaultValue={displayMetric("weightKg", p?.weightKg)} />
          </Field>
          <Field label="% Grasa" htmlFor="bodyFatPct">
            <TextInput id="bodyFatPct" name="bodyFatPct" inputMode="decimal" defaultValue={displayMetric("bodyFatPct", p?.bodyFatPct)} />
          </Field>
          <Field label="Cintura (cm)" htmlFor="waistCm">
            <TextInput id="waistCm" name="waistCm" inputMode="decimal" defaultValue={displayMetric("waistCm", p?.waistCm)} />
          </Field>
          <Field label="Cadera (cm)" htmlFor="hipCm">
            <TextInput id="hipCm" name="hipCm" inputMode="decimal" defaultValue={displayMetric("hipCm", p?.hipCm)} />
          </Field>
          <Field label="Brazo (cm)" htmlFor="armCm">
            <TextInput id="armCm" name="armCm" inputMode="decimal" defaultValue={displayMetric("armCm", p?.armCm)} />
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
            <TextInput id="targetWeightKg" name="targetWeightKg" inputMode="decimal" defaultValue={displayMetric("targetWeightKg", p?.targetWeightKg)} />
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

      {/* Grupo de WhatsApp de seguimiento. El enlace aparece como botón verde
          en la card del cliente dentro del listado /clientes. */}
      <section>
        <SectionTitle>Seguimiento</SectionTitle>
        <div className="grid grid-cols-1 gap-4">
          <Field
            label="Grupo de WhatsApp"
            htmlFor="whatsappGroupUrl"
            hint="Pega aquí el enlace de invitación al grupo del cliente. Ej. https://chat.whatsapp.com/XXXX"
          >
            <TextInput
              id="whatsappGroupUrl"
              name="whatsappGroupUrl"
              type="url"
              placeholder="https://chat.whatsapp.com/…"
              defaultValue={p?.whatsappGroupUrl ?? ""}
            />
          </Field>
        </div>
      </section>

      {/* Botón manual como fallback — útil si el user quiere forzar un
          guardado tras un cambio rápido antes de salir, o si el autosave
          tardó en dispararse. */}
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
