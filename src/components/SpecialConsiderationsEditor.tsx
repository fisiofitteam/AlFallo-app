"use client";

import { useState, useTransition, useRef } from "react";
import { upload } from "@vercel/blob/client";
import {
  Plus, Trash2, Save, Loader2, Paperclip, Download, X,
  FileText, FileSpreadsheet, File as FileIcon, ChevronUp, ChevronDown,
} from "lucide-react";
import {
  upsertSpecialConsideration,
  deleteSpecialConsideration,
  reorderSpecialConsiderations,
} from "@/app/(panel)/biblioteca/brief-ia/actions";
import type { SpecialConsiderationDTO } from "@/lib/specialConsiderations";

type LocalItem = SpecialConsiderationDTO & { _dirty?: boolean; _new?: boolean };

export function SpecialConsiderationsEditor({
  initial,
}: {
  initial: SpecialConsiderationDTO[];
}) {
  const [items, setItems] = useState<LocalItem[]>(initial);
  const [saving, startSaving] = useTransition();

  function patch(id: string, p: Partial<LocalItem>) {
    setItems((arr) => arr.map((x) => (x.id === id ? { ...x, ...p, _dirty: true } : x)));
  }

  function addItem() {
    const id = `new_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setItems((arr) => [
      ...arr,
      {
        id,
        title: "",
        description: "",
        examplePlanUrl: null,
        examplePlanName: null,
        order: arr.length,
        _new: true,
        _dirty: true,
      },
    ]);
  }

  function removeItem(id: string) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    if (it._new) {
      // Aún no guardada: lo quitamos del estado local sin tocar BD.
      setItems((arr) => arr.filter((x) => x.id !== id));
      return;
    }
    if (!confirm(`¿Borrar la consideración "${it.title || "(sin título)"}"?`)) return;
    startSaving(async () => {
      const fd = new FormData();
      fd.set("id", id);
      await deleteSpecialConsideration(fd);
      setItems((arr) => arr.filter((x) => x.id !== id));
    });
  }

  async function saveOne(it: LocalItem): Promise<string> {
    return upsertSpecialConsideration({
      id: it._new ? undefined : it.id,
      title: it.title,
      description: it.description,
      examplePlanUrl: it.examplePlanUrl,
      examplePlanName: it.examplePlanName,
    });
  }

  function saveAll() {
    const dirty = items.filter((x) => x._dirty);
    if (dirty.length === 0) return;
    startSaving(async () => {
      const updates: Record<string, string> = {};
      for (const it of dirty) {
        if (!it.title.trim()) continue;
        const newId = await saveOne(it);
        if (it._new && newId !== it.id) updates[it.id] = newId;
      }
      setItems((arr) =>
        arr.map((x) => ({
          ...x,
          id: updates[x.id] ?? x.id,
          _dirty: false,
          _new: false,
        })),
      );
    });
  }

  function moveItem(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[idx], next[j]] = [next[j], next[idx]];
    setItems(next);
    // Persistimos el nuevo orden en BD (solo IDs ya creados).
    const orderedIds = next.filter((x) => !x._new).map((x) => x.id);
    if (orderedIds.length > 1) {
      startSaving(async () => {
        await reorderSpecialConsiderations(orderedIds);
      });
    }
  }

  const dirtyCount = items.filter((x) => x._dirty).length;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2 rounded-xl border border-primary/30 bg-primary-soft/30 px-4 py-3 text-xs text-text">
        <span>
          Crea aquí las consideraciones especiales (ej. <em>Embarazo</em>, <em>Colon irritable</em>,
          <em> Hipotiroidismo</em>…). Cada una se mostrará como opción en el selector dentro de la{" "}
          <strong>ficha nutricional</strong> de cualquier cliente. Cuando un cliente tenga una marcada,
          su descripción y la dieta adjunta entrarán automáticamente al brief de la IA al generar plan.
        </span>
      </div>

      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {items.length} {items.length === 1 ? "consideración" : "consideraciones"}
          {dirtyCount > 0 ? ` · ${dirtyCount} sin guardar` : null}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-semibold text-text hover:border-primary hover:text-primary"
          >
            <Plus size={12} /> Añadir consideración
          </button>
          <button
            type="button"
            onClick={saveAll}
            disabled={saving || dirtyCount === 0}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "var(--c-primary)" }}
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Guardar todas
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/30 p-10 text-center">
          <p className="text-sm text-muted">
            No hay consideraciones creadas. Pulsa{" "}
            <strong>"Añadir consideración"</strong> para crear la primera.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((it, idx) => (
            <li key={it.id}>
              <ConsiderationCard
                item={it}
                index={idx}
                total={items.length}
                onPatch={(p) => patch(it.id, p)}
                onRemove={() => removeItem(it.id)}
                onMoveUp={() => moveItem(idx, -1)}
                onMoveDown={() => moveItem(idx, 1)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ConsiderationCard({
  item,
  index,
  total,
  onPatch,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  item: LocalItem;
  index: number;
  total: number;
  onPatch: (p: Partial<LocalItem>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    const timeoutP = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("Tardó demasiado (90s).")), 90_000),
    );
    try {
      const blob = await Promise.race([
        upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/biblioteca/upload-doc",
        }),
        timeoutP,
      ]);
      onPatch({ examplePlanUrl: blob.url, examplePlanName: file.name });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo subir";
      setError(msg);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const FileIco = pickFileIcon(item.examplePlanName);

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="flex items-center justify-between gap-2 border-b border-border bg-bg/40 px-4 py-2">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">
          Consideración {index + 1}
          {item._dirty ? (
            <span className="ml-2 text-amber-600">· sin guardar</span>
          ) : null}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            title="Subir"
            className="rounded-md border border-border bg-bg p-1.5 text-muted hover:border-primary hover:text-text disabled:opacity-30"
          >
            <ChevronUp size={12} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            title="Bajar"
            className="rounded-md border border-border bg-bg p-1.5 text-muted hover:border-primary hover:text-text disabled:opacity-30"
          >
            <ChevronDown size={12} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="Borrar"
            className="rounded-md border border-border bg-bg p-1.5 text-muted hover:border-red-300 hover:text-red-600"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </header>
      <div className="space-y-3 p-4">
        <input
          value={item.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder="Título de la consideración (ej. Embarazo, Lactancia, Colon irritable…)"
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-base font-semibold outline-none focus:border-primary"
        />
        <textarea
          rows={5}
          value={item.description}
          onChange={(e) => onPatch({ description: e.target.value })}
          placeholder="Consideraciones que la IA debe tener en cuenta. Ejemplo: ajustes calóricos, alimentos a evitar, suplementación necesaria, micronutrientes clave, etc."
          className="w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        />

        <div>
          <p className="block text-xs font-semibold uppercase tracking-wider text-muted">
            Dieta de ejemplo (PDF/Excel/CSV, opcional)
          </p>
          {item.examplePlanUrl && item.examplePlanName ? (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <FileIco size={16} className="flex-shrink-0 text-primary" />
                <span className="truncate text-sm">{item.examplePlanName}</span>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={item.examplePlanUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Descargar"
                  className="rounded-md p-1.5 text-muted hover:bg-surface hover:text-text"
                >
                  <Download size={14} />
                </a>
                <button
                  type="button"
                  onClick={() => onPatch({ examplePlanUrl: null, examplePlanName: null })}
                  title="Quitar archivo"
                  className="rounded-md p-1.5 text-muted hover:bg-surface hover:text-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-border bg-bg px-3 py-2 text-sm font-medium text-muted transition hover:border-primary hover:text-text disabled:opacity-60"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                {busy ? "Subiendo…" : "Adjuntar dieta de ejemplo"}
              </button>
              {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function pickFileIcon(name: string | null) {
  if (!name) return FileIcon;
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return FileText;
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) return FileSpreadsheet;
  return FileIcon;
}
