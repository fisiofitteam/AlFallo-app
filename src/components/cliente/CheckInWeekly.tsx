"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Pencil } from "lucide-react";
import { Field, Select, TextArea, TextInput } from "@/components/form-ui";
import { submitCheckIn, updateCheckIn } from "@/app/cliente/actions";

const SCALE_1_5 = [
  { value: "1", label: "1 · Muy baja" },
  { value: "2", label: "2 · Baja" },
  { value: "3", label: "3 · Normal" },
  { value: "4", label: "4 · Alta" },
  { value: "5", label: "5 · Muy alta" },
];

export type CustomMetricInput = {
  id: string;
  name: string;
  unit: string | null;
  type: string; // "number" | "scale"
  value: number | null;
};

export type CheckInActive = {
  id: string;
  weightKg: number | null;
  waistCm: number | null;
  hipCm: number | null;
  armCm: number | null;
  bodyFatPct: number | null;
  adherencePct: number | null;
  energy: number | null;
  notes: string | null;
  status: string;
  reviewNotes: string | null;
};

/**
 * Bloque interactivo del check-in semanal del atleta.
 *
 * Modos:
 *  - "Sin enviar todavía"  → muestra el form. Submit deshabilitado mientras
 *    está pendiente (anti-doble-submit en cliente).
 *  - "Ya enviado"          → muestra resumen + botón "Editar respuestas".
 *  - "Editando"            → mismo form con los valores precargados; al
 *    guardar llama a updateCheckIn (no a submitCheckIn).
 *
 * Server-side ya rechaza doble submitCheckIn (ver lib/weeklyCheckin); esta
 * UI lo refuerza para que ni siquiera lo intente.
 */
