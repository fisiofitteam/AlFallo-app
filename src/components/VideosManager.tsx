"use client";

import { useState } from "react";
import { Plus, X, Pencil, Trash2, Video, ChevronDown, ExternalLink } from "lucide-react";
import { parseVideo } from "@/lib/video";
import { createVideo, updateVideo, deleteVideo } from "@/app/(panel)/biblioteca/videos/actions";

export type VideoItem = {
  id: string;
  title: string;
  description: string | null;
  url: string;
  category: string | null;
  authorName: string | null;
};

export function VideosManager({ videos }: { videos: VideoItem[] }) {
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Agrupamos por categoría (string libre). "Sin categoría" cae al final.
  const categories = Array.from(new Set(videos.map((v) => v.category ?? ""))).sort((a, b) => {
    if (a === "" && b !== "") return 1;
    if (b === "" && a !== "") return -1;
    return a.localeCompare(b);
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted">
          {videos.length} {videos.length === 1 ? "vídeo guardado" : "vídeos guardados"}
        </p>
        <button
          type="button"
          onClick={() => {
            setShowNew((v) => !v);
            setEditingId(null);
          }}
          className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
        >
          {showNew ? <X size={13} /> : <Plus size={13} />}
          {showNew ? "Cerrar" : "Nuevo vídeo"}
        </button>
      </div>

      {showNew ? <NewVideoForm onDone={() => setShowNew(false)} /> : null}

      {videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Video size={32} className="mx-auto text-muted" />
          <p className="mt-3 font-medium">Aún no hay vídeos</p>
          <p className="mt-1 text-sm text-muted">Pega una URL de YouTube o Vimeo para empezar.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => {
            const items = videos.filter((v) => (v.category ?? "") === cat);
            const label = cat || "Sin categoría";
            return (
              <section key={label}>
                <h2 className="mb-3 flex items-baseline gap-2 text-base font-bold">
                  <span>{label}</span>
                  <span className="text-xs text-muted">({items.length})</span>
                </h2>
                <ul className="space-y-2">
                  {items.map((v) =>
                    editingId === v.id ? (
                      <li key={v.id}>
                        <EditVideoForm video={v} onDone={() => setEditingId(null)} />
                      </li>
                    ) : (
                      <VideoCard key={v.id} video={v} onEdit={() => setEditingId(v.id)} />
                    ),
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VideoCard({ video, onEdit }: { video: VideoItem; onEdit: () => void }) {
  const info = parseVideo(video.url);
  return (
    <li>
      <details className="group overflow-hidden rounded-xl border border-border bg-surface">
        <summary className="cursor-pointer list-none p-4 transition hover:bg-bg/40">
          <div className="flex items-center gap-3">
            <ChevronDown
              size={16}
              className="flex-shrink-0 text-muted transition group-open:rotate-180"
            />
            {info.thumbnail ? (
              <img
                src={info.thumbnail}
                alt=""
                className="h-12 w-20 flex-shrink-0 rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="flex h-12 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Video size={18} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{video.title}</p>
              {video.description ? (
                <p className="line-clamp-1 text-xs text-muted">{video.description}</p>
              ) : null}
            </div>
          </div>
        </summary>
        <div className="border-t border-border p-4">
          {info.embedUrl ? (
            <div className="mb-3 aspect-video w-full overflow-hidden rounded-xl border border-border">
              <iframe
                src={info.embedUrl}
                title={video.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <a
              href={video.url}
              target="_blank"
              rel="noreferrer"
              className="mb-3 flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Abrir enlace <ExternalLink size={12} />
            </a>
          )}
          {video.description ? (
            <p className="whitespace-pre-wrap text-sm text-text">{video.description}</p>
          ) : null}
          <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
            <span>{video.authorName ? `Por ${video.authorName}` : null}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onEdit}
                className="flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:border-primary hover:text-text"
              >
                <Pencil size={11} /> Editar
              </button>
              <form action={deleteVideo}>
                <input type="hidden" name="id" value={video.id} />
                <button
                  type="submit"
                  onClick={(e) => {
                    if (!confirm(`¿Borrar el vídeo "${video.title}"?`)) e.preventDefault();
                  }}
                  className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-red-600 hover:border-red-300"
                >
                  <Trash2 size={11} /> Borrar
                </button>
              </form>
            </div>
          </footer>
        </div>
      </details>
    </li>
  );
}

function NewVideoForm({ onDone }: { onDone: () => void }) {
  return (
    <form
      action={async (fd) => {
        await createVideo(fd);
        onDone();
      }}
      className="mb-6 rounded-2xl border border-primary/40 bg-surface p-5"
    >
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-primary">Nuevo vídeo</h3>
      <VideoFields />
      <FormActions onCancel={onDone} submitLabel="Guardar vídeo" />
    </form>
  );
}

function EditVideoForm({
  video,
  onDone,
}: {
  video: VideoItem;
  onDone: () => void;
}) {
  return (
    <form
      action={async (fd) => {
        await updateVideo(fd);
        onDone();
      }}
      className="rounded-xl border border-primary/40 bg-surface p-5"
    >
      <input type="hidden" name="id" value={video.id} />
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-primary">
        Editando vídeo
      </h3>
      <VideoFields defaults={video} />
      <FormActions onCancel={onDone} submitLabel="Guardar cambios" />
    </form>
  );
}

function VideoFields({ defaults }: { defaults?: VideoItem }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input
        name="title"
        required
        defaultValue={defaults?.title ?? ""}
        placeholder="Título"
        className="sm:col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <input
        name="url"
        required
        type="url"
        defaultValue={defaults?.url ?? ""}
        placeholder="URL de YouTube o Vimeo"
        className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <input
        name="category"
        defaultValue={defaults?.category ?? ""}
        placeholder="Categoría (ej. Educación, Motivación)"
        className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <textarea
        name="description"
        rows={3}
        defaultValue={defaults?.description ?? ""}
        placeholder="Descripción (opcional)"
        className="sm:col-span-2 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}

function FormActions({
  onCancel,
  submitLabel,
}: {
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <div className="mt-3 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg px-3 py-2 text-sm text-muted hover:bg-bg hover:text-text"
      >
        Cancelar
      </button>
      <button
        type="submit"
        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        {submitLabel}
      </button>
    </div>
  );
}
