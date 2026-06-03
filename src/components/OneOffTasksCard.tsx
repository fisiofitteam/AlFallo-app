"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Check } from "lucide-react";
import { toggleOneOffTask } from "@/app/(panel)/oneoff-toggle-action";

export type OneOffCardItem = {
  id: string;
  title: string;
  due: string; // "el 15 jun", "hasta 7 jun", "este mes"
};

/**
 * Tarjeta de tareas puntuales (con fecha o recurrencia mensual). Solo pinta
 * tareas activas hoy y no marcadas. Al marcar, optimismo + revalidate.
 */
export function OneOffTasksCard({ items }: { items: OneOffCardItem[] }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();

  if (items.length === 0) return null;

  const visible = items.filter((i) => !hidden[i.id]);

  function markDone(id: string) {
    setHidden((m) => ({ ...m, [id]: true }));
    startTransition(async () => {
      try {
        await toggleOneOffTask(id);
      } catch {
        setHidden((m) => ({ ...m, [id]: false }));
      }
    });
  }

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
        <p className="flex items-center gap-2 font-semibold">
          <CalendarClock size={18} className="text-primary" />
          Tareas puntuales
        </p>
        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-bold text-primary">
          {visible.length} {visible.length === 1 ? "pendiente" : "pendientes"}
        </span>
      </header>

      {visible.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">¡Todo limpio por ahora! 🎉</p>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-5 py-3">
              <button
                type="button"
                onClick={() => markDone(t.id)}
                aria-label="Marcar como hecha"
                title="Marcar como hecha"
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border border-border bg-bg transition hover:border-primary hover:bg-primary hover:text-white"
              >
                <Check size={12} className="opacity-0 transition group-hover:opacity-100" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.title}</p>
                <p className="text-xs text-muted">{t.due}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
