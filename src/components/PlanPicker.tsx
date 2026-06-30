"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, Check, X, Loader2, UtensilsCrossed, Trophy } from "lucide-react";

import { createPlan, deletePlan, renamePlan } from "@/app/(panel)/planes/actions";
import {
  TEMPLATE_SEXES,
  TEMPLATE_GOALS,
  TEMPLATE_SEX_LABELS,
  TEMPLATE_GOAL_LABELS,
  type TemplateSex,
  type TemplateGoal,
} from "@/lib/nutritionTemplateShape";

export type PlanPickerItem = { id: string; name: string; kind: string };
export type GoalOption = { value: string; label: string };
export type CompetitionTemplateOption = {
  id: string;
  name: string;
  description: string | null;
};
export type NutritionTemplateOption = {
  id: string;
  sex: string;
  goal: string;
  name: string;
  description: string | null;
  macros: { kcal: number; protein: number; carbs: number; fat: number };
};

/**
 * Barra superior de la pestaña Plan dentro de la ficha del cliente.
 * - Fila 1: selector de plan + renombrar/borrar + añadir.
 * - Fila opcional: aviso si el plan abierto es de competición.
 *
 * Cuando el nutri pulsa "Añadir plan", se abre AddPlanModal:
 *   · Pauta nutricional: elige una plantilla nutricional (sex/goal) → al
 *     crear el plan se COPIA la estructura de la plantilla al plan.
 *   · Plan de competición: elige una plantilla de competición.
 * Ya NO hay generación con IA al crear: la IA solo se usa en cliente para
 * recalcular macros de UNA opción al editar su texto.
 */
export function PlanPicker({
  clientId,
  plans,
  selectedPlanId,
  competitionTemplates,
  nutritionTemplates,
  defaultSex,
}: {
  clientId: string;
  plans: PlanPickerItem[];
  selectedPlanId: string | null;
  competitionTemplates: CompetitionTemplateOption[];
  nutritionTemplates: NutritionTemplateOption[];
  /** Sexo del cliente para sugerir filtro inicial en el selector de
   *  plantillas (puede ser null si no lo tienen rellenado). */
  defaultSex: string | null;
}) {
  const router = useRouter();
  const [, startNav] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);

  const selected = plans.find((p) => p.id === selectedPlanId) ?? plans[0] ?? null;

  function go(planId: string) {
    startNav(() => router.push(`/clientes/${clientId}?tab=plan&planId=${planId}`));
  }

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface">
      {/* Fila 1: selector + acciones del plan */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-4">
        <span className="text-sm font-medium text-muted">Plan:</span>

        {renaming && selected ? (
          <RenameInline
            planId={selected.id}
            current={selected.name}
            onDone={() => setRenaming(false)}
          />
        ) : (
          <>
            <select
              value={selected?.id ?? ""}
              onChange={(e) => go(e.target.value)}
              disabled={plans.length <= 1 && !selected}
              className="rounded-lg border border-border bg-bg px-3 py-1.5 text-sm font-semibold outline-none focus:border-primary disabled:opacity-60"
            >
              {plans.length === 0 ? (
                <option value="">— sin planes —</option>
              ) : (
                plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))
              )}
            </select>

            {selected ? (
              <>
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  title="Renombrar plan"
                  className="rounded-md border border-border p-1.5 text-muted hover:border-primary hover:text-text"
                >
                  <Pencil size={13} />
                </button>
                <form
                  action={async (fd) => {
                    if (
                      !confirm(
                        `¿Borrar el plan "${selected.name}"? Se eliminan todos sus días, comidas y opciones.`,
                      )
                    )
                      return;
                    await deletePlan(fd);
                  }}
                >
                  <input type="hidden" name="planId" value={selected.id} />
                  <button
                    type="submit"
                    title="Borrar plan"
                    className="rounded-md border border-border p-1.5 text-muted hover:border-red-300 hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </form>
              </>
            ) : null}
          </>
        )}

        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-semibold text-text hover:border-primary hover:text-primary"
          >
            <Plus size={12} /> Añadir plan
          </button>
        </div>
      </div>

      {/* Aviso si el plan abierto es de competición. */}
      {selected && selected.kind === "competition" ? (
        <div className="border-t border-border bg-amber-50 px-5 py-3 text-xs text-amber-800">
          🏆 Plan de competición — se gestiona desde su plantilla en{" "}
          <a
            href="/biblioteca/competicion"
            className="font-semibold underline"
            target="_blank"
            rel="noreferrer"
          >
            Biblioteca → Plantillas de competición
          </a>
          . Lo editas directamente en este builder.
        </div>
      ) : null}

      {adding ? (
        <AddPlanModal
          clientId={clientId}
          competitionTemplates={competitionTemplates}
          nutritionTemplates={nutritionTemplates}
          defaultSex={defaultSex}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </section>
  );
}

