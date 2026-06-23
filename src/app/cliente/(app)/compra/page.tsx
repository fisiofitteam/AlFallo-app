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

// Marcas habituales de supermercado que la IA mete a veces en el texto.
// Las quitamos al construir la key para que "muesli mercadona" y "muesli
// hacendado" colisionen con "muesli" y sean el mismo item en la lista.
const BRAND_TOKENS = [
  "mercadona",
  "lidl",
  "hacendado",
  "dia",
  "alcampo",
  "carrefour",
  "eroski",
  "aldi",
  "caprabo",
  "bonpreu",
  "consum",
];

// Descriptores que reducen variantes a su alimento base (a efectos de
// dedupe). No se muestran al cliente — solo se descuentan al hacer key.
const DESCRIPTOR_NOISE = [
  "azucares anadidos",
  "sin azucar",
  "sin azucares",
  "sin gluten",
  "sin lactosa",
  "sin sal",
  "bajo en sal",
  "alta en proteinas",
  "rico en proteinas",
  "proteico",
  "proteica",
  "light",
  "natural",
  "ecologico",
  "ecologica",
  "bio",
];

/** Llave de aglomeración: nombre fuertemente normalizado. Lower + sin tildes
 *  + sin números/% + sin marcas de super + sin descriptores de marketing.
 *  Así "Muesli crunchy 0%", "muesli crunchy 0% mercadona" y "muesli crunchy
 *  0% azúcares añadidos mercadona" producen la misma key. */
