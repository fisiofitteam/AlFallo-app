import type { CheckIn } from "@prisma/client";
import { CheckCircle2, Clock, CalendarDays, AlertCircle } from "lucide-react";
import { TextArea } from "@/components/form-ui";
import { PanelCheckInEditor } from "@/components/PanelCheckInEditor";
import { listMetricDefinitions } from "@/lib/metricDefinitions";
import { CHECKIN_DAY_OPTIONS } from "@/lib/weeklyCheckin";
import { reviewCheckIn, setCheckInDaysOfWeek } from "../actions";

function Metric({ label, value, unit = "" }: { label: string; value: number | null; unit?: string }) {
  if (value == null) return null;
  return (
    <span className="text-sm">
      <span className="text-muted">{label}:</span> {value}
      {unit}
    </span>
  );
}

export async function CheckInsTab({
  clientId,
  checkIns,
  checkInDaysOfWeek,
  latestRequestFulfilled,
}: {
  clientId: string;
  checkIns: CheckIn[];
  checkInDaysOfWeek: number[];
  latestRequestFulfilled: boolean;
}) {
  // Cargamos el catálogo para poder mostrar los labels bonitos de las
  // métricas custom (extraAnswers) que aparezcan en algún check-in.
  const metricDefs = checkIns.some(
    (c) => c.extraAnswers && typeof c.extraAnswers === "object",
  )
    ? await listMetricDefinitions({ includeInactive: true })
    : [];
  const metricLabelById = new Map(
    metricDefs.map((m) => [m.id, { label: m.name, unit: m.unit }]),
  );

  const activeDays = new Set(checkInDaysOfWeek);
  const daysLabel =
    checkInDaysOfWeek
      .map((d) => CHECKIN_DAY_OPTIONS.find((o) => o.value === d)?.label ?? "")
      .filter(Boolean)
      .join(" · ") || "Viernes";

  return (
    <div className="space-y-4">
      {/* Configuración: días del recordatorio semanal + estado de la petición vigente */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays size={16} className="text-primary" />
              Recordatorio semanal
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Cada día marcado abre una petición: el atleta ve el aviso desde ese día hasta que
              envía un check-in. Puedes marcar varios (p. ej. lunes y viernes).
            </p>
          </div>
          {latestRequestFulfilled ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              <CheckCircle2 size={13} /> Al día
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
              <AlertCircle size={13} /> Pendiente
            </span>
          )}
        </div>
        <form action={setCheckInDaysOfWeek} className="space-y-2">
          <input type="hidden" name="clientId" value={clientId} />
          <div className="flex flex-wrap items-center gap-1.5">
            {CHECKIN_DAY_OPTIONS.map((d) => {
              const checked = activeDays.has(d.value);
              return (
                <label
                  key={d.value}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition ${
                    checked
                      ? "border-primary bg-primary-soft font-semibold text-primary"
                      : "border-border bg-bg text-muted hover:border-primary/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="days"
                    value={d.value}
                    defaultChecked={checked}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  {d.label}
                </label>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs text-muted">
              Actual: <strong>{daysLabel}</strong>
            </span>
            <button
              type="submit"
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:opacity-90"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>

      {checkIns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="font-medium">Sin check-ins todavía</p>
          <p className="mt-1 text-sm text-muted">
            Aparecerán aquí cuando el atleta los envíe desde su app. Los días marcados arriba son
            cuándo se le pedirá.
          </p>
        </div>
      ) : (
        checkIns.map((c) => (
          <div key={c.id} className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{c.date.toLocaleDateString("es-ES")}</span>
              {c.status === "revisado" ? (
                <span className="flex items-center gap-1 text-xs text-[#1fa971]">
                  <CheckCircle2 size={14} /> Revisado
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-[#e07b1a]">
                  <Clock size={14} /> Pendiente
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              <Metric label="Peso" value={c.weightKg} unit=" kg" />
              <Metric label="% Grasa" value={c.bodyFatPct} />
              <Metric label="Cintura" value={c.waistCm} unit=" cm" />
              <Metric label="Cadera" value={c.hipCm} unit=" cm" />
              <Metric label="Brazo" value={c.armCm} unit=" cm" />
              <Metric label="Adherencia" value={c.adherencePct} unit="%" />
              <Metric label="Energía" value={c.energy} unit="/5" />
            </div>

            {c.notes && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">{c.notes}</p>}

            {c.extraAnswers && typeof c.extraAnswers === "object" ? (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-bg/60 p-3">
                {Object.entries(c.extraAnswers as Record<string, unknown>).map(([id, val]) => {
                  if (val == null || val === "") return null;
                  const meta = metricLabelById.get(id);
                  const label = meta?.label ?? id;
                  const unit = meta?.unit ?? "";
                  const display = typeof val === "boolean" ? (val ? "Sí" : "No") : String(val);
                  return (
                    <span key={id} className="text-sm">
                      <span className="text-muted">{label}:</span> {display}
                      {unit ? ` ${unit}` : ""}
                    </span>
                  );
                })}
              </div>
            ) : null}

            <PanelCheckInEditor
              checkInId={c.id}
              initial={{
                weightKg: c.weightKg,
                waistCm: c.waistCm,
                hipCm: c.hipCm,
                armCm: c.armCm,
                bodyFatPct: c.bodyFatPct,
                adherencePct: c.adherencePct,
                energy: c.energy,
                notes: c.notes,
              }}
            />

            <form action={reviewCheckIn} className="mt-3 space-y-2">
              <input type="hidden" name="checkInId" value={c.id} />
              <TextArea
                name="reviewNotes"
                defaultValue={c.reviewNotes ?? ""}
                placeholder="Tu respuesta al atleta…"
              />
              <div className="flex justify-end">
                <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition hover:opacity-90">
                  {c.status === "revisado" ? "Actualizar respuesta" : "Responder y marcar revisado"}
                </button>
              </div>
            </form>
          </div>
        ))
      )}
    </div>
  );
}
