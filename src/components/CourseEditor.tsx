"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Pencil, Video, FolderTree, Loader2 } from "lucide-react";
import { ImageUpload } from "@/components/ImageUpload";
import { CourseCover } from "@/components/CourseCover";
import { parseVideo } from "@/lib/video";

type Lesson = { id: string; title: string; description: string | null; videoUrl: string };
type Section = { id: string; title: string; lessons: Lesson[] };
type Course = {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  published: boolean;
  sections: Section[];
};

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d?.error || "Error");
  }
  return res.status === 200 ? res.json() : null;
}

export function CourseEditor({ course: initial }: { course: Course }) {
  const router = useRouter();
  const [course, setCourse] = useState<Course>(initial);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveCourse(patch: Partial<Course>) {
    setError(null);
    try {
      await api(`/api/community/modules/${course.id}`, "PATCH", patch);
      setCourse({ ...course, ...patch });
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteCourse() {
    if (!confirm("¿Borrar este curso entero (con secciones y lecciones)?")) return;
    try {
      await api(`/api/community/modules/${course.id}`, "DELETE");
      router.push("/comunidad");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function addSection(title: string) {
    const s = await api("/api/community/sections", "POST", { moduleId: course.id, title });
    setCourse({ ...course, sections: [...course.sections, { id: s.id, title: s.title, lessons: [] }] });
  }
  async function patchSection(id: string, patch: { title?: string }) {
    await api(`/api/community/sections/${id}`, "PATCH", patch);
    setCourse({
      ...course,
      sections: course.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  }
  async function deleteSection(id: string) {
    if (!confirm("¿Borrar esta sección con todas sus lecciones?")) return;
    await api(`/api/community/sections/${id}`, "DELETE");
    setCourse({ ...course, sections: course.sections.filter((s) => s.id !== id) });
  }

  async function addLesson(sectionId: string, data: { title: string; videoUrl: string; description?: string }) {
    const l = await api("/api/community/lessons", "POST", { sectionId, ...data });
    setCourse({
      ...course,
      sections: course.sections.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              lessons: [...s.lessons, { id: l.id, title: l.title, description: l.description, videoUrl: l.videoUrl }],
            }
          : s,
      ),
    });
  }
  async function patchLesson(sectionId: string, lessonId: string, patch: Partial<Lesson>) {
    await api(`/api/community/lessons/${lessonId}`, "PATCH", patch);
    setCourse({
      ...course,
      sections: course.sections.map((s) =>
        s.id === sectionId
          ? { ...s, lessons: s.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l)) }
          : s,
      ),
    });
  }
  async function deleteLesson(sectionId: string, lessonId: string) {
    if (!confirm("¿Borrar esta lección?")) return;
    await api(`/api/community/lessons/${lessonId}`, "DELETE");
    setCourse({
      ...course,
      sections: course.sections.map((s) =>
        s.id === sectionId ? { ...s, lessons: s.lessons.filter((l) => l.id !== lessonId) } : s,
      ),
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/comunidad" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
        <ArrowLeft size={16} /> Comunidad
      </Link>

      {/* Cabecera del curso */}
      <header className="mb-6 rounded-2xl border border-border bg-surface p-5">
        {editing ? (
          <CourseHeaderForm
            course={course}
            onSave={saveCourse}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-40 shrink-0">
              <CourseCover url={course.coverUrl} title={course.title} size="md" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold">{course.title}</h1>
              {course.description && <p className="mt-1 text-sm text-muted">{course.description}</p>}
              <p className="mt-2 text-xs">
                {course.published ? (
                  <span className="rounded-full bg-[#e7f6ec] px-2 py-0.5 text-[#15803d]">Publicado</span>
                ) : (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-zinc-600">Borrador</span>
                )}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-text"
              >
                <Pencil size={13} /> Editar
              </button>
              <button
                onClick={deleteCourse}
                className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
              >
                <Trash2 size={13} /> Borrar
              </button>
            </div>
          </div>
        )}
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </header>

      {/* Secciones */}
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
        <FolderTree size={16} /> Secciones
      </h2>
      <div className="space-y-3">
        {course.sections.map((s) => (
          <SectionCard
            key={s.id}
            section={s}
            onPatch={(p) => patchSection(s.id, p)}
            onDelete={() => deleteSection(s.id)}
            onAddLesson={(d) => addLesson(s.id, d)}
            onPatchLesson={(lid, p) => patchLesson(s.id, lid, p)}
            onDeleteLesson={(lid) => deleteLesson(s.id, lid)}
          />
        ))}
      </div>

      {/* Añadir sección */}
      <AddSection onAdd={addSection} />
    </div>
  );
}

function CourseHeaderForm({
  course,
  onSave,
  onCancel,
}: {
  course: Course;
  onSave: (patch: Partial<Course>) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? "");
  const [coverUrl, setCoverUrl] = useState(course.coverUrl);
  const [published, setPublished] = useState(course.published);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    await onSave({ title, description, coverUrl, published });
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título"
        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descripción"
        rows={3}
        className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <div>
        <p className="mb-1 text-xs font-medium text-muted">Portada</p>
        <ImageUpload value={coverUrl} onChange={setCoverUrl} accept="image/*" label="Subir portada" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
        Publicado (visible para los atletas)
      </label>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} disabled={busy} className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2">
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

function SectionCard({
  section,
  onPatch,
  onDelete,
  onAddLesson,
  onPatchLesson,
  onDeleteLesson,
}: {
  section: Section;
  onPatch: (p: { title?: string }) => Promise<void> | void;
  onDelete: () => void;
  onAddLesson: (d: { title: string; videoUrl: string; description?: string }) => Promise<void> | void;
  onPatchLesson: (id: string, p: Partial<Lesson>) => Promise<void> | void;
  onDeleteLesson: (id: string) => Promise<void> | void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(section.title);

  async function saveTitle() {
    await onPatch({ title });
    setEditingTitle(false);
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        {editingTitle ? (
          <div className="flex flex-1 gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-primary"
            />
            <button onClick={saveTitle} className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-fg">
              Guardar
            </button>
            <button onClick={() => { setTitle(section.title); setEditingTitle(false); }} className="rounded-lg px-3 py-1 text-xs text-muted hover:bg-surface-2">
              Cancelar
            </button>
          </div>
        ) : (
          <>
            <h3 className="font-semibold">{section.title}</h3>
            <div className="flex gap-1">
              <button onClick={() => setEditingTitle(true)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-text">
                <Pencil size={13} />
              </button>
              <button onClick={onDelete} className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600">
                <Trash2 size={13} />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Lecciones */}
      <ul className="mt-3 space-y-2">
        {section.lessons.map((l) => (
          <LessonRow
            key={l.id}
            lesson={l}
            onPatch={(p) => onPatchLesson(l.id, p)}
            onDelete={() => onDeleteLesson(l.id)}
          />
        ))}
        {section.lessons.length === 0 && <li className="text-xs text-muted">Aún no hay lecciones.</li>}
      </ul>

      <AddLesson onAdd={onAddLesson} />
    </section>
  );
}

function LessonRow({
  lesson,
  onPatch,
  onDelete,
}: {
  lesson: Lesson;
  onPatch: (p: Partial<Lesson>) => Promise<void> | void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(lesson.title);
  const [videoUrl, setVideoUrl] = useState(lesson.videoUrl);
  const [description, setDescription] = useState(lesson.description ?? "");

  async function save() {
    await onPatch({ title, videoUrl, description });
    setEditing(false);
  }

  if (editing) {
    return (
      <li className="rounded-lg border border-border p-3">
        <div className="space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-sm" />
          <input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="URL YouTube/Vimeo" className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-sm" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción (opcional)" rows={2} className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-sm" />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setTitle(lesson.title); setVideoUrl(lesson.videoUrl); setDescription(lesson.description ?? ""); setEditing(false); }} className="rounded-lg px-3 py-1 text-xs text-muted hover:bg-surface-2">Cancelar</button>
            <button onClick={save} className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-fg">Guardar</button>
          </div>
        </div>
      </li>
    );
  }
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <Video size={14} className="text-primary" />
        <span className="truncate">{lesson.title}</span>
      </span>
      <span className="flex shrink-0 gap-1">
        <button onClick={() => setEditing(true)} className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-text">
          <Pencil size={12} />
        </button>
        <button onClick={onDelete} className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600">
          <Trash2 size={12} />
        </button>
      </span>
    </li>
  );
}

function AddSection({ onAdd }: { onAdd: (title: string) => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-3 flex items-center gap-1.5 rounded-xl border border-dashed border-border px-4 py-2.5 text-sm font-medium text-muted hover:border-primary hover:text-text">
        <Plus size={15} /> Añadir sección
      </button>
    );
  }
  return (
    <div className="mt-3 flex gap-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título de la sección"
        className="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <button
        onClick={async () => {
          if (!title.trim() || busy) return;
          setBusy(true);
          await onAdd(title.trim());
          setBusy(false);
          setTitle("");
          setOpen(false);
        }}
        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg disabled:opacity-60"
        disabled={busy}
      >
        Añadir
      </button>
      <button onClick={() => setOpen(false)} className="rounded-xl px-3 py-2 text-sm text-muted hover:bg-surface-2">
        Cancelar
      </button>
    </div>
  );
}

function AddLesson({
  onAdd,
}: {
  onAdd: (d: { title: string; videoUrl: string; description?: string }) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-3 flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-soft">
        <Plus size={13} /> Añadir lección
      </button>
    );
  }

  const preview = parseVideo(videoUrl);

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-dashed border-border p-3">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título de la lección"
        className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-primary"
      />
      <input
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
        placeholder="URL YouTube o Vimeo"
        className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-primary"
      />
      {videoUrl && preview.provider === "unknown" && (
        <p className="text-xs text-amber-700">⚠️ URL no reconocida como YouTube/Vimeo.</p>
      )}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descripción (opcional)"
        rows={2}
        className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-primary"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={() => {
            setOpen(false);
            setTitle("");
            setVideoUrl("");
            setDescription("");
          }}
          className="rounded-lg px-3 py-1 text-xs text-muted hover:bg-surface-2"
        >
          Cancelar
        </button>
        <button
          onClick={async () => {
            if (!title.trim() || !videoUrl.trim() || busy) return;
            setBusy(true);
            await onAdd({ title: title.trim(), videoUrl: videoUrl.trim(), description: description.trim() || undefined });
            setBusy(false);
            setTitle("");
            setVideoUrl("");
            setDescription("");
            setOpen(false);
          }}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-fg disabled:opacity-60"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Añadir
        </button>
      </div>
    </div>
  );
}
