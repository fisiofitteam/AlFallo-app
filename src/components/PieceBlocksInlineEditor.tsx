"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";

export type PieceBlock = {
  id?: string;
  label: string;
  content: string;
};

function autosize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function normalize(raw: unknown): PieceBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: PieceBlock[] = [];
  raw.forEach((b, i) => {
    if (!b || typeof b !== "object") return;
    const o = b as Record<string, unknown>;
    out.push({
      id: typeof o.id === "string" ? o.id : newId(),
      label: typeof o.label === "string" ? o.label : `Plano ${i + 1}`,
      content: typeof o.content === "string" ? o.content : "",
    });
  });
  return out;
}

export function PieceBlocksInlineEditor({
  pieceId,
  initial,
}: {
  pieceId: string;
  initial: unknown;
}) {
  const [blocks, setBlocks] = useState<PieceBlock[]>(() => normalize(initial));
  const [saving, setSaving] = useState<"idle" | "pending" | "ok" | "err">("idle");
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function flush(next: PieceBlock[]) {
    setSaving("pending");
    try {
      const res = await fetch("/api/content/pieces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pieceId, blocks: next }),
      });
      if (!res.ok) throw new Error("bad");
      setSaving("ok");
      setTimeout(() => setSaving("idle"), 1200);
    } catch {
      setSaving("err");
      setTimeout(() => setSaving("idle"), 2500);
    }
  }

  function scheduleSave(next: PieceBlock[]) {
    setBlocks(next);
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => flush(next), 800);
  }

  function onBlurAny() {
    if (pendingTimer.current) {
      clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
    }
    flush(blocks);
  }

  function updateBlock(idx: number, patch: Partial<PieceBlock>) {
    const next = blocks.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    scheduleSave(next);
  }

  function addBlock() {
    const label = `Plano ${blocks.length + 1}`;
    scheduleSave([...blocks, { id: newId(), label, content: "" }]);
  }

  function removeBlock(idx: number) {
    scheduleSave(blocks.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Guion</p>
        <span className="flex items-center gap-1 text-[10px] text-neutral-400 print:hidden">
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

      {blocks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50/60 px-3 py-2 text-xs text-neutral-400 print:hidden">
          Sin guion todavía. Añade el primer plano abajo.
        </p>
      ) : null}

      {blocks.map((b, i) => (
        <div
          key={b.id ?? i}
          className="rounded-lg border border-neutral-200 bg-white p-2 print:border-neutral-300"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={b.label}
              onChange={(e) => updateBlock(i, { label: e.target.value })}
              onBlur={onBlurAny}
              className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] font-bold uppercase tracking-wider text-neutral-600 outline-none focus:border-neutral-200 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => removeBlock(i)}
              title="Borrar bloque"
              className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600 print:hidden"
            >
              <X size={12} />
            </button>
          </div>
          <textarea
            rows={2}
            value={b.content}
            onChange={(e) => {
              updateBlock(i, { content: e.target.value });
              autosize(e.currentTarget);
            }}
            ref={(el) => {
              if (el) autosize(el);
            }}
            onBlur={onBlurAny}
            placeholder="Idea del plano…"
            className="mt-1 w-full resize-none rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-neutral-800 outline-none focus:border-neutral-200 focus:bg-white print:border-transparent print:bg-transparent"
          />
        </div>
      ))}

      <button
        type="button"
        onClick={addBlock}
        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-neutral-300 px-2 py-1 text-xs font-medium text-neutral-500 hover:border-neutral-500 hover:text-neutral-800 print:hidden"
      >
        <Plus size={12} /> Añadir bloque
      </button>
    </div>
  );
}
