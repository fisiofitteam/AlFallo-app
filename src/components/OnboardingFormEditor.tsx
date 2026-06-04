"use client";

import { useState, useTransition } from "react";
import {
  ClipboardList, FileText,
  Plus, Trash2, ChevronUp, ChevronDown, X,
  Lock, RotateCcw, Save, Loader2, AlertTriangle,
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
  select: "Opción única (botones)",
  date: "Fecha",
  tags: "Lista separada por comas",
  checkbox: "Sí / No",
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

export function OnboardingFormEditor({
  initial,
  defaultContract,
}: {
  initial: OnboardingFormConfigShape;
  /** Texto del contrato por defecto, para fallback cuando contractText es null. */
  defaultContract: string;
}) {
  const [tab, setTab] = useState<"cuestionario" | "contrato">("cuestionario");
  const [config, setConfig] = useState<OnboardingFormConfigShape>({
    sections: initial.sections,
    contractText: initial.contractText ?? null,
  });
  const [saving, startSaving] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function save() {
    startSaving(async () => {
      await saveOnboardingConfigAction(config);
      setSavedAt(Date.now());
    });
  }

  function reset() {
    if (!confirm("Esto restaura el formulario y el contrato a los valores recomendados. ¿Seguro?")) return;
    startSaving(async () => {
      await resetOnboardingConfigAction();
      window.location.reload();
    });
  }

  return (
    <div>
      {/* Cabecera con tabs + acciones de guardar */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border">
        <nav className="flex gap-1">
          <TabButton active={tab === "cuestionario"} onClick={() => setTab("cuestionario")}>
            <ClipboardList size={15} className="mr-1.5 inline" /> Cuestionario
          </TabButton>
          <TabButton active={tab === "contrato"} onClick={() => setTab("contrato")}>
            <FileText size={15} className="mr-1.5 inline" /> Contrato
          </TabButton>
        </nav>
        <div className="mb-2 flex items-center gap-2">
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
            className="flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "var(--c-primary)" }}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Guardar cambios
          </button>
        </div>
      </div>

      {tab === "cuestionario" ? (
        <QuestionnaireEditor
          sections={config.sections}
          onChange={(sections) => setConfig((c) => ({ ...c, sections }))}
        />
      ) : (
        <ContractEditor
          value={config.contractText ?? ""}
          fallback={defaultContract}
          onChange={(contractText) => setConfig((c) => ({ ...c, contractText }))}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 pb-2.5 text-sm font-semibold transition ${
        active
          ? "border-text text-text"
          : "border-transparent text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

// ── Editor del cuestionario ─────────────────────────────────────────────

function QuestionnaireEditor({
  sections,
  onChange,
}: {
  sections: OnboardingSection[];
  onChange: (next: OnboardingSection[]) => void;
}) {
  function patchSection(idx: number, patch: Partial<OnboardingSection>) {
    onChange(sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }
  function removeSection(idx: number) {
    const s = sections[idx];
    if (s.fields.some((f) => isCriticalField(f.id))) {
      alert("No puedes borrar esta sección: contiene campos críticos para Harris-Benedict.");
      return;
    }
    if (!confirm(`¿Borrar la sección "${s.title}" y todos sus campos?`)) return;
    onChange(sections.filter((_, i) => i !== idx));
  }
  function moveSection(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  }
  function addSection() {
    const title = prompt("Título de la sección nueva:");
    if (!title) return;
    onChange([
      ...sections,
      { id: `s_${Date.now()}`, title: title.trim(), description: null, fields: [] },
    ]);
  }
  function patchField(sIdx: number, fIdx: number, patch: Partial<OnboardingField>) {
    onChange(
      sections.map((s, i) =>
        i !== sIdx
          ? s
          : { ...s, fields: s.fields.map((f, j) => (j === fIdx ? { ...f, ...patch } : f)) },
      ),
    );
  }
  function removeField(sIdx: number, fIdx: number) {
    const f = sections[sIdx].fields[fIdx];
    if (isCriticalField(f.id)) {
      alert("No puedes borrar un campo crítico para Harris-Benedict.");
      return;
    }
    if (!confirm(`¿Borrar el campo "${f.label}"?`)) return;
    onChange(
      sections.map((s, i) =>
        i !== sIdx ? s : { ...s, fields: s.fields.filter((_, j) => j !== fIdx) },
      ),
    );
  }
  function moveField(sIdx: number, fIdx: number, dir: -1 | 1) {
    onChange(
      sections.map((s, i) => {
        if (i !== sIdx) return s;
        const fields = [...s.fields];
        const j = fIdx + dir;
        if (j < 0 || j >= fields.length) return s;
        [fields[fIdx], fields[j]] = [fields[j], fields[fIdx]];
        return { ...s, fields };
      }),
    );
  }
  function addField(sIdx: number) {
    const label = prompt("Etiqueta de la pregunta nueva:");
    if (!label || !label.trim()) return;
    const slug = slugify(label) || `q_${Date.now()}`;
    onChange(
      sections.map((s, i) =>
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
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
        <span>
          Los campos con candado <Lock size={11} className="inline" /> son críticos para Harris-Benedict
          (sexo, fecha de nacimiento, peso, altura, frecuencia y objetivo) y no se pueden ocultar,
          hacer opcionales ni borrar.
        </span>
      </div>

      {sections.map((s, sIdx) => (
        <SectionCard
          key={s.id}
          section={s}
          index={sIdx}
          totalSections={sections.length}
          onPatch={(patch) => patchSection(sIdx, patch)}
          onRemove={() => removeSection(sIdx)}
          onMoveUp={() => moveSection(sIdx, -1)}
          onMoveDown={() => moveSection(sIdx, 1)}
          onPatchField={(fIdx, patch) => patchField(sIdx, fIdx, patch)}
          onRemoveField={(fIdx) => removeField(sIdx, fIdx)}
          onMoveFieldUp={(fIdx) => moveField(sIdx, fIdx, -1)}
          onMoveFieldDown={(fIdx) => moveField(sIdx, fIdx, 1)}
          onAddField={() => addField(sIdx)}
        />
      ))}

      <button
        type="button"
        onClick={addSection}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border bg-surface/30 px-4 py-3 text-sm text-muted hover:border-primary hover:text-primary"
      >
        <Plus size={14} /> Añadir sección
      </button>
    </div>
  );
}

function SectionCard({
  section,
  index,
  totalSections,
  onPatch,
  onRemove,
  onMoveUp,
  onMoveDown,
  onPatchField,
  onRemoveField,
  onMoveFieldUp,
  onMoveFieldDown,
  onAddField,
}: {
  section: OnboardingSection;
  index: number;
  totalSections: number;
  onPatch: (patch: Partial<OnboardingSection>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onPatchField: (fIdx: number, patch: Partial<OnboardingField>) => void;
  onRemoveField: (fIdx: number) => void;
  onMoveFieldUp: (fIdx: number) => void;
  onMoveFieldDown: (fIdx: number) => void;
  onAddField: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">
          PASO {index + 1}
        </span>
        <ReorderControls
          canUp={index > 0}
          canDown={index < totalSections - 1}
          onUp={onMoveUp}
          onDown={onMoveDown}
          onRemove={onRemove}
        />
      </header>
      <div className="space-y-4 px-5 py-5">
        <input
          value={section.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder="Título de la sección"
          className="w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-base font-semibold outline-none focus:border-primary"
        />
        <input
          value={section.description ?? ""}
          onChange={(e) => onPatch({ description: e.target.value })}
          placeholder="Descripción corta de la sección (opcional)"
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        />

        {/* Fields */}
        <div className="space-y-3">
          {section.fields.map((f, fIdx) => (
            <FieldCard
              key={f.id}
              field={f}
              index={fIdx}
              total={section.fields.length}
              onPatch={(patch) => onPatchField(fIdx, patch)}
              onRemove={() => onRemoveField(fIdx)}
              onMoveUp={() => onMoveFieldUp(fIdx)}
              onMoveDown={() => onMoveFieldDown(fIdx)}
            />
          ))}
          {section.fields.length === 0 ? (
            <p className="px-2 text-xs italic text-muted">Sección vacía.</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onAddField}
          className="flex items-center gap-1 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted hover:border-primary hover:text-primary"
        >
          <Plus size={12} /> Añadir pregunta
        </button>
      </div>
    </section>
  );
}

function FieldCard({
  field,
  index,
  total,
  onPatch,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  field: OnboardingField;
  index: number;
  total: number;
  onPatch: (patch: Partial<OnboardingField>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const critical = isCriticalField(field.id);
  const custom = isCustomField(field.id);
  const isSelect = field.type === "select";
  // Sólo personalizables pueden cambiar el TIPO. Las core respetan el tipo
  // (porque el submitOnboarding las mapea a columnas tipadas).
  const canChangeType = custom;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg">
      <div className="flex items-start gap-2 border-b border-border bg-surface/40 px-3 py-2">
        <div className="flex flex-1 items-center gap-2">
          {critical ? (
            <span title="Crítico para Harris-Benedict" className="text-amber-600">
              <Lock size={12} />
            </span>
          ) : null}
          <input
            value={field.label}
            onChange={(e) => onPatch({ label: e.target.value })}
            placeholder="Etiqueta del campo"
            className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm font-semibold outline-none hover:border-border focus:border-primary"
          />
        </div>
        <ReorderControls
          canUp={index > 0}
          canDown={index < total - 1}
          onUp={onMoveUp}
          onDown={onMoveDown}
          onRemove={critical ? undefined : onRemove}
          removeDisabled={critical}
        />
      </div>

      <div className="space-y-2.5 px-3 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={field.type}
            disabled={!canChangeType}
            onChange={(e) => onPatch({ type: e.target.value as OnboardingFieldType })}
            className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-70"
            title={canChangeType ? "Tipo de campo" : "El tipo de los campos core está fijo"}
          >
            {ALL_TYPES.map((t) => (
              <option key={t} value={t}>
                {FIELD_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-text">
            <input
              type="checkbox"
              checked={!!field.required}
              disabled={critical}
              onChange={(e) => onPatch({ required: e.target.checked })}
              className="h-4 w-4 rounded border-border accent-[color:var(--c-primary)] disabled:opacity-40"
            />
            Obligatoria
          </label>
          {!critical ? (
            <label className="flex items-center gap-1.5 text-sm text-text">
              <input
                type="checkbox"
                checked={!!field.hidden}
                onChange={(e) => onPatch({ hidden: e.target.checked })}
                className="h-4 w-4 rounded border-border accent-[color:var(--c-primary)]"
              />
              Oculta al atleta
            </label>
          ) : null}
        </div>

        <input
          value={field.hint ?? ""}
          onChange={(e) => onPatch({ hint: e.target.value || null })}
          placeholder="Texto de ayuda dentro del campo (opcional)"
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        />

        {isSelect ? (
          <div>
            <p className="mb-1 text-xs font-medium text-muted">Opciones (una por línea)</p>
            <textarea
              rows={4}
              value={(field.options ?? []).map((o) => o.label).join("\n")}
              onChange={(e) => {
                const lines = e.target.value
                  .split("\n")
                  .map((l) => l.trim())
                  .filter(Boolean);
                // Generamos value a partir del label (slug) si no se especifica.
                const next = lines.map((l) => {
                  const [a, b] = l.includes("|") ? l.split("|") : [slugify(l), l];
                  return { value: (a || slugify(l)).trim(), label: (b ?? l).trim() };
                });
                onPatch({ options: next });
              }}
              placeholder={"Hombre\nMujer\nOtro"}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        ) : null}

        <p className="px-1 text-[11px] text-muted">
          <code className="rounded bg-bg px-1 py-0.5 text-[10px]">{field.id}</code>{" "}
          · {FIELD_TYPE_LABELS[field.type]}
          {custom ? " · personalizada" : critical ? " · crítica HB" : " · campo core"}
        </p>
      </div>
    </div>
  );
}

function ReorderControls({
  canUp,
  canDown,
  onUp,
  onDown,
  onRemove,
  removeDisabled,
}: {
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove?: () => void;
  removeDisabled?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        onClick={onUp}
        disabled={!canUp}
        title="Subir"
        className="rounded-md border border-border bg-bg p-1.5 text-muted hover:border-primary hover:text-text disabled:opacity-30"
      >
        <ChevronUp size={13} />
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={!canDown}
        title="Bajar"
        className="rounded-md border border-border bg-bg p-1.5 text-muted hover:border-primary hover:text-text disabled:opacity-30"
      >
        <ChevronDown size={13} />
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={removeDisabled}
          title="Eliminar"
          className="rounded-md border border-border bg-bg p-1.5 text-muted hover:border-red-300 hover:text-red-600 disabled:opacity-30"
        >
          <X size={13} />
        </button>
      ) : null}
    </div>
  );
}

// ── Editor del contrato ─────────────────────────────────────────────────

function ContractEditor({
  value,
  fallback,
  onChange,
}: {
  value: string;
  fallback: string;
  onChange: (next: string | null) => void;
}) {
  const effective = value || fallback;
  const usingDefault = !value.trim();

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-xs text-blue-800">
        <FileText size={14} className="mt-0.5 flex-shrink-0" />
        <span>
          Este es el texto que el atleta lee y acepta junto a su DNI en el onboarding. Si lo dejas
          vacío, se usa el texto por defecto incluido con la app.
          {usingDefault ? (
            <>
              {" "}
              <button
                type="button"
                onClick={() => onChange(fallback)}
                className="ml-1 inline-flex items-center font-semibold text-blue-700 underline hover:text-blue-900"
              >
                Cargar texto por defecto y empezar a editarlo
              </button>
            </>
          ) : null}
        </span>
      </div>

      <textarea
        rows={24}
        value={effective}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder="Pega aquí el contrato que el atleta deberá aceptar…"
        className="w-full whitespace-pre-wrap rounded-2xl border border-border bg-surface p-5 text-sm leading-relaxed outline-none focus:border-primary"
      />

      {!usingDefault ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              if (!confirm("¿Quitar tu texto personalizado y volver al texto por defecto?")) return;
              onChange(null);
            }}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-muted hover:border-primary hover:text-text"
          >
            <Trash2 size={12} /> Volver al texto por defecto
          </button>
        </div>
      ) : null}
    </div>
  );
}
