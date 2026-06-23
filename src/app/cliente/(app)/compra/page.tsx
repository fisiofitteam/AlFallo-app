import Link from "next/link";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { FOOD_CATEGORY_OPTIONS } from "@/lib/nutrition";
import { ComingSoon } from "@/components/coming-soon";
import {
  ShoppingChecklist,
  type ShoppingGroup,
} from "@/components/cliente/ShoppingChecklist";

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

/** Llave de aglomeración: nombre normalizado (lower + sin tildes + trim). */
function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parser de fallback para opciones de IA viejas que no tienen el array
 *  `ingredients` en BD. La IA siempre sigue el formato "120 g avena + 250 ml
 *  leche + 1 plátano". Partimos por "+" / "·" / ",", quitamos cantidades y
 *  unidades del principio, y nos quedamos con el nombre del alimento. */
function parseIngredientsFromText(text: string): IngredientShape[] {
  if (!text || !text.trim()) return [];
  const parts = text
    .split(/\s*[+·,]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: IngredientShape[] = [];
  for (const part of parts) {
    let s = part;
    // Fracciones "1/2", "1/4" al principio.
    s = s.replace(/^\s*\d+\s*\/\s*\d+\s*(?:de\s+)?/i, "");
    // Cantidad numérica + unidad opcional + "de" opcional.
    s = s.replace(
      /^\s*\d+(?:[.,]\d+)?\s*(?:g|gr|gramos|ml|kg|l|cl|cucharadas?|cdas?)?\s*(?:de\s+)?/i,
      "",
    );
    // Paréntesis al final (ej. "manzana (200 g)").
    s = s.replace(/\s*\(.*?\)\s*$/g, "").trim();
    if (s.length < 2) continue;
    out.push({ name: s, category: "otros" });
  }
  return out;
}

/** Devuelve los alimentos individuales de un MealItem. Orden de preferencia:
 *  1. Item real del banco (foodId).
 *  2. Array `ingredients` persistido por IA / macroEstimator nuevo.
 *  3. Parser del nameSnapshot (fallback para planes antiguos sin desglose). */
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
    if (out.length > 0) return out;
  }
  return parseIngredientsFromText(item.nameSnapshot);
}

export default async function CompraPage() {
  const me = await requireOnboardedClient();

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

  // De-duplicación por nombre normalizado, agrupación por categoría.
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

  const groups: ShoppingGroup[] = categories.map((cat) => ({
    categoryKey: cat,
    categoryLabel: categoryLabel(cat),
    items: byCategory.get(cat)!.map((ing) => ({
      name: ing.name,
      key: normalizeKey(ing.name),
    })),
  }));

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
          {totalItems} {totalItems === 1 ? "alimento" : "alimentos"} en tu plan. Marca los que ya
          tengas para no comprarlos otra vez.
        </p>
      </header>

      <ShoppingChecklist groups={groups} />
    </div>
  );
}
