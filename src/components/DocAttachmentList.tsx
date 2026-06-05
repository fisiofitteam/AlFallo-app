"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  Paperclip, Loader2, X, Download, FileText, FileSpreadsheet, File as FileIcon,
} from "lucide-react";
import type { BriefAttachment } from "@/lib/ai-brief-types";

/**
 * Subidor de N archivos (PDF/Excel/CSV) a Vercel Blob.
 * Valor controlado: array de { url, name }. Cada subida nueva se añade al
 * array y el padre persiste el cambio al guardar el brief.
 *
 * Si Vercel Blob no está activado el endpoint devuelve 503 y mostramos el
 * error legible. Si la subida tarda más de 90 s, el SDK suele colgarse —
 * forzamos un timeout con Promise.race para surfacear un mensaje claro.
 */
export function DocAttachmentList({
  label,
  hint,
  accept,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  accept: string;
  value: BriefAttachment[];
  onChange: (next: BriefAttachment[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadOne(file: File): Promise<BriefAttachment | null> {
    const timeoutP = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("Tardó demasiado (90s). Revisa la conexión o los logs de Vercel.")), 90_000),
    );
    const blob = await Promise.race([
      upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/biblioteca/upload-doc",
      }),
      timeoutP,
    ]);
    return { url: blob.url, name: file.name };
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    const added: BriefAttachment[] = [];
    try {
      for (const f of files) {
        const a = await uploadOne(f);
        if (a) added.push(a);
      }
      if (added.length > 0) onChange([...value, ...added]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo subir";
      // eslint-disable-next-line no-console
      console.error("[DocAttachmentList] upload failed:", e);
      setError(msg);
      // Aunque algún archivo fallara, persistimos los que sí subieron.
      if (added.length > 0) onChange([...value, ...added]);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(idx: number) {
    if (!confirm(`¿Quitar "${value[idx]?.name ?? "este archivo"}" del brief?`)) return;
    onChange(value.filter((_, i) => i !== idx));
  }

  return (
    <div>
      <p className="block text-sm font-semibold">{label}</p>
      {hint ? <p className="block text-xs text-muted">{hint}</p> : null}

      {value.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {value.map((f, i) => {
            const Icon = pickIcon(f.name);
            return (
              <li
                key={`${f.url}-${i}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Icon size={16} className="flex-shrink-0 text-primary" />
                  <span className="truncate text-sm">{f.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    title="Descargar"
                    className="rounded-md p-1.5 text-muted hover:bg-surface hover:text-text"
                  >
                    <Download size={14} />
                  </a>
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    title="Quitar archivo"
                    className="rounded-md p-1.5 text-muted hover:bg-surface hover:text-red-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="mt-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) handleFiles(files);
          }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-border bg-bg px-4 py-2.5 text-sm font-medium text-muted transition hover:border-primary hover:text-text disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
          {busy
            ? "Subiendo…"
            : value.length === 0
              ? "Adjuntar archivo"
              : "Adjuntar más"}
        </button>
        <p className="mt-1 text-[11px] text-muted">
          Puedes seleccionar varios archivos a la vez. Se guardan al pulsar "Guardar" del brief.
        </p>
      </div>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function pickIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return FileText;
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) return FileSpreadsheet;
  return FileIcon;
}
