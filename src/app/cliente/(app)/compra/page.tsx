import Link from "next/link";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { FOOD_CATEGORY_OPTIONS } from "@/lib/nutrition";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Tu compra · Al Fallo" };
export const dynamic = "force-dynamic";

function categoryLabel(value: string | null | undefined): string {
  if (!value) return "Otros";
  return FOOD_CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? "Otros";
}

const CATEGORY_ORDER = [
  "proteina",
  "carbohidrato",
  "grasa",
  "verdura",
  "lacteo",
  "suplemento",
  "otro",
  "otros",
];

type IngredientShape = {
  name: string;
  category: string;
};

type Item = {
  foodId: string | null;
  nameSnapshot: string;
  food: { category: string | null } | null;
  ingredients: unknown;
};

/** Llave de aglomeración: nombre normalizado para de-duplicar "Avena",
 *  "avena", "AVENA " a la misma entrada. */
function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Devuelve los alimentos individuales de un MealItem. Items reales del
 *  banco → uno con sus datos. Items freestyle → la columna `ingredients`
 *  (la rellenan la IA y macroEstimator). Sin desglose disponible (legacy)
 *  los descartamos para no mostrar líneas con texto kilométrico. */
function ingredientsOf(item: Item): IngredientShape[] {
  if (item.foodId) {
    return [{ name: item.nameSnapshot, category: item.food?.category ?? "otros" }];
  }
  const raw = item.ingredients;
  if (Array.isArray(raw) && raw.length > 0) {
    const out: IngredientShape[] = [];
    for (const r of raw) {
      if (!r || typeof r !== "object") continue;
      const rec = r as Record<string, unknown>;
      const name = typeof rec.name === "string" ? rec.name.trim() : "";
      if (!name) continue;
      const category = typeof rec.category === "string" ? rec.category : "otro";
      out.push({ name, category });
    }
    return out;
  }
  return [];
}

export default async function CompraPage() {
  const me = await requireOnboardedClient();

  // Cargamos los items de todos los planes regulares (sin competición).
  // Todas las opciones cuentan: si el cliente puede rotar entre ellas, el
  // alimento debe estar en la lista.
  const plans = await prisma.nutritionPlan.findMany({
    where: { clientId: me.id, kind: { not: "competition" } },
    select: {
      name: true,
      days: {
        select: {
          meals: {
            select: {
              items: {
                select: {
                  foodId: true,
                  nameSnapshot: true,
                  food: { select: { category: true } },
                  ingredients: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const allItems: Item[] = plans.flatMap((p) =>
    p.days.flatMap((d) => d.meals.flatMap((m) => m.items)),
  );

  if (allItems.length === 0) {
    return (
      <ComingSoon
        icon={ShoppingCart}
        title="Tu compra"
        description="En cuanto tu nutricionista te asigne un plan, aquí tendrás tu lista de la compra calculada automáticamente."
      />
    );
  }

  // De-duplicamos por nombre normalizado y agrupamos por categoría.
  const byKey = new Map<string, IngredientShape>();
  for (const item of allItems) {
    for (const ing of ingredientsOf(item)) {
      const key = normalizeKey(ing.name);
      if (!key || byKey.has(key)) continue;
      byKey.set(key, ing);
    }
  }

  const byCategory = new Map<string, IngredientShape[]>();
  for (const ing of byKey.values()) {
    const cat = ing.category || "otros";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(ing);
  }
  for (const list of byCategory.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }
  const categories = Array.from(byCategory.keys()).sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });

  const totalItems = byKey.size;

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
          <ShoppingCart className="text-primary" size={26} />
          Tu compra
        </h1>
        <p className="mt-1 text-sm text-muted">
          {totalItems} {totalItems === 1 ? "alimento" : "alimentos"} en tu plan.
        </p>
      </header>

      <div className="space-y-4">
        {categories.map((cat) => (
          <section key={cat} className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">
              {categoryLabel(cat)}
            </h2>
            <ul className="divide-y divide-border">
              {byCategory.get(cat)!.map((it, i) => (
                <li key={i} className="py-2.5 text-sm font-medium capitalize">
                  {it.name}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
