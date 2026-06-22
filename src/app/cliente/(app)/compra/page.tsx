import Link from "next/link";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { FOOD_CATEGORY_OPTIONS } from "@/lib/nutrition";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Tu compra · Al Fallo" };
export const dynamic = "force-dynamic";

// Formato bonito de cantidad: 850 g, 1,2 kg, etc.
function fmtQty(grams: number): string {
  if (grams >= 1000) {
    const kg = grams / 1000;
    return `${kg.toFixed(kg >= 10 ? 0 : 1).replace(".", ",")} kg`;
  }
  return `${Math.round(grams)} g`;
}

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
  quantityG: number;
  category?: string | null;
};

type Item = {
  foodId: string | null;
  nameSnapshot: string;
  quantityG: number;
  food: { category: string | null } | null;
  ingredients: unknown;
};

type Agg = { name: string; totalG: number; category: string };

/** Devuelve los ingredientes de un MealItem como array tipado. Si el item
 *  apunta a un FoodLibrary real (foodId), genera un ingrediente único con
 *  el nombre/categoría/cantidad reales. Si es freestyle, lee la columna
 *  `ingredients` (la rellenan IA y macroEstimator) — si está vacía, cae a
 *  un único "ingrediente" con la opción entera (legacy de plans antiguos). */
function ingredientsOf(item: Item): IngredientShape[] {
  if (item.foodId) {
    return [
      {
        name: item.nameSnapshot,
        quantityG: item.quantityG,
        category: item.food?.category ?? "otros",
      },
    ];
  }
  const raw = item.ingredients;
  if (Array.isArray(raw) && raw.length > 0) {
    const out: IngredientShape[] = [];
    for (const r of raw) {
      if (!r || typeof r !== "object") continue;
      const rec = r as Record<string, unknown>;
      const name = typeof rec.name === "string" ? rec.name.trim() : "";
      const qty = Number(rec.quantityG);
      if (!name || !Number.isFinite(qty) || qty <= 0) continue;
      const category = typeof rec.category === "string" ? rec.category : "otro";
      out.push({ name, quantityG: qty, category });
    }
    if (out.length > 0) return out;
  }
  // Sin desglose: lo mostramos como una sola línea con el texto entero,
  // sin cantidad fiable. Esto es lo que pasaba antes para todas las opciones.
  return [{ name: item.nameSnapshot, quantityG: 0, category: "otros" }];
}

/** Llave de aglomeración: nombre normalizado (lower + sin tildes ni espacios
 *  extra). De-duplica "Avena", "avena", "AVENA " a la misma entrada. */
function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function aggregateItemsToMap(items: Item[]): Map<string, Agg> {
  const agg = new Map<string, Agg>();
  for (const item of items) {
    for (const ing of ingredientsOf(item)) {
      const key = normalizeKey(ing.name);
      if (!key) continue;
      const existing = agg.get(key);
      if (existing) {
        existing.totalG += ing.quantityG;
      } else {
        agg.set(key, {
          name: ing.name,
          totalG: ing.quantityG,
          category: ing.category ?? "otros",
        });
      }
    }
  }
  return agg;
}

export default async function CompraPage() {
  const me = await requireOnboardedClient();
  const meRow = await prisma.client.findUnique({
    where: { id: me.id },
    select: { lastViewedPlanId: true },
  });

  // Todos los planes REGULARES (sin competición). Incluimos TODAS las
  // opciones (no filtramos `selected`): el cliente puede rotar y la lista
  // debe cubrirlas todas.
  const plans = await prisma.nutritionPlan.findMany({
    where: { clientId: me.id, kind: { not: "competition" } },
    orderBy: { createdAt: "desc" },
    include: {
      days: {
        include: {
          meals: {
            include: {
              items: {
                select: {
                  foodId: true,
                  nameSnapshot: true,
                  quantityG: true,
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

  const itemsByPlan = plans.map((p) => ({
    id: p.id,
    name: p.name,
    items: p.days.flatMap((d) => d.meals.flatMap((m) => m.items)) as Item[],
  }));
  const totalItemsAcrossPlans = itemsByPlan.reduce((acc, p) => acc + p.items.length, 0);

  if (plans.length === 0 || totalItemsAcrossPlans === 0) {
    return (
      <ComingSoon
        icon={ShoppingCart}
        title="Tu compra"
        description="En cuanto tu nutricionista te asigne un plan, aquí tendrás tu lista de la compra calculada automáticamente."
      />
    );
  }

  // Plan PRIMARY: el último que el cliente abrió. Si no, el más reciente.
  const primary =
    itemsByPlan.find((p) => p.id === meRow?.lastViewedPlanId) ?? itemsByPlan[0];

  // 1) Cantidades del PRIMARY ganan.
  const aggregated = aggregateItemsToMap(primary.items);

  // 2) Resto de planes: añadimos solo los ingredientes que NO estén ya.
  for (const plan of itemsByPlan) {
    if (plan.id === primary.id) continue;
    const otherAgg = aggregateItemsToMap(plan.items);
    for (const [key, value] of otherAgg) {
      if (!aggregated.has(key)) aggregated.set(key, value);
    }
  }

  // Agrupar por categoría y ordenar.
  const byCategory = new Map<string, Agg[]>();
  for (const item of aggregated.values()) {
    const cat = item.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(item);
  }
  for (const list of byCategory.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }
  const categories = Array.from(byCategory.keys()).sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });

  const totalItems = aggregated.size;
  const hasMultiplePlans = plans.length > 1;

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
          {hasMultiplePlans ? (
            <>
              Cantidades de <span className="font-semibold text-text">{primary.name}</span> (tu plan
              más reciente). Incluye también alimentos de tus otros planes.
            </>
          ) : (
            <>
              Calculada a partir de tu plan{" "}
              <span className="font-semibold text-text">{primary.name}</span> · {totalItems}{" "}
              {totalItems === 1 ? "alimento" : "alimentos"}.
            </>
          )}
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
                <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-medium capitalize">{it.name}</span>
                  {it.totalG > 0 ? (
                    <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
                      {fmtQty(it.totalG)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        {hasMultiplePlans
          ? "Cuando cambies de plan en tu app, las cantidades se actualizan al del plan que abras."
          : "Suma de TODAS las opciones del plan. Si rotas entre ellas, te sirve sin más."}
      </p>
    </div>
  );
}
