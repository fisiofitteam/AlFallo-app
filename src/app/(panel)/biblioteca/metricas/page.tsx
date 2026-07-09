import { redirect } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import {
  CORE_FIELDS,
  METRIC_CATEGORIES,
  METRIC_FREQUENCIES,
  METRIC_TYPES,
  categoryLabel,
  frequencyLabel,
  listMetricDefinitions,
} from "@/lib/metricDefinitions";
import {
  createMetric,
  deleteMetric,
  moveMetric,
  toggleMetricActive,
  updateMetric,
} from "./actions";

export const metadata = { title: "Métricas de check-in · Biblioteca" };
export const dynamic = "force-dynamic";

export default async function MetricsLibraryPage() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/biblioteca");

  const metrics = await listMetricDefinitions({ includeInactive: true });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Métricas de check-in</h1>
        <p className="mt-1 text-sm text-muted">
          Catálogo global de lo que pedimos al atleta cuando hace check-in. Marca cada métrica
          como <strong>básico</strong>, <strong>avanzado</strong>, o ambos.
          Los atletas con check-in avanzado activado ven las de <em>avanzado</em>; el resto, las de <em>básico</em>.
        </p>
      </header>

      {/* Nueva métrica */}
      <form action={createMetric} className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-semibold">Añadir métrica</p>
        <div className="grid gap-2 md:grid-cols-[1.4fr_1fr_1fr_0.8fr]">
          <label className="block text-xs">
            <span className="font-semibold text-muted">Nombre</span>
            <input
              name="name"
              required
              placeholder="Ej. Cuello"
              className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block text-xs">
            <span className="font-semibold text-muted">Tipo</span>
            <select name="type" defaultValue="number" className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm">
              {METRIC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="font-semibold text-muted">Unidad</span>
            <input name="unit" placeholder="kg, cm, %, h…" className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary" />
          </label>
          <label className="block text-xs">
            <span className="font-semibold text-muted">Cadencia</span>
            <select name="frequency" defaultValue="weekly" className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm">
              {METRIC_FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <label className="block text-xs">
            <span className="font-semibold text-muted">Grupo</span>
            <select name="category" defaultValue="otros" className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm">
              {METRIC_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="font-semibold text-muted">Columna fija (opcional)</span>
            <select name="coreField" defaultValue="" className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm">
              <option value="">— (respuesta libre)</option>
              {CORE_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-3">
            <label className="inline-flex items-center gap-1 text-xs">
              <input type="checkbox" name="inBasic" value="1" defaultChecked className="rounded border-border text-primary" /> Básico
            </label>
            <label className="inline-flex items-center gap-1 text-xs">
              <input type="checkbox" name="inAdvanced" value="1" defaultChecked className="rounded border-border text-primary" /> Avanzado
            </label>
            <button type="submit" className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-fg hover:opacity-90">
              <Plus size={13} className="mr-1 inline" /> Añadir
            </button>
          </div>
        </div>
      </form>

      {/* Listado editable */}
      <div className="space-y-2">
        {metrics.map((m, i) => (
          <article
            key={m.id}
            className={`rounded-2xl border p-4 ${
              m.active ? "border-border bg-surface" : "border-dashed border-border bg-bg/40"
            }`}
          >
            <form action={updateMetric} className="space-y-2">
              <input type="hidden" name="id" value={m.id} />
              <div className="grid gap-2 md:grid-cols-[1.4fr_1fr_1fr_0.8fr]">
                <input
                  name="name"
                  defaultValue={m.name}
                  required
                  className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
                />
                <select name="type" defaultValue={m.type} className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm">
                  {METRIC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <input name="unit" defaultValue={m.unit ?? ""} placeholder="Unidad" className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary" />
                <select name="frequency" defaultValue={m.frequency} className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm">
                  {METRIC_FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                <select name="category" defaultValue={m.category} className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm">
                  {METRIC_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <select name="coreField" defaultValue={m.coreField ?? ""} className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm">
                  <option value="">— (respuesta libre)</option>
                  {CORE_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <div className="flex items-end gap-3">
                  <label className="inline-flex items-center gap-1 text-xs">
                    <input type="checkbox" name="inBasic" value="1" defaultChecked={m.inBasic} className="rounded border-border text-primary" /> Básico
                  </label>
                  <label className="inline-flex items-center gap-1 text-xs">
                    <input type="checkbox" name="inAdvanced" value="1" defaultChecked={m.inAdvanced} className="rounded border-border text-primary" /> Avanzado
                  </label>
                </div>
              </div>
              <input
                name="description"
                defaultValue={m.description ?? ""}
                placeholder="Descripción o hint (opcional)"
                className="w-full rounded-lg border border-border bg-bg px-2 py-1 text-xs text-muted outline-none focus:border-primary"
              />
              {m.type === "select" ? (
                <textarea
                  name="options"
                  defaultValue={
                    Array.isArray(m.options)
                      ? (m.options as { value: string; label: string }[])
                          .map((o) => `${o.value}|${o.label}`)
                          .join("\n")
                      : ""
                  }
                  rows={3}
                  placeholder="Una opción por línea, formato: valor|Etiqueta"
                  className="w-full rounded-lg border border-border bg-bg px-2 py-1 text-xs outline-none focus:border-primary"
                />
              ) : (
                <input type="hidden" name="options" value="" />
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="text-muted">
                  {categoryLabel(m.category)} · {frequencyLabel(m.frequency)}
                  {m.coreField ? ` · columna: ${m.coreField}` : " · libre"}
                </span>
                <button type="submit" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:opacity-90">
                  Guardar
                </button>
              </div>
            </form>

            <div className="mt-2 flex items-center justify-end gap-1">
              <form action={moveMetric}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="direction" value="up" />
                <button type="submit" disabled={i === 0} title="Subir" className="rounded-md p-1 text-muted hover:text-primary disabled:opacity-30">
                  <ChevronUp size={14} />
                </button>
              </form>
              <form action={moveMetric}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="direction" value="down" />
                <button type="submit" disabled={i === metrics.length - 1} title="Bajar" className="rounded-md p-1 text-muted hover:text-primary disabled:opacity-30">
                  <ChevronDown size={14} />
                </button>
              </form>
              <form action={toggleMetricActive}>
                <input type="hidden" name="id" value={m.id} />
                <button
                  type="submit"
                  className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                    m.active
                      ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                      : "bg-bg text-muted hover:bg-surface"
                  }`}
                >
                  {m.active ? "Activa" : "Desactivada"}
                </button>
              </form>
              <form action={deleteMetric}>
                <input type="hidden" name="id" value={m.id} />
                <button
                  type="submit"
                  title="Borrar métrica del catálogo"
                  className="rounded-md p-1 text-muted hover:text-red-600"
                >
                  <Trash2 size={13} />
                </button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
