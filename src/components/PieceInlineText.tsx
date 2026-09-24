"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";

type Field = "title" | "editorNotes";

function autosize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function PieceInlineText({
  pieceId,
  field,
  initial,
  placeholder,
  className = "",
  variant = "textarea",
}: {
  pieceId: string;
  field: Field;
  initial: string | null;
  placeholder?: string;
  className?: string;
  variant?: "textarea" | "title";
}) {
  const [value, setValue] = useState(initial ?? "");
  const [saving, setSaving] = useState<"idle" | "pending" | "ok" | "err">("idle");
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string>(initial ?? "");

  useEffect(() => {
    if (ref.current) autosize(ref.current);
  }, [value]);

  async function flush(next: string) {
    if (next === lastSaved.current) {
      setSaving("idle");
      return;
    }
    setSaving("pending");
    try {
      const res = await fetch("/api/content/pieces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pieceId, [field]: next }),
      });
      if (!res.ok) throw new Error("bad");
      lastSaved.current = next;
      setSaving("ok");
      setTimeout(() => setSaving("idle"), 1200);
    } catch {
      setSaving("err");
      setTimeout(() => setSaving("idle"), 2500);
    }
  }

  function scheduleSave(next: string) {
    setValue(next);
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => flush(next), 800);
  }

  function onBlur() {
    if (pendingTimer.current) {
      clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
    }
    flush(value);
  }

  const base =
    variant === "title"
      ? "text-lg font-semibold text-neutral-900 placeholder-neutral-400"
      : "text-sm text-neutral-800 placeholder-neutral-400";

  return (
    <div className="group relative">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => scheduleSave(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={`w-full resize-none rounded-md border border-transparent bg-transparent px-1 py-0.5 outline-none transition focus:border-neutral-200 focus:bg-white print:border-transparent print:bg-transparent ${base} ${className}`}
      />
      <span
        className={`pointer-events-none absolute right-1 top-1 flex h-5 items-center gap-1 rounded px-1 text-[10px] text-neutral-400 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 print:hidden ${
          saving !== "idle" ? "opacity-100" : ""
        }`}
      >
        {saving === "pending" ? (
          <>
            <Loader2 size={10} className="animate-spin" /> guardando…
          </>
        ) : saving === "ok" ? (
          <>
            <Check size={10} className="text-emerald-500" /> guardado
          </>
        ) : saving === "err" ? (
          <>
            <X size={10} className="text-red-500" /> error
          </>
        ) : null}
      </span>
    </div>
  );
}
