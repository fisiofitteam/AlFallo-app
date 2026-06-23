"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  Plus,
  Save,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type {
  CompetitionTemplateDTO,
  TemplateDay,
  TemplateMeal,
  TemplateOption,
} from "@/lib/competitionTemplates";
import { saveCompetitionTemplate } from "@/app/(panel)/biblioteca/competicion/actions";

/**
 * Editor de plantilla de competición. Es un formulario plano con un único
 * "Guardar" al final — sin autoguardado: las plantillas se tocan poco, y
 * un editor de batch reduce muchísimo la complejidad respecto al
 * PlanBuilder que se usa en los planes vivos del cliente.
 *
 * Estructura: días → comidas → opciones. Cada opción es texto + macros (y
 * subgrupo opcional para comida/cena).
 */

// Sugerencias rápidas para el nombre de la comida. El nutri puede pulsar
// una para autocompletar, o escribir libremente cualquier texto (ej.
// "WOD 1: Run 1km + Sled 50m", "Carrera 5km", "Semifinal Hyrox 11:30").
// Lo que se guarda en meal.name es el texto literal. El check de comida
// "compuesta" (con subgrupos intro/grasas/carbos/...) se hace
// case-insensitive, así que "Comida" / "comida" / "COMIDA" entran todas
// en modo compuesto, igual que "Cena".
const MEAL_NAME_SUGGESTIONS: string[] = [
  "Desayuno",
  "Media mañana",
  "Pre-WOD",
  "WOD",
  "Post-WOD",
  "Comida",
  "Merienda",
  "Cena",
  "Snack",
];

/** Devuelve true si el nombre de la comida coincide con "comida" o "cena"
 *  ignorando mayúsculas. Esos meals tienen el modo compuesto con subgrupos. */
function isComposedMealName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return n === "comida" || n === "cena";
}

const SUB_TYPES = [
  { value: "", label: "—" },
  { value: "intro", label: "Intro" },
  { value: "grasas", label: "Grasas" },
  { value: "carbos", label: "Carbos" },
  { value: "proteina", label: "Proteína" },
  { value: "postre", label: "Postre" },
];

