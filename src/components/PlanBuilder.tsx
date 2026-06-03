"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Sparkles, Plus, Trash2, Loader2, FileText, ArrowLeft, ChevronDown,
  RotateCcw, AlertTriangle,
} from "lucide-react";
import {
  addOptionToMeal,
  deleteItem,
  generatePlanFromHB,
  toggleItemSelected,
  updateOptionMacros,
  updateOptionText,
  addDay,
  deleteDay,
  setDayType,
  addMeal,
  deleteMeal,
} from "@/app/(panel)/planes/actions";
import { MEAL_TYPE_OPTIONS, DAY_TYPES } from "@/lib/nutrition";

export type PlanBuilderOption = {
  id: string;
  text: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  selected: boolean;
};

export type PlanBuilderMeal = {
  id: string;
  name: string;
  options: PlanBuilderOption[];
};

export type PlanBuilderDay = {
  id: string;
  name: string;
  dayType: string;
  meals: PlanBuilderMeal[];
};

export type PlanBuilderTargets = {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

function mealLabel(value: string): string {
  return MEAL_TYPE_OPTIONS.find((m) => m.value === value)?.label ?? value;
}

function mealEmoji(value: string): string {
  switch (value) {
    case "desayuno": return "🌅";
    case "media_manana": return "🍎";
    case "pre_wod": return "💪";
    case "post_wod": return "🥤";
    case "comida": return "🍽";
    case "merienda": return "🥨";
    case "cena": return "🌙";
    case "snack": return "🍫";
    default: return "🍴";
  }
}

export function PlanBuilder({
  planId,
  clientName,
  clientId,
  planName,
  initialDays,
  initialTargets,
}: {
  planId: string;
  clientName: string;
  clientId: string;
  planName: string;
  initialDays: PlanBuilderDay[];
  initialTargets: PlanBuilderTargets;
}) {
  const [days, setDays] = useState<PlanBuilderDay[]>(initialDays);
  const [activeDayId, setActiveDayId] = useState<string | null>(
    initialDays[0]?.id ?? null,
  );
  const [generating, startGenerating] = useTransition();

  const activeDay = days.find((d) => d.id === activeDayId) ?? days[0] ?? null;

  // Suma de los items SELECTED del día activo. Recalcula automáticamente
  // mientras el usuario cambia checks/macros (state local).
  const actual = useMemo(() => {
    if (!activeDay) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    return activeDay.meals
      .flatMap((m) => m.options.filter((o) => o.selected))
      .reduce(
        (acc, o) => ({
          kcal: acc.kcal + o.kcal,
          protein: acc.protein + o.protein,
          carbs: acc.carbs + o.carbs,
          fat: acc.fat + o.fat,
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      );
  }, [activeDay]);

  // ── Mutadores locales (después llaman al server) ─────────────

  function patchOption(
    dayId: string,
    mealId: string,
    optionId: string,
    patch: Partial<PlanBuilderOption>,
  ) {
    setDays((prev) =>
      prev.map((d) =>
        d.id !== dayId
          ? d
          : {
              ...d,
              meals: d.meals.map((m) =>
                m.id !== mealId
                  ? m
                  : {
                      ...m,
                      options: m.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)),
                    },
              ),
            },
      ),
    );
  }

  function removeOptionLocal(dayId: string, mealId: string, optionId: string) {
    setDays((prev) =>
      prev.map((d) =>
        d.id !== dayId
          ? d
          : {
              ...d,
              meals: d.meals.map((m) =>
                m.id !== mealId ? m : { ...m, options: m.options.filter((o) => o.id !== optionId) },
              ),
            },
      ),
    );
  }

  function generateHB() {
    if (!confirm("Esto borra los días/comidas actuales del plan y crea una estructura nueva con Harris-Benedict. ¿Seguro?")) return;
    const fd = new FormData();
    fd.set("planId", planId);
    startGenerating(async () => {
      await generatePlanFromHB(fd);
      // Tras generar, recargamos la página para hidratar con los nuevos datos.
      window.location.reload();
    });
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Cabecera */}
      <Link
        href={`/clientes/${clientId}?tab=plan`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft size={14} /> Volver a la ficha de {clientName.split(" ")[0]}
      </Link>

      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{planName}</h1>
          <p className="text-sm text-muted">Plan nutricional · {clientName}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={generateHB}
            disabled={generating}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Generar con Harris-Benedict
          </button>
        </div>
      </header>

      {/* Resumen macros del día activo */}
      <SummaryCard targets={initialTargets} actual={actual} />

      {/* Tabs de días */}
      {days.length > 1 ? (
        <nav className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
          {days.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setActiveDayId(d.id)}
              className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                d.id === activeDayId ? "bg-primary text-white" : "text-muted hover:bg-bg hover:text-text"
              }`}
            >
              {d.name}
            </button>
          ))}
        </nav>
      ) : null}

      {!activeDay ? (
        <EmptyPlan onGenerate={generateHB} planId={planId} />
      ) : (
        <DayPanel
          day={activeDay}
          planId={planId}
          onPatch={(mealId, optionId, patch) => patchOption(activeDay.id, mealId, optionId, patch)}
          onRemoveOption={(mealId, optionId) => removeOptionLocal(activeDay.id, mealId, optionId)}
        />
      )}

      {/* Pie con acciones de día */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <form action={addDay} className="flex items-center gap-1">
          <input type="hidden" name="planId" value={planId} />
          <input type="hidden" name="name" value={`Día ${days.length + 1}`} />
          <button
            type="submit"
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 hover:border-primary hover:text-text"
          >
            <Plus size={11} /> Añadir otro día
          </button>
        </form>
        {activeDay ? (
          <form action={deleteDay}>
            <input type="hidden" name="planId" value={planId} />
            <input type="hidden" name="dayId" value={activeDay.id} />
            <button
              type="submit"
              onClick={(e) => {
                if (!confirm(`¿Borrar "${activeDay.name}"? Se eliminan sus comidas y opciones.`)) e.preventDefault();
              }}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-red-600 hover:border-red-300"
            >
              <Trash2 size={11} /> Borrar este día
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

// ── Resumen de macros (target vs actual vs delta) ────────────────────────

function SummaryCard({
  targets,
  actual,
}: {
  targets: PlanBuilderTargets;
  actual: { kcal: number; protein: number; carbs: number; fat: number };
}) {
  const macros: { key: "kcal" | "protein" | "carbs" | "fat"; label: string; unit: string }[] = [
    { key: "kcal", label: "Kcal", unit: "" },
    { key: "protein", label: "Prot (g)", unit: "" },
    { key: "carbs", label: "Carbos (g)", unit: "" },
    { key: "fat", label: "Grasa (g)", unit: "" },
  ];

  function deltaColor(delta: number, marginPct: number, target: number | null) {
    if (target == null || target === 0) return "text-muted";
    const pct = Math.abs(delta / target) * 100;
    if (pct <= marginPct) return "text-emerald-600";
    if (pct <= marginPct * 2) return "text-amber-600";
    return "text-red-600";
  }

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="border-b border-border px-5 py-3">
        <p className="font-semibold">Resumen de macros</p>
      </header>
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="px-5 py-3 text-left font-medium"></th>
            {macros.map((m) => (
              <th key={m.key} className="px-5 py-3 text-right font-medium">
                {m.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border">
            <th className="px-5 py-3 text-left font-medium text-muted">Objetivo</th>
            {macros.map((m) => (
              <td key={m.key} className="px-5 py-3 text-right font-semibold">
                {targets[m.key] ?? "—"}
              </td>
            ))}
          </tr>
          <tr className="border-t border-border">
            <th className="px-5 py-3 text-left font-medium text-muted">Actual</th>
            {macros.map((m) => (
              <td key={m.key} className="px-5 py-3 text-right">
                {Math.round(actual[m.key] * 10) / 10}
              </td>
            ))}
          </tr>
          <tr className="border-t border-border">
            <th className="px-5 py-3 text-left font-medium text-muted">Diferencia</th>
            {macros.map((m) => {
              const t = targets[m.key];
              if (t == null) return <td key={m.key} className="px-5 py-3 text-right text-muted">—</td>;
              const delta = actual[m.key] - t;
              const sign = delta > 0 ? "+" : "";
              return (
                <td key={m.key} className={`px-5 py-3 text-right font-semibold ${deltaColor(delta, 5, t)}`}>
                  {sign}{Math.round(delta * 10) / 10}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </section>
  );
}

// ── Estado vacío del plan ────────────────────────────────────────────────

function EmptyPlan({ onGenerate, planId }: { onGenerate: () => void; planId: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-12 text-center">
      <FileText size={28} className="mx-auto text-muted" />
      <p className="mt-3 font-medium">Este plan está vacío</p>
      <p className="mt-1 text-sm text-muted">
        Pulsa <strong>Generar con Harris-Benedict</strong> para crear un día tipo con 5 comidas
        × 3 opciones, calculando los macros objetivo desde el formulario del cliente.
      </p>
      <button
        type="button"
        onClick={onGenerate}
        className="mt-4 inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        <Sparkles size={14} /> Generar con Harris-Benedict
      </button>
    </div>
  );
}

// ── Panel del día activo ─────────────────────────────────────────────────

function DayPanel({
  day,
  planId,
  onPatch,
  onRemoveOption,
}: {
  day: PlanBuilderDay;
  planId: string;
  onPatch: (mealId: string, optionId: string, patch: Partial<PlanBuilderOption>) => void;
  onRemoveOption: (mealId: string, optionId: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Tipo de día */}
      <form action={setDayType} className="flex flex-wrap items-center gap-2 text-sm">
        <input type="hidden" name="planId" value={planId} />
        <input type="hidden" name="dayId" value={day.id} />
        <span className="font-medium text-muted">Tipo de día:</span>
        {DAY_TYPES.map((t) => (
          <button
            key={t.value}
            type="submit"
            name="dayType"
            value={t.value}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              day.dayType === t.value
                ? "border-primary bg-primary-soft text-primary"
                : "border-border text-muted hover:border-primary"
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </form>

      {day.meals.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
          Este día no tiene comidas todavía.
        </p>
      ) : (
        day.meals.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            planId={planId}
            onPatch={(optionId, patch) => onPatch(meal.id, optionId, patch)}
            onRemoveOption={(optionId) => onRemoveOption(meal.id, optionId)}
          />
        ))
      )}

      {/* Añadir comida extra al día */}
      <form action={addMeal} className="flex items-center gap-2">
        <input type="hidden" name="planId" value={planId} />
        <input type="hidden" name="dayId" value={day.id} />
        <select
          name="name"
          defaultValue="snack"
          className="rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {MEAL_TYPE_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs text-muted hover:border-primary hover:text-text"
        >
          <Plus size={12} /> Añadir comida
        </button>
      </form>
    </div>
  );
}

// ── Tarjeta de comida con sus opciones ───────────────────────────────────

function MealCard({
  meal,
  planId,
  onPatch,
  onRemoveOption,
}: {
  meal: PlanBuilderMeal;
  planId: string;
  onPatch: (optionId: string, patch: Partial<PlanBuilderOption>) => void;
  onRemoveOption: (optionId: string) => void;
}) {
  const [addingPending, startAdding] = useTransition();

  // Macros de la opción marcada (la primera selected). Si hay varias selected
  // sumamos todas (la UI permite que el nutri marque varias si quiere combinar).
  const selectedMacros = meal.options.filter((o) => o.selected).reduce(
    (acc, o) => ({
      kcal: acc.kcal + o.kcal,
      protein: acc.protein + o.protein,
      carbs: acc.carbs + o.carbs,
      fat: acc.fat + o.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  function addOption() {
    const fd = new FormData();
    fd.set("planId", planId);
    fd.set("mealId", meal.id);
    startAdding(async () => {
      await addOptionToMeal(fd);
      // Recargamos para hidratar la nueva opción con su id real.
      window.location.reload();
    });
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface">
      <details open className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-border px-5 py-3 transition hover:bg-bg/40">
          <div className="flex items-center gap-2">
            <ChevronDown size={16} className="text-muted transition group-open:rotate-180" />
            <span className="text-lg">{mealEmoji(meal.name)}</span>
            <span className="font-semibold">{mealLabel(meal.name)}</span>
            <span className="text-xs text-muted">
              {Math.round(selectedMacros.kcal)} kcal · P {Math.round(selectedMacros.protein)} ·
              {" "}G {Math.round(selectedMacros.fat)} · C {Math.round(selectedMacros.carbs)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                addOption();
              }}
              disabled={addingPending}
              className="rounded-md p-1 text-muted hover:bg-bg hover:text-primary disabled:opacity-50"
              title="Añadir opción"
            >
              {addingPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            </button>
            <form action={deleteMeal}>
              <input type="hidden" name="planId" value={planId} />
              <input type="hidden" name="mealId" value={meal.id} />
              <button
                type="submit"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!confirm(`¿Borrar la comida "${mealLabel(meal.name)}"?`)) e.preventDefault();
                }}
                className="rounded-md p-1 text-muted hover:bg-bg hover:text-red-600"
                title="Borrar comida"
              >
                <Trash2 size={14} />
              </button>
            </form>
          </div>
        </summary>

        <div className="divide-y divide-border">
          {meal.options.map((opt, i) => (
            <OptionRow
              key={opt.id}
              option={opt}
              index={i}
              planId={planId}
              onPatch={(patch) => onPatch(opt.id, patch)}
              onDelete={() => onRemoveOption(opt.id)}
            />
          ))}
          {meal.options.length === 0 ? (
            <p className="px-5 py-4 text-sm italic text-muted">Sin opciones. Pulsa "+" arriba.</p>
          ) : null}
        </div>
      </details>
    </article>
  );
}

// ── Fila de opción con autosave ──────────────────────────────────────────

function OptionRow({
  option,
  index,
  planId,
  onPatch,
  onDelete,
}: {
  option: PlanBuilderOption;
  index: number;
  planId: string;
  onPatch: (patch: Partial<PlanBuilderOption>) => void;
  onDelete: () => void;
}) {
  const [savingPending, startSaving] = useTransition();
  const textTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const macroTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function saveTextDebounced(value: string) {
    onPatch({ text: value });
    if (textTimer.current) clearTimeout(textTimer.current);
    textTimer.current = setTimeout(() => {
      const fd = new FormData();
      fd.set("planId", planId);
      fd.set("itemId", option.id);
      fd.set("text", value);
      startSaving(async () => {
        await updateOptionText(fd);
      });
    }, 600);
  }

  function saveMacrosDebounced(patch: Partial<PlanBuilderOption>) {
    onPatch(patch);
    if (macroTimer.current) clearTimeout(macroTimer.current);
    macroTimer.current = setTimeout(() => {
      const fd = new FormData();
      fd.set("planId", planId);
      fd.set("itemId", option.id);
      fd.set("kcal", String(patch.kcal ?? option.kcal));
      fd.set("protein", String(patch.protein ?? option.protein));
      fd.set("carbs", String(patch.carbs ?? option.carbs));
      fd.set("fat", String(patch.fat ?? option.fat));
      startSaving(async () => {
        await updateOptionMacros(fd);
      });
    }, 600);
  }

  function toggleSelected() {
    onPatch({ selected: !option.selected });
    const fd = new FormData();
    fd.set("planId", planId);
    fd.set("itemId", option.id);
    startSaving(async () => {
      await toggleItemSelected(fd);
    });
  }

  function remove() {
    if (!confirm("¿Borrar esta opción?")) return;
    onDelete();
    const fd = new FormData();
    fd.set("planId", planId);
    fd.set("itemId", option.id);
    startSaving(async () => {
      await deleteItem(fd);
    });
  }

  return (
    <div className="px-5 py-4">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <label className="flex shrink-0 cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={option.selected}
            onChange={toggleSelected}
            className="h-4 w-4 cursor-pointer rounded border-border text-primary focus:ring-primary"
          />
          <span className="text-sm font-semibold text-primary">Opción {index + 1}</span>
        </label>

        <MacroInput
          label="Kcal"
          value={option.kcal}
          onChange={(v) => saveMacrosDebounced({ kcal: v })}
        />
        <MacroInput
          label="Prot"
          value={option.protein}
          onChange={(v) => saveMacrosDebounced({ protein: v })}
        />
        <MacroInput
          label="Grasa"
          value={option.fat}
          onChange={(v) => saveMacrosDebounced({ fat: v })}
        />
        <MacroInput
          label="Carbos"
          value={option.carbs}
          onChange={(v) => saveMacrosDebounced({ carbs: v })}
        />

        <button
          type="button"
          onClick={remove}
          title="Borrar opción"
          className="ml-auto rounded-md p-1.5 text-muted hover:bg-bg hover:text-red-600"
        >
          <Trash2 size={13} />
        </button>
        {savingPending ? <Loader2 size={11} className="animate-spin text-muted" /> : null}
      </div>

      <textarea
        rows={2}
        value={option.text}
        onChange={(e) => saveTextDebounced(e.target.value)}
        placeholder="Describe la opción (ej. Tostada con 100gr pan integral con 1/4 de aguacate, 1 loncha de queso havarti…)"
        className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </div>
  );
}

function MacroInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-muted">
      <span>{label}</span>
      <input
        type="number"
        value={Math.round(value * 10) / 10}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        step="0.5"
        min="0"
        className="w-16 rounded-md border border-border bg-bg px-2 py-1 text-right text-sm text-text outline-none focus:border-primary"
      />
    </label>
  );
}
