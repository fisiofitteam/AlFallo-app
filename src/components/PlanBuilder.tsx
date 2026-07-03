"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  Plus, Trash2, Loader2, FileText, ArrowLeft, ChevronDown, ChevronUp,
  RotateCcw, AlertTriangle, StickyNote,
} from "lucide-react";
import {
  addOptionToMeal,
  deleteItem,
  toggleItemSelected,
  selectExclusiveOption,
  updateOptionMacros,
  updateOptionNote,
  updateOptionText,
  updateOptionTextAndEstimate,
  addDay,
  deleteDay,
  addMeal,
  deleteMeal,
  renameMeal,
  moveMeal,
  updatePlanCopy,
  updatePlanMacroOverride,
} from "@/app/(panel)/planes/actions";
import { MEAL_TYPE_OPTIONS } from "@/lib/nutrition";

export type PlanBuilderOption = {
  id: string;
  text: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  selected: boolean;
  /** Solo en comida/cena: intro|grasas|carbos|proteina|postre. */
  subType: string | null;
  /** Nota libre para el atleta (elaboración, tip, aclaración). No entra en
   *  el cálculo de macros ni en la lista de la compra. */
  note: string | null;
};

const SUB_GROUPS: { value: string; label: string }[] = [
  { value: "intro", label: "INTRO" },
  { value: "grasas", label: "GRASAS" },
  { value: "carbos", label: "CARBOS" },
  { value: "proteina", label: "PROTEÍNA" },
  { value: "postre", label: "POSTRE" },
];

