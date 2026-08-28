"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Sparkles, Loader2 } from "lucide-react";

// Modal generador de programas (macrociclo). Orquesta desde el navegador la
// generación sesión a sesión (cada fetch tiene maxDuration=60 en servidor) y
// luego crea el Program + vuelca cada sesión con from-session.

const WEEKS_PER_MESO = 4;

const MODALITIES = [
  { value: "crossfit", label: "CrossFit" },
  { value: "hyrox", label: "Hyrox" },
  { value: "hybrid", label: "Híbrido" },
];

const FOCUS_OPTIONS = [
  "Fuerza",
  "Metcon",
  "Hipertrofia",
  "Híbrido",
  "Técnica",
  "Resistencia",
];

type Block = { heading: string; body: string; exercises: string[] };
type Session = { title: string; description: string | null; blocks: Block[] };
type CellStatus = "idle" | "loading" | "ready" | "error";
type Cell = {
  week: number;
  day: number;
  status: CellStatus;
  session?: Session;
  error?: string;
};

function mesoInfo(week: number): { meso: number; wkInMeso: number } {
  return {
    meso: Math.floor((week - 1) / WEEKS_PER_MESO) + 1,
    wkInMeso: ((week - 1) % WEEKS_PER_MESO) + 1,
  };
}

function phaseLabel(wkInMeso: number): string {
  return wkInMeso === 1
    ? "Introducción"
    : wkInMeso === 2
      ? "Progresión"
      : wkInMeso === 3
        ? "Pico"
        : "Descarga";
}

function phaseHint(week: number, totalMesos: number, emphasis: string): string {
  const { meso, wkInMeso } = mesoInfo(week);
  const parts = [
    `MESOCICLO ${meso} de ${totalMesos} · Semana ${wkInMeso}/${WEEKS_PER_MESO} del bloque (${phaseLabel(wkInMeso)}).`,
  ];
  if (emphasis.trim()) parts.push(`Énfasis de este mesociclo: ${emphasis.trim()}.`);
  parts.push(
    wkInMeso === 1
      ? "Introducción: reintroduce el estímulo del bloque con volumen medio, técnica prioritaria, sin cargas máximas."
      : wkInMeso === 2
        ? "Progresión: sube ~10% de volumen o intensidad respecto a la semana anterior, consolidando patrones."
        : wkInMeso === 3
          ? "Pico: máxima intensidad/volumen del bloque, sesiones exigentes cerca del tope técnico."
          : "Descarga: volumen −30/40% respecto a la semana de pico; técnica y recuperación para el siguiente mesociclo.",
  );
  if (meso > 1 && wkInMeso === 1) {
    parts.push(
      "Este bloque parte de una base superior al mesociclo anterior: aplica sobrecarga progresiva (más carga, densidad o complejidad) respecto al bloque previo.",
    );
  }
  return parts.join(" ");
}

