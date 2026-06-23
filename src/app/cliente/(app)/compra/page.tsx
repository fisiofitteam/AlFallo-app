import Link from "next/link";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { FOOD_CATEGORY_OPTIONS } from "@/lib/nutrition";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Tu compra · Al Fallo" };
export const dynamic = "force-dynamic";

const WEEK_DAYS = 7;

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
  category: string;
};

type Item = {
  foodId: string | null;
  nameSnapshot: string;
  quantityG: number;
  subType: string | null;
  food: { category: string | null } | null;
  ingredients: unknown;
};

type Meal = { items: Item[] };
type Day = { meals: Meal[] };
type PlanLite = { id: string; name: string; days: Day[] };

/** Llave de aglomeración: nombre normalizado (lower + sin tildes + trim). */
function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Devuelve los ingredientes de un MealItem como array tipado. */
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
  // Sin desglose (legacy): no se puede aglomerar bien. Devolvemos vacío
  // para no contaminar la lista con líneas sin cantidad.
  return [];
}

type Acc = Map<string, IngredientShape>;

function addContribution(acc: Acc, ing: IngredientShape, qty: number) {
  const key = normalizeKey(ing.name);
  if (!key || qty <= 0) return;
  const existing = acc.get(key);
  if (existing) {
    existing.quantityG += qty;
  } else {
    acc.set(key, { name: ing.name, quantityG: qty, category: ing.category });
  }
}

/** Agrega los ingredientes de UNA comida en gramos POR SERVICIO. Reglas:
 *  - Si la comida es compuesta (opciones con subType), agrupamos por subType
 *    y promediamos dentro de cada subgrupo: el cliente elige 1 opción de cada
 *    subgrupo por día. Luego sumamos subgrupos para tener la comida completa.
 *  - Si es plana (sin subType), promediamos todas las opciones (el cliente
 *    elige 1 opción por día). */
function aggregateMealServing(items: Item[]): Acc {
  const result: Acc = new Map();
  if (items.length === 0) return result;

  // Agrupar por subType. "_flat" = sin subType.
  const groups = new Map<string, Item[]>();
  for (const it of items) {
    const key = it.subType ?? "_flat";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }

  for (const group of groups.values()) {
    const count = group.length;
    if (count === 0) continue;
    for (const item of group) {
      for (const ing of ingredientsOf(item)) {
        // contribución por servicio = cantidad / opciones del subgrupo
        addContribution(result, ing, ing.quantityG / count);
      }
    }
  }
  return result;
}

/** Cantidades SEMANALES por ingrediente para un plan. Trata cada día del
 *  plan como una rotación equivalente: si hay N días distintos, asumimos
 *  que el atleta los rota durante la semana → multiplicamos por 7/N. */
function aggregatePlanWeekly(plan: PlanLite): Acc {
  const dayTotals: Acc[] = [];
  for (const day of plan.days) {
    const dayAcc: Acc = new Map();
    for (const meal of day.meals) {
      const serving = aggregateMealServing(meal.items);
      for (const ing of serving.values()) {
        addContribution(dayAcc, ing, ing.quantityG);
      }
    }
    dayTotals.push(dayAcc);
  }
  if (dayTotals.length === 0) return new Map();

  // Promedio del día (asumiendo rotación uniforme) × 7.
  const factor = WEEK_DAYS / dayTotals.length;
  const weekly: Acc = new Map();
  for (const day of dayTotals) {
    for (const ing of day.values()) {
      addContribution(weekly, ing, ing.quantityG * factor);
    }
  }
  return weekly;
}

export default async function CompraPage() {
  const me = await requireOnboardedClient();
  const meRow = await prisma.client.findUnique({
    where: { id: me.id },
    select: { lastViewedPlanId: true },
  });

  // Todos los planes REGULARES (sin competición).
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
                  subType: true,
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

  const planList: PlanLite[] = plans.map((p) => ({
    id: p.id,
    name: p.name,
    days: p.days.map((d) => ({
      meals: d.meals.map((m) => ({ items: m.items as Item[] })),
    })),
  }));

  const totalItemsAcrossPlans = planList.reduce(
    (acc, p) => acc + p.days.reduce((a, d) => a + d.meals.reduce((b, m) => b + m.items.length, 0), 0),
    0,
  );

  if (planList.length === 0 || totalItemsAcrossPlans === 0) {
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
    planList.find((p) => p.id === meRow?.lastViewedPlanId) ?? planList[0];

  // 1) Cantidades del PRIMARY (semanales) ganan.
  const aggregated = aggregatePlanWeekly(primary);

  // 2) Resto de planes: añadir solo ingredientes nuevos.
  for (const plan of planList) {
    if (plan.id === primary.id) continue;
    const other = aggregatePlanWeekly(plan);
    for (const [key, ing] of other) {
      if (!aggregated.has(key)) aggregated.set(key, { ...ing });
    }
  }

  // Redondear a gramos enteros.
  for (const ing of aggregated.values()) {
    ing.quantityG = Math.round(ing.quantityG);
  }

  // Agrupar por categoría.
  const byCategory = new Map<string, IngredientShape[]>();
  for (const ing of aggregated.values()) {
    if (ing.quantityG <= 0) continue; // descartar ingredientes residuales tras redondeo
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

  const totalItems = Array.from(byCategory.values()).reduce((acc, l) => acc + l.length, 0);
  const hasMultiplePlans = planList.length > 1;

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
          Cantidades para <strong className="text-text">una semana</strong>
          {hasMultiplePlans ? (
            <>
              {" "}
              de <span className="font-semibold text-text">{primary.name}</span>. Incluye también
              alimentos de tus otros planes.
            </>
          ) : (
            <>
              {" "}
              · {totalItems} {totalItems === 1 ? "alimento" : "alimentos"}.
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
                  <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
                    {fmtQty(it.quantityG)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        Asumimos que rotas entre las opciones de cada comida. Cantidades aproximadas para 7 días.
      </p>
    </div>
  );
}