function normalizeKey(name: string): string {
  let s = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  // Porcentajes y números (con o sin "g", "ml"): "0%", "100 g", "5".
  s = s
    .replace(/\d+\s*%/g, "")
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:g|gr|gramos|ml|kg|l|cl)?\b/g, "");

  // Tokens de marca o descriptores ruidosos.
  for (const t of [...BRAND_TOKENS, ...DESCRIPTOR_NOISE]) {
    s = s.replace(new RegExp(`\\b${t}\\b`, "g"), "");
  }

  // Limpia residuos: signos y espacios múltiples.
  s = s.replace(/[%()/]/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Tokens de descripción de cocción/acompañamiento. Si un fragmento empieza
 *  por alguno de estos lo descartamos entero: viene de un split desafortunado
 *  y NO es un ingrediente real (ej. "a la plancha o al horno"). */
const NON_INGREDIENT_PREFIXES = [
  "a la ",
  "al ",
  "en ",
  "con ",
  "sin ",
  "o ",
  "y ",
];

function looksLikeNonIngredient(name: string): boolean {
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return NON_INGREDIENT_PREFIXES.some((p) => n.startsWith(p));
}

/** Recorta el método de cocción / acompañamiento del nombre, dejando solo
 *  el alimento base. "Pollo a la plancha o al horno" → "Pollo". También
 *  recorta participios típicos al final ("arroz blanco hervido" → "arroz
 *  blanco"). */
function stripCookingMethod(name: string): string {
  let s = name;
  // 1. Corta al primer trigger preposicional: "<comida> a la/al/en/con/sin …".
  //    Solo cuenta a partir del segundo carácter para no comernos el propio
  //    nombre si empezara por una de estas palabras (rarísimo, pero seguro).
  const triggers = /(?:\s+|,\s*)(?:a la|al|en|con|sin)\s/i;
  const m = s.match(triggers);
  if (m && m.index !== undefined && m.index > 0) {
    s = s.slice(0, m.index);
  }
  // 2. Corta participio típico de cocción al final: cocido, asado, frito,
  //    salteado, hervido, horneado, gratinado, rehogado, marinado, ahumado,
  //    guisado, escalfado, braseado, aliñado, plancheado.
  s = s.replace(
    /\s+(?:cocid|asad|frit|saltead|hervid|hornead|gratinad|rehogad|marinad|ahumad|guisad|escalfad|brasead|alinad|plancheado|plancheado)[oa]s?$/i,
    "",
  );
  // 3. Limpia residuos de puntuación y espacios.
  return s.replace(/[\s,.;:]+$/g, "").trim();
}

// Palabras de "instrucción" o "comentario" — si aparecen dentro de un
// fragmento, este viene de un texto explicativo de la IA (no es un
// ingrediente) y se descarta entero. La IA escribe cosas como "puedes
// añadir sirope o canela" o "esto es la opción ideal postentreno".
const INSTRUCTION_TOKENS = [
  "puede",
  "puedes",
  "anade",
  "anadir",
  "anadid",
  "ideal",
  "opcion",
  "opciones",
  "perfect",
  "recomend",
  "preferible",
  "alternativ",
  "sustituy",
  "cambia",
  "varia",
  "elige",
  "preentreno",
  "postentreno",
  "pre entreno",
  "post entreno",
  "pre-entreno",
  "post-entreno",
  "esto es",
  "este es",
  "esta es",
  "ten en cuenta",
  "consejo",
  "nota",
  "tip",
];

function isInstruction(text: string): boolean {
  const n = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return INSTRUCTION_TOKENS.some((t) => n.includes(t));
}

// Texto que es SOLO un verbo de cocción suelto (sin alimento delante).
// Surge tras split por " o " ("frito o hervido" → "frito" y "hervido").
const COOKING_ONLY_RE =
  /^(?:fritos?|fritas?|asados?|asadas?|cocidos?|cocidas?|salteados?|salteadas?|hervidos?|hervidas?|horneados?|horneadas?|gratinados?|gratinadas?|rehogados?|rehogadas?|marinados?|marinadas?|ahumados?|ahumadas?|guisados?|guisadas?|escalfados?|escalfadas?|braseados?|braseadas?|alinados?|alinadas?|plancheados?|plancheadas?)$/i;

function isCookingMethodOnly(text: string): boolean {
  const n = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return COOKING_ONLY_RE.test(n);
}

/** Parser de fallback para opciones de IA viejas que no tienen el array
 *  `ingredients` en BD. Pipeline:
 *   1. Split del texto por "+" "·" ","   →  fragmentos.
 *   2. Cada fragmento que parezca INSTRUCCIÓN ("puedes añadir…") se descarta.
 *   3. Cada fragmento se subdivide por " o " (alternativas: "patata o boniato"
 *      son dos items).
 *   4. Cada subitem: quitar cantidad/unidad/fracción/paréntesis, recortar
 *      método de cocción, filtrar prefijos no-alimento y palabras sueltas
 *      de cocción ("frito" pelado), filtrar longitud (2-60 chars). */
function parseIngredientsFromText(text: string): IngredientShape[] {
  if (!text || !text.trim()) return [];

  const chunks = text
    .split(/\s*[+·,]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  const out: IngredientShape[] = [];
  for (const chunk of chunks) {
    if (isInstruction(chunk)) continue;
    if (looksLikeNonIngredient(chunk)) continue;

    const alternatives = chunk.split(/\s+o\s+/i);
    for (const alt of alternatives) {
      let s = alt;
      // Fracciones "1/2", "1/4" al principio.
      s = s.replace(/^\s*\d+\s*\/\s*\d+\s*(?:de\s+)?/i, "");
      // Cantidad numérica + unidad opcional + "de" opcional.
      s = s.replace(
        /^\s*\d+(?:[.,]\d+)?\s*(?:g|gr|gramos|ml|kg|l|cl|cucharadas?|cdas?)?\s*(?:de\s+)?/i,
        "",
      );
      // Paréntesis al final (ej. "manzana (200 g)").
      s = s.replace(/\s*\(.*?\)\s*$/g, "").trim();

      if (s.length < 2 || s.length > 60) continue;
      if (looksLikeNonIngredient(s)) continue;
      if (isInstruction(s)) continue;
      if (isCookingMethodOnly(s)) continue;

      s = stripCookingMethod(s);
      if (s.length < 2) continue;
      if (looksLikeNonIngredient(s)) continue;
      if (isCookingMethodOnly(s)) continue;

      out.push({ name: s, category: "otros" });
    }
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

  // De-duplicación por nombre normalizado. Al colisionar, mantenemos el
  // NOMBRE MÁS CORTO entre los duplicados (suele ser el más limpio:
  // "muesli crunchy" gana frente a "muesli crunchy 0% azúcares añadidos
  // mercadona"). Para la categoría, ganamos si la existente es "otros" y
  // la nueva trae categoría real.
  const byKey = new Map<string, IngredientShape>();
  for (const item of allItems) {
    for (const ing of ingredientsOf(item)) {
      const key = normalizeKey(ing.name);
      if (!key) continue;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, ing);
        continue;
      }
      const shorterName =
        ing.name.length < existing.name.length ? ing.name : existing.name;
      const betterCategory =
        existing.category === "otros" && ing.category !== "otros"
          ? ing.category
          : existing.category;
      byKey.set(key, { name: shorterName, category: betterCategory });
    }
  }

  // Subsunción: si una key SUELTA es prefijo (con límite de palabra) de otra
  // más larga, eliminamos la suelta. "pechuga" se va a favor de "pechuga de
  // pollo"; "queso" a favor de "queso fresco". Solo aplicamos a keys de UNA
  // sola palabra para no perder casos legítimos tipo "yogur natural" vs
  // "yogur natural griego".
  {
    const keys = Array.from(byKey.keys());
    for (const a of keys) {
      if (a.includes(" ")) continue; // solo keys de 1 palabra
      const subsumedBy = keys.find((b) => b !== a && b.startsWith(a + " "));
      if (subsumedBy) byKey.delete(a);
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
