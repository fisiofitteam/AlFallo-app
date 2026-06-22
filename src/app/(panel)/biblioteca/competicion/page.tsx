import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Pencil, Trophy, Trash2 } from "lucide-react";
import { requireProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import { getAllCompetitionTemplates } from "@/lib/competitionTemplates";
import { createCompetitionTemplate, deleteCompetitionTemplate } from "./actions";

export const metadata = { title: "Plantillas de competición · Biblioteca" };
export const dynamic = "force-dynamic";

function countDaysAndMeals(structure: { days: { meals: unknown[] }[] }) {
  const days = structure.days.length;
  const meals = structure.days.reduce((acc, d) => acc + d.meals.length, 0);
  return { days, meals };
}

export default async function CompetitionTemplatesPage() {
  const prof = await requireProfessional();
  if (!isManager(prof.role)) redirect("/biblioteca");

  const templates = await getAllCompetitionTemplates();

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Trophy className="text-amber-500" size={26} />
            Plantillas de competición
          </h1>
          <p className="mt-1 text-muted">
            Estos planes los aplica el nutri tal cual al atleta y los ajusta después. La IA no toca
            los planes de competición.
          </p>
        </div>
        <form action={createCompetitionTemplate}>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition hover:opacity-90"
          >
            <Plus size={16} /> Nueva plantilla
          </button>
        </form>
      </header>

      {templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Trophy size={32} className="mx-auto text-muted" />
          <p className="mt-3 font-medium">Aún no hay plantillas de competición</p>
          <p className="mt-1 text-sm text-muted">
            Crea la primera con "Nueva plantilla" — luego rellena días, comidas y opciones.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => {
            const counts = countDaysAndMeals(t.structure);
            return (
              <article
                key={t.id}
                className="group flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:border-primary"
              >
                <Link
                  href={`/biblioteca/competicion/${t.id}`}
                  className="flex-1 min-w-0"
                >
                  <p className="truncate text-base font-bold hover:text-primary">{t.name}</p>
                  {t.description ? (
                    <p className="mt-0.5 truncate text-sm text-muted">{t.description}</p>
                  ) : null}
                  <p className="mt-1.5 text-xs text-muted">
                    {counts.days} {counts.days === 1 ? "día" : "días"} · {counts.meals}{" "}
                    {counts.meals === 1 ? "comida" : "comidas"}
                  </p>
                </Link>
                <Link
                  href={`/biblioteca/competicion/${t.id}`}
                  title="Editar"
                  className="rounded-lg border border-border p-2 text-muted opacity-0 transition group-hover:opacity-100 hover:border-primary hover:text-primary"
                >
                  <Pencil size={14} />
                </Link>
                <form action={deleteCompetitionTemplate}>
                  <input type="hidden" name="id" value={t.id} />
                  <button
                    type="submit"
                    title="Borrar plantilla"
                    className="rounded-lg border border-border p-2 text-muted opacity-0 transition group-hover:opacity-100 hover:border-red-300 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </form>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
