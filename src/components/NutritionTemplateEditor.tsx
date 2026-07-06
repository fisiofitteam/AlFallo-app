"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check, ChevronDown, ChevronUp, Loader2, Save, Plus, Trash2, Sparkles, StickyNote,
} from "lucide-react";
import { MEAL_TYPE_OPTIONS } from "@/lib/nutrition";
import {
  TEMPLATE_SEXES,
  TEMPLATE_GOALS,
  TEMPLATE_SEX_LABELS,
  TEMPLATE_GOAL_LABELS,
  isComposedMeal,
  sumCanonicalDay,
  type TemplateStructure,
  type TemplateDay,
  type TemplateOption,
  type TemplateSex,
  type TemplateGoal,
} from "@/lib/nutritionTemplateShape";
import {
  estimateMacrosForTemplateOption,
  saveNutritionTemplate,
} from "@/app/(panel)/biblioteca/plantillas/actions";

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

  // Mutamos por índice de comida en vez de por nombre — el nutri puede
  // renombrar libremente y el nombre deja de ser identificador único.
  function updateMeal(mealIndex: number, fn: (m: TemplateDay["meals"][number]) => TemplateDay["meals"][number]) {
    setDay((d) => ({
      ...d,
      meals: d.meals.map((m, i) => (i === mealIndex ? fn(m) : m)),
    }));
  }

  function setMealName(mealIndex: number, name: string) {
    updateMeal(mealIndex, (m) => ({ ...m, name }));
  }

  function setOption(mealIndex: number, index: number, patch: Partial<TemplateOption>) {
    updateMeal(mealIndex, (m) => ({
      ...m,
      options: m.options.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    }));
  }

  function addOption(mealIndex: number, subType?: string, dayContext?: "training" | "rest") {
    updateMeal(mealIndex, (m) => ({
      ...m,
      options: [
        ...m.options,
        {
          text: "",
          kcal: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          subType: subType ?? null,
          dayContext: dayContext ?? null,
          note: null,
        },
      ],
    }));
  }

  function removeOption(mealIndex: number, index: number) {
    updateMeal(mealIndex, (m) => ({
      ...m,
      options: m.options.filter((_, i) => i !== index),
    }));
  }

  function addMeal(name: string) {
    if (!name.trim()) return;
    setDay((d) => ({
      ...d,
      meals: [...d.meals, { name: name.trim(), options: [] }],
    }));
  }

  function removeMeal(mealIndex: number) {
    setDay((d) => ({
      ...d,
      meals: d.meals.filter((_, i) => i !== mealIndex),
    }));
  }

  function moveMeal(mealIndex: number, dir: "up" | "down") {
    setDay((d) => {
      const j = mealIndex + (dir === "up" ? -1 : 1);
      if (j < 0 || j >= d.meals.length) return d;
      const next = [...d.meals];
      [next[mealIndex], next[j]] = [next[j], next[mealIndex]];
      return { ...d, meals: next };
    });
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
      {day.meals.map((meal, mealIdx) => {
        const composed = isComposedMeal(meal);
        // Label por defecto: si el nombre coincide con un slug conocido,
        // mostramos el bonito; si el nutri lo renombró, respetamos lo suyo.
        const defaultLabel = MEAL_LABELS[meal.name] ?? meal.name;
        return (
          <section key={mealIdx} className="rounded-2xl border border-border bg-surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <input
                value={defaultLabel}
                onChange={(e) => setMealName(mealIdx, e.target.value)}
                placeholder="Nombre de la comida"
                className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-base font-bold outline-none hover:border-border focus:border-primary"
              />
              <button
                type="button"
                onClick={() => moveMeal(mealIdx, "up")}
                disabled={mealIdx === 0}
                title="Subir comida"
                className="rounded-md p-1 text-muted hover:bg-bg hover:text-text disabled:opacity-30"
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                onClick={() => moveMeal(mealIdx, "down")}
                disabled={mealIdx === day.meals.length - 1}
                title="Bajar comida"
                className="rounded-md p-1 text-muted hover:bg-bg hover:text-text disabled:opacity-30"
              >
                <ChevronDown size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirm(`¿Borrar "${defaultLabel}"? Se eliminan sus opciones.`)) return;
                  removeMeal(mealIdx);
                }}
                title="Borrar comida"
                className="rounded-md p-1 text-muted hover:bg-bg hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
            {composed ? (
              <div className="space-y-3">
                {COMPOSED_SUBTYPES.map((sub) => {
                  const opts = meal.options
                    .map((o, idx) => ({ o, idx }))
                    .filter((x) => x.o.subType === sub.value);
                  // El subgrupo CARBOS se divide en día entreno / descanso.
                  // El resto de subgrupos siguen mostrándose plano.
                  if (sub.value === "carbos") {
                    return (
                      <div key={sub.value} className="rounded-xl border border-border bg-bg p-3">
                        <p className="mb-2 text-xs font-semibold uppercase text-muted">
                          {sub.label}
                        </p>
                        {(["training", "rest"] as const).map((ctx) => {
                          const ctxLabel =
                            ctx === "training" ? "Día de entrenamiento" : "Día de descanso / recovery";
                          const ctxOpts = opts.filter(
                            (x) => (x.o.dayContext ?? null) === ctx,
                          );
                          return (
                            <div key={ctx} className="mb-2 rounded-lg border border-dashed border-border/60 p-2 last:mb-0">
                              <div className="mb-1.5 flex items-center justify-between">
                                <p className="text-[11px] font-semibold text-primary">{ctxLabel}</p>
                                <button
                                  type="button"
                                  onClick={() => addOption(mealIdx, sub.value, ctx)}
                                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] hover:border-primary hover:text-primary"
                                >
                                  <Plus size={11} /> Añadir
                                </button>
                              </div>
                              {ctxOpts.length === 0 ? (
                                <p className="text-[11px] italic text-muted">Sin opciones aún.</p>
                              ) : (
                                <ul className="space-y-2">
                                  {ctxOpts.map(({ o, idx }) => (
                                    <OptionRow
                                      key={idx}
                                      option={o}
                                      onChange={(patch) => setOption(mealIdx, idx, patch)}
                                      onRemove={() => removeOption(mealIdx, idx)}
                                    />
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  }
                  return (
                    <div key={sub.value} className="rounded-xl border border-border bg-bg p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase text-muted">{sub.label}</p>
                        <button
                          type="button"
                          onClick={() => addOption(mealIdx, sub.value)}
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
                              onChange={(patch) => setOption(mealIdx, idx, patch)}
                              onRemove={() => removeOption(mealIdx, idx)}
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
                    onChange={(patch) => setOption(mealIdx, idx, patch)}
                    onRemove={() => removeOption(mealIdx, idx)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => addOption(mealIdx)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg px-2 py-1 text-[11px] hover:border-primary hover:text-primary"
                >
                  <Plus size={11} /> Añadir opción
                </button>
              </div>
            )}
          </section>
        );
      })}

      {/* Añadir comida extra al día tipo */}
      <AddMealForm onAdd={(name) => addMeal(name)} />

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
  // Auto-estimación de macros al editar el texto. Debounce 1200 ms para no
  // bombardear la API con un teclazo por letra. Mientras la IA está
  // calculando mostramos un spinner pequeño con tooltip al lado del texto.
  // Si el nutri toca los inputs numéricos manualmente, ganan (los pisamos
  // solo al siguiente cambio de texto).
  const [estimating, setEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState(false);
  // Panel de notas: se abre si ya hay nota guardada o si el nutri pulsa el
  // botón. La nota es texto libre y NO afecta a macros.
  const [showNote, setShowNote] = useState<boolean>(
    typeof option.note === "string" && option.note.trim().length > 0,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guardamos el último texto que pidió estimación para descartar respuestas
  // antiguas (race condition: si el nutri sigue tecleando, la primera
  // respuesta no debería pisar al texto/macros actuales).
  const lastReqText = useRef<string>(option.text);

  // Cancelar timer pendiente al desmontar (la opción puede borrarse).
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function handleTextChange(next: string) {
    onChange({ text: next });
    if (timer.current) clearTimeout(timer.current);
    setEstimateError(false);
    const trimmed = next.trim();
    if (trimmed.length < 3) return;
    timer.current = setTimeout(async () => {
      lastReqText.current = trimmed;
      setEstimating(true);
      try {
        const macros = await estimateMacrosForTemplateOption(trimmed);
        // Descarta respuesta obsoleta si el texto ya no es el que pedimos.
        if (lastReqText.current !== trimmed) return;
        onChange({
          kcal: macros.kcal,
          protein: macros.protein,
          carbs: macros.carbs,
          fat: macros.fat,
        });
      } catch {
        setEstimateError(true);
      } finally {
        setEstimating(false);
      }
    }, 1200);
  }

  // Forzar estimación inmediata (botón ✨). Útil cuando el nutri quiere
  // recalcular sin esperar al debounce, o tras editar los macros a mano y
  // arrepentirse.
  function recalcNow() {
    if (timer.current) clearTimeout(timer.current);
    const trimmed = option.text.trim();
    if (trimmed.length < 3) return;
    lastReqText.current = trimmed;
    setEstimateError(false);
    setEstimating(true);
    estimateMacrosForTemplateOption(trimmed)
      .then((macros) => {
        if (lastReqText.current !== trimmed) return;
        onChange({
          kcal: macros.kcal,
          protein: macros.protein,
          carbs: macros.carbs,
          fat: macros.fat,
        });
      })
      .catch(() => setEstimateError(true))
      .finally(() => setEstimating(false));
  }

  return (
    <li className="rounded-lg border border-border bg-surface p-2">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <textarea
            value={option.text}
            onChange={(e) => handleTextChange(e.target.value)}
            rows={2}
            placeholder="Ej. 120 g avena + 250 ml leche + 30 g whey + 1 plátano"
            className="w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
          {estimateError ? (
            <p className="mt-1 text-[10px] text-red-600">
              No se pudieron estimar los macros — escríbelos a mano o reintenta con ✨.
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={recalcNow}
            disabled={estimating || option.text.trim().length < 3}
            title="Recalcular macros con IA ahora"
            className="rounded-lg border border-border bg-bg p-1.5 text-muted hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {estimating ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Sparkles size={13} />
            )}
          </button>
          <button
            type="button"
            onClick={onRemove}
            title="Eliminar opción"
            className="rounded-lg border border-border bg-bg p-1.5 text-muted hover:border-red-300 hover:text-red-600"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        <NumInput label="Kcal" value={option.kcal} onChange={(v) => onChange({ kcal: v })} />
        <NumInput label="P (g)" value={option.protein} onChange={(v) => onChange({ protein: v })} />
        <NumInput label="C (g)" value={option.carbs} onChange={(v) => onChange({ carbs: v })} />
        <NumInput label="G (g)" value={option.fat} onChange={(v) => onChange({ fat: v })} />
      </div>

      {/* Notas: texto libre para elaboración/tip. No entra en el cálculo de
          macros. Se muestra al atleta bajo la opción. */}
      {showNote ? (
        <div className="mt-2">
          <label className="block text-[10px]">
            <span className="font-semibold text-muted">Notas para el atleta</span>
            <textarea
              value={option.note ?? ""}
              onChange={(e) => onChange({ note: e.target.value })}
              rows={2}
              placeholder="Ej. Elaborar al horno 20 min a 180 ºC. Puedes cambiar el arroz por quinoa."
              className="mt-0.5 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-xs outline-none focus:border-primary"
            />
          </label>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNote(true)}
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-border bg-bg px-2 py-1 text-[11px] text-muted hover:border-primary hover:text-primary"
        >
          <StickyNote size={11} /> Añadir notas
        </button>
      )}
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

/** Añadir una comida extra al día tipo. El nutri elige un tipo predefinido
 *  (desayuno, snack, pre-wod…) o escribe uno libre. Al añadir se crea sin
 *  opciones y con detección automática de simple/composed (empieza simple
 *  porque no tiene subType; para hacerla composed basta con añadir opciones
 *  a los subgrupos desde el editor — pero aquí la ruta natural es simple). */
function AddMealForm({ onAdd }: { onAdd: (name: string) => void }) {
  const [choice, setChoice] = useState<string>("snack");
  const [custom, setCustom] = useState<string>("");
  const isCustom = choice === "__custom";

  return (
    <section className="rounded-2xl border border-dashed border-border bg-surface/60 p-4">
      <p className="mb-2 text-sm font-semibold">Añadir otra comida</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block text-xs">
          <span className="font-semibold text-muted">Tipo</span>
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
          >
            {MEAL_TYPE_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
            <option value="__custom">Otra… (nombre libre)</option>
          </select>
        </label>
        {isCustom ? (
          <label className="block flex-1 text-xs">
            <span className="font-semibold text-muted">Nombre</span>
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Ej. Batido post-entreno"
              className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
          </label>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (isCustom) {
              const name = custom.trim();
              if (!name) return;
              onAdd(name);
              setCustom("");
            } else {
              const label = MEAL_TYPE_OPTIONS.find((m) => m.value === choice)?.value ?? choice;
              onAdd(label);
            }
          }}
          disabled={isCustom && custom.trim().length === 0}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
        >
          <Plus size={13} /> Añadir comida
        </button>
      </div>
    </section>
  );
}
