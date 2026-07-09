import { redirect } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import {
  categoryLabel,
  listMarks,
  MARK_CATEGORIES,
  MARK_UNITS,
  unitLabel,
} from "@/lib/strengthMarks";
import {
  createStrengthMark,
  deleteStrengthMark,
  moveStrengthMark,
  toggleStrengthMarkActive,
  updateStrengthMark,
} from "./actions";

export const metadata = { title: "Marcas de fuerza · Biblioteca" };
export const dynamic = "force-dynamic";

export default async function MarksLibraryPage() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/biblioteca");

  const marks = await listMarks({ includeInactive: true });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Marcas de fuerza y benchmarks</h1>
        <p className="mt-1 text-sm text-muted">
          Cat&aacute;logo global. Todos los atletas ven las marcas activas y pueden registrar sus valores desde su app.
          El equipo tambi&eacute;n puede a&ntilde;adir registros manualmente desde la ficha del cliente.
        </p>
      </header>

      {/* Alta rápida */}
      <form
        action={createStrengthMark}
        className="rounded-2xl border border-border bg-surface p-4"
      >
        <p className="mb-3 text-sm font-semibold">A&ntilde;adir marca</p>
        <div className="grid gap-2 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
          <label className="block text-xs">
            <span className="font-semibold text-muted">Nombre</span>
            <input
              name="name"
              required
              placeholder="Ej. Back squat 1RM"
              className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block text-xs">
            <span className="font-semibold text-muted">Categor&iacute;a</span>
            <select
              name="category"
              defaultValue="fuerza"
              className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
            >
              {MARK_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="font-semibold text-muted">Unidad</span>
            <select
              name="unit"
              defaultValue="kg"
              className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
            >
              {MARK_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label} ({u.plural})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="font-semibold text-muted">Mejor es</span>
            <select
              name="direction"
              defaultValue="up"
              className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
            >
              <option value="up">Mayor (kg, reps...)</option>
              <option value="down">Menor (tiempo)</option>
            </select>
          </label>
          <button
            type="submit"
            className="self-end rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-fg hover:opacity-90"
          >
            <Plus size={13} className="mr-1 inline" /> A&ntilde;adir
          </button>
        </div>
      </form>

      {/* Listado */}
      <div className="space-y-2">
        {marks.map((m, i) => (
          <article
            key={m.id}
            className={`rounded-2xl border p-4 ${
              m.active ? "border-border bg-surface" : "border-dashed border-border bg-bg/40"
            }`}
          >
            <form action={updateStrengthMark} className="grid gap-2 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
              <input type="hidden" name="id" value={m.id} />
              <input
                name="name"
                defaultValue={m.name}
                required
                className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
              <select
                name="category"
                defaultValue={m.category}
                className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
              >
                {MARK_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <select
                name="unit"
                defaultValue={m.unit}
                className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
              >
                {MARK_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
              <select
                name="direction"
                defaultValue={m.direction}
                className="rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
              >
                <option value="up">Mayor mejor</option>
                <option value="down">Menor mejor</option>
              </select>
              <button
                type="submit"
                className="self-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:opacity-90"
              >
                Guardar
              </button>
            </form>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="text-muted">
                {categoryLabel(m.category)} · unidad {unitLabel(m.unit)} · {m.direction === "up" ? "mayor mejor" : "menor mejor"}
              </span>
              <div className="flex items-center gap-1">
                <form action={moveStrengthMark}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button
                    type="submit"
                    disabled={i === 0}
                    title="Subir"
                    className="rounded-md p-1 text-muted hover:text-primary disabled:opacity-30"
                  >
                    <ChevronUp size={14} />
                  </button>
                </form>
                <form action={moveStrengthMark}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    type="submit"
                    disabled={i === marks.length - 1}
                    title="Bajar"
                    className="rounded-md p-1 text-muted hover:text-primary disabled:opacity-30"
                  >
                    <ChevronDown size={14} />
                  </button>
                </form>
                <form action={toggleStrengthMarkActive}>
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
                <form action={deleteStrengthMark}>
                  <input type="hidden" name="id" value={m.id} />
                  <button
                    type="submit"
                    title="Borrar (elimina todos los registros)"
                    className="rounded-md p-1 text-muted hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </form>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
