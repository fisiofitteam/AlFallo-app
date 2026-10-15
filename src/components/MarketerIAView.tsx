"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Paperclip, X } from "lucide-react";
import { upload } from "@vercel/blob/client";
import { isoWeekFromDate } from "@/lib/content-templates";

type GoalKey = "atraer" | "conectar" | "educar" | "convertir" | "lanzamiento";
type ScriptBlock = { label: string; content: string };
type Piece = {
  dayOfWeek: number;
  format: string;
  title: string;
  hook: string;
  goals: GoalKey[];
  rationale: string;
  script?: ScriptBlock[];
};
type Week = {
  weekOffset: number;
  centralTheme: string;
  bodyZone: string;
  weekType: "educativa" | "objeciones" | "lanzamiento" | "recuperacion";
  limitingBeliefs?: string[];
  pieces: Piece[];
};
type Result = { strategy: string; weeks: Week[] };

const DAY_LABELS = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function nextMondayUtc(): Date {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dow = d.getUTCDay();
  const daysUntilMonday = dow === 1 ? 7 : (8 - dow) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  return d;
}
function toDateInputValue(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}
function snapToMondayUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  const dow = day.getUTCDay();
  const backToMonday = dow === 0 ? 6 : dow - 1;
  day.setUTCDate(day.getUTCDate() - backToMonday);
  return day;
}
function mondayForOffset(baseMonday: Date, offset: number): Date {
  const d = new Date(baseMonday);
  d.setUTCDate(d.getUTCDate() + offset * 7);
  return d;
}

