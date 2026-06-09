"use client";

import { useState, useTransition } from "react";
import { Save, Loader2, Sparkles, ClipboardList, Settings2 } from "lucide-react";
import {
  BRIEF_SCOPES,
  BRIEF_SCOPE_LABELS,
  type BriefScope,
  type BriefShape,
} from "@/lib/ai-brief-types";
import { saveBriefAction } from "@/app/(panel)/biblioteca/brief-ia/actions";
import { DocAttachmentList } from "@/components/DocAttachmentList";
import { SpecialConsiderationsEditor } from "@/components/SpecialConsiderationsEditor";
import type { SpecialConsiderationDTO } from "@/lib/specialConsiderations";

type LocalState = Record<BriefScope, BriefShape>;
type Mode = BriefScope | "_special";

export function AIBriefEditor({
  initial,
  initialSpecial,
}: {
  initial: BriefShape[];
  initialSpecial: SpecialConsiderationDTO[];
}) {
  const [state, setState] = useState<LocalState>(() =>
    Object.fromEntries(initial.map((b) => [b.scope, b])) as LocalState,
  );
  const [mode, setMode] = useState<Mode>("global");
  const [saving, startSaving] = useTransition();
  const [savedAt, setSavedAt] = useState<Record<BriefScope, number | null>>(
    () => Object.fromEntries(BRIEF_SCOPES.map((s) => [s, null])) as Record<BriefScope, number | null>,
  );

  function patch(scope: BriefScope, patch: Partial<BriefShape>) {
    setState((s) => ({ ...s, [scope]: { ...s[scope], ...patch } }));
  }

  function save(scope: BriefScope) {
    const brief = state[scope];
    const fd = new FormData();
    fd.set("scope", brief.scope);
    fd.set("philosophy", brief.philosophy);
    fd.set("preferredFoods", brief.preferredFoods);
    fd.set("avoidFoods", brief.avoidFoods);
    fd.set("equivalences", brief.equivalences);
    fd.set("additionalRules", brief.additionalRules);
    fd.set("examplePlans", brief.examplePlans);
    fd.set("equivalencesAttachments", JSON.stringify(brief.equivalencesAttachments));
    fd.set("examplePlansAttachments", JSON.stringify(brief.examplePlansAttachments));
    startSaving(async () => {
      await saveBriefAction(fd);
      setSavedAt((s) => ({ ...s, [scope]: Date.now() }));
    });
  }

  // Modo activo: scope (brief) o "_special" (consideraciones).
  const activeScope: BriefScope = mode === "_special" ? "global" : (mode as BriefScope);
  const current = state[activeScope];
  const isGlobal = activeScope === "global";

  return (
    <div>
      <div className="mb-5 flex items-start gap-2 rounded-xl border border-primary/40 bg-primary-soft/30 px-4 py-3 text-xs text-text">
        <Sparkles size={14} className="mt-0.5 flex-shrink-0 text-primary" />
        <span>
          Al generar un plan con IA se inyecta el brief <strong>Global</strong> + el del{" "}
          <strong>objetivo del cliente</strong> + las <strong>consideraciones especiales</strong>{" "}
          marcadas en su ficha. Lo vacío no se envía (no infla el prompt).
        </span>
      </div>

      {/* Tabs: scopes + Consideraciones especiales */}
      <nav className="mb-5 flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1">
        {BRIEF_SCOPES.map((s) => {
          const filled = isAnyFieldFilled(state[s]);
          const isActive = mode === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setMode(s)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition ${
                isActive
                  ? "bg-primary font-semibold text-white"
                  : "text-muted hover:bg-bg hover:text-text"
              }`}
            >
              {filled ? (
                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-white" : "bg-emerald-500"}`} />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-border" />
              )}
              {BRIEF_SCOPE_LABELS[s]}
            </button>
          );
        })}
        <span className="mx-1 self-stretch border-l border-border" aria-hidden />
        <button
          type="button"
          onClick={() => setMode("_special")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition ${
            mode === "_special"
              ? "bg-primary font-semibold text-white"
              : "text-muted hover:bg-bg hover:text-text"
          }`}
        >
          <Settings2 size={13} />
          Consideraciones especiales
        </button>
      </nav>

      {mode === "_special" ? (
        <SpecialConsiderationsEditor initial={initialSpecial} />
      ) : (
        <section className="rounded-2xl border border-border bg-surface">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <p className="font-semibold">{BRIEF_SCOPE_LABELS[activeScope]}</p>
            <div className="flex items-center gap-2">
              {savedAt[activeScope] ? <span className="text-xs text-emerald-600">Guardado ✓</span> : null}
              <button
                type="button"
                onClick={() => save(activeScope)}
                disabled={saving}
                className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Guardar
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-5 p-5">
            <BriefField
              label="Filosofía nutricional"
              hint="Tu enfoque general. Ej: 'Déficit moderado de 300-500 kcal, proteína alta 1.8-2.2 g/kg, reparto en 4-5 comidas, hidratación 35 ml/kg…'"
              value={current.philosophy}
              onChange={(v) => patch(activeScope, { philosophy: v })}
            />
            <BriefField
              label="Alimentos preferidos"
              hint="Lista blanca. Una línea por familia o alimento."
              value={current.preferredFoods}
              onChange={(v) => patch(activeScope, { preferredFoods: v })}
            />
            <BriefField
              label="Alimentos a evitar"
              hint="Ej: 'Ultraprocesados, bollería industrial, azúcar añadido…'"
              value={current.avoidFoods}
              onChange={(v) => patch(activeScope, { avoidFoods: v })}
            />

            {/* Equivalencias solo en el brief GLOBAL */}
            {isGlobal ? (
              <>
                <BriefField
                  label="Equivalencias y porciones"
                  hint="Cómo traducir cantidades. Ej: '1 huevo M = 50 g · 1 cda. AOVE = 10 g · 1 yogur natural = 125 g…'"
                  value={current.equivalences}
                  onChange={(v) => patch(activeScope, { equivalences: v })}
                />
                <DocAttachmentList
                  label="Tabla de equivalencias (PDF, Excel o CSV)"
                  hint="Adjunta tu tabla(s) maestra(s). Puedes subir varios archivos. La IA los leerá al generar."
                  accept=".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  value={current.equivalencesAttachments}
                  onChange={(next) => patch(activeScope, { equivalencesAttachments: next })}
                />
              </>
            ) : null}

            <BriefField
              label="Reglas adicionales"
              hint="Todo lo demás: variedad, horarios, suplementación, presupuesto, contexto cultural, idioma…"
              value={current.additionalRules}
              onChange={(v) => patch(activeScope, { additionalRules: v })}
            />

            {/* Dietas de ejemplo solo en los OBJETIVOS específicos */}
            {!isGlobal ? (
              <>
                <BriefField
                  label="Dietas de ejemplo"
                  hint="Pega aquí menús reales que sirvan de plantilla de estilo y estructura. Puedes pegar un día tipo, una semana entera o varios ejemplos separados por '---'. La IA los usará de referencia, no los copiará literal."
                  value={current.examplePlans}
                  onChange={(v) => patch(activeScope, { examplePlans: v })}
                  rows={14}
                />
                <DocAttachmentList
                  label="Dietas de ejemplo en PDF"
                  hint="Adjunta planes en PDF de casos reales o referencia. Puedes subir varios. Claude los leerá nativamente."
                  accept=".pdf,application/pdf"
                  value={current.examplePlansAttachments}
                  onChange={(next) => patch(activeScope, { examplePlansAttachments: next })}
                />
              </>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}

function isAnyFieldFilled(b: BriefShape): boolean {
  return Boolean(
    b.philosophy.trim() ||
      b.preferredFoods.trim() ||
      b.avoidFoods.trim() ||
      b.equivalences.trim() ||
      b.additionalRules.trim() ||
      b.examplePlans.trim() ||
      b.equivalencesAttachments.length > 0 ||
      b.examplePlansAttachments.length > 0,
  );
}

function BriefField({
  label,
  hint,
  value,
  onChange,
  rows = 5,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold">{label}</span>
      <span className="block text-xs text-muted">{hint}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        placeholder="Déjalo vacío si no quieres añadir nada en esta sección."
      />
    </label>
  );
}
