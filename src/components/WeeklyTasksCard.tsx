"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, ClipboardList, Settings } from "lucide-react";
import { toggleWeeklyTask } from "@/app/(panel)/weekly-tasks-actions";
import { WEEKDAYS, weekRangeLabel } from "@/lib/weekly-tasks";

export type WeeklyTaskItem = {
  id: string;
  title: string;
  description: string | null;
  dayOfWeek: number;
  order: number;
  assigneeName: string | null; // null = "todos"
  done: boolean; // si el actor actual lo tiene marcado esta semana
};

export function WeeklyTasksCard({
  tasks,
  weekStartIso,
  canConfigure,
  canCheck,
}: {
  tasks: WeeklyTaskItem[];
  weekStartIso: string;
  canConfigure: boolean;
  canCheck: boolean;
}) {
  // Estado optimista: marcamos al instante y luego sincronizamos.
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>(
    () => Object.fromEntries(tasks.map((t) => [t.id, t.done])),
  );
  const [, startTransition] = useTransition();

  // Si llegan tareas nuevas (revalidate), refrescamos el estado base.
  // (sin useEffect — los toggles intermedios se respetan porque sincronizamos al volver.)
  const tasksByDay = WEEKDAYS.map((wd) => ({
    ...wd,
    items: tasks
      .filter((t) => t.dayOfWeek === wd.value)
      .sort((a, b) => a.order - b.order),
  }));

  const total = tasks.length;
  const done = tasks.filter((t) => doneMap[t.id]).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  function toggle(id: string) {
    if (!canCheck) return;
    const prev = !!doneMap[id];
    setDoneMap((m) => ({ ...m, [id]: !prev }));
    startTransition(async () => {
      try {
        await toggleWeeklyTask(id);
      } catch {
        // Revertimos si fallara.
        setDoneMap((m) => ({ ...m, [id]: prev }));
      }
    });
  }

  return (
    <section className="mb-6 rounded-2xl border border-border bg-surface p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <ClipboardList size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold leading-tight">Tareas semanales</h2>
            <p className="text-xs text-muted">{weekRangeLabel(new Date(weekStartIso))}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {total > 0 ? (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-28 overflow-hidden rounded-full bg-bg">
                <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-semibold text-muted">
                {done}/{total}
              </span>
            </div>
          ) : null}
          {canConfigure ? (
            <Link
              href="/equipo/tareas-semanales"
              className="flex items-center gap-1 rounded-lg border border-border bg-bg px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-primary hover:text-text"
              title="Configurar tareas"
            >
              <Settings size={14} /> Configurar
            </Link>
          ) : null}
        </div>
      </header>

      {total === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg/50 p-6 text-center text-sm text-muted">
          No hay tareas para esta semana.
          {canConfigure ? (
            <>
              {" "}
              <Link href="/equipo/tareas-semanales" className="font-semibold text-primary hover:underline">
                Crear la primera
              </Link>
              .
            </>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {tasksByDay.map((day) => (
            <div key={day.value} className="rounded-xl border border-border bg-bg/40 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                {day.short}
              </p>
              {day.items.length === 0 ? (
                <p className="text-xs text-muted/60">—</p>
              ) : (
                <ul className="space-y-1.5">
                  {day.items.map((t) => {
                    const checked = !!doneMap[t.id];
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => toggle(t.id)}
                          disabled={!canCheck}
                          title={canCheck ? t.description || t.title : "Solo visualización"}
                          className={`group flex w-full items-start gap-2 rounded-lg p-1.5 text-left text-xs transition disabled:cursor-default ${
                            canCheck ? "hover:bg-bg" : ""
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition ${
                              checked
                                ? "border-primary bg-primary text-white"
                                : "border-border bg-bg group-hover:border-primary"
                            }`}
                          >
                            {checked ? <Check size={11} strokeWidth={3} /> : null}
                          </span>
                          <span
                            className={`flex-1 leading-snug ${
                              checked ? "text-muted line-through" : "text-text"
                            }`}
                          >
                            {t.title}
                            {t.assigneeName ? (
                              <span className="ml-1 text-[10px] text-muted">· {t.assigneeName.split(" ")[0]}</span>
                            ) : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
