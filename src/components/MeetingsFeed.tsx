"use client";

import { useState } from "react";
import { ChevronDown, Pin, Pencil, Trash2, Plus, X, Calendar } from "lucide-react";
import {
  createMeeting,
  updateMeeting,
  deleteMeeting,
  togglePinMeeting,
} from "@/app/(panel)/reuniones/actions";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  type MeetingCategory,
} from "@/app/(panel)/reuniones/categories";

export type MeetingItem = {
  id: string;
  title: string;
  objective: string | null;
  category: MeetingCategory;
  date: string | null; // ISO
  body: string;
  pinned: boolean;
  authorName: string | null;
  createdAt: string;
};

export function MeetingsFeed({
  meetings,
  category,
  canManage,
}: {
  meetings: MeetingItem[];
  category: MeetingCategory;
  canManage: boolean;
}) {
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {meetings.length} {meetings.length === 1 ? "reunión" : "reuniones"} en{" "}
          <strong>{CATEGORY_LABEL[category]}</strong>
        </p>
        {canManage ? (
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            {showNew ? <X size={13} /> : <Plus size={13} />}
            {showNew ? "Cerrar" : "Nueva reunión"}
          </button>
        ) : null}
      </div>

      {showNew ? <NewMeetingForm category={category} onDone={() => setShowNew(false)} /> : null}

      {meetings.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
          Aún no hay reuniones en esta categoría.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {meetings.map((m) => (
            <MeetingCard key={m.id} meeting={m} canManage={canManage} />
          ))}
        </ul>
      )}
    </div>
  );
}

function MeetingCard({ meeting, canManage }: { meeting: MeetingItem; canManage: boolean }) {
  const [editing, setEditing] = useState(false);
  const date = meeting.date ? new Date(meeting.date) : new Date(meeting.createdAt);
  const fmt = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (editing) {
    return (
      <li>
        <EditMeetingForm
          meeting={meeting}
          onDone={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li>
      <details className="group overflow-hidden rounded-2xl border border-border bg-surface transition open:shadow-sm">
        <summary className="cursor-pointer list-none p-4 transition hover:bg-bg/40">
          <div className="flex items-start gap-3">
            <ChevronDown
              size={18}
              className="mt-1 flex-shrink-0 text-muted transition group-open:rotate-180"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                {meeting.pinned ? <Pin size={14} className="text-primary" /> : null}
                <h3 className="text-base font-bold leading-tight">{meeting.title}</h3>
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Calendar size={12} /> {fmt.format(date)}
                </span>
              </div>
              {meeting.objective ? (
                <p className="mt-1 line-clamp-1 text-sm text-muted">{meeting.objective}</p>
              ) : null}
            </div>
          </div>
        </summary>
        <div className="border-t border-border px-5 pb-5 pt-4">
          {meeting.body.trim() ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{meeting.body}</p>
          ) : (
            <p className="text-sm italic text-muted">Sin notas todavía.</p>
          )}
          <footer className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>
              {meeting.authorName ? `Por ${meeting.authorName}` : null}
            </span>
            {canManage ? (
              <div className="flex items-center gap-1">
                <form action={togglePinMeeting}>
                  <input type="hidden" name="id" value={meeting.id} />
                  <button
                    type="submit"
                    title={meeting.pinned ? "Quitar pin" : "Fijar arriba"}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:border-primary hover:text-text"
                  >
                    <Pin size={11} /> {meeting.pinned ? "Quitar pin" : "Fijar"}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:border-primary hover:text-text"
                >
                  <Pencil size={11} /> Editar
                </button>
                <form action={deleteMeeting}>
                  <input type="hidden" name="id" value={meeting.id} />
                  <button
                    type="submit"
                    title="Borrar"
                    onClick={(e) => {
                      if (!confirm(`¿Borrar la reunión "${meeting.title}"?`)) e.preventDefault();
                    }}
                    className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-red-600 hover:border-red-300"
                  >
                    <Trash2 size={11} /> Borrar
                  </button>
                </form>
              </div>
            ) : null}
          </footer>
        </div>
      </details>
    </li>
  );
}

function NewMeetingForm({
  category,
  onDone,
}: {
  category: MeetingCategory;
  onDone: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form
      action={async (fd) => {
        await createMeeting(fd);
        onDone();
      }}
      className="mb-4 rounded-2xl border border-primary/40 bg-surface p-5"
    >
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-primary">Nueva reunión</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="title"
          required
          placeholder="Título (ej. Reunión semanal de nutris 7/6)"
          className="sm:col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <input
          type="date"
          name="date"
          defaultValue={today}
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <select
          name="category"
          defaultValue={category}
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <input
          name="objective"
          placeholder="Objetivo principal (lo que se ve al colapsar)"
          className="sm:col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <textarea
          name="body"
          rows={6}
          placeholder="Notas, orden del día, acuerdos… (texto libre, los saltos de línea y guiones se respetan)"
          className="sm:col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-bg hover:text-text"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Publicar
        </button>
      </div>
    </form>
  );
}

function EditMeetingForm({
  meeting,
  onDone,
}: {
  meeting: MeetingItem;
  onDone: () => void;
}) {
  const dateStr = meeting.date
    ? new Date(meeting.date).toISOString().slice(0, 10)
    : "";
  return (
    <form
      action={async (fd) => {
        await updateMeeting(fd);
        onDone();
      }}
      className="rounded-2xl border border-primary/40 bg-surface p-5"
    >
      <input type="hidden" name="id" value={meeting.id} />
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-primary">
        Editando reunión
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="title"
          required
          defaultValue={meeting.title}
          className="sm:col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <input
          type="date"
          name="date"
          defaultValue={dateStr}
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <select
          name="category"
          defaultValue={meeting.category}
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <input
          name="objective"
          defaultValue={meeting.objective ?? ""}
          placeholder="Objetivo principal"
          className="sm:col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <textarea
          name="body"
          rows={8}
          defaultValue={meeting.body}
          className="sm:col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        />
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-bg hover:text-text"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Guardar
        </button>
      </div>
    </form>
  );
}
