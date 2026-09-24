"use client";

import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";

export const PIECE_STATUS_OPTIONS = [
  { value: "idea", label: "Idea" },
  { value: "script", label: "Guion listo" },
  { value: "recorded", label: "Grabado" },
  { value: "edited", label: "Editado" },
  { value: "scheduled", label: "Programado" },
  { value: "published", label: "Publicado" },
];

const STATUS_TONE: Record<string, string> = {
  idea: "bg-neutral-100 text-neutral-700 border-neutral-300",
  script: "bg-amber-100 text-amber-800 border-amber-300",
  recorded: "bg-sky-100 text-sky-800 border-sky-300",
  edited: "bg-violet-100 text-violet-800 border-violet-300",
  scheduled: "bg-blue-100 text-blue-800 border-blue-300",
  published: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

export function PieceStatusInlineSelect({
  pieceId,
  status,
}: {
  pieceId: string;
  status: string;
}) {
  const [current, setCurrent] = useState(status);
  const [saving, setSaving] = useState<"idle" | "pending" | "ok" | "err">("idle");

  async function save(next: string) {
    const prev = current;
    setCurrent(next);
    setSaving("pending");
    try {
      const res = await fetch("/api/content/pieces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pieceId, status: next }),
      });
      if (!res.ok) throw new Error("bad");
      setSaving("ok");
      setTimeout(() => setSaving("idle"), 1400);
    } catch {
      setCurrent(prev);
      setSaving("err");
      setTimeout(() => setSaving("idle"), 2000);
    }
  }

  const tone = STATUS_TONE[current] ?? STATUS_TONE.idea;

  return (
    <span className="inline-flex items-center gap-1">
      <select
        value={current}
        onChange={(e) => save(e.target.value)}
        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide outline-none ${tone} print:hidden`}
      >
        {PIECE_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {/* Vista impresa: badge estático sin dropdown. */}
      <span
        className={`hidden rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tone} print:inline`}
      >
        {PIECE_STATUS_OPTIONS.find((o) => o.value === current)?.label ?? current}
      </span>
      {saving === "pending" ? (
        <Loader2 size={12} className="animate-spin text-neutral-400 print:hidden" />
      ) : saving === "ok" ? (
        <Check size={12} className="text-emerald-500 print:hidden" />
      ) : saving === "err" ? (
        <X size={12} className="text-red-500 print:hidden" />
      ) : null}
    </span>
  );
}
