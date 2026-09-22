"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { panelEditCheckInFields } from "@/app/(panel)/clientes/actions";

type Fields = {
  weightKg: number | null;
  waistCm: number | null;
  hipCm: number | null;
  armCm: number | null;
  bodyFatPct: number | null;
  adherencePct: number | null;
  energy: number | null;
  notes: string | null;
};

const inputCls =
  "w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary";

export function PanelCheckInEditor({
  checkInId,
  initial,
}: {
  checkInId: string;
  initial: Fields;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg px-2 py-1 text-[11px] font-semibold hover:bg-surface-2"
        >
          <Pencil size={12} /> Editar valores
        </button>
      </div>
    );
  }

  return (
    <form
      action={async (fd) => {
        await panelEditCheckInFields(fd);
        setOpen(false);
      }}
      className="mt-3 rounded-xl border border-border bg-bg/60 p-3"
    >
      <input type="hidden" name="checkInId" value={checkInId} />
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-muted">Corregir valores del atleta</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-1 text-muted hover:text-text"
          title="Cerrar"
        >
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="block text-[11px]">
          <span className="text-muted">Peso (kg)</span>
          <input
            className={inputCls}
            type="number"
            step="0.1"
            name="weightKg"
            defaultValue={initial.weightKg ?? ""}
          />
        </label>
        <label className="block text-[11px]">
          <span className="text-muted">% Grasa</span>
          <input
            className={inputCls}
            type="number"
            step="0.1"
            name="bodyFatPct"
            defaultValue={initial.bodyFatPct ?? ""}
          />
        </label>
        <label className="block text-[11px]">
          <span className="text-muted">Cintura (cm)</span>
          <input
            className={inputCls}
            type="number"
            step="0.1"
            name="waistCm"
            defaultValue={initial.waistCm ?? ""}
          />
        </label>
        <label className="block text-[11px]">
          <span className="text-muted">Cadera (cm)</span>
          <input
            className={inputCls}
            type="number"
            step="0.1"
            name="hipCm"
            defaultValue={initial.hipCm ?? ""}
          />
        </label>
        <label className="block text-[11px]">
          <span className="text-muted">Brazo (cm)</span>
          <input
            className={inputCls}
            type="number"
            step="0.1"
            name="armCm"
            defaultValue={initial.armCm ?? ""}
          />
        </label>
        <label className="block text-[11px]">
          <span className="text-muted">Adherencia (%)</span>
          <input
            className={inputCls}
            type="number"
            name="adherencePct"
            min={0}
            max={100}
            defaultValue={initial.adherencePct ?? ""}
          />
        </label>
        <label className="block text-[11px]">
          <span className="text-muted">Energía (1-5)</span>
          <input
            className={inputCls}
            type="number"
            name="energy"
            min={1}
            max={5}
            defaultValue={initial.energy ?? ""}
          />
        </label>
      </div>
      <label className="mt-2 block text-[11px]">
        <span className="text-muted">Notas del atleta</span>
        <textarea
          className={inputCls}
          rows={2}
          name="notes"
          defaultValue={initial.notes ?? ""}
        />
      </label>
      <div className="mt-2 flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:opacity-90"
        >
          Guardar valores
        </button>
      </div>
    </form>
  );
}
