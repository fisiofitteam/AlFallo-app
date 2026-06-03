"use client";

import { useState, useTransition } from "react";
import {
  Plus, Trash2, Eye, EyeOff, Lock, RotateCcw, Save, ChevronDown,
  AlertTriangle, Loader2, GripHorizontal,
} from "lucide-react";
import {
  isCriticalField,
  isCustomField,
  type OnboardingField,
  type OnboardingFieldType,
  type OnboardingFormConfigShape,
  type OnboardingSection,
} from "@/lib/onboarding-form";
import {
  saveOnboardingConfigAction,
  resetOnboardingConfigAction,
} from "@/app/(panel)/biblioteca/onboarding/actions";

const FIELD_TYPE_LABELS: Record<OnboardingFieldType, string> = {
  text: "Texto corto",
  textarea: "Texto largo",
  number: "Número",
  select: "Desplegable",
  date: "Fecha",
  tags: "Lista (separada por comas)",
  checkbox: "Sí/No",
};

const ALL_TYPES: OnboardingFieldType[] = [
  "text",
  "textarea",
  "number",
  "select",
  "date",
  "tags",
  "checkbox",
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function OnboardingFormEditor({ initial }: { initial: OnboardingFormConfigShape }) {
  const [config, setConfig] = useState<OnboardingFormConfigShape>(initial);
  const [saving, startSaving] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function patchSection(idx: number, patch: Partial<OnboardingSection>) {
    setConfig((c) => ({
      ...c,
      sections: c.sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    }));
  }

  function patchField(sIdx: number, fIdx: number, patch: Partial<OnboardingField>) {
    setConfig((c) => ({
      ...c,
      sections: c.sections.map((s, i) =>
        i !== sIdx
          ? s
          : { ...s, fields: s.fields.map((f, j) => (j === fIdx ? { ...f, ...patch } : f)) },
      ),
    }));
  }

  function removeField(sIdx: number, fIdx: number) {
    setConfig((c) => ({
      ...c,
      sections: c.sections.map((s, i) =>
        i !== sIdx ? s : { ...s, fields: s.fields.filter((_, j) => j !== fIdx) },
      ),
    }));
  }

  function addCustomField(sIdx: number) {
    const label = prompt("Etiqueta de la pregunta nueva:");
    if (!label || !label.trim()) return;
    const slug = slugify(label) || `q_${Date.now()}`;
    setConfig((c) => ({
      ...c,
      sections: c.sections.map((s, i) =>
        i !== sIdx
          ? s
          : {
              ...s,
              fields: [
                ...s.fields,
                {
                  id: `extra:${slug}`,
                  label: label.trim(),
                  type: "text" as OnboardingFieldType,
                  required: false,
                  hidden: false,
                },
              ],
            },
      ),
    }));
  }

  function addSection() {
    const title = prompt("Título de la sección nueva:");
    if (!title) return;
    setConfig((c) => ({
      ...c,
      sections: [
        ...c.sections,
        { id: `s_${Date.now()}`, title: title.trim(), fields: [] },
      ],
    }));
  }

  function removeSection(idx: number) {
    const s = config.sections[idx];
    const hasCritical = s.fields.some((f) => isCriticalField(f.id));
    if (hasCritical) {
      alert("No puedes borrar esta sección: contiene campos críticos para Harris-Benedict.");
      return;
    }
    if (!confirm(`¿Borrar la sección "${s.title}" y todos sus campos?`)) return;
    setConfig((c) => ({ ...c, sections: c.sections.filter((_, i) => i !== idx) }));
  }

  function save() {
    startSaving(async () => {
      await saveOnboardingConfigAction(config);
      setSavedAt(Date.now());
    });
  }

  function reset() {
    if (!confirm("Esto restaura el formulario a los valores recomendados. ¿Seguro?")) return;
    startSaving(async () => {
      await resetOnboardingConfigAction();
      window.location.reload();
    });
  }

  function moveField(sIdx: number, fIdx: number, dir: -1 | 1) {
    setConfig((c) => ({
      ...c,
      sections: c.sections.map((s, i) => {
        if (i !== sIdx) return s;
        const fields = [...s.fields];
        const j = fIdx + dir;
        if (j < 0 || j >= fields.length) return s;
        [fields[fIdx], fields[j]] = [fields[j], fields[fIdx]];
        return { ...s, fields };
      }),
    }));
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Este formulario lo rellena cada atleta al entrar a su app por primera vez.
          Sus respuestas alimentan al generador Harris-Benedict y al plan nutricional.
        </p>
        <div className="flex items-center gap-2">
          {savedAt ? <span className="text-xs text-emerald-600">Guardado ✓</span> : null}
          <button
            onClick={reset}
            disabled={saving}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-muted hover:border-primary hover:text-text disabled:opacity-50"
          >
            <RotateCcw size={12} /> Restaurar recomendado
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Guardar cambios
          </button>
        </div>
      </div>

      <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
        <span>
          Los campos con candado <Lock size={11} className="inline" /> son críticos para Harris-Benedict
          (sexo, fecha de nacimiento, peso, altura, frecuencia y objetivo) y no se pueden ocultar ni
          hacer opcionales.
        </span>
      </div>

      <div className="space-y-4">
        {config.sections.map((s, sIdx) => (
          <section key={s.id} className="overflow-hidden rounded-2xl border border-border bg-surface">
            <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
              <div className="flex flex-1 items-center gap-2">
                <GripHorizontal size={14} className="text-muted" />
                <input
                  value={s.title}
                  onChange={(e) => patchSection(sIdx, { title: e.target.value })}
                  className="flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-base font-bold outline-none hover:border-border focus:border-primary"
                />
              </div>
              <button
                onClick={() => removeSection(sIdx)}
                title="Borrar sección"
                className="rounded-md p-1 text-muted hover:bg-bg hover:text-red-600"
              >
                <Trash2 size={13} />
              </button>
            </header>
            <ul className="divide-y divide-border">
              {s.fields.map((f, fIdx) => (
                <FieldRow
                  key={f.id}
                  field={f}
                  onPatch={(patch) => patchField(sIdx, fIdx, patch)}
                  onRemove={() => removeField(sIdx, fIdx)}
                  onMoveUp={() => moveField(sIdx, fIdx, -1)}
                  onMoveDown={() => moveField(sIdx, fIdx, 1)}
                />
              ))}
              {s.fields.length === 0 ? (
                <li className="px-5 py-3 text-xs italic text-muted">Sección vacía.</li>
              ) : null}
            </ul>
            <footer className="border-t border-border bg-bg/30 px-5 py-2">
              <button
                onClick={() => addCustomField(sIdx)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-bg hover:text-primary"
              >
                <Plus size={11} /> Añadir pregunta a esta sección
              </button>
            </footer>
          </section>
        ))}
      </div>

      <button
        onClick={addSection}
        className="mt-4 flex items-center gap-1 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted hover:border-primary hover:text-text"
      >
        <Plus size={13} /> Añadir sección
      </button>
    </div>
  );
}

function FieldRow({
  field,
  onPatch,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  field: OnboardingField;
  onPatch: (patch: Partial<OnboardingField>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const critical = isCriticalField(field.id);
  const custom = isCustomField(field.id);
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <li className="px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-col gap-0.5">
          <button onClick={onMoveUp} className="text-muted hover:text-text" title="Subir">▲</button>
          <button onClick={onMoveDown} className="text-muted hover:text-text" title="Bajar">▼</button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {critical ? (
              <span title="Crítico para Harris-Benedict" className="text-amber-600">
                <Lock size={11} />
              </span>
            ) : null}
            <input
              value={field.label}
              onChange={(e) => onPatch({ label: e.target.value })}
              className="flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-sm font-medium outline-none hover:border-border focus:border-primary"
            />
          </div>
          <p className="px-2 text-xs text-muted">
            <code>{field.id}</code>
            {" · "}
            {FIELD_TYPE_LABELS[field.type]}
            {custom ? " · personalizada" : ""}
          </p>
        </div>

        <button
          onClick={() => onPatch({ hidden: !field.hidden })}
          disabled={critical}
          title={field.hidden ? "Mostrar al atleta" : "Ocultar al atleta"}
          className={`rounded-md border border-border px-2 py-1 text-xs disabled:opacity-40 ${
            field.hidden ? "bg-bg text-muted" : "text-text"
          }`}
        >
          {field.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
        </button>
        <label className="flex items-center gap-1 text-xs text-muted">
          <input
            type="checkbox"
            checked={!!field.required}
            disabled={critical}
            onChange={(e) => onPatch({ required: e.target.checked })}
            className="h-3.5 w-3.5"
          />
          Obligatorio
        </label>
        {custom ? (
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:border-primary hover:text-text"
          >
            <ChevronDown size={11} className={`inline transition ${showAdvanced ? "rotate-180" : ""}`} />
          </button>
        ) : null}
        <button
          onClick={() => {
            if (critical) {
              alert("No puedes borrar un campo crítico para Harris-Benedict.");
              return;
            }
            if (!confirm(`¿Borrar el campo "${field.label}"?`)) return;
            onRemove();
          }}
          title="Borrar campo"
          className="rounded-md p-1 text-muted hover:bg-bg hover:text-red-600 disabled:opacity-30"
          disabled={critical}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {showAdvanced && custom ? (
        <div className="ml-7 mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="text-xs text-muted">
            Tipo
            <select
              value={field.type}
              onChange={(e) =>
                onPatch({ type: e.target.value as OnboardingFieldType })
              }
              className="mt-1 w-full rounded border border-border bg-bg px-2 py-1 text-sm outline-none focus:border-primary"
            >
              {ALL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FIELD_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted sm:col-span-2">
            Texto de ayuda (opcional)
            <input
              value={field.hint ?? ""}
              onChange={(e) => onPatch({ hint: e.target.value || null })}
              className="mt-1 w-full rounded border border-border bg-bg px-2 py-1 text-sm outline-none focus:border-primary"
            />
          </label>
          {field.type === "select" ? (
            <label className="text-xs text-muted sm:col-span-3">
              Opciones del desplegable (una por línea, formato <code>valor|Etiqueta</code>)
              <textarea
                rows={3}
                value={(field.options ?? []).map((o) => `${o.value}|${o.label}`).join("\n")}
                onChange={(e) =>
                  onPatch({
                    options: e.target.value
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean)
                      .map((l) => {
                        const [v, lab] = l.split("|");
                        return { value: (v || l).trim(), label: (lab || v || l).trim() };
                      }),
                  })
                }
                className="mt-1 w-full rounded border border-border bg-bg px-2 py-1 text-sm outline-none focus:border-primary"
              />
            </label>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
