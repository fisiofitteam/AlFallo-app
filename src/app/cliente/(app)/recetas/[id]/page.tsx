import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChefHat } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";

export const metadata = { title: "Receta · Al Fallo" };
export const dynamic = "force-dynamic";

// Etiqueta humana del tipo de comida — coincide con el de la lista.
function mealTypeLabel(value: string | null | undefined): string {
  switch (value) {
    case "desayuno":
      return "🌅 Desayuno";
    case "comida":
      return "🍽 Comida";
    case "cena":
      return "🌙 Cena";
    case "snack":
      return "🥨 Snack";
    case "postre":
      return "🍰 Postre";
    default:
      return "";
  }
}

export default async function RecipeDetailPage({ params }: { params: { id: string } }) {
  await requireOnboardedClient();
  const r = await prisma.recipe.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      description: true,
      mealType: true,
      imageUrl: true,
      ingredients: true,
      instructions: true,
    },
  });
  if (!r) notFound();

  const tag = mealTypeLabel(r.mealType);

  return (
    <div className="pt-1">
      <Link
        href="/cliente/recetas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
      >
        <ArrowLeft size={16} /> Recetas
      </Link>

      {/* Hero: foto grande + título */}
      {r.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={r.imageUrl}
          alt={r.title}
          className="mb-4 max-h-80 w-full rounded-2xl border border-border object-cover"
        />
      ) : (
        <div className="mb-4 flex aspect-video w-full items-center justify-center rounded-2xl bg-primary-soft text-primary">
          <ChefHat size={48} />
        </div>
      )}

      <header className="mb-5">
        {tag ? (
          <span className="inline-block rounded-full bg-primary-soft px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            {tag}
          </span>
        ) : null}
        <h1 className="mt-2 text-2xl font-extrabold leading-tight">{r.title}</h1>
        {r.description ? (
          <p className="mt-1 text-sm text-muted">{r.description}</p>
        ) : null}
      </header>

      {r.ingredients.trim() ? (
        <section className="mb-5 rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">
            Ingredientes
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.ingredients}</p>
        </section>
      ) : null}

      {r.instructions.trim() ? (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">
            Preparación
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.instructions}</p>
        </section>
      ) : null}
    </div>
  );
}
