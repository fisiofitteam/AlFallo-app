"use client";

import { useState } from "react";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import {
  WEEKDAY_LABELS,
  NTH_WEEK_OPTIONS,
  ruleSummary,
  type OneOffMode,
} from "@/lib/oneoff-tasks";
import { createOneOffTask, deleteOneOffTask } from "@/app/(panel)/tareas/oneoff-actions";

export type EditorOneOff = {
  id: string;
  title: string;
  targetRole: string;
  mode: string;
  date: string | null; // ISO
  startDate: string | null;
  endDate: string | null;
  nthWeek: number | null;
  weekday: number | null;
  until: string | null;
};

function summaryFor(t: EditorOneOff): string {
  return ruleSummary({
    mode: t.mode,
    date: t.date ? new Date(t.date) : null,
    startDate: t.startDate ? new Date(t.startDate) : null,
    endDate: t.endDate ? new Date(t.endDate) : null,
    nthWeek: t.nthWeek,
    weekday: t.weekday,
    until: t.until ? new Date(t.until) : null,
  });
}

export function OneOffTasksSection({
  tasks,
  assignableTeam,
}: {
  tasks: EditorOneOff[];
  assignableTeam: { id: string; fullName: string; role: string }[];
}) {
  const [showForm, setShowForm] = useState(tasks.length === 0);

  const nutriTasks = tasks.filter((t) => t.targetRole === "nutricionista");
  const coachTasks = tasks.filter((t) => t.targetRole === "head_coach");

  return (
    <section className="mb-10">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <CalendarClock size={20} className="text-primary" />
        Tareas puntuales
      </h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
          <p className="text-sm text-muted">
            Tareas con fecha o recurrencia mensual. Aparecen en la tarjeta de "Puntuales"
            del nutri y desaparecen al marcarlas.
          </p>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            <Plus size={13} /> {showForm ? "Cerrar" : "Nueva tarea"}
          </button>
        </header>

        {showForm ? <NewOneOffForm assignableTeam={assignableTeam} /> : null}

        <div className="grid grid-cols-1 gap-0 divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
          <OneOffList title="🥑 Nutricionistas" tasks={nutriTasks} />
          <OneOffList title="⭐ Head Coach" tasks={coachTasks} />
        </div>
      </div>
    </section>
  );
}

function OneOffList({ title, tasks }: { title: string; tasks: EditorOneOff[] }) {
  return (
    <div className="p-5">
      <h3 className="mb-3 text-sm font-bold">{title}</h3>
      {tasks.length === 0 ? (
        <p className="text-xs italic text-muted/70">Sin tareas puntuales.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li
              key={t.id}
              className="group flex items-start justify-between gap-2 rounded-lg border border-border bg-bg p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t.title}</p>
                <p className="text-xs text-muted">{summaryFor(t)}</p>
              </div>
              <form action={deleteOneOffTask}>
                <input type="hidden" name="id" value={t.id} />
                <button
                  type="submit"
                  title="Borrar"
                  className="rounded-md p-1 text-muted opacity-0 transition group-hover:opacity-100 hover:bg-surface hover:text-red-600"
                  onClick={(e) => {
                    if (!confirm(`¿Borrar la tarea "${t.title}"?`)) e.preventDefault();
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NewOneOffForm({
  assignableTeam,
}: {
  assignableTeam: { id: string; fullName: string; role: string }[];
}) {
  const [mode, setMode] = useState<OneOffMode>("single");
  const [targetRole, setTargetRole] = useState("nutricionista");

  const filteredTeam = assignableTeam.filter((p) => p.role === targetRole);

  return (
    <form action={createOneOffTask} className="border-b border-border bg-bg/40 px-5 py-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
        <input
          name="title"
          required
          placeholder="Título (ej. Llamada con proveedor)"
          className="sm:col-span-3 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <select
          name="targetRole"
          value={targetRole}
          onChange={(e) => setTargetRole(e.target.value)}
          className="sm:col-span-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="nutricionista">Nutris</option>
          <option value="head_coach">Head Coach</option>
        </select>
        <select
          name="assigneeId"
          defaultValue=""
          className="sm:col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">Todos los del rol</option>
          {filteredTeam.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
            </option>
          ))}
        </select>

        <select
          name="mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as OneOffMode)}
          className="sm:col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="single">Un día concreto</option>
          <option value="range">Rango de fechas</option>
          <option value="monthly_weekday">Cada mes: día de la semana</option>
        </select>

        {/* Campos por modo */}
        {mode === "single" ? (
          <input
            type="date"
            name="date"
            required
            className="sm:col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
          />
        ) : null}
        {mode === "range" ? (
          <>
            <input
              type="date"
              name="startDate"
              required
              className="sm:col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              type="date"
              name="endDate"
              required
              className="sm:col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </>
        ) : null}
        {mode === "monthly_weekday" ? (
          <>
            <select
              name="nthWeek"
              required
              defaultValue="1"
              className="sm:col-span-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {NTH_WEEK_OPTIONS.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </select>
            <select
              name="weekday"
              required
              defaultValue="1"
              className="sm:col-span-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {WEEKDAY_LABELS.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.long}
                </option>
              ))}
            </select>
            <input
              type="date"
              name="until"
              placeholder="Hasta (opcional)"
              className="sm:col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
              title="Opcional: hasta cuándo se repite"
            />
          </>
        ) : null}
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Crear tarea
        </button>
      </div>
    </form>
  );
}
