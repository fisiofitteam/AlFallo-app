"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Upload, X, Loader2 } from "lucide-react";

/**
 * Botón que sube una imagen/vídeo a Vercel Blob (cliente → Blob directo) y
 * devuelve la URL pública al `onChange`. Permite borrar con la X.
 *
 * Si Vercel Blob no está activado (no hay BLOB_READ_WRITE_TOKEN), el
 * endpoint /api/community/upload devuelve 503 y mostramos un mensaje claro.
 */
export function ImageUpload({
  value,
  onChange,
  accept = "image/*",
  label = "Subir imagen",
  hint,
  className = "",
}: {
  value: string | null | undefined;
  // onChange admite string vacío para "borrar" (compat con consumidores que usen string state)
  onChange: (url: string) => void;
  accept?: string;
  label?: string;
  hint?: string;
  className?: string;
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
        handleUploadUrl: "/api/community/upload",
      });
      onChange(blob.url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo subir";
      setError(msg);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (value) {
    return (
      <div className={`relative inline-block ${className}`}>
        {value.match(/\.(mp4|webm|mov)$/i) ? (
          <video src={value} controls className="max-h-48 rounded-xl border border-border" />
        ) : (
          <img src={value} alt="" className="max-h-48 rounded-xl border border-border object-cover" />
        )}
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-md hover:bg-red-600"
          title="Quitar"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
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
        className="flex items-center gap-1.5 rounded-xl border border-dashed border-border bg-surface px-4 py-2.5 text-sm font-medium text-muted transition hover:border-primary hover:text-text disabled:opacity-60"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
        {busy ? "Subiendo…" : label}
      </button>
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