export function MarketerIAView() {
  const [brief, setBrief] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [startWeek, setStartWeek] = useState(() => toDateInputValue(nextMondayUtc()));
  const [weeksAhead, setWeeksAhead] = useState(2);
  const [mixReel, setMixReel] = useState(3);
  const [mixCarousel, setMixCarousel] = useState(1);
  const [mixInfographic, setMixInfographic] = useState(0);
  const [mixImage, setMixImage] = useState(0);
  const [mixLive, setMixLive] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [added, setAdded] = useState<Record<string, string>>({});

  // PDF opcional de referencia para ESTA generación (no se persiste).
  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  async function handlePdfSelected(file: File | null) {
    if (!file) return;
    setUploadError(null);
    setUploadingPdf(true);
    try {
      const key = `marketer-oneoff/${Date.now()}-${file.name}`;
      const blob = await upload(key, file, {
        access: "public",
        handleUploadUrl: "/api/biblioteca/upload-doc",
      });
      setAttachment({ url: blob.url, name: file.name });
    } catch (e) {
      setUploadError((e as Error).message || "No se pudo subir el PDF.");
    } finally {
      setUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  }

  function removeAttachment() {
    setAttachment(null);
  }

  async function generate() {
    if (brief.trim().length < 10) {
      setError("Escribe un brief más detallado");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    setAdded({});
    try {
      const piecesPerWeek: Record<string, number> = {};
      if (mixReel > 0) piecesPerWeek.reel = mixReel;
      if (mixCarousel > 0) piecesPerWeek.carousel = mixCarousel;
      if (mixInfographic > 0) piecesPerWeek.infographic = mixInfographic;
      if (mixImage > 0) piecesPerWeek.image = mixImage;
      if (mixLive > 0) piecesPerWeek.live = mixLive;
      const r = await fetch("/api/content/marketer/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: brief.trim(),
          targetDate: targetDate || undefined,
          startWeek: toDateInputValue(snapToMondayUtc(startWeek)),
          weeksAhead,
          piecesPerWeek: Object.keys(piecesPerWeek).length > 0 ? piecesPerWeek : undefined,
          attachment: attachment ?? undefined,
        }),
      });
      // Parseo defensivo: si Vercel devuelve HTML por timeout, .json() peta.
      const raw = await r.text();
      let d: { ok?: boolean; strategy?: string; weeks?: Week[]; error?: string };
      try {
        d = JSON.parse(raw);
      } catch {
        setError(
          r.status === 504
            ? "La IA tardó demasiado (>5 min). Prueba menos semanas."
            : `Respuesta no válida (${r.status}): ${raw.slice(0, 200)}`,
        );
        return;
      }
      if (!r.ok || !d?.ok) {
        setError(d?.error || `Error ${r.status}`);
        return;
      }
      setResult({ strategy: d.strategy ?? "", weeks: d.weeks ?? [] });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  }

  async function addPiece(week: Week, piece: Piece, key: string) {
    if (added[key]) return;
    setAdded((p) => ({ ...p, [key]: "loading" }));
    try {
      const baseMonday = snapToMondayUtc(startWeek);
      const monday = mondayForOffset(baseMonday, week.weekOffset);
      const { year, weekNumber } = isoWeekFromDate(monday);
      const r = await fetch("/api/content/marketer/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week: {
            year,
            weekNumber,
            centralTheme: week.centralTheme,
            bodyZone: week.bodyZone,
            weekType: week.weekType,
            limitingBeliefs: week.limitingBeliefs ?? [],
          },
          piece: {
            dayOfWeek: piece.dayOfWeek,
            format: piece.format,
            title: piece.title,
            hook: piece.hook,
            goals: piece.goals,
            script: piece.script ?? [],
          },
        }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) {
        setAdded((p) => {
          const n = { ...p };
          delete n[key];
          return n;
        });
        alert(d.error || "No se pudo añadir");
        return;
      }
      setAdded((p) => ({ ...p, [key]: d.pieceId }));
    } catch (e: unknown) {
      setAdded((p) => {
        const n = { ...p };
        delete n[key];
        return n;
      });
      alert(e instanceof Error ? e.message : "Error inesperado");
    }
  }

  async function addAll() {
    if (!result) return;
    for (const week of result.weeks) {
      for (let i = 0; i < week.pieces.length; i++) {
        const piece = week.pieces[i];
        const key = `${week.weekOffset}|${piece.dayOfWeek}|${i}`;
        if (added[key]) continue;
        await addPiece(week, piece, key);
      }
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
      {/* Panel izq: brief + params */}
      <aside className="space-y-3">
        <div>
          <label className="text-xs font-medium text-muted">Brief</label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface p-2 text-sm"
            style={{ minHeight: 180 }}
            placeholder='Ej. "Lanzamiento de Performance el 15 de octubre. 2 semanas antes ataco el mito de que hay que quitar hidratos para definir, y en la semana de lanzamiento saco 2 testimonios reales."'
            disabled={busy}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted">Empezar semana del…</label>
          <input
            type="date"
            value={startWeek}
            onChange={(e) => setStartWeek(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface p-1.5 text-sm"
            disabled={busy}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted">Fecha objetivo (opcional)</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface p-1.5 text-sm"
            disabled={busy}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted">Semanas a planificar</label>
          <div className="mt-1 flex gap-1">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setWeeksAhead(n)}
                disabled={busy}
                className={`rounded-lg border px-3 py-1 text-xs transition ${
                  weeksAhead === n
                    ? "border-primary bg-primary text-primary-fg"
                    : "border-border bg-surface hover:bg-surface-2"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted">Mezcla por semana</label>
          <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
            <MixInput label="🎬 Reels" value={mixReel} onChange={setMixReel} disabled={busy} />
            <MixInput label="📚 Carruseles" value={mixCarousel} onChange={setMixCarousel} disabled={busy} />
            <MixInput label="📊 Infografías" value={mixInfographic} onChange={setMixInfographic} disabled={busy} />
            <MixInput label="📷 Imagen" value={mixImage} onChange={setMixImage} disabled={busy} />
            <MixInput label="🔴 Live" value={mixLive} onChange={setMixLive} disabled={busy} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted">PDF de referencia (opcional)</label>
          <p className="mt-0.5 text-[11px] text-muted">
            Hasta 50 MB. La IA lo lee para esta generación concreta — no se guarda.
          </p>
          {attachment ? (
            <div className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-xs">
              <Paperclip size={12} className="text-muted" />
              <a
                href={attachment.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate hover:text-primary hover:underline"
              >
                {attachment.name}
              </a>
              <button
                type="button"
                onClick={removeAttachment}
                disabled={busy}
                className="rounded-md p-1 text-muted hover:text-red-600 disabled:opacity-50"
                title="Quitar PDF"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <label className="mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-border bg-bg px-3 py-2 text-xs font-medium hover:border-primary">
              {uploadingPdf ? (
                <>
                  <Loader2 size={12} className="animate-spin" /> Subiendo…
                </>
              ) : (
                <>
                  <Paperclip size={12} /> Adjuntar PDF
                </>
              )}
              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => handlePdfSelected(e.target.files?.[0] ?? null)}
                disabled={uploadingPdf || busy}
              />
            </label>
          )}
          {uploadError ? (
            <p className="mt-1 text-[11px] text-red-600">{uploadError}</p>
          ) : null}
        </div>

        <button
          onClick={generate}
          disabled={busy || uploadingPdf}
          className="w-full rounded-lg bg-primary py-2 font-medium text-primary-fg transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Generando…" : "🧠 Generar estrategia"}
        </button>
        <p className="text-xs text-muted">
          <Link href="/contenido/marketer/brief" className="underline hover:text-text">
            Editar brief de marca
          </Link>{" "}
          que la IA usa como base.
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </aside>

      {/* Panel dcha: resultado */}
      <section>
        {!result && !busy && (
          <p className="text-sm italic text-muted">
            Escribe un brief y pulsa &quot;Generar estrategia&quot;. La IA propondrá semanas y piezas
            concretas — con un clic las añades al calendario.
          </p>
        )}
        {busy && (
          <p className="text-sm text-muted">
            Generando… puede tardar 30–90 segundos con briefs largos.
          </p>
        )}
        {result && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="mb-1 font-semibold">Arco narrativo</h3>
              <p className="whitespace-pre-wrap text-sm">{result.strategy}</p>
              <button
                onClick={addAll}
                className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Añadir TODAS las piezas al calendario
              </button>
            </div>
            {result.weeks.map((w) => (
              <div key={w.weekOffset} className="rounded-2xl border border-border p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-neutral-200 px-2 py-0.5 text-xs">
                    Semana +{w.weekOffset}
                  </span>
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-900">
                    {w.weekType}
                  </span>
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs">{w.bodyZone}</span>
                </div>
                <h4 className="font-medium">{w.centralTheme}</h4>
                {w.limitingBeliefs && w.limitingBeliefs.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-xs text-muted">
                    {w.limitingBeliefs.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}
                <ul className="mt-3 space-y-2">
                  {w.pieces.map((p, i) => {
                    const key = `${w.weekOffset}|${p.dayOfWeek}|${i}`;
                    const state = added[key];
                    return (
                      <li key={key} className="rounded-lg bg-neutral-50 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="mb-1 flex flex-wrap gap-1 text-xs">
                              <span className="rounded border border-border bg-white px-2 py-0.5">
                                {DAY_LABELS[p.dayOfWeek] ?? `Día ${p.dayOfWeek}`}
                              </span>
                              <span className="rounded border border-border bg-white px-2 py-0.5">
                                {p.format}
                              </span>
                              {p.goals.map((g) => (
                                <span key={g} className="rounded bg-purple-100 px-2 py-0.5 text-purple-900">
                                  {g}
                                </span>
                              ))}
                            </div>
                            <div className="text-sm font-medium">{p.title}</div>
                            <div className="mt-1 text-xs text-neutral-700">
                              <b>Idea:</b> {p.hook}
                            </div>
                            <div className="mt-1 text-xs italic text-muted">{p.rationale}</div>
                            {p.format === "reel" && p.script && p.script.length > 0 && (
                              <details className="mt-2 rounded-lg border border-neutral-200 bg-white p-2 text-xs">
                                <summary className="cursor-pointer font-medium text-neutral-700">
                                  🎬 Guion del reel ({p.script.length} bloques)
                                </summary>
                                <div className="mt-2 space-y-2">
                                  {p.script.map((b, si) => (
                                    <div key={si}>
                                      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                                        {b.label}
                                      </div>
                                      <p className="mt-0.5 whitespace-pre-wrap leading-snug text-neutral-800">
                                        {b.content}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                          <button
                            onClick={() => addPiece(w, p, key)}
                            disabled={!!state}
                            className={`shrink-0 rounded px-3 py-1 text-xs transition ${
                              state === "loading"
                                ? "bg-neutral-300"
                                : state
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-black text-white hover:bg-neutral-800"
                            }`}
                          >
                            {state === "loading" ? "…" : state ? "✓ Añadida" : "+ Añadir"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MixInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-1">
      <span className="flex-1">{label}</span>
      <input
        type="number"
        min={0}
        max={7}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Math.max(0, Math.min(7, Number(e.target.value) || 0)))}
        className="w-12 rounded border border-border p-0.5 text-center"
      />
    </label>
  );
}
