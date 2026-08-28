"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AiTrainingBriefData } from "@/lib/ai-training-brief";

type BriefEntry = {
  kind: string;
  label: string;
  brief: AiTrainingBriefData;
  examples: number;
};

const FIELDS: {
  key: keyof AiTrainingBriefData;
  label: string;
  help: string;
  minRows: number;
}[] = [
  {
    key: "systemPrompt",
    label: "🧠 System prompt (override)",
    help: "Si lo rellenas, se usa TAL CUAL como system. Ignora el resto de campos.",
    minRows: 6,
  },
  {
    key: "philosophy",
    label: "🎯 Filosofía / enfoque",
    help: "Qué persigues. Alto nivel.",
    minRows: 5,
  },
  {
    key: "voiceTone",
    label: "🗣️ Voz y tono",
    help: "Cómo suena una sesión bien escrita.",
    minRows: 5,
  },
  {
    key: "structureHints",
    label: "🧱 Estructura típica",
    help: "Bloques, orden, títulos habituales.",
    minRows: 6,
  },
  {
    key: "formats",
    label: "⏱️ Formatos y notación",
    help: "EMOM/TABATA/AMRAP, cargas, pausas.",
    minRows: 5,
  },
  {
    key: "intensityRules",
    label: "🔥 Intensidad e intención",
    help: "Duración, RPE, %, límites por bloque.",
    minRows: 5,
  },
  {
    key: "vocabulary",
    label: "📚 Vocabulario y ejercicios",
    help: "Nombres preferidos, abreviaturas.",
    minRows: 5,
  },
  {
    key: "dos",
    label: "✅ Do's",
    help: "Lo que SIEMPRE debe hacer.",
    minRows: 5,
  },
  {
    key: "donts",
    label: "🚫 Don'ts",
    help: "Lo que NUNCA debe hacer.",
    minRows: 5,
  },
  {
    key: "goodExamples",
    label: "🌟 Ejemplos buenos",
    help: "Se usan como few-shot cuando encajan por keywords.",
    minRows: 8,
  },
  {
    key: "badExamples",
    label: "🗑️ Ejemplos malos",
    help: "Qué evitar (opcional).",
    minRows: 5,
  },
];

export function AiTrainingBriefEditor({
  briefs,
  activeKind,
}: {
  briefs: BriefEntry[];
  activeKind: string;
}) {
  const router = useRouter();
  const initial = briefs.find((b) => b.kind === activeKind) ?? briefs[0];
  const [kind, setKind] = useState(initial.kind);
  const currentEntry = briefs.find((b) => b.kind === kind) ?? initial;
  const [values, setValues] = useState<AiTrainingBriefData>(currentEntry.brief);
  const [savingKey, setSavingKey] = useState<keyof AiTrainingBriefData | null>(null);
  const [error, setError] = useState<string | null>(null);

  function switchKind(next: string) {
    const entry = briefs.find((b) => b.kind === next);
    if (!entry) return;
    setKind(next);
    setValues(entry.brief);
    setError(null);
    router.replace(`/biblioteca/programa-brief-ia?kind=${encodeURIComponent(next)}`);
  }

  async function save(key: keyof AiTrainingBriefData, value: string) {
    setSavingKey(key);
    setError(null);
    try {
      const r = await fetch(`/api/ai/training-brief?kind=${encodeURIComponent(kind)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const d = await r.json();
      if (!r.ok || !d?.ok) throw new Error(d?.error ?? "Error guardando");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando");
    } finally {
      setSavingKey(null);
    }
  }

  async function clearAll() {
    if (!confirm("¿Vaciar TODOS los campos del brief? Esto no se puede deshacer.")) return;
    setError(null);
    try {
      const r = await fetch(`/api/ai/training-brief?kind=${encodeURIComponent(kind)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear-all-fields" }),
      });
      const d = await r.json();
      if (!r.ok || !d?.ok) throw new Error(d?.error ?? "Error");
      setValues(d.brief);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error vaciando el brief");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {briefs.map((b) => (
          <button
            key={b.kind}
            onClick={() => switchKind(b.kind)}
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              kind === b.kind
                ? "bg-primary text-primary-fg"
                : "border border-border bg-surface hover:bg-surface-2"
            }`}
          >
            {b.label}{" "}
            <span
              className={`ml-1 text-[10px] ${
                kind === b.kind ? "text-primary-fg/70" : "text-muted"
              }`}
            >
              · {b.examples} ejemplos
            </span>
          </button>
        ))}
        <button
          onClick={clearAll}
          className="ml-auto rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:border-red-300 hover:text-red-700"
        >
          Vaciar brief
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-5">
        {FIELDS.map((f) => (
          <div key={f.key} className="rounded-2xl border border-border bg-surface p-4">
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <label htmlFor={f.key} className="text-sm font-semibold">
                {f.label}
              </label>
              <span className="text-[10px] text-muted">
                {(values[f.key] ?? "").length} chars
                {savingKey === f.key ? " · guardando…" : ""}
              </span>
            </div>
            <p className="mb-2 text-xs text-muted">{f.help}</p>
            <textarea
              id={f.key}
              value={values[f.key] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
              }
              onBlur={(e) => save(f.key, e.target.value)}
              rows={f.minRows}
              className="w-full rounded-lg border border-border bg-bg p-3 font-mono text-xs leading-relaxed outline-none focus:border-primary"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
