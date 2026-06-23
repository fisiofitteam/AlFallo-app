"use client";

import { useRef, useState, type DragEvent } from "react";
import { upload } from "@vercel/blob/client";
import { Upload, X, Loader2 } from "lucide-react";

/**
 * Subidor de imagen/vídeo a Vercel Blob. Tres formas de añadir archivo:
 *   1. Clic en el botón → diálogo nativo del SO.
 *   2. Arrastrar y soltar sobre la zona.
 *   3. Pegar (no soportado todavía; lo añadimos si hace falta).
 *
 * Llama a `onChange` con la URL pública al terminar. La X la borra.
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
  // dragOver controla el highlight de la zona mientras arrastras un archivo.
  // Usamos contador en vez de boolean para tolerar enter/leave de elementos
  // hijos sin que parpadee el estado.
  const [dragDepth, setDragDepth] = useState(0);
  const dragging = dragDepth > 0;

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

  // Chequeo simple del tipo MIME contra el `accept` (ej. "image/*"). Si el
  // tipo no coincide, no subimos. Para vídeos también queda dentro de
  // "image/*"? No, hay que pasarles accept="image/*,video/*" si los quieres.
  function isAcceptable(file: File): boolean {
    if (!accept || accept === "*") return true;
    const parts = accept.split(",").map((s) => s.trim());
    return parts.some((p) => {
      if (p.endsWith("/*")) {
        const prefix = p.slice(0, -2);
        return file.type.startsWith(prefix + "/");
      }
      return file.type === p;
    });
  }

  function onDragEnter(e: DragEvent) {
    e.preventDefault();
    setDragDepth((d) => d + 1);
  }
  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    setDragDepth((d) => Math.max(0, d - 1));
  }
  function onDragOver(e: DragEvent) {
    // Necesario para que se dispare el drop.
    e.preventDefault();
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragDepth(0);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!isAcceptable(file)) {
      setError(`Tipo de archivo no permitido (${file.type || "?"}).`);
      return;
    }
    handleFile(file);
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
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        disabled={busy}
        // Al arrastrar encima, resalta en rosa con icono de upload bouncing
        // para dar feedback claro. El borde dashed se mantiene siempre.
        className={`flex items-center gap-1.5 rounded-xl border border-dashed px-4 py-2.5 text-sm font-medium transition disabled:opacity-60 ${
          dragging
            ? "border-primary bg-primary-soft text-primary"
            : "border-border bg-surface text-muted hover:border-primary hover:text-text"
        }`}
      >
        {busy ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Upload size={15} className={dragging ? "animate-bounce" : ""} />
        )}
        {busy ? "Subiendo…" : dragging ? "Suelta para subir" : label}
      </button>
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {!hint && !error && (
        <p className="mt-1 text-xs text-muted">O arrastra una imagen aquí.</p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
