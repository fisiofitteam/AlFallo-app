"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { StickyNote, X, Loader2, Check } from "lucide-react";
import { updateClientInternalNotes } from "@/app/(panel)/clientes/actions";

/** Botón "Notas" del header de la ficha del cliente. En blanco cuando no
 *  hay nada escrito, en amarillo cuando hay contenido. Al pulsar abre un
 *  popover con textarea que autosave debounced. */
export function ClientNotesButton({
  clientId,
  initialNotes,
}: {
  clientId: string;
  initialNotes: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, startSaving] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const hasContent = notes.trim().length > 0;

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Cerrar al pulsar Escape o hacer click fuera.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  function handleChange(value: string) {
    setNotes(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const fd = new FormData();
      fd.set("clientId", clientId);
      fd.set("notes", value);
      startSaving(async () => {
        await updateClientInternalNotes(fd);
        setSavedAt(Date.now());
      });
    }, 800);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={hasContent ? "Notas del cliente (con contenido)" : "Notas del cliente"}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
          hasContent
            ? "border-amber-300 bg-amber-100 text-amber-900 hover:border-amber-400 hover:bg-amber-200"
            : "border-border bg-surface text-text hover:border-primary hover:text-primary"
        }`}
      >
        <StickyNote size={15} />
        Notas
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(90vw,380px)] rounded-2xl border border-border bg-surface p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Notas del cliente</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-muted hover:bg-bg hover:text-text"
              aria-label="Cerrar"
            >
              <X size={14} />
            </button>
          </div>
          <textarea
            value={notes}
            onChange={(e) => handleChange(e.target.value)}
            rows={7}
            placeholder="Recordatorios, cosas a hablar en la próxima sesión, alergias, contexto útil… (solo lo ve el equipo)"
            className="w-full resize-y rounded-lg border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-primary"
          />
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
            <span>
              {notes.length}/5000 · No visible para el atleta.
            </span>
            {saving ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 size={11} className="animate-spin" /> Guardando…
              </span>
            ) : savedAt ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <Check size={11} /> Guardado
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