function RenameInline({
  planId,
  current,
  onDone,
}: {
  planId: string;
  current: string;
  onDone: () => void;
}) {
  const [pending, start] = useTransition();
  return (
    <form
      action={async (fd) => {
        const name = String(fd.get("name") ?? "").trim();
        if (name && name !== current) {
          start(async () => {
            await renamePlan(fd);
            onDone();
          });
        } else {
          onDone();
        }
      }}
      className="flex items-center gap-1"
    >
      <input type="hidden" name="planId" value={planId} />
      <input
        name="name"
        defaultValue={current}
        autoFocus
        required
        className="rounded-md border border-primary/50 bg-bg px-2 py-1 text-sm outline-none focus:border-primary"
      />
      <button
        type="submit"
        disabled={pending}
        title="Guardar"
        className="rounded-md p-1.5 text-white shadow-sm hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: "var(--c-primary)" }}
      >
        {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
      </button>
      <button
        type="button"
        onClick={onDone}
        title="Cancelar"
        className="rounded-md p-1.5 text-muted hover:bg-bg"
      >
        <X size={12} />
      </button>
    </form>
  );
}

/** Botón standalone "+ Añadir plan" + modal. Lo usa la galería de planes
 *  (PlanCards) cuando todavía no se ha entrado a ninguno. */
export function AddPlanButton({
  clientId,
  competitionTemplates,
  nutritionTemplates,
  defaultSex,
  variant = "primary",
}: {
  clientId: string;
  competitionTemplates: CompetitionTemplateOption[];
  nutritionTemplates: NutritionTemplateOption[];
  defaultSex: string | null;
  variant?: "primary" | "subtle";
}) {
  const [open, setOpen] = useState(false);
  const cls =
    variant === "primary"
      ? "flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition hover:opacity-90"
      : "flex items-center gap-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-semibold text-text hover:border-primary hover:text-primary";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cls}>
        <Plus size={variant === "primary" ? 16 : 12} /> Añadir plan
      </button>
      {open ? (
        <AddPlanModal
          clientId={clientId}
          competitionTemplates={competitionTemplates}
          nutritionTemplates={nutritionTemplates}
          defaultSex={defaultSex}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function AddPlanModal({
  clientId,
  competitionTemplates,
  nutritionTemplates,
  defaultSex,
  onClose,
}: {
  clientId: string;
  competitionTemplates: CompetitionTemplateOption[];
  nutritionTemplates: NutritionTemplateOption[];
  defaultSex: string | null;
  onClose: () => void;
}) {
  // Tipo de plan: pauta nutricional (default) o competición.
  const [kind, setKind] = useState<"regular" | "competition">("regular");
  const [name, setName] = useState("Plan nutricional");
  const [description, setDescription] = useState("");

  // Filtros del listado de plantillas nutricionales. Pre-seleccionamos el
  // sexo del cliente si la ficha lo tiene; el goal se deja en "todos".
  const initialSex: TemplateSex | "" =
    defaultSex === "hombre" || defaultSex === "mujer" ? defaultSex : "";
  const [filterSex, setFilterSex] = useState<TemplateSex | "">(initialSex);
  const [filterGoal, setFilterGoal] = useState<TemplateGoal | "">("");

  // Plantilla elegida. Para "regular" es de nutritionTemplates; para
  // "competition" es de competitionTemplates.
  const [nutritionTemplateId, setNutritionTemplateId] = useState("");
  const [competitionTemplateId, setCompetitionTemplateId] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const filteredNutrition = useMemo(() => {
    return nutritionTemplates.filter((t) => {
      if (filterSex && t.sex !== filterSex) return false;
      if (filterGoal && t.goal !== filterGoal) return false;
      return true;
    });
  }, [nutritionTemplates, filterSex, filterGoal]);

  // Regla de validación: para crear hace falta nombre + plantilla elegida.
  const canSubmit =
    name.trim().length > 0 &&
    ((kind === "regular" && nutritionTemplateId) ||
      (kind === "competition" && competitionTemplateId));

  function selectKind(next: "regular" | "competition") {
    setKind(next);
    if (next === "competition" && name === "Plan nutricional") setName("Plan de competición");
    if (next === "regular" && name === "Plan de competición") setName("Plan nutricional");
  }

  function submit() {
    if (!canSubmit) return;
    const fd = new FormData();
    fd.set("clientId", clientId);
    fd.set("name", name.trim());
    if (description.trim()) fd.set("description", description.trim());
    if (kind === "competition") {
      fd.set("kind", "competition");
      fd.set("competitionTemplateId", competitionTemplateId);
    } else {
      fd.set("kind", "regular");
      fd.set("nutritionTemplateId", nutritionTemplateId);
    }
    start(async () => {
      setError(null);
      const r = await createPlan(fd);
      if (!("ok" in r)) {
        setError(r?.error ?? "No se pudo crear el plan");
        return;
      }
      window.location.href = `/clientes/${r.clientId}?tab=plan&planId=${r.planId}`;
    });
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="font-semibold">Añadir plan</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-bg hover:text-text"
            title="Cerrar"
          >
            <X size={14} />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          {/* Tipo de plan */}
          <div>
            <span className="block text-sm font-semibold">Tipo de plan</span>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => selectKind("regular")}
                disabled={pending}
                className={`flex items-start gap-2 rounded-xl border p-3 text-left transition disabled:opacity-50 ${
                  kind === "regular"
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-bg hover:border-primary/60"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    kind === "regular"
                      ? "bg-primary text-primary-fg"
                      : "bg-primary-soft text-primary"
                  }`}
                >
                  <UtensilsCrossed size={16} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Pauta nutricional</span>
                  <span className="block text-[11px] leading-snug text-muted">
                    Eliges una plantilla por sexo + objetivo. Se copia al plan editable.
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => selectKind("competition")}
                disabled={pending}
                className={`flex items-start gap-2 rounded-xl border p-3 text-left transition disabled:opacity-50 ${
                  kind === "competition"
                    ? "border-amber-400 bg-amber-50"
                    : "border-border bg-bg hover:border-amber-300"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    kind === "competition"
                      ? "bg-amber-500 text-white"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <Trophy size={16} />
                </span>
                <span>
                  <span className="block text-sm font-semibold">Plan de competición</span>
                  <span className="block text-[11px] leading-snug text-muted">
                    Plan puntual para una prueba con plantilla específica.
                  </span>
                </span>
              </button>
            </div>
          </div>

          <label className="block">
            <span className="block text-sm font-semibold">Nombre del plan</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={kind === "competition" ? "Plan de competición" : "Plan nutricional"}
              className="mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-semibold">Descripción (la verá el cliente)</span>
            <span className="block text-xs text-muted">
              Frase corta para que el atleta entienda de qué va este plan. Opcional.
            </span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                kind === "competition"
                  ? "Ej. Carga 36-24h antes del Hyrox Madrid"
                  : "Ej. Semana de mañana — entrenas antes de comer"
              }
              className="mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>

          {/* Selector de plantilla — depende del tipo de plan. */}
          {kind === "regular" ? (
            <NutritionTemplatePicker
              templates={filteredNutrition}
              filterSex={filterSex}
              filterGoal={filterGoal}
              onFilterSex={setFilterSex}
              onFilterGoal={setFilterGoal}
              value={nutritionTemplateId}
              onChange={setNutritionTemplateId}
              allTemplatesCount={nutritionTemplates.length}
            />
          ) : (
            <CompetitionTemplatePicker
              templates={competitionTemplates}
              value={competitionTemplateId}
              onChange={setCompetitionTemplateId}
            />
          )}

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-lg border border-border bg-bg px-3 py-1.5 text-sm font-medium text-muted hover:border-primary hover:text-text"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit || pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : null}
            Crear plan
          </button>
        </footer>
      </div>
    </div>
  );
}

/** Picker de plantilla nutricional. Filtros por sexo + objetivo + listado
 *  con macros visibles. Selección por radio implícito (la card cambia de
 *  borde al click). */
function NutritionTemplatePicker({
  templates,
  filterSex,
  filterGoal,
  onFilterSex,
  onFilterGoal,
  value,
  onChange,
  allTemplatesCount,
}: {
  templates: NutritionTemplateOption[];
  filterSex: TemplateSex | "";
  filterGoal: TemplateGoal | "";
  onFilterSex: (v: TemplateSex | "") => void;
  onFilterGoal: (v: TemplateGoal | "") => void;
  value: string;
  onChange: (id: string) => void;
  allTemplatesCount: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg/40 p-3">
      <p className="text-sm font-semibold">
        Plantilla nutricional <span className="text-red-500">*</span>
      </p>
      <p className="text-xs text-muted">
        Filtra por sexo y objetivo. Se copia la estructura completa al plan editable.
      </p>

      {/* Filtros chips */}
      <div className="mt-3 space-y-2">
        <FilterRow
          label="Sexo"
          active={filterSex}
          options={TEMPLATE_SEXES.map((s) => ({ value: s, label: TEMPLATE_SEX_LABELS[s] }))}
          onChange={(v) => onFilterSex(v as TemplateSex | "")}
        />
        <FilterRow
          label="Objetivo"
          active={filterGoal}
          options={TEMPLATE_GOALS.map((g) => ({ value: g, label: TEMPLATE_GOAL_LABELS[g] }))}
          onChange={(v) => onFilterGoal(v as TemplateGoal | "")}
        />
      </div>

      {/* Listado */}
      <div className="mt-3 space-y-2">
        {allTemplatesCount === 0 ? (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Aún no hay plantillas nutricionales. Crea la primera en{" "}
            <a href="/biblioteca/plantillas" className="font-semibold underline">
              Biblioteca → Plantillas nutricionales
            </a>
            .
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-lg bg-bg px-3 py-2 text-xs text-muted">
            No hay plantillas con estos filtros. Cambia el sexo o el objetivo arriba.
          </div>
        ) : (
          templates.map((t) => {
            const active = value === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange(t.id)}
                className={`flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition ${
                  active
                    ? "border-primary bg-primary-soft"
                    : "border-border bg-surface hover:border-primary/60"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1">
                    <span className="inline-flex items-center rounded-full bg-bg px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">
                      {TEMPLATE_SEX_LABELS[t.sex as TemplateSex] ?? t.sex}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {TEMPLATE_GOAL_LABELS[t.goal as TemplateGoal] ?? t.goal}
                    </span>
                  </div>
                  <p className="text-sm font-semibold leading-tight">{t.name}</p>
                  {t.description ? (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">{t.description}</p>
                  ) : null}
                </div>
                <div className="text-right text-[11px] text-muted">
                  <p>
                    <strong className="text-sm text-text">{t.macros.kcal}</strong> kcal
                  </p>
                  <p>
                    P {t.macros.protein} · C {t.macros.carbs} · G {t.macros.fat}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function FilterRow({
  label,
  active,
  options,
  onChange,
}: {
  label: string;
  active: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-semibold uppercase text-muted">{label}</span>
      <button
        type="button"
        onClick={() => onChange("")}
        className={chipClass(!active)}
      >
        Todos
      </button>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={chipClass(active === o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function chipClass(active: boolean): string {
  return active
    ? "rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-primary-fg"
    : "rounded-full border border-border bg-bg px-2.5 py-0.5 text-[11px] font-medium text-muted hover:border-primary hover:text-primary";
}

function CompetitionTemplatePicker({
  templates,
  value,
  onChange,
}: {
  templates: CompetitionTemplateOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-semibold">
        Plantilla a aplicar <span className="text-red-500">*</span>
      </span>
      <span className="block text-xs text-muted">
        Se copia la estructura entera al plan del cliente. Las plantillas se gestionan en{" "}
        <strong>Biblioteca → Plantillas de competición</strong>.
      </span>
      {templates.length === 0 ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Aún no hay plantillas de competición. Crea la primera en{" "}
          <a href="/biblioteca/competicion" className="font-semibold underline">
            Biblioteca → Plantillas de competición
          </a>
          .
        </p>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1.5 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="">— Selecciona una plantilla —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.description ? ` — ${t.description}` : ""}
            </option>
          ))}
        </select>
      )}
    </label>
  );
}
