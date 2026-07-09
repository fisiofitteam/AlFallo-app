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

const SCALE_1_10 = Array.from({ length: 10 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

export type MetricInput = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  unit: string | null;
  coreField: string | null;
  category: string;
  frequency: string;
  options: { value: string; label: string }[] | null;
};

export type CustomMetricInput = {
  id: string;
  name: string;
  unit: string | null;
  type: string;
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
  extraAnswers: Record<string, string | number | boolean | null> | null;
  status: string;
  reviewNotes: string | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  peso_perimetros: "Peso y perímetros",
  adherencia: "Adherencia",
  subjetivos: "Sensaciones",
  otros: "Otros",
};

const FREQUENCY_LABEL: Record<string, string> = {
  weekly: "semanal",
  biweekly: "quincenal",
  monthly: "mensual",
  any: "libre",
};

/** Devuelve el name= del input para cada métrica. Los que mapean a columna
 *  fija reutilizan el nombre exacto (weightKg, ...) para que la server action
 *  las lea como antes. Los custom van con prefijo "extra:" y su id. */
function inputName(metric: MetricInput): string {
  return metric.coreField ?? `extra:${metric.id}`;
}

function coreValue(metric: MetricInput, active: CheckInActive | null): string | number | null | undefined {
  if (!active) return undefined;
  if (!metric.coreField) {
    const raw = active.extraAnswers?.[metric.id];
    if (raw == null) return undefined;
    if (typeof raw === "boolean") return raw ? "1" : "";
    return raw;
  }
  return (active as unknown as Record<string, string | number | null>)[metric.coreField];
}

export function CheckInWeekly({
  active,
  metrics,
  customMetrics,
}: {
  active: CheckInActive | null;
  metrics: MetricInput[];
  customMetrics: CustomMetricInput[];
}) {
  const [editing, setEditing] = useState(false);

  if (!active) {
    return <CheckInForm mode="new" initial={null} metrics={metrics} customMetrics={customMetrics} />;
  }
  if (editing) {
    return (
      <CheckInForm
        mode="edit"
        initial={active}
        metrics={metrics}
        customMetrics={customMetrics}
        onDone={() => setEditing(false)}
      />
    );
  }

  // Resumen resumido de las 4-6 primeras métricas con valor.
  const withValue = metrics
    .map((m) => {
      const raw = coreValue(m, active);
      const has =
        raw !== undefined && raw !== null && raw !== "" && !(typeof raw === "number" && Number.isNaN(raw));
      return has ? { name: m.name, unit: m.unit, value: raw } : null;
    })
    .filter((x): x is { name: string; unit: string | null; value: string | number } => x !== null);

  return (
    <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 flex-shrink-0 text-emerald-600" size={22} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-emerald-900">Check-in de esta semana enviado</p>
          <p className="mt-0.5 text-sm text-emerald-800/80">
            Ya está en manos de tu nutri. Si te has equivocado en algo, puedes editar las respuestas hasta el próximo lunes.
          </p>
          {withValue.length > 0 ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
              {withValue.slice(0, 9).map((it, i) => (
                <div key={i}>
                  <dt className="text-xs text-emerald-700">{it.name}</dt>
                  <dd className="font-semibold text-emerald-900">
                    {it.value}
                    {it.unit ? ` ${it.unit}` : ""}
                  </dd>
                </div>
              ))}
            </dl>
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

function CheckInForm({
  mode,
  initial,
  metrics,
  customMetrics,
  onDone,
}: {
  mode: "new" | "edit";
  initial: CheckInActive | null;
  metrics: MetricInput[];
  customMetrics: CustomMetricInput[];
  onDone?: () => void;
}) {
  const [pending, start] = useTransition();
  const [sent, setSent] = useState(false);
  const blocked = pending || sent;

  // Agrupamos métricas por category respetando su order en cada grupo.
  const groups: { key: string; label: string; items: MetricInput[] }[] = [];
  for (const m of metrics) {
    let g = groups.find((x) => x.key === m.category);
    if (!g) {
      g = { key: m.category, label: CATEGORY_LABEL[m.category] ?? m.category, items: [] };
      groups.push(g);
    }
    g.items.push(m);
  }

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
      className="mt-5 space-y-5 rounded-2xl border border-border bg-surface p-5"
    >
      {mode === "edit" && initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      {groups.map((g) => (
        <section key={g.key} className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">{g.label}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {g.items.map((m) => (
              <MetricField key={m.id} metric={m} initial={coreValue(m, initial)} />
            ))}
          </div>
        </section>
      ))}

      {customMetrics.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-border bg-bg/40 p-4">
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
        </section>
      ) : null}

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

/** Renderiza el input adecuado según el tipo de la métrica. Anota la cadencia
 *  al lado del label como pista ("semanal", "quincenal", etc.). */
function MetricField({
  metric,
  initial,
}: {
  metric: MetricInput;
  initial: string | number | null | undefined;
}) {
  const name = inputName(metric);
  const label = metric.unit ? `${metric.name} (${metric.unit})` : metric.name;
  const hint = metric.description
    ? metric.description
    : metric.frequency === "any"
    ? undefined
    : `Cadencia: ${FREQUENCY_LABEL[metric.frequency] ?? metric.frequency}`;
  const defaultStr = initial == null ? "" : String(initial);

  if (metric.type === "textarea") {
    return (
      <div className="sm:col-span-2">
        <Field label={label} htmlFor={name} hint={hint}>
          <TextArea id={name} name={name} defaultValue={defaultStr} />
        </Field>
      </div>
    );
  }
  if (metric.type === "scale5") {
    return (
      <Field label={label} htmlFor={name} hint={hint}>
        <Select id={name} name={name} options={SCALE_1_5} defaultValue={defaultStr} />
      </Field>
    );
  }
  if (metric.type === "scale10") {
    return (
      <Field label={label} htmlFor={name} hint={hint}>
        <Select id={name} name={name} options={SCALE_1_10} defaultValue={defaultStr} />
      </Field>
    );
  }
  if (metric.type === "select" && metric.options) {
    return (
      <Field label={label} htmlFor={name} hint={hint}>
        <Select id={name} name={name} options={metric.options} defaultValue={defaultStr} />
      </Field>
    );
  }
  if (metric.type === "checkbox") {
    return (
      <Field label={label} htmlFor={name} hint={hint}>
        <label className="mt-1 inline-flex items-center gap-2 text-sm">
          <input
            id={name}
            name={name}
            type="checkbox"
            value="1"
            defaultChecked={defaultStr === "true" || defaultStr === "1"}
            className="rounded border-border text-primary"
          />
          <span>Sí</span>
        </label>
      </Field>
    );
  }
  if (metric.type === "text") {
    return (
      <Field label={label} htmlFor={name} hint={hint}>
        <TextInput id={name} name={name} defaultValue={defaultStr} />
      </Field>
    );
  }
  // number por defecto
  return (
    <Field label={label} htmlFor={name} hint={hint}>
      <TextInput id={name} name={name} inputMode="decimal" defaultValue={defaultStr} />
    </Field>
  );
}