// Una comida se considera "compuesta" (con subgrupos intro/grasas/carbos/
// proteina/postre) cuando alguno de sus items lleva subType. Antes lo
// inferíamos por el nombre ("comida"/"cena"), pero como el nutri puede
// renombrar libremente, ahora va por los datos.
function isComposedMeal(meal: { options: { subType: string | null }[] }): boolean {
  return meal.options.some((o) => o.subType !== null);
}

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
  planKind = "regular",
  initialDays,
  initialTargets,
  initialNotes,
  initialSupplementation,
  initialOverride,
  embedded = false,
}: {
  planId: string;
  clientName: string;
  clientId: string;
  planName: string;
  /** "regular" o "competition". En competición ocultamos el botón "Generar
   *  plan" porque esos planes se construyen a partir de plantilla, no IA. */
  planKind?: string;
  initialDays: PlanBuilderDay[];
  initialTargets: PlanBuilderTargets;
  initialNotes: string | null;
  initialSupplementation: string | null;
  /** Override de macros guardado en el plan (los 4 a null si no se usa). */
  initialOverride?: {
    kcal: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  };
  embedded?: boolean;
}) {
  const [days, setDays] = useState<PlanBuilderDay[]>(initialDays);
  const [activeDayId, setActiveDayId] = useState<string | null>(
    initialDays[0]?.id ?? null,
  );
  // (Eliminado: useTransition de generación IA. Los planes vienen ya
  //  poblados desde plantilla — no se "genera" nada desde el builder.)
  const [notesDraft, setNotesDraft] = useState(initialNotes ?? "");
  const [supplementationDraft, setSupplementationDraft] = useState(initialSupplementation ?? "");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, startCopySave] = useTransition();

  function persistCopySoon(nextNotes: string, nextSupp: string) {
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => {
      startCopySave(async () => {
        await updatePlanCopy(planId, nextNotes || null, nextSupp || null);
      });
    }, 800);
  }

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

  function renameMealLocal(dayId: string, mealId: string, name: string) {
    setDays((prev) =>
      prev.map((d) =>
        d.id !== dayId
          ? d
          : { ...d, meals: d.meals.map((m) => (m.id === mealId ? { ...m, name } : m)) },
      ),
    );
  }

  function moveMealLocal(dayId: string, mealId: string, dir: "up" | "down") {
    setDays((prev) =>
      prev.map((d) => {
        if (d.id !== dayId) return d;
        const idx = d.meals.findIndex((m) => m.id === mealId);
        if (idx < 0) return d;
        const j = idx + (dir === "up" ? -1 : 1);
        if (j < 0 || j >= d.meals.length) return d;
        const next = [...d.meals];
        [next[idx], next[j]] = [next[j], next[idx]];
        return { ...d, meals: next };
      }),
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

  return (
    <div className={embedded ? "" : "mx-auto max-w-6xl"}>
      {/* Cabecera standalone (en /planes/[id]). Embebido en la ficha del
          cliente la cabecera ya la pone la ficha + PlanPicker. */}
      {!embedded ? (
        <>
          <Link
            href={`/clientes/${clientId}?tab=plan`}
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-text"
          >
            <ArrowLeft size={14} /> Volver a la ficha de {clientName.split(" ")[0]}
          </Link>

          <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold md:text-3xl">{planName}</h1>
              <p className="text-sm text-muted">
                {planKind === "competition" ? "Plan de competición" : "Plan nutricional"} ·{" "}
                {clientName}
              </p>
            </div>
            {/* (Eliminado el botón "Generar plan con IA". Los planes vienen
                ya poblados desde plantilla al crearse.) */}
          </header>
        </>
      ) : null}

      {/* Editor de macros target para ESTE plan. Si tiene override
          guardado, los inputs vienen rellenos; si no, vienen en blanco y
          el plan usa los macros oficiales del cliente. Cambios → action
          updatePlanMacroOverride. Solo aplica a pauta nutricional. */}
      {planKind !== "competition" ? (
        <MacroOverrideEditor planId={planId} initial={initialOverride ?? null} />
      ) : null}

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
        <EmptyPlan planKind={planKind} />
      ) : (
        <DayPanel
          day={activeDay}
          planId={planId}
          onPatch={(mealId, optionId, patch) => patchOption(activeDay.id, mealId, optionId, patch)}
          onRemoveOption={(mealId, optionId) => removeOptionLocal(activeDay.id, mealId, optionId)}
          onRenameMeal={(mealId, name) => renameMealLocal(activeDay.id, mealId, name)}
          onMoveMeal={(mealId, dir) => moveMealLocal(activeDay.id, mealId, dir)}
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

      {/* Observaciones y suplementación. Texto libre que el cliente ve en su
          app junto al plan. Autosave debounce 800 ms. */}
      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <header className="border-b border-border px-5 py-3">
            <p className="font-semibold">Observaciones</p>
            <p className="mt-0.5 text-xs text-muted">
              Notas generales del plan, indicaciones importantes para el atleta.
            </p>
          </header>
          <textarea
            rows={6}
            value={notesDraft}
            onChange={(e) => {
              setNotesDraft(e.target.value);
              persistCopySoon(e.target.value, supplementationDraft);
            }}
            placeholder="Ej. Bebe 35 ml/kg al día. Si entrenas dos sesiones, repite Pre-WOD. Pesa los alimentos en crudo salvo verduras."
            className="block w-full resize-y bg-transparent px-5 py-3 text-sm leading-relaxed outline-none focus:bg-bg/40"
          />
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <header className="border-b border-border px-5 py-3">
            <p className="font-semibold">Suplementación</p>
            <p className="mt-0.5 text-xs text-muted">
              Suplementos y dosis pautadas. El cliente lo ve como bloque propio.
            </p>
          </header>
          <textarea
            rows={6}
            value={supplementationDraft}
            onChange={(e) => {
              setSupplementationDraft(e.target.value);
              persistCopySoon(notesDraft, e.target.value);
            }}
            placeholder="Ej. Creatina monohidrato 5 g/día con comida principal. Whey 30 g post-WOD. Magnesio 300 mg antes de dormir. Vit. D3 2000 UI con desayuno."
            className="block w-full resize-y bg-transparent px-5 py-3 text-sm leading-relaxed outline-none focus:bg-bg/40"
          />
        </div>
      </section>

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

function EmptyPlan({ planKind }: { planKind: string }) {
  // Plan vacío: ya no hay botón "Generar plan" — los planes vienen poblados
  // desde plantilla al crearse. Si el plan está vacío es porque el nutri
  // borró todos los días manualmente.
  if (planKind === "competition") {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-12 text-center">
        <FileText size={28} className="mx-auto text-muted" />
        <p className="mt-3 font-medium">Plan de competición vacío</p>
        <p className="mt-1 text-sm text-muted">
          Crea el plan desde la ficha del cliente eligiendo una plantilla, o añade los días y
          comidas a mano abajo.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-12 text-center">
      <FileText size={28} className="mx-auto text-muted" />
      <p className="mt-3 font-medium">Este plan está vacío</p>
      <p className="mt-1 text-sm text-muted">
        Crea el plan desde la ficha del cliente eligiendo una plantilla en{" "}
        <strong>Añadir plan</strong>, o añade los días y comidas a mano abajo.
      </p>
    </div>
  );
}

// ── Panel del día activo ─────────────────────────────────────────────────

function DayPanel({
  day,
  planId,
  onPatch,
  onRemoveOption,
  onRenameMeal,
  onMoveMeal,
}: {
  day: PlanBuilderDay;
  planId: string;
  onPatch: (mealId: string, optionId: string, patch: Partial<PlanBuilderOption>) => void;
  onRemoveOption: (mealId: string, optionId: string) => void;
  onRenameMeal: (mealId: string, name: string) => void;
  onMoveMeal: (mealId: string, dir: "up" | "down") => void;
}) {
  return (
    <div className="space-y-4">
      {day.meals.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
          Este día no tiene comidas todavía.
        </p>
      ) : (
        day.meals.map((meal, idx) => (
          <MealCard
            key={meal.id}
            meal={meal}
            planId={planId}
            position={idx}
            totalMeals={day.meals.length}
            onPatch={(optionId, patch) => onPatch(meal.id, optionId, patch)}
            onRemoveOption={(optionId) => onRemoveOption(meal.id, optionId)}
            onRename={(name) => onRenameMeal(meal.id, name)}
            onMove={(dir) => onMoveMeal(meal.id, dir)}
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
  position,
  totalMeals,
  onPatch,
  onRemoveOption,
  onRename,
  onMove,
}: {
  meal: PlanBuilderMeal;
  planId: string;
  position: number;
  totalMeals: number;
  onPatch: (optionId: string, patch: Partial<PlanBuilderOption>) => void;
  onRemoveOption: (optionId: string) => void;
  onRename: (name: string) => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const [addingPending, startAdding] = useTransition();
  const [, startRename] = useTransition();
  const [, startMove] = useTransition();
  const renameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Texto mostrado en el input: en la primera renderización mostramos el
  // label prettificado (ej. "Desayuno" en lugar del slug "desayuno"). Cuando
  // el nutri edita, el valor pasa a ser literalmente lo que escriba.
  const initialName = mealLabel(meal.name);
  const [nameDraft, setNameDraft] = useState(initialName);

  function pushRename(value: string) {
    setNameDraft(value);
    onRename(value);
    if (renameTimer.current) clearTimeout(renameTimer.current);
    renameTimer.current = setTimeout(() => {
      const fd = new FormData();
      fd.set("planId", planId);
      fd.set("mealId", meal.id);
      fd.set("name", value.trim());
      if (!value.trim()) return;
      startRename(async () => {
        await renameMeal(fd);
      });
    }, 600);
  }

  function move(dir: "up" | "down") {
    onMove(dir);
    const fd = new FormData();
    fd.set("planId", planId);
    fd.set("mealId", meal.id);
    fd.set("direction", dir);
    startMove(async () => {
      await moveMeal(fd);
    });
  }

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

  function addOption(subType?: string) {
    const fd = new FormData();
    fd.set("planId", planId);
    fd.set("mealId", meal.id);
    if (subType) fd.set("subType", subType);
    startAdding(async () => {
      await addOptionToMeal(fd);
      // Recargamos para hidratar la nueva opción con su id real.
      window.location.reload();
    });
  }

  const composed = isComposedMeal(meal);
  // Para comida/cena el contador top muestra la suma "comida completa": 1
  // opción seleccionada por subgrupo. Para simples, también la suma de
  // selected (que normalmente será una sola en las comidas planas).
  const headerLabel = `${Math.round(selectedMacros.kcal)} kcal · P ${Math.round(
    selectedMacros.protein,
  )} · G ${Math.round(selectedMacros.fat)} · C ${Math.round(selectedMacros.carbs)}`;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-surface">
      <details open className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-border px-5 py-3 transition hover:bg-bg/40">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <ChevronDown size={16} className="flex-shrink-0 text-muted transition group-open:rotate-180" />
            <span className="text-lg">{mealEmoji(meal.name)}</span>
            {/* Nombre editable inline: clic-stopPropagation para que el
                <summary> no toggle el desplegable al pinchar el input. */}
            <input
              value={nameDraft}
              onChange={(e) => pushRename(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              placeholder="Nombre de la comida"
              className="min-w-0 max-w-[260px] flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 font-semibold outline-none hover:border-border focus:border-primary"
            />
            <span className="ml-1 text-xs text-muted">{headerLabel}</span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                move("up");
              }}
              disabled={position === 0}
              title="Subir comida"
              className="rounded-md p-1 text-muted hover:bg-bg hover:text-text disabled:opacity-30"
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                move("down");
              }}
              disabled={position === totalMeals - 1}
              title="Bajar comida"
              className="rounded-md p-1 text-muted hover:bg-bg hover:text-text disabled:opacity-30"
            >
              <ChevronDown size={14} />
            </button>
            {!composed ? (
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
            ) : null}
            <form action={deleteMeal}>
              <input type="hidden" name="planId" value={planId} />
              <input type="hidden" name="mealId" value={meal.id} />
              <button
                type="submit"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!confirm(`¿Borrar la comida "${nameDraft}"?`)) e.preventDefault();
                }}
                className="rounded-md p-1 text-muted hover:bg-bg hover:text-red-600"
                title="Borrar comida"
              >
                <Trash2 size={14} />
              </button>
            </form>
          </div>
        </summary>

        {composed ? (
          <ComposedBody
            meal={meal}
            planId={planId}
            adding={addingPending}
            onPatch={onPatch}
            onRemoveOption={onRemoveOption}
            onAdd={(sub) => addOption(sub)}
          />
        ) : (
          <SimpleBody
            meal={meal}
            planId={planId}
            onPatch={onPatch}
            onRemoveOption={onRemoveOption}
          />
        )}
      </details>
    </article>
  );
}

function SimpleBody({
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
  return (
    <div className="divide-y divide-border">
      {meal.options.map((opt, i) => (
        <OptionRow
          key={opt.id}
          option={opt}
          index={i}
          planId={planId}
          exclusiveInGroup={false}
          onPatch={(patch) => onPatch(opt.id, patch)}
          onDelete={() => onRemoveOption(opt.id)}
          onSelectExclusive={() => undefined}
        />
      ))}
      {meal.options.length === 0 ? (
        <p className="px-5 py-4 text-sm italic text-muted">Sin opciones. Pulsa "+" arriba.</p>
      ) : null}
    </div>
  );
}

function ComposedBody({
  meal,
  planId,
  adding,
  onPatch,
  onRemoveOption,
  onAdd,
}: {
  meal: PlanBuilderMeal;
  planId: string;
  adding: boolean;
  onPatch: (optionId: string, patch: Partial<PlanBuilderOption>) => void;
  onRemoveOption: (optionId: string) => void;
  onAdd: (subType: string) => void;
}) {
  // Selección exclusiva por subgrupo: marca esta y deselecciona hermanas.
  function handleExclusive(optionId: string, subType: string) {
    const opt = meal.options.find((o) => o.id === optionId);
    if (!opt) return;
    if (opt.selected) {
      // ya estaba seleccionada → toggle a false
      onPatch(optionId, { selected: false });
    } else {
      for (const sib of meal.options) {
        if (sib.subType === subType && sib.id !== optionId && sib.selected) {
          onPatch(sib.id, { selected: false });
        }
      }
      onPatch(optionId, { selected: true });
    }
  }

  return (
    <div className="space-y-5 px-5 py-4">
      {SUB_GROUPS.map((g) => {
        const items = meal.options
          .filter((o) => o.subType === g.value)
          .sort((a, b) => a.kcal - b.kcal);
        return (
          <div key={g.value}>
            <header className="mb-2 flex items-center justify-between">
              <p className="border-l-2 border-primary pl-2 text-xs font-bold uppercase tracking-wider text-primary">
                {g.label}
              </p>
              <button
                type="button"
                onClick={() => onAdd(g.value)}
                disabled={adding}
                title="Añadir opción"
                className="rounded-md p-1 text-muted hover:bg-bg hover:text-primary disabled:opacity-50"
              >
                {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              </button>
            </header>
            {items.length === 0 ? (
              <p className="text-xs italic text-muted/70">Sin opciones aún.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((opt, i) => (
                  <OptionRow
                    key={opt.id}
                    option={opt}
                    index={i}
                    planId={planId}
                    exclusiveInGroup
                    compact
                    onPatch={(patch) => onPatch(opt.id, patch)}
                    onDelete={() => onRemoveOption(opt.id)}
                    onSelectExclusive={() => handleExclusive(opt.id, g.value)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Fila de opción con autosave ──────────────────────────────────────────

function OptionRow({
  option,
  index,
  planId,
  exclusiveInGroup,
  compact = false,
  onPatch,
  onDelete,
  onSelectExclusive,
}: {
  option: PlanBuilderOption;
  index: number;
  planId: string;
  exclusiveInGroup: boolean;
  compact?: boolean;
  onPatch: (patch: Partial<PlanBuilderOption>) => void;
  onDelete: () => void;
  onSelectExclusive: () => void;
}) {
  const [savingPending, startSaving] = useTransition();
  const textTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const macroTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Panel de notas: abierto si ya hay nota guardada, o si el nutri lo abre.
  const [showNote, setShowNote] = useState<boolean>(
    typeof option.note === "string" && option.note.trim().length > 0,
  );

  function saveNoteDebounced(value: string) {
    onPatch({ note: value });
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => {
      const fd = new FormData();
      fd.set("planId", planId);
      fd.set("itemId", option.id);
      fd.set("note", value);
      startSaving(async () => {
        await updateOptionNote(fd);
      });
    }, 800);
  }

  function saveTextDebounced(value: string) {
    onPatch({ text: value });
    if (textTimer.current) clearTimeout(textTimer.current);
    // Debounce 800 ms para persistir el texto. NO reestimamos macros con
    // IA automáticamente — antes lo hacíamos y daba sensación de "cambios
    // aleatorios" cada vez que el nutri tocaba una cantidad. Los macros
    // ahora son ESTABLES y solo cambian con:
    //   1) edición manual en los inputs kcal/P/C/G de la opción.
    //   2) click en el botón "Recalcular con IA" de la opción.
    textTimer.current = setTimeout(() => {
      const fd = new FormData();
      fd.set("planId", planId);
      fd.set("itemId", option.id);
      fd.set("text", value);
      startSaving(async () => {
        await updateOptionText(fd);
      });
    }, 800);
  }

  /** Recalcula los macros de esta opción con la IA (Sonnet 4.6 + validación
   *  4-9-4). Lo dispara el nutri explícitamente con el botón 🔄. Reemplaza
   *  los valores kcal/P/C/G por la nueva estimación. */
  function recalcMacrosWithAI() {
    const text = option.text.trim();
    if (text.length < 3) return;
    startSaving(async () => {
      try {
        const next = await updateOptionTextAndEstimate(planId, option.id, text);
        onPatch({
          kcal: next.kcal,
          protein: next.protein,
          carbs: next.carbs,
          fat: next.fat,
        });
      } catch {
        // silencioso: si falla, el texto ya está guardado por saveTextDebounced.
      }
    });
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
    if (exclusiveInGroup) {
      // Optimismo local lo hace el padre vía onSelectExclusive (afecta a hermanas).
      onSelectExclusive();
      const fd = new FormData();
      fd.set("planId", planId);
      fd.set("itemId", option.id);
      startSaving(async () => {
        await selectExclusiveOption(fd);
      });
    } else {
      onPatch({ selected: !option.selected });
      const fd = new FormData();
      fd.set("planId", planId);
      fd.set("itemId", option.id);
      startSaving(async () => {
        await toggleItemSelected(fd);
      });
    }
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

  if (compact) {
    return (
      <div
        className={`rounded-lg border p-2 transition ${
          option.selected ? "border-primary bg-primary-soft/40" : "border-border bg-bg/40"
        }`}
      >
        <div className="mb-1 flex items-center gap-1.5">
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5">
            <input
              type="checkbox"
              checked={option.selected}
              onChange={toggleSelected}
              className="h-3.5 w-3.5 cursor-pointer rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-xs font-semibold text-primary">Opción {index + 1}</span>
          </label>
          <button
            type="button"
            onClick={recalcMacrosWithAI}
            disabled={savingPending}
            title="Recalcular macros con IA a partir del texto actual"
            className="ml-auto rounded-md p-1 text-muted hover:bg-surface hover:text-primary disabled:opacity-50"
          >
            <RotateCcw size={11} />
          </button>
          <button
            type="button"
            onClick={remove}
            title="Borrar opción"
            className="rounded-md p-1 text-muted hover:bg-surface hover:text-red-600"
          >
            <Trash2 size={11} />
          </button>
          {savingPending ? <Loader2 size={10} className="animate-spin text-muted" /> : null}
        </div>
        <div className="mb-1.5 grid grid-cols-4 gap-1 text-[10px]">
          <CompactMacro label="Kcal" value={option.kcal} onChange={(v) => saveMacrosDebounced({ kcal: v })} />
          <CompactMacro label="Prot" value={option.protein} onChange={(v) => saveMacrosDebounced({ protein: v })} />
          <CompactMacro label="Gra" value={option.fat} onChange={(v) => saveMacrosDebounced({ fat: v })} />
          <CompactMacro label="Carb" value={option.carbs} onChange={(v) => saveMacrosDebounced({ carbs: v })} />
        </div>
        <textarea
          rows={2}
          value={option.text}
          onChange={(e) => saveTextDebounced(e.target.value)}
          placeholder="Alimento + cantidad (ej. 150 g pollo)"
          className="w-full resize-none rounded-md border border-border bg-bg px-2 py-1.5 text-xs outline-none focus:border-primary"
        />
        <NoteBlock
          note={option.note}
          open={showNote}
          onOpen={() => setShowNote(true)}
          onChange={saveNoteDebounced}
          compact
        />
      </div>
    );
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
          onClick={recalcMacrosWithAI}
          disabled={savingPending}
          title="Recalcular macros con IA a partir del texto actual"
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-bg px-2 py-1 text-[11px] font-medium text-muted hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <RotateCcw size={11} /> Recalcular macros
        </button>
        <button
          type="button"
          onClick={remove}
          title="Borrar opción"
          className="rounded-md p-1.5 text-muted hover:bg-bg hover:text-red-600"
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
      <NoteBlock
        note={option.note}
        open={showNote}
        onOpen={() => setShowNote(true)}
        onChange={saveNoteDebounced}
      />
    </div>
  );
}

// Bloque de notas para una opción. Texto libre, no afecta a macros. Colapsado
// por defecto salvo que ya haya nota. Compact = versión estrecha para las
// opciones agrupadas de comida/cena.
function NoteBlock({
  note,
  open,
  onOpen,
  onChange,
  compact = false,
}: {
  note: string | null;
  open: boolean;
  onOpen: () => void;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={
          compact
            ? "mt-1.5 inline-flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted hover:border-primary hover:text-primary"
            : "mt-2 inline-flex items-center gap-1 rounded-md border border-border bg-bg px-2 py-1 text-[11px] text-muted hover:border-primary hover:text-primary"
        }
      >
        <StickyNote size={compact ? 10 : 11} /> Añadir notas
      </button>
    );
  }
  return (
    <div className={compact ? "mt-1.5" : "mt-2"}>
      <label className={compact ? "block text-[9px]" : "block text-[11px]"}>
        <span className="font-semibold text-muted">Notas para el atleta</span>
        <textarea
          value={note ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder="Ej. Elaborar al horno 20 min a 180 ºC. Puedes cambiar el arroz por quinoa."
          className={
            compact
              ? "mt-0.5 w-full resize-none rounded-md border border-border bg-bg px-2 py-1.5 text-xs outline-none focus:border-primary"
              : "mt-0.5 w-full resize-none rounded-lg border border-border bg-bg px-3 py-1.5 text-sm outline-none focus:border-primary"
          }
        />
      </label>
    </div>
  );
}

function CompactMacro({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col">
      <span className="text-[9px] text-muted">{label}</span>
      <input
        type="number"
        value={Math.round(value * 10) / 10}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        step="0.5"
        min="0"
        className="w-full rounded border border-border bg-bg px-1 py-0.5 text-right text-xs text-text outline-none focus:border-primary"
      />
    </label>
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

// ── Editor del override de macros del plan ──────────────────────────────
// Permite al nutri sobrescribir los macros target SOLO para este plan, sin
// tocar la ficha del cliente. Si lo deja todo en blanco se respetan los
// macros oficiales del cliente.

function MacroOverrideEditor({
  planId,
  initial,
}: {
  planId: string;
  initial: {
    kcal: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  } | null;
}) {
  const [kcal, setKcal] = useState<string>(initial?.kcal != null ? String(initial.kcal) : "");
  const [protein, setProtein] = useState<string>(
    initial?.protein != null ? String(initial.protein) : "",
  );
  const [carbs, setCarbs] = useState<string>(initial?.carbs != null ? String(initial.carbs) : "");
  const [fat, setFat] = useState<string>(initial?.fat != null ? String(initial.fat) : "");
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasOverride = !!(kcal && protein && carbs && fat);

  function save() {
    const fd = new FormData();
    fd.set("planId", planId);
    fd.set("kcalOverride", kcal);
    fd.set("proteinOverride", protein);
    fd.set("carbsOverride", carbs);
    fd.set("fatOverride", fat);
    start(async () => {
      setError(null);
      const r = await updatePlanMacroOverride(fd);
      if (r && "error" in r && r.error) {
        setError(r.error);
        return;
      }
      setSavedAt(Date.now());
    });
  }

  function clearAll() {
    setKcal("");
    setProtein("");
    setCarbs("");
    setFat("");
    const fd = new FormData();
    fd.set("planId", planId);
    // (sin valores → action interpreta "todos en blanco" y borra el override)
    start(async () => {
      setError(null);
      await updatePlanMacroOverride(fd);
      setSavedAt(Date.now());
    });
  }

  return (
    <section className="mb-4 rounded-2xl border border-border bg-surface p-4">
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-bold">Macros objetivo para este plan</p>
          <p className="text-xs text-muted">
            {hasOverride
              ? "Override activo. La IA usará estos macros al generar/regenerar."
              : "Sin override. Se usan los macros oficiales del cliente (Macros objetivo en la ficha)."}
          </p>
        </div>
        {savedAt ? (
          <span className="text-[11px] text-emerald-700">
            Guardado{" "}
            {new Date(savedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
          </span>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="block text-xs">
          <span className="font-semibold text-muted">Kcal</span>
          <input
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
            inputMode="numeric"
            placeholder="2100"
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block text-xs">
          <span className="font-semibold text-muted">Prot (g)</span>
          <input
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            inputMode="numeric"
            placeholder="160"
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block text-xs">
          <span className="font-semibold text-muted">Carbos (g)</span>
          <input
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            inputMode="numeric"
            placeholder="210"
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block text-xs">
          <span className="font-semibold text-muted">Grasa (g)</span>
          <input
            value={fat}
            onChange={(e) => setFat(e.target.value)}
            inputMode="numeric"
            placeholder="70"
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
        </label>
      </div>

      {error ? (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending || !(kcal && protein && carbs && fat)}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <Loader2 size={11} className="animate-spin" /> : null}
          Guardar override
        </button>
        {hasOverride || (initial && (initial.kcal != null || initial.protein != null)) ? (
          <button
            type="button"
            onClick={clearAll}
            disabled={pending}
            className="rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-medium text-muted hover:border-red-300 hover:text-red-600 disabled:opacity-50"
            title="Quitar override y volver a usar los macros oficiales del cliente"
          >
            Quitar override
          </button>
        ) : null}
        <p className="ml-auto text-[11px] italic text-muted">
          Estos macros se le pasan tal cual a la IA al generar el plan.
        </p>
      </div>
    </section>
  );
}
