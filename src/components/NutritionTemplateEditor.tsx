"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save, Plus, Trash2 } from "lucide-react";
import {
  TEMPLATE_SEXES,
  TEMPLATE_GOALS,
  TEMPLATE_SEX_LABELS,
  TEMPLATE_GOAL_LABELS,
  sumCanonicalDay,
  type TemplateStructure,
  type TemplateDay,
  type TemplateOption,
  type TemplateSex,
  type TemplateGoal,
} from "@/lib/nutritionTemplateShape";
import { saveNutritionTemplate } from "@/app/(panel)/biblioteca/plantillas/actions";

/**
 * Editor de plantilla nutricional. Estructura FIJA:
 *  - 1 día tipo
 *  - 5 comidas en orden: desayuno, media_manana, comida, merienda, cena
 *  - Comidas simples: lista de opciones (texto + macros), 2-3 alternativas.
 *  - Comida y cena: opciones agrupadas por subgrupo (intro/grasas/carbos/
 *    proteina/postre). El nutri puede añadir varias por subgrupo.
 *
 * Sin autoguardado — botón Guardar al final. Mantiene la cabecera con
 * macros canónicos en vivo (1 opción de cada comida simple + 1 opción de
 * cada subgrupo de comida/cena) para que el nutri ajuste sin generar.
 */

const COMPOSED_SUBTYPES = [
  { value: "intro", label: "Intro / Entrante" },
  { value: "grasas", label: "Grasas" },
  { value: "carbos", label: "Carbos" },
  { value: "proteina", label: "Proteína" },
  { value: "postre", label: "Postre" },
] as const;

const MEAL_LABELS: Record<string, string> = {
  desayuno: "Desayuno",
  media_manana: "Media mañana",
  comida: "Comida",
  merienda: "Merienda",
  cena: "Cena",
};

type Props = {
  initial: {
    id: string;
    sex: string;
    goal: string;
    name: string;
    description: string | null;
    notes: string | null;
    supplementation: string | null;
    structure: TemplateStructure;
  };
};

