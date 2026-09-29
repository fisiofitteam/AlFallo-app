import { redirect } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import { listAllHabits } from "@/lib/habits";
import {
  createHabit,
  deleteHabit,
  moveHabit,
  toggleHabitActive,
  updateHabit,
} from "./actions";

export const metadata = { title: "Hábitos · Biblioteca" };
export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary";

export default async function HabitosLibraryPage() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/biblioteca");

  const habits = await listAllHabits();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Hábitos</h1>
        <p className="mt-1 text-sm text-muted">
          Catálogo global. Cada hábito activo aparece en la tarjeta "Hábitos de hoy"
          de la home del atleta y en su pestaña de hábitos, con racha semanal
          basada en <strong>días marcados / 7</strong>.
        </p>
      </header>

      {/* Nuevo hábito */}
      <form action={createHabit} className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-semibold">Añadir hábito</p>
        <div className="grid gap-2 md:grid-cols-[80px_1.4fr_1fr_120px_auto]">
          <label className="block text-xs">
            <span className="font-semibold text-muted">Emoji</span>
            <input name="emoji" maxLength={4} placeholder="🎯" className={`${inputCls} mt-1`} />
          </label>
          <label className="block text-xs">
            <span className="font-semibold text-muted">Nombre</span>
            <input
              name="name"
              required
              placeholder="Ej. Cumplir con el plan"
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="block text-xs">
            <span className="font-semibold text-muted">Descripción (opc.)</span>
            <input
              name="description"
              placeholder="Máx 200 caracteres"
              className={`${inputCls} mt-1`}
            />
          </label>
          <label className="block text-xs">
            <span className="font-semibold text-muted">Meta semanal</span>
            <select name="weeklyTarget" defaultValue={7} className={`${inputCls} mt-1`}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n} / 7 días
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-fg hover:opacity-90"
            >
              <Plus size={13} className="mr-1 inline" /> Añadir
            </button>
          </div>
        </div>
      </form>

      {/* Listado editable */}
      <div className="space-y-2">
        {habits.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
            Sin hábitos todavía. Crea el primero arriba.
          </p>
        ) : null}
        {habits.map((h, i) => (
          <article
            key={h.id}
            className={`rounded-2xl border p-4 ${
              h.active ? "border-border bg-surface" : "border-dashed border-border bg-bg/40"
            }`}
          >
            <form action={updateHabit} className="space-y-2">
              <input type="hidden" name="id" value={h.id} />
              <div className="grid gap-2 md:grid-cols-[80px_1.4fr_1fr_120px]">
                <input
                  name="emoji"
                  defaultValue={h.emoji ?? ""}
                  maxLength={4}
                  placeholder="🎯"
                  className={inputCls}
                />
                <input name="name" defaultValue={h.name} required className={inputCls} />
                <input
                  name="description"
                  defaultValue={h.description ?? ""}
                  placeholder="Descripción"
                  className={inputCls}
                />
                <select
                  name="weeklyTarget"
                  defaultValue={h.weeklyTarget}
                  className={inputCls}
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n} / 7 días
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:opacity-90"
                >
                  Guardar
                </button>
              </div>
            </form>

            <div className="mt-2 flex items-center justify-end gap-1">
              <form action={moveHabit}>
                <input type="hidden" name="id" value={h.id} />
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
              <form action={moveHabit}>
                <input type="hidden" name="id" value={h.id} />
                <input type="hidden" name="direction" value="down" />
                <button
                  type="submit"
                  disabled={i === habits.length - 1}
                  title="Bajar"
                  className="rounded-md p-1 text-muted hover:text-primary disabled:opacity-30"
                >
                  <ChevronDown size={14} />
                </button>
              </form>
              <form action={toggleHabitActive}>
                <input type="hidden" name="id" value={h.id} />
                <button
                  type="submit"
                  className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                    h.active
                      ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                      : "bg-bg text-muted hover:bg-surface"
                  }`}
                >
                  {h.active ? "Activo" : "Inactivo"}
                </button>
              </form>
              <form action={deleteHabit}>
                <input type="hidden" name="id" value={h.id} />
                <button
                  type="submit"
                  title="Borrar del catálogo"
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
