"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Paperclip, Loader2, X, Download, FileText, FileSpreadsheet, File as FileIcon } from "lucide-react";

/**
 * Subidor de un archivo de referencia (PDF/Excel/CSV) a Vercel Blob.
 * Recibe valor controlado { url, name } y un onChange que persiste cambios
 * en el form padre. Si Vercel Blob no está activado, el endpoint devuelve
 * 503 y mostramos un mensaje legible.
 */
export function DocAttachment({
  label,
  hint,
  accept,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  accept: string;
  value: { url: string | null; name: string | null };
  onChange: (next: { url: string | null; name: string | null }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/biblioteca/upload-doc",
      });
      onChange({ url: blob.url, name: file.name });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo subir";
      setError(msg);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const Icon = pickIcon(value.name);

  return (
    <div>
      <p className="block text-sm font-semibold">{label}</p>
      {hint ? <p className="block text-xs text-muted">{hint}</p> : null}

      {value.url && value.name ? (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Icon size={16} className="flex-shrink-0 text-primary" />
            <span className="truncate text-sm">{value.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <a
              href={value.url}
              target="_blank"
              rel="noreferrer"
              title="Descargar"
              className="rounded-md p-1.5 text-muted hover:bg-surface hover:text-text"
            >
              <Download size={14} />
            </a>
            <button
              type="button"
              onClick={() => {
                if (!confirm(`¿Quitar "${value.name}" del brief?`)) return;
                onChange({ url: null, name: null });
              }}
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
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-border bg-bg px-4 py-2.5 text-sm font-medium text-muted transition hover:border-primary hover:text-text disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
            {busy ? "Subiendo…" : "Adjuntar archivo"}
          </button>
        </div>
      )}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function pickIcon(name: string | null) {
  if (!name) return FileIcon;
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return FileText;
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) return FileSpreadsheet;
  return FileIcon;
}