export function NutritionTemplateEditor({ initial }: Props) {
  const router = useRouter();
  const [sex, setSex] = useState<TemplateSex>(initial.sex as TemplateSex);
  const [goal, setGoal] = useState<TemplateGoal>(initial.goal as TemplateGoal);
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [supplementation, setSupplementation] = useState(initial.supplementation ?? "");
  const [day, setDay] = useState<TemplateDay>(
    initial.structure.days[0] ?? {
      name: "Día tipo",
      dayType: "entreno",
      meals: [],
    },
  );
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const macros = useMemo(() => sumCanonicalDay(day), [day]);

  function updateMeal(mealName: string, fn: (m: TemplateDay["meals"][number]) => TemplateDay["meals"][number]) {
    setDay((d) => ({
      ...d,
      meals: d.meals.map((m) => (m.name === mealName ? fn(m) : m)),
    }));
  }

  function setOption(mealName: string, index: number, patch: Partial<TemplateOption>) {
    updateMeal(mealName, (m) => ({
      ...m,
      options: m.options.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    }));
  }

  function addOption(mealName: string, subType?: string) {
    updateMeal(mealName, (m) => ({
      ...m,
      options: [
        ...m.options,
        { text: "", kcal: 0, protein: 0, carbs: 0, fat: 0, subType: subType ?? null },
      ],
    }));
  }

  function removeOption(mealName: string, index: number) {
    updateMeal(mealName, (m) => ({
      ...m,
      options: m.options.filter((_, i) => i !== index),
    }));
  }

  function save() {
    const fd = new FormData();
    fd.set("id", initial.id);
    fd.set("sex", sex);
    fd.set("goal", goal);
    fd.set("name", name);
    fd.set("description", description);
    fd.set("notes", notes);
    fd.set("supplementation", supplementation);
    const structure: TemplateStructure = { days: [day] };
    fd.set("structureJson", JSON.stringify(structure));

    start(async () => {
      setError(null);
      const r = await saveNutritionTemplate(fd);
      if (r && "error" in r && r.error) {
        setError(r.error);
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* Cabecera fija con sexo/goal/macros */}
      <header className="rounded-2xl border border-border bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
          <label className="block text-xs">
            <span className="font-semibold text-muted">Sexo</span>
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value as TemplateSex)}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
            >
              {TEMPLATE_SEXES.map((s) => (
                <option key={s} value={s}>
                  {TEMPLATE_SEX_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="font-semibold text-muted">Objetivo</span>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value as TemplateGoal)}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
            >
              {TEMPLATE_GOALS.map((g) => (
                <option key={g} value={g}>
                  {TEMPLATE_GOAL_LABELS[g]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            <span className="font-semibold text-muted">Nombre</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>

        <label className="mt-3 block text-xs">
          <span className="font-semibold text-muted">Descripción (opcional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
            placeholder="Para quién encaja, intención, notas internas para el equipo…"
          />
        </label>

        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <MacroPill label="Kcal" value={macros.kcal} />
          <MacroPill label="Prot" value={macros.protein} suffix="g" />
          <MacroPill label="Carbos" value={macros.carbs} suffix="g" />
          <MacroPill label="Grasa" value={macros.fat} suffix="g" />
        </div>
        <p className="mt-1 text-[11px] italic text-muted">
          Macros canónicos = 1 opción del desayuno + 1 de media mañana + 1 de cada subgrupo
          (comida) + 1 de merienda + 1 de cada subgrupo (cena).
        </p>
      </header>

      {/* Comidas */}
      {day.meals.map((meal) => {
        const isComposed = meal.name === "comida" || meal.name === "cena";
        return (
          <section key={meal.name} className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-base font-bold">{MEAL_LABELS[meal.name] ?? meal.name}</h2>
            {isComposed ? (
              <div className="space-y-3">
                {COMPOSED_SUBTYPES.map((sub) => {
                  const opts = meal.options
                    .map((o, idx) => ({ o, idx }))
                    .filter((x) => x.o.subType === sub.value);
                  return (
                    <div key={sub.value} className="rounded-xl border border-border bg-bg p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase text-muted">{sub.label}</p>
                        <button
                          type="button"
                          onClick={() => addOption(meal.name, sub.value)}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[11px] hover:border-primary hover:text-primary"
                        >
                          <Plus size={11} /> Añadir
                        </button>
                      </div>
                      {opts.length === 0 ? (
                        <p className="text-[11px] italic text-muted">Sin opciones aún.</p>
                      ) : (
                        <ul className="space-y-2">
                          {opts.map(({ o, idx }) => (
                            <OptionRow
                              key={idx}
                              option={o}
                              onChange={(patch) => setOption(meal.name, idx, patch)}
                              onRemove={() => removeOption(meal.name, idx)}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {meal.options.map((o, idx) => (
                  <OptionRow
                    key={idx}
                    option={o}
                    onChange={(patch) => setOption(meal.name, idx, patch)}
                    onRemove={() => removeOption(meal.name, idx)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => addOption(meal.name)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg px-2 py-1 text-[11px] hover:border-primary hover:text-primary"
                >
                  <Plus size={11} /> Añadir opción
                </button>
              </div>
            )}
          </section>
        );
      })}

      {/* Observaciones + Suplementación */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <label className="block text-xs">
          <span className="font-semibold text-muted">Observaciones generales</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="mt-3 block text-xs">
          <span className="font-semibold text-muted">Suplementación</span>
          <textarea
            value={supplementation}
            onChange={(e) => setSupplementation(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
        </label>
      </section>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {/* Barra inferior sticky con macros + botón guardar */}
      <div className="sticky bottom-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur">
        <p className="text-sm">
          <span className="font-semibold">{macros.kcal}</span> kcal ·{" "}
          <span className="font-semibold">{macros.protein}</span> P ·{" "}
          <span className="font-semibold">{macros.carbs}</span> C ·{" "}
          <span className="font-semibold">{macros.fat}</span> G
        </p>
        <div className="flex items-center gap-2">
          {savedAt ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
              <Check size={13} /> Guardado
            </span>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar plantilla
          </button>
        </div>
      </div>
    </div>
  );
}

function OptionRow({
  option,
  onChange,
  onRemove,
}: {
  option: TemplateOption;
  onChange: (patch: Partial<TemplateOption>) => void;
  onRemove: () => void;
}) {
  return (
    <li className="rounded-lg border border-border bg-surface p-2">
      <div className="flex items-start gap-2">
        <textarea
          value={option.text}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={2}
          placeholder="Ej. 120 g avena + 250 ml leche + 30 g whey + 1 plátano"
          className="flex-1 rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={onRemove}
          title="Eliminar opción"
          className="rounded-lg border border-border bg-bg p-1.5 text-muted hover:border-red-300 hover:text-red-600"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        <NumInput label="Kcal" value={option.kcal} onChange={(v) => onChange({ kcal: v })} />
        <NumInput label="P (g)" value={option.protein} onChange={(v) => onChange({ protein: v })} />
        <NumInput label="C (g)" value={option.carbs} onChange={(v) => onChange({ carbs: v })} />
        <NumInput label="G (g)" value={option.fat} onChange={(v) => onChange({ fat: v })} />
      </div>
    </li>
  );
}

function NumInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block text-[10px]">
      <span className="font-semibold text-muted">{label}</span>
      <input
        type="number"
        min={0}
        step={0.1}
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-0.5 w-full rounded-lg border border-border bg-bg px-2 py-1 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}

function MacroPill({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-lg bg-bg px-2 py-1.5">
      <p className="text-[10px] font-semibold uppercase text-muted">{label}</p>
      <p className="text-base font-bold leading-tight">
        {value}
        {suffix ? <span className="text-[10px] text-muted">{suffix}</span> : null}
      </p>
    </div>
  );
}
