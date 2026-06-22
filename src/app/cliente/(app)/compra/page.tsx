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

// Etiqueta legible de la categoría.
function categoryLabel(value: string | null | undefined): string {
  if (!value) return "Otros";
  return FOOD_CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? "Otros";
}

// Orden visual de las categorías en la lista.
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

type Item = {
  foodId: string | null;
  nameSnapshot: string;
  quantityG: number;
  food: { category: string | null } | null;
};

type Agg = { name: string; totalG: number; category: string };

/** Suma los gramos de todos los items seleccionados del plan, agrupándolos
 *  por foodId (o por nombre normalizado cuando es freestyle). Devuelve el
 *  mapa para que el caller decida cómo combinarlo con otros planes. */
function aggregatePlanItems(items: Item[]): Map<string, Agg> {
  const agg = new Map<string, Agg>();
  for (const item of items) {
    const key = item.foodId ?? `name:${item.nameSnapshot.toLowerCase()}`;
    const cat = item.food?.category ?? "otros";
    const existing = agg.get(key);
    if (existing) {
      existing.totalG += item.quantityG;
    } else {
      agg.set(key, { name: item.nameSnapshot, totalG: item.quantityG, category: cat });
    }
  }
  return agg;
}

export default async function CompraPage() {
  const me = await requireOnboardedClient();

  // Cargamos al cliente para conocer su lastViewedPlanId.
  const meRow = await prisma.client.findUnique({
    where: { id: me.id },
    select: { lastViewedPlanId: true },
  });

  // Todos los planes REGULARES (sin competición). Solo items "selected": el
  // cliente solo compra lo que efectivamente come, no las opciones no elegidas.
  const plans = await prisma.nutritionPlan.findMany({
    where: { clientId: me.id, kind: { not: "competition" } },
    orderBy: { createdAt: "desc" },
    include: {
      days: {
        include: {
          meals: {
            include: {
              items: {
                where: { selected: true },
                select: {
                  foodId: true,
                  nameSnapshot: true,
                  quantityG: true,
                  food: { select: { category: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  // Aplanar items de cada plan a un solo array.
  const itemsByPlan = plans.map((p) => ({
    id: p.id,
    name: p.name,
    items: p.days.flatMap((d) => d.meals.flatMap((m) => m.items)),
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

  // Determinar el plan PRIMARY: el último que el cliente abrió en /cliente/plan.
  // Si ese plan ya no existe (o ya no es regular), caemos al más reciente.
  const primary =
    itemsByPlan.find((p) => p.id === meRow?.lastViewedPlanId) ?? itemsByPlan[0];

  // 1) Cantidades del PRIMARY → ganadoras.
  const aggregated = aggregatePlanItems(primary.items);

  // 2) Resto de planes: añadimos solo lo que NO esté ya. Si un alimento está
  //    en varios planes pero NO en el primary, usamos las cantidades del
  //    primer plan donde aparezca (orden createdAt desc).
  for (const plan of itemsByPlan) {
    if (plan.id === primary.id) continue;
    const otherAgg = aggregatePlanItems(plan.items);
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
                  <span className="font-medium">{it.name}</span>
                  <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
                    {fmtQty(it.totalG)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        {hasMultiplePlans
          ? "Cuando cambies de plan en tu app, las cantidades se actualizan al del plan que abras."
          : "Suma total de los alimentos de tu plan. Si cubre una semana, esta es tu lista semanal."}
      </p>
    </div>
  );
}