export function CheckInWeekly({
  active,
  customMetrics,
}: {
  active: CheckInActive | null;
  customMetrics: CustomMetricInput[];
}) {
  const [editing, setEditing] = useState(false);

  if (!active) {
    return <CheckInForm mode="new" initial={null} customMetrics={customMetrics} />;
  }

  if (editing) {
    return (
      <CheckInForm
        mode="edit"
        initial={active}
        customMetrics={customMetrics}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 flex-shrink-0 text-emerald-600" size={22} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-emerald-900">Check-in de esta semana enviado</p>
          <p className="mt-0.5 text-sm text-emerald-800/80">
            Ya está en manos de tu nutri. Si te has equivocado en algo, puedes editar las
            respuestas hasta el próximo lunes.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
            <KV label="Peso" value={active.weightKg != null ? `${active.weightKg} kg` : "—"} />
            <KV label="% Grasa" value={active.bodyFatPct != null ? `${active.bodyFatPct}%` : "—"} />
            <KV label="Adherencia" value={active.adherencePct != null ? `${active.adherencePct}%` : "—"} />
            <KV label="Cintura" value={active.waistCm != null ? `${active.waistCm} cm` : "—"} />
            <KV label="Cadera" value={active.hipCm != null ? `${active.hipCm} cm` : "—"} />
            <KV label="Brazo" value={active.armCm != null ? `${active.armCm} cm` : "—"} />
          </dl>
          {active.notes ? (
            <div className="mt-3">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Tus sensaciones
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-emerald-900">{active.notes}</p>
            </div>
          ) : null}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              <Pencil size={14} /> Editar respuestas
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-emerald-700">{label}</dt>
      <dd className="font-semibold text-emerald-900">{value}</dd>
    </div>
  );
}

/** El formulario en sí. mode="new" envía submitCheckIn, "edit" updateCheckIn. */
function CheckInForm({
  mode,
  initial,
  customMetrics,
  onDone,
}: {
  mode: "new" | "edit";
  initial: CheckInActive | null;
  customMetrics: CustomMetricInput[];
  onDone?: () => void;
}) {
  const [pending, start] = useTransition();
  // Esto bloquea TODOS los submits posteriores en el mismo cliente aunque el
  // useTransition acabe rápido — anti-doble-click definitivo. La página se
  // recarga al revalidate, así que tampoco importa que quede true.
  const [sent, setSent] = useState(false);
  const blocked = pending || sent;

  return (
    <form
      action={(fd) => {
        if (blocked) return;
        setSent(true);
        start(async () => {
          if (mode === "new") {
            await submitCheckIn(fd);
          } else {
            await updateCheckIn(fd);
            onDone?.();
          }
        });
      }}
      className="mt-5 space-y-4 rounded-2xl border border-border bg-surface p-5"
    >
      {mode === "edit" && initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Peso (kg)" htmlFor="weightKg">
          <TextInput
            id="weightKg"
            name="weightKg"
            inputMode="decimal"
            defaultValue={initial?.weightKg ?? ""}
          />
        </Field>
        <Field label="% Grasa" htmlFor="bodyFatPct">
          <TextInput
            id="bodyFatPct"
            name="bodyFatPct"
            inputMode="decimal"
            defaultValue={initial?.bodyFatPct ?? ""}
          />
        </Field>
        <Field label="Cintura (cm)" htmlFor="waistCm">
          <TextInput
            id="waistCm"
            name="waistCm"
            inputMode="decimal"
            defaultValue={initial?.waistCm ?? ""}
          />
        </Field>
        <Field label="Cadera (cm)" htmlFor="hipCm">
          <TextInput
            id="hipCm"
            name="hipCm"
            inputMode="decimal"
            defaultValue={initial?.hipCm ?? ""}
          />
        </Field>
        <Field label="Brazo (cm)" htmlFor="armCm">
          <TextInput
            id="armCm"
            name="armCm"
            inputMode="decimal"
            defaultValue={initial?.armCm ?? ""}
          />
        </Field>
        <Field label="Adherencia (%)" htmlFor="adherencePct">
          <TextInput
            id="adherencePct"
            name="adherencePct"
            inputMode="numeric"
            defaultValue={initial?.adherencePct ?? ""}
          />
        </Field>
      </div>
      <Field label="Energía" htmlFor="energy">
        <Select
          id="energy"
          name="energy"
          options={SCALE_1_5}
          defaultValue={initial?.energy != null ? String(initial.energy) : ""}
        />
      </Field>
      {/* Métricas personalizadas que el nutri ha definido para este cliente. */}
      {customMetrics.length > 0 ? (
        <div className="space-y-3 rounded-xl border border-border bg-bg/40 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            Tus métricas personalizadas
          </p>
          <div className="grid grid-cols-2 gap-4">
            {customMetrics.map((m) => (
              <Field
                key={m.id}
                label={m.unit ? `${m.name} (${m.unit})` : m.name}
                htmlFor={`metric_${m.id}`}
              >
                <TextInput
                  id={`metric_${m.id}`}
                  name={`metric_${m.id}`}
                  inputMode="decimal"
                  defaultValue={m.value ?? ""}
                />
              </Field>
            ))}
          </div>
        </div>
      ) : null}

      <Field label="¿Cómo ha ido la semana?" htmlFor="notes" hint="Sensaciones, dificultades, dudas…">
        <TextArea id="notes" name="notes" defaultValue={initial?.notes ?? ""} />
      </Field>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={blocked}
          className="flex-1 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-fg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {blocked ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              {mode === "edit" ? "Guardando…" : "Enviando…"}
            </span>
          ) : mode === "edit" ? (
            "Guardar cambios"
          ) : (
            "Enviar check-in"
          )}
        </button>
        {mode === "edit" ? (
          <button
            type="button"
            onClick={() => onDone?.()}
            disabled={blocked}
            className="rounded-xl border border-border bg-bg px-4 py-3 font-medium text-muted hover:bg-surface-2 disabled:opacity-60"
          >
            Cancelar
          </button>
        ) : null}
      </div>
    </form>
  );
}
