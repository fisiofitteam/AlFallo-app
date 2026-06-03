"use client";

import { useState, useTransition } from "react";
import { Check, ListChecks } from "lucide-react";
import { toggleWeeklyTask } from "@/app/(panel)/weekly-tasks-actions";
import { WEEKDAYS } from "@/lib/weekly-tasks";

export type WeeklyTaskItem = {
  id: string;
  title: string;
  dayOfWeek: number;
  order: number;
  done: boolean;
};

/**
 * Tarjeta de tareas semanales del panel principal del nutri / head_coach.
 * Layout L-V, contador "hechas/total" por día, toggle optimista.
 */
export function WeeklyTasksCard({ tasks }: { tasks: WeeklyTaskItem[] }) {
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>(
    () => Object.fromEntries(tasks.map((t) => [t.id, t.done])),
  );
  const [, startTransition] = useTransition();

  function toggle(id: string) {
    const prev = !!doneMap[id];
    setDoneMap((m) => ({ ...m, [id]: !prev }));
    startTransition(async () => {
      try {
        await toggleWeeklyTask(id);
      } catch {
        setDoneMap((m) => ({ ...m, [id]: prev }));
      }
    });
  }

  const tasksByDay = WEEKDAYS.map((wd) => ({
    ...wd,
    items: tasks
      .filter((t) => t.dayOfWeek === wd.value)
      .sort((a, b) => a.order - b.order),
  }));

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
        <p className="flex items-center gap-2 font-semibold">
          <ListChecks size={18} className="text-primary" />
          Tareas de la semana
        </p>
        <p className="text-xs text-muted">Se reinician cada lunes a las 00:00</p>
      </header>

      <div className="grid grid-cols-1 gap-0 divide-y divide-border md:grid-cols-5 md:divide-x md:divide-y-0">
        {tasksByDay.map((day) => {
          const total = day.items.length;
          const done = day.items.filter((t) => doneMap[t.id]).length;
          return (
            <div key={day.value} className="flex min-h-[120px] flex-col p-4">
              <header className="mb-3 flex items-baseline justify-between">
                <p className="font-bold">{day.long}</p>
                <span className="text-xs text-muted">
                  {total === 0 ? "0" : `${done}/${total}`}
                </span>
              </header>
              {total === 0 ? (
                <p className="text-xs italic text-muted/70">Sin tareas</p>
              ) : (
                <ul className="space-y-1.5">
                  {day.items.map((t) => {
                    const checked = !!doneMap[t.id];
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => toggle(t.id)}
                          title={t.title}
                          className="group flex w-full items-start gap-2 rounded-md p-1 text-left transition hover:bg-bg"
                        >
                          <span
                            className={`mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-sm border transition ${
                              checked
                                ? "border-primary bg-primary text-white"
                                : "border-border bg-bg group-hover:border-primary"
                            }`}
                          >
                            {checked ? <Check size={10} strokeWidth={3} /> : null}
                          </span>
                          <span
                            className={`flex-1 text-xs leading-snug ${
                              checked ? "text-muted line-through" : "text-text"
                            }`}
                          >
                            {t.title}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
