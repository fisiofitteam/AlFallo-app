import { prisma } from "@/lib/prisma";
import { RecipesManager, type RecipeItem } from "@/components/RecipesManager";

export const metadata = { title: "Recetas · Biblioteca" };
export const dynamic = "force-dynamic";

export default async function RecetasTab() {
  const recipes = await prisma.recipe.findMany({
    orderBy: [{ mealType: "asc" }, { title: "asc" }],
    include: { createdBy: { select: { fullName: true } } },
  });

  const payload: RecipeItem[] = recipes.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    mealType: r.mealType,
    ingredients: r.ingredients,
    instructions: r.instructions,
    imageUrl: r.imageUrl,
    authorName: r.createdBy?.fullName ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  return <RecipesManager recipes={payload} />;
}