export function AiGenerateProgramModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [modality, setModality] = useState(MODALITIES[0].value);
  const [focus, setFocus] = useState(FOCUS_OPTIONS[0]);
  const [mesocycles, setMesocycles] = useState(1);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [emphases, setEmphases] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [description, setDescription] = useState("");

  const [cells, setCells] = useState<Cell[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ week: number; day: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const weeks = mesocycles * WEEKS_PER_MESO;
  const totalSessions = weeks * daysPerWeek;

  const emphasisFor = (meso: number): string => emphases[meso - 1] ?? "";
  function setEmphasis(idx: number, val: string) {
    setEmphases((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  }

  function freshCells(): Cell[] {
    const grid: Cell[] = [];
    for (let w = 1; w <= weeks; w++) {
      for (let d = 1; d <= daysPerWeek; d++) {
        grid.push({ week: w, day: d, status: "idle" });
      }
    }
    return grid;
  }

  function updateCell(w: number, d: number, patch: Partial<Cell>) {
    setCells((prev) =>
      prev.map((c) => (c.week === w && c.day === d ? { ...c, ...patch } : c)),
    );
  }

  function buildContext(list: Cell[], w: number, d: number): string {
    const { meso } = mesoInfo(w);
    const parts: string[] = [
      `PROGRAMA (MACROCICLO) de ${mesocycles} mesociclo(s) × ${WEEKS_PER_MESO} semanas × ${daysPerWeek} días. Foco general: ${focus}.`,
      phaseHint(w, mesocycles, emphasisFor(meso)),
      `Ahora programas la sesión del Día ${d} de la Semana ${w} (global).`,
    ];
    const inMeso = list.filter(
      (c) =>
        c.status === "ready" &&
        c.session &&
        mesoInfo(c.week).meso === meso &&
        (c.week < w || (c.week === w && c.day < d)),
    );
    if (inMeso.length > 0) {
      const lines = inMeso.map((c) => {
        const title = c.session?.title ?? "sesión";
        const exs = Array.from(
          new Set(c.session?.blocks.flatMap((b) => b.exercises) ?? []),
        )
          .slice(0, 8)
          .join(", ");
        return `  · S${c.week}·D${c.day}: "${title}"${exs ? ` — ${exs}` : ""}`;
      });
      parts.push(`SESIONES DE ESTE MESOCICLO:\n${lines.join("\n")}`);
      parts.push(
        "No repitas la misma familia de ejercicios más de 2-3 veces dentro del bloque. Varía el estímulo entre días.",
      );
    }
    if (meso > 1) {
      const summaries: string[] = [];
      for (let m = 1; m < meso; m++) {
        const em = emphasisFor(m).trim();
        summaries.push(`  · Mesociclo ${m}${em ? `: ${em}` : " (progresión general)"}`);
      }
      parts.push(
        `MESOCICLOS PREVIOS (ya entrenados):\n${summaries.join("\n")}\nProgresa respecto a ellos; no reinicies desde cero.`,
      );
    }
    return parts.join("\n\n");
  }

  async function generateAll() {
    if (!prompt.trim() || prompt.trim().length < 10) {
      setErr("Escribe un prompt más detallado (mín. 10 caracteres).");
      return;
    }
    setErr(null);
    setBusy(true);
    const grid = freshCells();
    setCells(grid);
    const local = [...grid];
    try {
      for (let w = 1; w <= weeks; w++) {
        for (let d = 1; d <= daysPerWeek; d++) {
          setProgress({ week: w, day: d });
          updateCell(w, d, { status: "loading", error: undefined });
          try {
            const res = await fetch("/api/ai/generate-session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                kind: modality,
                prompt: prompt.trim(),
                dayOfWeek: d,
                durationMin: 60,
                extraContext: buildContext(local, w, d),
              }),
            });
            const data = await res.json();
            if (!res.ok || !data?.ok) {
              throw new Error(data?.error ?? `Error ${res.status}`);
            }
            updateCell(w, d, { status: "ready", session: data.session });
            const idx = local.findIndex((c) => c.week === w && c.day === d);
            if (idx >= 0) {
              local[idx] = { ...local[idx], status: "ready", session: data.session };
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Error de red";
            updateCell(w, d, { status: "error", error: msg });
          }
        }
      }
    } finally {
      setProgress(null);
      setBusy(false);
    }
  }

  async function save() {
    if (!name.trim()) {
      setErr("Ponle un nombre al programa.");
      return;
    }
    const ready = cells.filter((c) => c.status === "ready" && c.session);
    if (ready.length === 0) {
      setErr("Genera al menos una sesión antes de guardar.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const pRes = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type: focus,
          level: 1,
          weeksCount: weeks,
          description:
            description.trim() ||
            `Macrociclo de ${mesocycles} mesociclo(s) × ${WEEKS_PER_MESO} semanas · ${focus}.`,
        }),
      });
      const program = await pRes.json();
      if (!pRes.ok || !program?.id) {
        throw new Error(program?.error ?? "No se pudo crear el programa");
      }
      for (const c of ready) {
        const r = await fetch("/api/programs/from-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            programId: program.id,
            weekNumber: c.week,
            dayOfWeek: c.day,
            session: c.session,
          }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d?.error ?? `Fallo guardando S${c.week}·D${c.day}`);
        }
      }
      onClose();
      router.push(`/biblioteca/programas/${program.id}`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Error inesperado al guardar");
      setSaving(false);
    }
  }

  const readyCount = cells.filter((c) => c.status === "ready").length;
  const groupedByMeso = useMemo(() => {
    const groups = new Map<number, number[]>();
    for (let w = 1; w <= weeks; w++) {
      const { meso } = mesoInfo(w);
      if (!groups.has(meso)) groups.set(meso, []);
      groups.get(meso)!.push(w);
    }
    return groups;
  }, [weeks]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-bg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="text-lg font-semibold">✨ Programador IA · Macrociclo</h2>
            <p className="text-xs text-muted">
              Genera un programa completo sesión a sesión con Claude Sonnet 4.6.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-text"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        <div className="grid max-h-[80vh] grid-cols-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[340px_1fr]">
          {/* Config */}
          <aside className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted">Nombre del programa</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface p-2 text-sm"
                placeholder="Ej. CrossFit Fuerza Q1"
                disabled={busy || saving}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted">Modalidad (brief)</label>
              <select
                value={modality}
                onChange={(e) => setModality(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface p-1.5 text-sm"
                disabled={busy || saving}
              >
                {MODALITIES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted">Foco general</label>
              <select
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface p-1.5 text-sm"
                disabled={busy || saving}
              >
                {FOCUS_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted">Mesociclos</label>
                <input
                  type="number"
                  min={1}
                  max={6}
                  value={mesocycles}
                  onChange={(e) =>
                    setMesocycles(Math.max(1, Math.min(6, Number(e.target.value) || 1)))
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-surface p-1.5 text-sm"
                  disabled={busy || saving}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted">Días por semana</label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={daysPerWeek}
                  onChange={(e) =>
                    setDaysPerWeek(Math.max(1, Math.min(7, Number(e.target.value) || 1)))
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-surface p-1.5 text-sm"
                  disabled={busy || saving}
                />
              </div>
            </div>
            {mesocycles > 1 && (
              <div>
                <label className="text-xs font-medium text-muted">
                  Énfasis por mesociclo (opcional)
                </label>
                <div className="mt-1 space-y-1">
                  {Array.from({ length: mesocycles }).map((_, i) => (
                    <input
                      key={i}
                      value={emphases[i] ?? ""}
                      onChange={(e) => setEmphasis(i, e.target.value)}
                      placeholder={`Meso ${i + 1}: ej. "Base aeróbica"`}
                      className="w-full rounded-lg border border-border bg-surface p-1.5 text-xs"
                      disabled={busy || saving}
                    />
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted">Prompt / tema del programa</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                className="mt-1 w-full rounded-lg border border-border bg-surface p-2 text-sm"
                placeholder={`Ej. "Programa para atleta amateur de CrossFit. Día 1 sentadilla, Día 2 press+tirón, Día 3 metcon largo. 60 min por sesión."`}
                disabled={busy || saving}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted">
                Descripción del programa (opcional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-border bg-surface p-2 text-sm"
                disabled={busy || saving}
              />
            </div>
            <div className="rounded-lg bg-surface-2 p-2 text-[11px] text-muted">
              Se generarán <strong>{totalSessions}</strong> sesiones ({weeks} semanas × {daysPerWeek} días).{" "}
              {totalSessions > 40 && (
                <span className="text-amber-700">Puede tardar varios minutos.</span>
              )}
            </div>
            <button
              onClick={generateAll}
              disabled={busy || saving || !prompt.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 font-medium text-primary-fg transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {busy
                ? progress
                  ? `Generando M${mesoInfo(progress.week).meso}·S${progress.week}·D${progress.day}…`
                  : "Generando…"
                : `Generar ${totalSessions} sesiones`}
            </button>
            {cells.length > 0 && (
              <button
                onClick={save}
                disabled={busy || saving || readyCount === 0}
                className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving
                  ? "Guardando…"
                  : `Crear programa (${readyCount}/${totalSessions} listas)`}
              </button>
            )}
            {err && <p className="text-xs text-red-600">{err}</p>}
          </aside>

          {/* Rejilla */}
          <section className="space-y-4">
            {cells.length === 0 ? (
              <p className="text-sm italic text-muted">
                Configura el macrociclo y pulsa &quot;Generar&quot;. Verás una tarjeta por sesión con el
                progreso en vivo.
              </p>
            ) : (
              Array.from(groupedByMeso.entries()).map(([meso, ws]) => (
                <div key={meso} className="rounded-2xl border border-border p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
                    Mesociclo {meso}
                  </p>
                  <div className="space-y-2">
                    {ws.map((w) => {
                      const { wkInMeso } = mesoInfo(w);
                      const row = cells.filter((c) => c.week === w);
                      return (
                        <div key={w}>
                          <p className="mb-1 text-[10px] text-muted">
                            Sem {w} · {phaseLabel(wkInMeso)}
                          </p>
                          <div
                            className="grid gap-2"
                            style={{
                              gridTemplateColumns: `repeat(${daysPerWeek}, minmax(0, 1fr))`,
                            }}
                          >
                            {row.map((c) => (
                              <SessionCell key={`${c.week}-${c.day}`} cell={c} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SessionCell({ cell }: { cell: Cell }) {
  if (cell.status === "idle") {
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface/30 p-2 text-center text-[10px] text-muted">
        —
      </div>
    );
  }
  if (cell.status === "loading") {
    return (
      <div className="flex items-center justify-center gap-1 rounded-lg border border-border bg-amber-50 p-2 text-[10px] text-amber-800">
        <Loader2 size={10} className="animate-spin" />
        Generando…
      </div>
    );
  }
  if (cell.status === "error") {
    return (
      <div
        className="rounded-lg border border-red-200 bg-red-50 p-2 text-[10px] text-red-700"
        title={cell.error}
      >
        ⚠ Error
      </div>
    );
  }
  return (
    <div
      className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[10px]"
      title={cell.session?.title}
    >
      <p className="line-clamp-2 font-semibold text-emerald-900">
        {cell.session?.title ?? "Sesión"}
      </p>
      <p className="mt-0.5 text-emerald-700">{cell.session?.blocks.length ?? 0} bloques</p>
    </div>
  );
}
