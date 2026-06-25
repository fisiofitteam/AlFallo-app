import Link from "next/link";
import { ArrowLeft, ChefHat } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";

export const metadata = { title: "Recetas · Al Fallo" };
export const dynamic = "force-dynamic";

// Tipos de comida del recetario para el cliente, en plural. El orden de
// este array define el orden de los desplegables en la pantalla. "snack"
// (sin sufijo) se mantiene por compatibilidad con recetas antiguas: caen
// dentro de "Snack salado" como cajón de sastre (más probable de lo dos).
const MEAL_TYPES = [
  { values: ["snack_dulce"], label: "Snack dulce", emoji: "🍪" },
  { values: ["snack_salado", "snack"], label: "Snack salado", emoji: "🥨" },
  { values: ["desayuno"], label: "Desayunos", emoji: "🌅" },
  { values: ["comida"], label: "Comidas", emoji: "🍽" },
  { values: ["cena"], label: "Cenas", emoji: "🌙" },
  { values: ["postre"], label: "Postre", emoji: "🍰" },
  { values: [""], label: "Otras", emoji: "🍴" },
];

export default async function RecetasPage() {
  await requireOnboardedClient();

  const recipes = await prisma.recipe.findMany({
    orderBy: [{ mealType: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      mealType: true,
      imageUrl: true,
    },
  });

  if (recipes.length === 0) {
    return (
      <div className="pt-1">
        <Link
          href="/cliente"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
        >
          <ArrowLeft size={16} /> Inicio
        </Link>
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border p-12 text-center">
          <ChefHat size={32} className="text-muted" />
          <p className="mt-3 font-medium">Aún no hay recetas</p>
          <p className="mt-1 text-sm text-muted">Tu nutricionista las irá añadiendo.</p>
        </div>
      </div>
    );
  }

  // Agrupar por tipo de comida; cada grupo puede agrupar varios valores
  // (snack_salado + snack legacy → ambos caen en "Snack salado"). Los
  // valores nulos/vacíos van a "Otras".
  const grouped = MEAL_TYPES.map((g) => ({
    label: g.label,
    emoji: g.emoji,
    key: g.values.join("|"),
    items: recipes.filter((r) => g.values.includes(r.mealType ?? "")),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="pt-1">
      <Link
        href="/cliente"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
      >
        <ArrowLeft size={16} /> Inicio
      </Link>

      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <ChefHat className="text-primary" size={26} />
          Recetas
        </h1>
        <p className="mt-1 text-sm text-muted">
          {recipes.length} {recipes.length === 1 ? "receta" : "recetas"} del equipo, agrupadas por
          tipo de comida.
        </p>
      </header>

      <div className="space-y-6">
        {grouped.map((g) => (
          <section key={g.key}>
            <h2 className="mb-2 flex items-center gap-1.5 text-base font-bold">
              <span>{g.emoji}</span>
              <span>{g.label}</span>
              <span className="text-xs text-muted">({g.items.length})</span>
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {g.items.map((r) => (
                <Link
                  key={r.id}
                  href={`/cliente/recetas/${r.id}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition hover:border-primary"
                >
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.imageUrl}
                      alt={r.title}
                      className="aspect-square w-full object-cover transition group-hover:opacity-95"
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-primary-soft text-primary">
                      <ChefHat size={32} />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="line-clamp-2 text-sm font-semibold leading-tight">{r.title}</p>
                    {r.description ? (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">{r.description}</p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
