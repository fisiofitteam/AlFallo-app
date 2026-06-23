"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Check, Play, Loader2, CheckCircle2 } from "lucide-react";
import { parseVideo } from "@/lib/video";
import { CourseCover } from "@/components/CourseCover";

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  completed: boolean;
};

type Section = {
  id: string;
  title: string;
  lessons: Lesson[];
};

type Course = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
};

export function ClientCourse({
  course,
  sections,
}: {
  course: Course;
  sections: Section[];
}) {
  // Aplanamos las lecciones para poder navegar prev/next entre secciones.
  const flat = useMemo(() => sections.flatMap((s) => s.lessons.map((l) => ({ ...l, sectionTitle: s.title }))), [sections]);
  const firstUndone = flat.find((l) => !l.completed);
  const [currentId, setCurrentId] = useState<string | null>(firstUndone?.id ?? flat[0]?.id ?? null);
  const [progress, setProgress] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(flat.map((l) => [l.id, l.completed])),
  );
  const [saving, setSaving] = useState(false);

  const total = flat.length;
  const done = flat.filter((l) => progress[l.id]).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const current = currentId ? flat.find((l) => l.id === currentId) ?? null : null;
  const video = current ? parseVideo(current.videoUrl) : null;

  async function toggleComplete() {
    if (!current) return;
    setSaving(true);
    const prev = progress[current.id] ?? false;
    setProgress((p) => ({ ...p, [current.id]: !prev }));
    try {
      const res = await fetch(`/api/community/lessons/${current.id}/complete`, { method: "POST" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { completed: boolean };
      setProgress((p) => ({ ...p, [current.id]: data.completed }));
    } catch {
      // revertir
      setProgress((p) => ({ ...p, [current.id]: prev }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-10">
      <Link
        href="/cliente/recursos"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ChevronLeft size={16} /> Volver a Recursos
      </Link>

      {/* Cabecera del curso */}
      <div className="mb-5 rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3">
          <CourseCover coverUrl={course.coverUrl} title={course.title} className="aspect-video w-full rounded-xl border border-border" />
        </div>
        <h1 className="text-xl font-extrabold text-text">{course.title}</h1>
        {course.description ? (
          <p className="mt-1 text-sm text-muted">{course.description}</p>
        ) : null}
        <div className="mt-3">
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">
            {done}/{total} lecciones · {pct}%
          </p>
        </div>
      </div>

      {/* Reproductor + descripción de la lección actual */}
      {current ? (
        <section className="mb-5 rounded-2xl border border-border bg-surface p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted">Lección actual</p>
          <h2 className="mb-3 text-lg font-bold text-text">{current.title}</h2>
          {video?.embedUrl ? (
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-bg">
              <iframe
                src={video.embedUrl}
                title={current.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border bg-bg text-sm text-muted">
              Vídeo no disponible
            </div>
          )}
          {current.description ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-text">{current.description}</p>
          ) : null}
          <button
            onClick={toggleComplete}
            disabled={saving}
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
              progress[current.id]
                ? "bg-surface-2 text-primary"
                : "bg-primary text-primary-fg hover:opacity-90"
            }`}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : progress[current.id] ? <CheckCircle2 size={16} /> : <Check size={16} />}
            {progress[current.id] ? "Lección completada — quitar" : "Marcar como completada"}
          </button>
        </section>
      ) : null}

      {/* Lista de secciones y lecciones */}
      <section className="space-y-4">
        {sections.map((s) => (
          <div key={s.id} className="rounded-2xl border border-border bg-surface p-4">
            <p className="mb-2 text-sm font-bold text-text">{s.title}</p>
            <ul className="space-y-1">
              {s.lessons.map((l) => {
                const isCurrent = l.id === currentId;
                const isDone = progress[l.id] ?? false;
                return (
                  <li key={l.id}>
                    <button
                      onClick={() => setCurrentId(l.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition ${
                        isCurrent ? "bg-primary-soft text-text" : "hover:bg-surface-2 text-muted"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border ${
                          isDone
                            ? "border-primary bg-primary text-primary-fg"
                            : isCurrent
                            ? "border-primary text-primary"
                            : "border-border"
                        }`}
                      >
                        {isDone ? <Check size={14} /> : <Play size={12} fill="currentColor" />}
                      </span>
                      <span className={`flex-1 ${isCurrent ? "font-semibold text-text" : ""}`}>{l.title}</span>
                    </button>
                  </li>
                );
              })}
              {s.lessons.length === 0 ? (
                <li className="px-2 py-1 text-xs text-muted">Sin lecciones todavía.</li>
              ) : null}
            </ul>
          </div>
        ))}
        {sections.length === 0 ? (
          <p className="text-center text-sm text-muted">Este curso aún no tiene contenido.</p>
        ) : null}
      </section>
    </div>
  );
}
