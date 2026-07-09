"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  DEFAULT_CHECKIN_FORM,
  type CheckInField,
  type CheckInFieldType,
  type CheckInFormConfigShape,
  type CheckInSection,
} from "@/lib/checkinForm";
import { resetCheckInFormAction, saveCheckInFormAction } from "@/app/(panel)/biblioteca/checkin-avanzado/actions";

const FIELD_TYPES: { value: CheckInFieldType; label: string }[] = [
  { value: "number", label: "Número" },
  { value: "scale5", label: "Escala 1-5" },
  { value: "scale10", label: "Escala 1-10" },
  { value: "text", label: "Texto corto" },
  { value: "textarea", label: "Texto largo" },
  { value: "select", label: "Selector" },
  { value: "checkbox", label: "Sí/No" },
];

function slugify(s: string): string {
  const base = s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return base || `f_${Date.now().toString(36)}`;
}

/** Editor visual del formulario avanzado. Secciones colapsables con campos
 *  editables inline. Sin librerías de DnD — reordenar con ↑ ↓. */
export function CheckInFormEditor({ initial }: { initial: CheckInFormConfigShape }) {
  const [sections, setSections] = useState<CheckInSection[]>(initial.sections);
  const [saving, startSaving] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function updateSection(idx: number, patch: Partial<CheckInSection>) {
    setSections((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function moveSection(idx: number, dir: "up" | "down") {
    setSections((prev) => {
      const j = idx + (dir === "up" ? -1 : 1);
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  function addSection() {
    const id = `sec_${Date.now().toString(36)}`;
    setSections((prev) => [
      ...prev,
      { id, title: "Nueva sección", description: null, fields: [] },
    ]);
  }

  function removeSection(idx: number) {
    if (!confirm(`¿Borrar la sección "${sections[idx].title}"?`)) return;
    setSections((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateField(secIdx: number, fieldIdx: number, patch: Partial<CheckInField>) {
    setSections((prev) =>
      prev.map((s, i) =>
        i !== secIdx
          ? s
          : { ...s, fields: s.fields.map((f, j) => (j === fieldIdx ? { ...f, ...patch } : f)) },
      ),
    );
  }

  function moveField(secIdx: number, fieldIdx: number, dir: "up" | "down") {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== secIdx) return s;
        const j = fieldIdx + (dir === "up" ? -1 : 1);
        if (j < 0 || j >= s.fields.length) return s;
        const next = [...s.fields];
        [next[fieldIdx], next[j]] = [next[j], next[fieldIdx]];
        return { ...s, fields: next };
      }),
    );
  }

  function addField(secIdx: number) {
    const label = "Nuevo campo";
    const id = `${slugify(label)}_${Date.now().toString(36).slice(-4)}`;
    setSections((prev) =>
      prev.map((s, i) =>
        i !== secIdx
          ? s
          : { ...s, fields: [...s.fields, { id, label, type: "number" }] },
      ),
    );
  }

  function removeField(secIdx: number, fieldIdx: number) {
    setSections((prev) =>
      prev.map((s, i) =>
        i !== secIdx ? s : { ...s, fields: s.fields.filter((_, j) => j !== fieldIdx) },
      ),
    );
  }

  function save() {
    startSaving(async () => {
      await saveCheckInFormAction({ sections });
      setSavedAt(Date.now());
    });
  }

  function reset() {
    if (!confirm("Se van a restaurar los valores por defecto del formulario avanzado. ¿Continuar?")) return;
    startSaving(async () => {
      await resetCheckInFormAction();
      setSections(DEFAULT_CHECKIN_FORM.sections);
      setSavedAt(Date.now());
    });
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Check-in avanzado</h1>
        <p className="mt-1 text-sm text-muted">
          Este formulario se usa cuando en la ficha del cliente activas
          <span className="mx-1 rounded bg-bg px-1.5 font-semibold text-text">Check-in avanzado</span>.
          El atleta lo verá en lugar del check-in semanal básico. Los campos se guardan en
          <code className="mx-1 rounded bg-bg px-1 text-[11px]">extraAnswers</code> de cada check-in.
        </p>
      </header>

      {sections.map((sec, si) => (
        <section key={sec.id} className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-start gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <input
                value={sec.title}
                onChange={(e) => updateSection(si, { title: e.target.value })}
                placeholder="Título de la sección"
                className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-base font-bold outline-none hover:border-border focus:border-primary"
              />
              <input
                value={sec.description ?? ""}
                onChange={(e) => updateSection(si, { description: e.target.value })}
                placeholder="Descripción (opcional)"
                className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-xs text-muted outline-none hover:border-border focus:border-primary"
              />
            </div>
            <div className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-border bg-bg p-0.5">
              <button type="button" onClick={() => moveSection(si, "up")} disabled={si === 0} className="rounded px-2 py-1 text-text hover:bg-surface hover:text-primary disabled:text-muted/40" title="Subir sección">
                <ChevronUp size={16} />
              </button>
              <button type="button" onClick={() => moveSection(si, "down")} disabled={si === sections.length - 1} className="rounded px-2 py-1 text-text hover:bg-surface hover:text-primary disabled:text-muted/40" title="Bajar sección">
                <ChevronDown size={16} />
              </button>
            </div>
            <button type="button" onClick={() => removeSection(si)} className="rounded-lg border border-border bg-bg p-1.5 text-muted hover:border-red-300 hover:text-red-600" title="Borrar sección">
              <Trash2 size={16} />
            </button>
          </div>

          <div className="space-y-2">
            {sec.fields.map((f, fi) => (
              <FieldRow
                key={f.id}
                field={f}
                onChange={(patch) => updateField(si, fi, patch)}
                onMoveUp={() => moveField(si, fi, "up")}
                onMoveDown={() => moveField(si, fi, "down")}
                onRemove={() => removeField(si, fi)}
                isFirst={fi === 0}
                isLast={fi === sec.fields.length - 1}
              />
            ))}
            <button
              type="button"
              onClick={() => addField(si)}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-border bg-bg px-3 py-1.5 text-xs text-muted hover:border-primary hover:text-primary"
            >
              <Plus size={12} /> Añadir campo
            </button>
          </div>
        </section>
      ))}

      <button
        type="button"
        onClick={addSection}
        className="w-full rounded-2xl border border-dashed border-border bg-surface/50 py-4 text-sm font-medium text-muted hover:border-primary hover:text-primary"
      >
        <Plus size={14} className="mr-1 inline" /> Añadir sección
      </button>

      <div className="sticky bottom-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur">
        <p className="text-xs text-muted">
          {sections.length} sección{sections.length === 1 ? "" : "es"} ·{" "}
          {sections.reduce((n, s) => n + s.fields.length, 0)} campos
        </p>
        <div className="flex items-center gap-2">
          {savedAt ? (
            <span className="text-xs text-emerald-700">Guardado {new Date(savedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>
          ) : null}
          <button
            type="button"
            onClick={reset}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted hover:border-red-300 hover:text-red-600 disabled:opacity-50"
          >
            <RotateCcw size={13} /> Restaurar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar formulario
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  field,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  isFirst,
  isLast,
}: {
  field: CheckInField;
  onChange: (patch: Partial<CheckInField>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const showUnit = field.type === "number";
  const showOptions = field.type === "select";
  return (
    <div className="rounded-xl border border-border bg-bg p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
            <label className="block text-xs">
              <span className="font-semibold text-muted">Etiqueta</span>
              <input
                value={field.label}
                onChange={(e) => onChange({ label: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
            </label>
            <label className="block text-xs">
              <span className="font-semibold text-muted">Tipo</span>
              <select
                value={field.type}
                onChange={(e) => onChange({ type: e.target.value as CheckInFieldType })}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-primary"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            {showUnit ? (
              <label className="block text-xs">
                <span className="font-semibold text-muted">Unidad</span>
                <input
                  value={field.unit ?? ""}
                  onChange={(e) => onChange({ unit: e.target.value || null })}
                  placeholder="kg, cm, h…"
                  className="mt-1 w-full max-w-[80px] rounded-lg border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-primary"
                />
              </label>
            ) : (
              <div />
            )}
          </div>

          <input
            value={field.hint ?? ""}
            onChange={(e) => onChange({ hint: e.target.value || null })}
            placeholder="Pista o ayuda (opcional)"
            className="w-full rounded-lg border border-border bg-surface px-2 py-1 text-xs text-muted outline-none focus:border-primary"
          />

          {showOptions ? (
            <OptionsEditor
              options={field.options ?? []}
              onChange={(next) => onChange({ options: next.length > 0 ? next : undefined })}
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={!!field.required}
                onChange={(e) => onChange({ required: e.target.checked })}
                className="rounded border-border text-primary"
              />
              <span>Obligatorio</span>
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="checkbox"
                checked={!!field.hidden}
                onChange={(e) => onChange({ hidden: e.target.checked })}
                className="rounded border-border text-primary"
              />
              <span>Oculto</span>
            </label>
            <code className="ml-auto rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted">
              id: {field.id}
            </code>
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-col gap-1">
          <button type="button" onClick={onMoveUp} disabled={isFirst} title="Subir campo" className="rounded-md border border-border bg-surface p-1 text-muted hover:text-primary disabled:opacity-40">
            <ChevronUp size={12} />
          </button>
          <button type="button" onClick={onMoveDown} disabled={isLast} title="Bajar campo" className="rounded-md border border-border bg-surface p-1 text-muted hover:text-primary disabled:opacity-40">
            <ChevronDown size={12} />
          </button>
          <button type="button" onClick={onRemove} title="Borrar campo" className="rounded-md border border-border bg-surface p-1 text-muted hover:border-red-300 hover:text-red-600">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: { value: string; label: string }[];
  onChange: (next: { value: string; label: string }[]) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-2">
      <p className="mb-1.5 text-[11px] font-semibold text-muted">Opciones del selector</p>
      <div className="space-y-1">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-1">
            <input
              value={opt.value}
              onChange={(e) => onChange(options.map((o, j) => (j === i ? { ...o, value: e.target.value } : o)))}
              placeholder="valor"
              className="w-24 rounded border border-border bg-bg px-1.5 py-1 text-xs outline-none focus:border-primary"
            />
            <input
              value={opt.label}
              onChange={(e) => onChange(options.map((o, j) => (j === i ? { ...o, label: e.target.value } : o)))}
              placeholder="Etiqueta visible"
              className="flex-1 rounded border border-border bg-bg px-1.5 py-1 text-xs outline-none focus:border-primary"
            />
            <button type="button" onClick={() => onChange(options.filter((_, j) => j !== i))} className="rounded p-1 text-muted hover:text-red-600" title="Quitar">
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...options, { value: `opt_${options.length + 1}`, label: "" }])}
        className="mt-1.5 inline-flex items-center gap-1 rounded border border-dashed border-border bg-bg px-2 py-0.5 text-[11px] text-muted hover:border-primary hover:text-primary"
      >
        <Plus size={10} /> Añadir opción
      </button>
    </div>
  );
}
