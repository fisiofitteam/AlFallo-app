import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardList, Plus, Trash2, EyeOff, Eye } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import { WEEKDAYS, dayLabel } from "@/lib/weekly-tasks";
import {
  createWeeklyTask,
  deleteWeeklyTask,
  toggleActive,
  updateWeeklyTask,
} from "./actions";

export const metadata = { title: "Tareas semanales · Equipo · Al Fallo" };
export const dynamic = "force-dynamic";

// Roles que pueden ser asignatarios (los que ven el checklist y lo marcan).
const ASSIGNABLE_ROLES = ["nutricionista", "head_coach"];

export default async function WeeklyTasksConfigPage() {
  const prof = await requireProfessional();
  if (!isManager(prof.role)) redirect("/");

  const [tasks, assignableTeam] = await Promise.all([
    prisma.weeklyTaskTemplate.findMany({
      orderBy: [{ dayOfWeek: "asc" }, { order: "asc" }],
      include: {
        assignee: { select: { fullName: true } },
        _count: { select: { completions: true } },
      },
    }),
    prisma.professional.findMany({
      where: { role: { in: ASSIGNABLE_ROLES }, isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, role: true },
    }),
  ]);

  // Agrupamos por día para el listado.
  const tasksByDay = WEEKDAYS.map((wd) => ({
    ...wd,
    items: tasks.filter((t) => t.dayOfWeek === wd.value),
  }));

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft size={14} /> Volver al panel
      </Link>

      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ClipboardList size={22} className="text-primary" /> Tareas semanales
        </h1>
        <p className="mt-1 text-sm text-muted">
          Plantillas que aparecen cada semana en el panel del equipo (lunes a viernes).
          El check vive por persona y por semana, así que el lunes la lista se resetea
          sola.
        </p>
      </header>

      {/* Formulario de nueva tarea */}
      <section className="mb-7 rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted">
          <Plus size={14} /> Nueva tarea
        </h2>
        <form action={createWeeklyTask} className="grid grid-cols-1 gap-3 sm:grid-cols-6">
          <input
            name="title"
            required
            placeholder="Título de la tarea (ej. Llamar a clientes pendientes)"
            className="sm:col-span-3 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <select
            name="dayOfWeek"
            defaultValue="1"
            className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
          >
            {WEEKDAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.long}
              </option>
            ))}
          </select>
          <select
            name="assigneeId"
            defaultValue=""
            className="sm:col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">Para todos los nutris</option>
            {assignableTeam.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>
          <input
            name="description"
            placeholder="Detalle (opcional, se ve al pasar el ratón)"
            className="sm:col-span-5 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Crear
          </button>
        </form>
      </section>

      {/* Listado actual */}
      {tasks.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
          Aún no hay tareas. Crea la primera arriba.
        </p>
      ) : (
        <div className="space-y-4">
          {tasksByDay.map((day) => (
            <section key={day.value} className="rounded-2xl border border-border bg-surface">
              <header className="border-b border-border px-4 py-2.5">
                <h3 className="text-sm font-bold">{day.long}</h3>
              </header>
              {day.items.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">Sin tareas este día.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {day.items.map((t) => (
                    <li key={t.id} className="p-4">
                      <form action={updateWeeklyTask} className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                        <input type="hidden" name="id" value={t.id} />
                        <input
                          name="title"
                          defaultValue={t.title}
                          required
                          className={`sm:col-span-3 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary ${
                            !t.active ? "opacity-50" : ""
                          }`}
                        />
                        <select
                          name="dayOfWeek"
                          defaultValue={String(t.dayOfWeek)}
                          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
                        >
                          {WEEKDAYS.map((d) => (
                            <option key={d.value} value={d.value}>
                              {d.long}
                            </option>
                          ))}
                        </select>
                        <select
                          name="assigneeId"
                          defaultValue={t.assigneeId ?? ""}
                          className="sm:col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
                        >
                          <option value="">Para todos los nutris</option>
                          {assignableTeam.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.fullName}
                            </option>
                          ))}
                        </select>
                        <input
                          name="description"
                          defaultValue={t.description ?? ""}
                          placeholder="Detalle (opcional)"
                          className="sm:col-span-4 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                        <div className="sm:col-span-2 flex items-center justify-end gap-2">
                          <button
                            type="submit"
                            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                          >
                            Guardar
                          </button>
                        </div>
                      </form>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted">
                        <span>
                          {t.assignee?.fullName ? `Asignada a ${t.assignee.fullName}` : "Para todos los nutris"}
                          {!t.active && " · oculta"}
                          {" · "}
                          {t._count.completions} {t._count.completions === 1 ? "vez completada" : "veces completada"}
                        </span>
                        <div className="flex gap-1">
                          <form action={toggleActive}>
                            <input type="hidden" name="id" value={t.id} />
                            <button
                              type="submit"
                              title={t.active ? "Ocultar de los paneles" : "Reactivar"}
                              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:border-primary hover:text-text"
                            >
                              {t.active ? <EyeOff size={12} /> : <Eye size={12} />}
                              {t.active ? "Ocultar" : "Reactivar"}
                            </button>
                          </form>
                          <form action={deleteWeeklyTask}>
                            <input type="hidden" name="id" value={t.id} />
                            <button
                              type="submit"
                              title="Borrar"
                              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-red-600 hover:border-red-400"
                            >
                              <Trash2 size={12} /> Borrar
                            </button>
                          </form>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-muted">
        Recordatorio: los días son {WEEKDAYS.map((d) => dayLabel(d.value)).join(", ")}. Sin findes.
      </p>
    </div>
  );
}