export function CompetitionTemplateEditor({ initial }: { initial: CompetitionTemplateDTO }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [supplementation, setSupplementation] = useState(initial.supplementation ?? "");
  const [days, setDays] = useState<TemplateDay[]>(initial.structure.days);
  const [pending, start] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function addDay() {
    setDays((d) => [
      ...d,
      { name: `Día ${d.length + 1}`, dayType: "entreno", meals: [] },
    ]);
  }

  function removeDay(di: number) {
    if (!confirm("¿Borrar el día completo con todas sus comidas?")) return;
    setDays((d) => d.filter((_, i) => i !== di));
  }

  function patchDay(di: number, patch: Partial<TemplateDay>) {
    setDays((d) => d.map((day, i) => (i === di ? { ...day, ...patch } : day)));
  }

  function addMeal(di: number) {
    setDays((d) =>
      d.map((day, i) =>
        i === di ? { ...day, meals: [...day.meals, { name: "desayuno", options: [] }] } : day,
      ),
    );
  }

  function removeMeal(di: number, mi: number) {
    setDays((d) =>
      d.map((day, i) =>
        i === di ? { ...day, meals: day.meals.filter((_, j) => j !== mi) } : day,
      ),
    );
  }

  function patchMeal(di: number, mi: number, patch: Partial<TemplateMeal>) {
    setDays((d) =>
      d.map((day, i) =>
        i === di
          ? {
              ...day,
              meals: day.meals.map((m, j) => (j === mi ? { ...m, ...patch } : m)),
            }
          : day,
      ),
    );
  }

  function addOption(di: number, mi: number) {
    setDays((d) =>
      d.map((day, i) =>
        i === di
          ? {
              ...day,
              meals: day.meals.map((m, j) =>
                j === mi
                  ? {
                      ...m,
                      options: [
                        ...m.options,
                        { text: "", kcal: 0, protein: 0, carbs: 0, fat: 0, subType: null },
                      ],
                    }
                  : m,
              ),
            }
          : day,
      ),
    );
  }

  function removeOption(di: number, mi: number, oi: number) {
    setDays((d) =>
      d.map((day, i) =>
        i === di
          ? {
              ...day,
              meals: day.meals.map((m, j) =>
                j === mi ? { ...m, options: m.options.filter((_, k) => k !== oi) } : m,
              ),
            }
          : day,
      ),
    );
  }

  function patchOption(di: number, mi: number, oi: number, patch: Partial<TemplateOption>) {
    setDays((d) =>
      d.map((day, i) =>
        i === di
          ? {
              ...day,
              meals: day.meals.map((m, j) =>
                j === mi
                  ? {
                      ...m,
                      options: m.options.map((o, k) => (k === oi ? { ...o, ...patch } : o)),
                    }
                  : m,
              ),
            }
          : day,
      ),
    );
  }

  function moveDay(di: number, dir: -1 | 1) {
    setDays((d) => {
      const target = di + dir;
      if (target < 0 || target >= d.length) return d;
      const copy = [...d];
      [copy[di], copy[target]] = [copy[target], copy[di]];
      return copy;
    });
  }

  function moveMeal(di: number, mi: number, dir: -1 | 1) {
    setDays((d) =>
      d.map((day, i) => {
        if (i !== di) return day;
        const target = mi + dir;
        if (target < 0 || target >= day.meals.length) return day;
        const meals = [...day.meals];
        [meals[mi], meals[target]] = [meals[target], meals[mi]];
        return { ...day, meals };
      }),
    );
  }

  function save() {
    const fd = new FormData();
    fd.set("id", initial.id);
    fd.set("name", name.trim() || "Plantilla sin nombre");
    fd.set("description", description.trim());
    fd.set("notes", notes.trim());
    fd.set("supplementation", supplementation.trim());
    fd.set("structureJson", JSON.stringify({ days }));
    start(async () => {
      await saveCompetitionTemplate(fd);
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Metadatos de la plantilla */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-primary">
          Datos generales
        </h2>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-semibold">Nombre</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Hyrox · 6 semanas previas"
              className="mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold">Descripción</label>
            <span className="block text-xs text-muted">
              Para que el nutri sepa cuándo aplicarla. Aparece al elegir plantilla en el modal.
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Ej. Para Hyrox individual o dobles, 6 semanas previas con carga progresiva."
              className="mt-1.5 w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold">Observaciones</label>
              <span className="block text-xs text-muted">
                Se copian al plan del cliente al aplicar (no las pisa si el plan ya tenía).
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="mt-1.5 w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold">Suplementación</label>
              <span className="block text-xs text-muted">
                Productos + dosis recomendados para esta plantilla.
              </span>
              <textarea
                value={supplementation}
                onChange={(e) => setSupplementation(e.target.value)}
                rows={4}
                className="mt-1.5 w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Días con sus comidas y opciones */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-primary">Días</h2>
          <button
            type="button"
            onClick={addDay}
            className="flex items-center gap-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary"
          >
            <Plus size={12} /> Añadir día
          </button>
        </div>

        {days.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
            Esta plantilla no tiene días. Pulsa "Añadir día" para empezar.
          </p>
        ) : (
          days.map((day, di) => (
            <article key={di} className="rounded-2xl border border-border bg-surface">
              <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
                <input
                  value={day.name}
                  onChange={(e) => patchDay(di, { name: e.target.value })}
                  placeholder="Día tipo"
                  className="min-w-[140px] flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm font-semibold outline-none focus:border-primary"
                />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveDay(di, -1)}
                    disabled={di === 0}
                    className="rounded-md border border-border p-1 text-muted hover:border-primary disabled:opacity-30"
                    title="Subir"
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDay(di, 1)}
                    disabled={di === days.length - 1}
                    className="rounded-md border border-border p-1 text-muted hover:border-primary disabled:opacity-30"
                    title="Bajar"
                  >
                    <ChevronDown size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDay(di)}
                    className="rounded-md border border-border p-1 text-muted hover:border-red-300 hover:text-red-600"
                    title="Borrar día"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </header>

              <div className="space-y-3 px-4 py-4">
                {day.meals.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted">
                    Día sin comidas. Pulsa abajo para añadir la primera.
                  </p>
                ) : (
                  day.meals.map((meal, mi) => {
                    const composed = isComposedMealName(meal.name);
                    return (
                      <div key={mi} className="rounded-xl border border-border bg-bg/40 p-3">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {/* Input libre: escribe lo que quieras o pulsa una
                              sugerencia de abajo. Útil para WODs concretos
                              ("WOD 1: Run + Sled", "Semifinal Hyrox 11:30"). */}
                          <input
                            value={meal.name}
                            onChange={(e) => patchMeal(di, mi, { name: e.target.value })}
                            placeholder="Nombre (ej. Desayuno, WOD 1: Run + Sled…)"
                            className="min-w-[200px] flex-1 rounded-md border border-border bg-bg px-2 py-1 text-sm font-semibold outline-none focus:border-primary"
                          />
                          <div className="ml-auto flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveMeal(di, mi, -1)}
                              disabled={mi === 0}
                              className="rounded-md border border-border p-1 text-muted hover:border-primary disabled:opacity-30"
                              title="Subir"
                            >
                              <ChevronUp size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveMeal(di, mi, 1)}
                              disabled={mi === day.meals.length - 1}
                              className="rounded-md border border-border p-1 text-muted hover:border-primary disabled:opacity-30"
                              title="Bajar"
                            >
                              <ChevronDown size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeMeal(di, mi)}
                              className="rounded-md border border-border p-1 text-muted hover:border-red-300 hover:text-red-600"
                              title="Borrar comida"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>

                        {/* Chips de sugerencias rápidas para el nombre. */}
                        <div className="mb-2 flex flex-wrap gap-1">
                          {MEAL_NAME_SUGGESTIONS.map((s) => {
                            const active = meal.name.trim().toLowerCase() === s.toLowerCase();
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => patchMeal(di, mi, { name: s })}
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${
                                  active
                                    ? "border-primary bg-primary-soft text-primary"
                                    : "border-border text-muted hover:border-primary hover:text-primary"
                                }`}
                              >
                                {s}
                              </button>
                            );
                          })}
                        </div>

                        <div className="space-y-1.5">
                          {meal.options.map((opt, oi) => (
                            <div
                              key={oi}
                              className="flex flex-wrap items-start gap-1.5 rounded-lg bg-surface p-2"
                            >
                              {composed ? (
                                <select
                                  value={opt.subType ?? ""}
                                  onChange={(e) =>
                                    patchOption(di, mi, oi, {
                                      subType: e.target.value || null,
                                    })
                                  }
                                  className="rounded-md border border-border bg-bg px-2 py-1 text-[11px] font-semibold outline-none focus:border-primary"
                                  title="Subgrupo (intro/grasas/carbos/proteína/postre)"
                                >
                                  {SUB_TYPES.map((s) => (
                                    <option key={s.value} value={s.value}>
                                      {s.label}
                                    </option>
                                  ))}
                                </select>
                              ) : null}
                              <input
                                value={opt.text}
                                onChange={(e) =>
                                  patchOption(di, mi, oi, { text: e.target.value })
                                }
                                placeholder="Texto de la opción (ej. 120 g avena + 250 ml leche + 30 g whey + 1 plátano)"
                                className="min-w-[200px] flex-1 rounded-md border border-border bg-bg px-2 py-1 text-sm outline-none focus:border-primary"
                              />
                              <MacroInput
                                value={opt.kcal}
                                onChange={(v) => patchOption(di, mi, oi, { kcal: v })}
                                label="kcal"
                              />
                              <MacroInput
                                value={opt.protein}
                                onChange={(v) => patchOption(di, mi, oi, { protein: v })}
                                label="P"
                              />
                              <MacroInput
                                value={opt.carbs}
                                onChange={(v) => patchOption(di, mi, oi, { carbs: v })}
                                label="C"
                              />
                              <MacroInput
                                value={opt.fat}
                                onChange={(v) => patchOption(di, mi, oi, { fat: v })}
                                label="G"
                              />
                              <button
                                type="button"
                                onClick={() => removeOption(di, mi, oi)}
                                title="Borrar opción"
                                className="rounded-md p-1 text-muted hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addOption(di, mi)}
                            className="mt-1 flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[11px] font-semibold text-muted hover:border-primary hover:text-primary"
                          >
                            <Plus size={11} /> Añadir opción
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}

                <button
                  type="button"
                  onClick={() => addMeal(di)}
                  className="flex items-center gap-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-semibold text-text hover:border-primary hover:text-primary"
                >
                  <Plus size={12} /> Añadir comida
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      {/* Sticky de guardado */}
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-border bg-surface px-5 py-3 shadow-lg">
        {savedAt ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
            <Check size={13} /> Guardado{" "}
            {new Date(savedAt).toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        ) : null}
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg shadow-md hover:opacity-90 disabled:opacity-50"
        >
          {pending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Guardar plantilla
        </button>
      </div>
    </div>
  );
}

function MacroInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-1 rounded-md border border-border bg-bg px-1.5 py-0.5 text-[11px]">
      <span className="font-semibold text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value || ""}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        placeholder="0"
        className="w-12 bg-transparent text-right outline-none"
      />
    </label>
  );
}
