import Link from "next/link";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { FOOD_CATEGORY_OPTIONS } from "@/lib/nutrition";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Tu compra · Al Fallo" };

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
  "otros", // por si llega sin categoría
];

export default async function CompraPage() {
  const me = await requireOnboardedClient();

  const plan = await prisma.nutritionPlan.findFirst({
    where: { clientId: me.id },
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
                },
              },
            },
          },
        },
      },
    },
  });

  if (!plan || plan.days.length === 0) {
    return (
      <ComingSoon
        icon={ShoppingCart}
        title="Tu compra"
        description="En cuanto tu nutricionista te asigne un plan, aquí tendrás tu lista de la compra calculada automáticamente."
      />
    );
  }

  // Agregar los alimentos del plan completo (suma de gramos por alimento).
  type Agg = { name: string; totalG: number; category: string };
  const aggregated = new Map<string, Agg>();
  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        const key = item.foodId ?? `name:${item.nameSnapshot.toLowerCase()}`;
        const cat = item.food?.category ?? "otros";
        const existing = aggregated.get(key);
        if (existing) {
          existing.totalG += item.quantityG;
        } else {
          aggregated.set(key, { name: item.nameSnapshot, totalG: item.quantityG, category: cat });
        }
      }
    }
  }

  // Agrupar por categoría.
  const byCategory = new Map<string, Agg[]>();
  for (const item of aggregated.values()) {
    const cat = item.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(item);
  }
  // Ordenar alfabéticamente cada grupo
  for (const list of byCategory.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }
  // Ordenar las categorías
  const categories = Array.from(byCategory.keys()).sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });

  const totalItems = aggregated.size;

  return (
    <div className="pt-1">
      <Link href="/cliente" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft size={16} /> Inicio
      </Link>

      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <ShoppingCart className="text-primary" size={26} />
          Tu compra
        </h1>
        <p className="mt-1 text-sm text-muted">
          Calculada a partir de tu plan <span className="text-text">{plan.name}</span> · {totalItems}{" "}
          {totalItems === 1 ? "alimento" : "alimentos"}.
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
        Suma total de los alimentos de tu plan completo. Si tu plan cubre una semana, esta es tu lista
        semanal; si cubre más días, divídelo según corresponda.
      </p>
    </div>
  );
}
