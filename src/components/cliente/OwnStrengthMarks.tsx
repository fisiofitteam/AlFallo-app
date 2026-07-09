"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { LineChart } from "@/components/line-chart";
import {
  addOwnStrengthRecord,
  deleteOwnStrengthRecord,
} from "@/app/cliente/actions";

type Mark = {
  id: string;
  name: string;
  category: string;
  unit: string;
  direction: string;
};

type Record = {
  id: string;
  markId: string;
  value: number;
  date: string;
  notes: string | null;
};

function formatValue(value: number, unit: string): string {
  if (unit === "s") {
    if (value >= 60) {
      const m = Math.floor(value / 60);
      const s = Math.round(value - m * 60);
      return `${m}:${String(s).padStart(2, "0")} min`;
    }
    return `${Math.round(value * 10) / 10} s`;
  }
  return `${Math.round(value * 10) / 10} ${unit}`;
}

function best(records: Record[], direction: string): Record | null {
  if (records.length === 0) return null;
  const sorted = [...records].sort((a, b) =>
    direction === "up" ? b.value - a.value : a.value - b.value,
  );
  return sorted[0];
}

export function OwnStrengthMarks({
  marks,
  records,
}: {
  marks: Mark[];
  records: Record[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const grouped = useMemo(() => {
    const byMark = new Map<string, Record[]>();
    for (const r of records) {
      const arr = byMark.get(r.markId) ?? [];
      arr.push(r);
      byMark.set(r.markId, arr);
    }
    for (const [k, arr] of byMark) {
      byMark.set(
        k,
        [...arr].sort((a, b) => a.date.localeCompare(b.date)),
      );
    }
    return byMark;
  }, [records]);

  return (
    <div className="space-y-3">
      {marks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
          Aún no hay marcas configuradas. Tu nutri las activará pronto.
        </div>
      ) : null}
      {marks.map((m) => {
        const list = grouped.get(m.id) ?? [];
        const record = best(list, m.direction);
        const last = list.at(-1) ?? null;
        const isOpen = openId === m.id;
        const points = list.map((r) => ({
          label: new Date(r.date).toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "2-digit",
          }),
          value: Math.round(r.value * 10) / 10,
        }));
        return (
          <article key={m.id} className="rounded-2xl border border-border bg-surface p-4">
            <header
              className="flex cursor-pointer items-start justify-between gap-3"
              onClick={() => setOpenId((prev) => (prev === m.id ? null : m.id))}
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-bold">{m.name}</h3>
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">{m.category}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                  {record ? (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-md bg-primary-soft px-1.5 py-0.5 font-semibold text-primary">
                        {m.direction === "up" ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        RÉCORD {formatValue(record.value, m.unit)}
                      </span>
                      <span className="text-muted">{list.length} registros</span>
                      {last && last.id !== record.id ? (
                        <span className="text-muted">último: {formatValue(last.value, m.unit)}</span>
                      ) : null}
                    </>
                  ) : (
                    <span className="italic text-muted">Sin registros aún</span>
                  )}
                </div>
              </div>
              <span className="shrink-0 rounded-md border border-border bg-bg px-2 py-1 text-[11px] text-muted">
                {isOpen ? "Cerrar" : "Registrar"}
              </span>
            </header>
            {isOpen ? (
              <div className="mt-3 space-y-3 border-t border-border pt-3">
                {points.length >= 2 ? (
                  <LineChart
                    points={points}
                    unit={` ${m.unit}`}
                    color={m.direction === "up" ? "#e6197e" : "#0ea5e9"}
                  />
                ) : (
                  <p className="text-xs italic text-muted">Necesitas al menos 2 registros para ver la gráfica.</p>
                )}
                <AddOwnRecord mark={m} />
                {list.length > 0 ? (
                  <ul className="divide-y divide-border rounded-lg border border-border bg-bg">
                    {[...list].reverse().map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium">
                            {formatValue(r.value, m.unit)}
                            <span className="ml-2 text-xs text-muted">
                              {new Date(r.date).toLocaleDateString("es-ES", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          </p>
                          {r.notes ? (
                            <p className="mt-0.5 text-xs italic text-muted">{r.notes}</p>
                          ) : null}
                        </div>
                        <DeleteOwn id={r.id} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function AddOwnRecord({ mark }: { mark: Mark }) {
  const [pending, start] = useTransition();
  const [value, setValue] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const hint = mark.unit === "s" ? "MM:SS o segundos (ej. 2:34)" : `Valor en ${mark.unit}`;

  function submit() {
    if (!value.trim()) return;
    const fd = new FormData();
    fd.set("markId", mark.id);
    fd.set("value", value);
    fd.set("date", date);
    if (notes.trim()) fd.set("notes", notes);
    start(async () => {
      await addOwnStrengthRecord(fd);
      setValue("");
      setNotes("");
    });
  }

  return (
    <div className="rounded-lg border border-border bg-bg p-2">
      <p className="mb-1.5 text-[11px] font-semibold uppercase text-muted">Añadir tu marca</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
        <label className="block text-xs">
          <span className="font-semibold text-muted">Valor</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={hint}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block text-xs">
          <span className="font-semibold text-muted">Fecha</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
        </label>
      </div>
      <label className="mt-2 block text-xs">
        <span className="font-semibold text-muted">Notas (opcional)</span>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej. Con cinturón, tras 3 series de calentamiento"
          className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-primary"
        />
      </label>
      <button
        type="button"
        onClick={submit}
        disabled={pending || !value.trim()}
        className="mt-2 inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
        Guardar registro
      </button>
    </div>
  );
}

function DeleteOwn({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <form
      action={(fd) => {
        if (!confirm("¿Borrar este registro?")) return;
        fd.set("id", id);
        start(async () => {
          await deleteOwnStrengthRecord(fd);
        });
      }}
    >
      <button
        type="submit"
        disabled={pending}
        title="Borrar"
        className="rounded p-1 text-muted hover:text-red-600 disabled:opacity-50"
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
      </button>
    </form>
  );
}
