"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import {
  Check,
  Download,
  File as FileIcon,
  FileSpreadsheet,
  FileText,
  Loader2,
  Paperclip,
  Save,
  X,
} from "lucide-react";
import { saveMacroBriefAction } from "@/app/(panel)/biblioteca/brief-macros/actions";
import type { MacroBriefAttachment } from "@/lib/macroBrief";

/**
 * Editor del brief de macros: textarea de notas + uploader de N archivos
 * (Excel/CSV/PDF/TXT). El uploader sube directamente a Vercel Blob desde
 * el cliente (endpoint /api/biblioteca/upload-doc) y guarda url + nombre
 * en el array. Al pulsar Guardar se serializa todo y se manda al server
 * action.
 */

const ACCEPT = ".xlsx,.xls,.csv,.pdf,.txt,.tsv,.md";

export function MacroBriefEditor({
  initial,
}: {
  initial: { notes: string | null; attachments: MacroBriefAttachment[] };
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [attachments, setAttachments] = useState<MacroBriefAttachment[]>(initial.attachments);
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    try {
      const added: MacroBriefAttachment[] = [];
      for (const file of Array.from(files)) {
        // upload() del SDK de Blob abre el endpoint del servidor que
        // devuelve token y sube directo al store. Nombre único con timestamp
        // para no chocar si subes dos ficheros con el mismo nombre.
        const key = `macro-brief/${Date.now()}-${file.name}`;
        const blob = await upload(key, file, {
          access: "public",
          handleUploadUrl: "/api/biblioteca/upload-doc",
        });
        added.push({ url: blob.url, name: file.name });
      }
      setAttachments((prev) => [...prev, ...added]);
    } catch (e) {
      setError(
        (e as Error).message ||
          "No se pudo subir el archivo. Comprueba que Vercel Blob esté configurado.",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  function save() {
    const fd = new FormData();
    fd.set("notes", notes);
    fd.set("attachmentsJson", JSON.stringify(attachments));
    start(async () => {
      setError(null);
      try {
        await saveMacroBriefAction(fd);
        setSavedAt(Date.now());
        router.refresh();
      } catch (e) {
        setError((e as Error).message || "Error guardando el brief.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Notas */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <label className="block text-xs">
          <span className="font-semibold text-muted">Notas del brief (opcional)</span>
          <span className="block text-[11px] italic text-muted">
            Instrucciones extra para el estimador: por ejemplo &quot;usa siempre las tablas de BEDCA
            para pesos cocidos&quot;, &quot;1 huevo M = 50 g&quot;, &quot;la avena que compramos
            tiene 385 kcal/100 g, no 380&quot;. La IA lo lee antes de estimar cada opción.
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            placeholder="Ej. Usa las tablas del Excel adjunto para todos los alimentos que aparezcan en él. Para el resto, tira de USDA/BEDCA."
            className="mt-2 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>
      </section>

      {/* Adjuntos */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Adjuntos</p>
            <p className="text-[11px] text-muted">
              Excel, CSV, PDF, TXT. Se pasan como referencia al estimador de macros en cada
              cálculo. Los Excel se leen hoja por hoja.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:opacity-90">
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
            Subir archivos
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
              disabled={uploading}
            />
          </label>
        </div>

        {attachments.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-bg/40 p-4 text-center text-xs text-muted">
            Aún no hay adjuntos. Sube tu Excel de equivalencias o tabla de macros para que la IA lo
            use como referencia.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {attachments.map((att, idx) => {
              const Ico = pickIcon(att.name);
              return (
                <li
                  key={att.url}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Ico size={14} className="text-muted" />
                    <span className="truncate text-sm">{att.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md p-1 text-muted hover:bg-surface hover:text-primary"
                      title="Descargar / abrir"
                    >
                      <Download size={13} />
                    </a>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="rounded-md p-1 text-muted hover:bg-surface hover:text-red-600"
                      title="Quitar del brief"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {/* Barra inferior sticky con guardar */}
      <div className="sticky bottom-2 z-10 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur">
        {savedAt ? (
          <span className="mr-auto inline-flex items-center gap-1 text-xs text-emerald-700">
            <Check size={13} /> Guardado
          </span>
        ) : null}
        <button
          type="button"
          onClick={save}
          disabled={pending || uploading}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar brief
        </button>
      </div>
    </div>
  );
}

function pickIcon(name: string) {
  const n = name.toLowerCase();
  if (n.endsWith(".pdf")) return FileText;
  if (n.endsWith(".xlsx") || n.endsWith(".xls") || n.endsWith(".csv") || n.endsWith(".tsv"))
    return FileSpreadsheet;
  return FileIcon;
}
