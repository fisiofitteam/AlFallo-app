"use client";

import { useState, useRef } from "react";
import { Plus, X, Pencil, Trash2, Check, ListChecks } from "lucide-react";
import { WEEKDAYS } from "@/lib/weekly-tasks";
import {
  createWeeklyTask,
  renameWeeklyTask,
  deleteWeeklyTask,
} from "@/app/(panel)/tareas/actions";

export type EditorTask = {
  id: string;
  title: string;
  dayOfWeek: number;
  order: number;
  active: boolean;
};

export function RoleSection({
  emoji,
  roleLabel,
  targetRole,
  tasks,
}: {
  emoji: string;
  roleLabel: string;
  targetRole: string;
  tasks: EditorTask[];
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        <span>{emoji}</span>
        {roleLabel}
      </h2>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="flex items-center gap-2 font-semibold">
            <ListChecks size={18} className="text-primary" />
            Tareas semanales · {roleLabel}
          </p>
          <p className="text-xs text-muted">Añade, edita o quita tareas por día</p>
        </header>
        <div className="grid grid-cols-1 gap-0 divide-y divide-border md:grid-cols-5 md:divide-x md:divide-y-0">
          {WEEKDAYS.map((day) => {
            const dayTasks = tasks
              .filter((t) => t.dayOfWeek === day.value)
              .sort((a, b) => a.order - b.order);
            return (
              <DayColumn
                key={day.value}
                dayValue={day.value}
                dayLabel={day.long}
                targetRole={targetRole}
                tasks={dayTasks}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DayColumn({
  dayValue,
  dayLabel,
  targetRole,
  tasks,
}: {
  dayValue: number;
  dayLabel: string;
  targetRole: string;
  tasks: EditorTask[];
}) {
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex min-h-[140px] flex-col p-4">
      <header className="mb-3 flex items-baseline justify-between">
        <p className="font-bold">{dayLabel}</p>
        <span className="text-xs text-muted">{tasks.length}</span>
      </header>

      <ul className="flex-1 space-y-1.5">
        {tasks.length === 0 && !adding ? (
          <p className="text-xs italic text-muted/70">Sin tareas</p>
        ) : null}
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </ul>

      <div className="mt-3">
        {adding ? (
          <form
            action={async (fd) => {
              const title = String(fd.get("title") ?? "").trim();
              if (title) {
                await createWeeklyTask(fd);
              }
              setAdding(false);
            }}
            className="flex items-center gap-1"
          >
            <input type="hidden" name="dayOfWeek" value={dayValue} />
            <input type="hidden" name="targetRole" value={targetRole} />
            <input
              ref={inputRef}
              autoFocus
              name="title"
              placeholder="Nueva tarea…"
              className="flex-1 rounded-md border border-primary/50 bg-bg px-2 py-1.5 text-xs outline-none focus:border-primary"
            />
            <button
              type="submit"
              title="Guardar"
              className="rounded-md bg-primary p-1.5 text-white hover:opacity-90"
            >
              <Check size={12} />
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              title="Cancelar"
              className="rounded-md p-1.5 text-muted hover:bg-bg"
            >
              <X size={12} />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center gap-1 rounded-md px-1 py-1 text-xs text-muted transition hover:bg-bg hover:text-primary"
          >
            <Plus size={12} /> Añadir
          </button>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: EditorTask }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <form
          action={async (fd) => {
            const title = String(fd.get("title") ?? "").trim();
            if (title && title !== task.title) {
              await renameWeeklyTask(fd);
            }
            setEditing(false);
          }}
          className="flex items-center gap-1"
        >
          <input type="hidden" name="id" value={task.id} />
          <input
            autoFocus
            name="title"
            defaultValue={task.title}
            className="flex-1 rounded-md border border-primary/50 bg-bg px-2 py-1 text-xs outline-none focus:border-primary"
          />
          <button
            type="submit"
            title="Guardar"
            className="rounded-md bg-primary p-1 text-white hover:opacity-90"
          >
            <Check size={11} />
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            title="Cancelar"
            className="rounded-md p-1 text-muted hover:bg-bg"
          >
            <X size={11} />
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="group flex items-start gap-2 rounded-md p-1 transition hover:bg-bg">
      <span
        className="mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-sm border border-border bg-bg"
        aria-hidden
      />
      <span className="flex-1 text-xs leading-snug">{task.title}</span>
      <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Editar"
          className="rounded p-0.5 text-muted hover:bg-surface hover:text-text"
        >
          <Pencil size={11} />
        </button>
        <form action={deleteWeeklyTask}>
          <input type="hidden" name="id" value={task.id} />
          <button
            type="submit"
            title="Borrar"
            className="rounded p-0.5 text-muted hover:bg-surface hover:text-red-600"
            onClick={(e) => {
              if (!confirm(`¿Borrar la tarea "${task.title}"?`)) e.preventDefault();
            }}
          >
            <Trash2 size={11} />
          </button>
        </form>
      </span>
    </li>
  );
}
