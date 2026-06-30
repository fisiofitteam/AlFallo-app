import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import {
  listTemplates,
  TEMPLATE_SEXES,
  TEMPLATE_GOALS,
  TEMPLATE_SEX_LABELS,
  TEMPLATE_GOAL_LABELS,
  isTemplateSex,
  isTemplateGoal,
  type TemplateSex,
  type TemplateGoal,
} from "@/lib/nutritionTemplates";
import { createNutritionTemplate, deleteNutritionTemplate } from "./actions";

export const metadata = { title: "Plantillas nutricionales · Al Fallo" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: { sex?: string; goal?: string };
}) {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/");

  const activeSex: TemplateSex | undefined = isTemplateSex(searchParams.sex)
    ? searchParams.sex
    : undefined;
  const activeGoal: TemplateGoal | undefined = isTemplateGoal(searchParams.goal)
    ? searchParams.goal
    : undefined;

  const templates = await listTemplates({ sex: activeSex, goal: activeGoal });

  // Construimos la querystring para los botones de filtro respetando lo
  // que ya está activo.
  const qs = (next: { sex?: string; goal?: string }) => {
    const sp = new URLSearchParams();
    const sex = next.sex ?? activeSex ?? "";
    const goal = next.goal ?? activeGoal ?? "";
    if (sex) sp.set("sex", sex);
    if (goal) sp.set("goal", goal);
    const s = sp.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Plantillas nutricionales</h1>
          <p className="text-sm text-muted">
            Crea pautas tipo por sexo y objetivo. Al añadir un plan a un cliente, eliges la
            plantilla y se copia editable.
          </p>
        </div>
      </header>

      {/* Filtros: sexo */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted">Sexo</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/biblioteca/plantillas${qs({ sex: "" })}`}
            className={chipClass(!activeSex)}
          >
            Todos
          </Link>
          {TEMPLATE_SEXES.map((s) => (
            <Link
              key={s}
              href={`/biblioteca/plantillas${qs({ sex: s })}`}
              className={chipClass(activeSex === s)}
            >
              {TEMPLATE_SEX_LABELS[s]}
            </Link>
          ))}
        </div>
      </div>

      {/* Filtros: objetivo */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted">Objetivo</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/biblioteca/plantillas${qs({ goal: "" })}`}
            className={chipClass(!activeGoal)}
          >
            Todos
          </Link>
          {TEMPLATE_GOALS.map((g) => (
            <Link
              key={g}
              href={`/biblioteca/plantillas${qs({ goal: g })}`}
              className={chipClass(activeGoal === g)}
            >
              {TEMPLATE_GOAL_LABELS[g]}
            </Link>
          ))}
        </div>
      </div>

      {/* Crear plantilla. El form pide sexo + goal + name. Si el usuario
          ya tiene filtros activos pre-rellenamos para que sea un click. */}
      <NewTemplateForm defaultSex={activeSex} defaultGoal={activeGoal} />

      {/* Listado */}
      {templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          No hay plantillas con estos filtros. Crea la primera arriba.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <li key={t.id}>
              <article className="flex h-full flex-col rounded-2xl border border-border bg-surface p-4">
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold uppercase text-muted">
                    {TEMPLATE_SEX_LABELS[t.sex as TemplateSex] ?? t.sex}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {TEMPLATE_GOAL_LABELS[t.goal as TemplateGoal] ?? t.goal}
                  </span>
                </div>
                <h2 className="text-base font-bold leading-tight">{t.name}</h2>
                {t.description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{t.description}</p>
                ) : null}

                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <MacroPill label="Kcal" value={t.macros.kcal} />
                  <MacroPill label="P" value={t.macros.protein} suffix="g" />
                  <MacroPill label="C" value={t.macros.carbs} suffix="g" />
                  <MacroPill label="G" value={t.macros.fat} suffix="g" />
                </div>

                <div className="mt-auto flex items-center justify-between pt-3">
                  <Link
                    href={`/biblioteca/plantillas/${t.id}`}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:opacity-90"
                  >
                    Abrir →
                  </Link>
                  <form action={deleteNutritionTemplate}>
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      type="submit"
                      className="text-[11px] text-muted hover:text-red-600"
                      title="Borrar plantilla"
                    >
                      Borrar
                    </button>
                  </form>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function chipClass(active: boolean): string {
  return active
    ? "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-fg"
    : "rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted hover:border-primary hover:text-primary";
}

function MacroPill({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg bg-bg px-2 py-1">
      <p className="text-[10px] font-semibold uppercase text-muted">{label}</p>
      <p className="text-sm font-bold leading-tight">
        {value}
        {suffix ? <span className="text-[10px] text-muted">{suffix}</span> : null}
      </p>
    </div>
  );
}

/** Form de creación rápida. Server-side action, sin JS. Defaults vienen
 *  de los filtros activos para que sea un click rellenar. */
function NewTemplateForm({
  defaultSex,
  defaultGoal,
}: {
  defaultSex: TemplateSex | undefined;
  defaultGoal: TemplateGoal | undefined;
}) {
  return (
    <form
      action={createNutritionTemplate}
      className="rounded-2xl border border-border bg-surface p-4"
    >
      <p className="mb-3 text-sm font-semibold">Nueva plantilla</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto]">
        <label className="block text-xs">
          <span className="font-semibold text-muted">Sexo</span>
          <select
            name="sex"
            defaultValue={defaultSex ?? ""}
            required
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
          >
            <option value="" disabled>
              —
            </option>
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
            name="goal"
            defaultValue={defaultGoal ?? ""}
            required
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm"
          >
            <option value="" disabled>
              —
            </option>
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
            name="name"
            required
            placeholder="Ej. Plantilla hombre · Pérdida grasa · 2200 kcal"
            className="mt-1 w-full rounded-lg border border-border bg-bg px-2 py-1.5 text-sm outline-none focus:border-primary"
          />
        </label>
        <button
          type="submit"
          className="self-end rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-fg hover:opacity-90"
        >
          Crear y editar
        </button>
      </div>
    </form>
  );
}
