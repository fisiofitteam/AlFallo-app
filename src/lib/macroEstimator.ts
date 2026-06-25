import "server-only";
import { kcalFromMacros, type Macros } from "@/lib/nutrition";

/**
 * Estimador de macros desde texto libre.
 *
 * Estrategia:
 *  1. Si hay ANTHROPIC_API_KEY configurada, llama a Claude Sonnet 4.6
 *     (más preciso que Haiku para estimaciones nutricionales; coste mayor
 *     pero diferencia notable en la calidad de los números).
 *  2. Si Claude falla o no hay API key, usa el fallback determinista
 *     (FOOD_RULES) que mapea keywords ("pollo", "arroz") a macros por 100g.
 *
 * Tras recibir la respuesta de la IA, validamos coherencia 4-9-4
 * (kcal = 4*proteína + 9*grasa + 4*carbos). Si el modelo se inventa kcal
 * que no cuadra con los macros, lo recalculamos por la fórmula clásica
 * en vez de fiarnos del número devuelto.
 *
 * Devuelve siempre macros válidos y el campo `source` para que la UI pueda
 * indicar al nutri si la estimación es IA o aproximación local.
 */

/** Ingrediente individual desglosado del texto. Igual que en planGenerator. */
export type EstimatedIngredient = {
  name: string;
  quantityG: number;
  category?: string;
};

export type MacroEstimateResult = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  source: "ai" | "fallback";
  notes?: string;
  /** Desglose de alimentos (vacío si no se pudo determinar). Alimenta la
   *  lista de la compra del cliente. */
  ingredients?: EstimatedIngredient[];
};

const ALLOWED_CATEGORIES = [
  "proteina",
  "carbohidrato",
  "grasa",
  "verdura",
  "lacteo",
  "suplemento",
  "otro",
];

type FoodRule = {
  keywords: string[];
  p: number; // proteína por 100 g
  f: number; // grasa por 100 g
  c: number; // carbo por 100 g
};

// Reglas determinísticas portadas de Lovable (función estimate-macros).
// Macros por 100 g. Si una palabra clave del texto encaja, se aplica a la
// cantidad detectada en gramos.
const FOOD_RULES: FoodRule[] = [
  { keywords: ["pollo", "pavo", "ternera", "atun", "atún", "merluza", "lubina", "dorada", "salmon", "salmón", "sepia", "calamar", "pescado"], p: 22, f: 5, c: 0 },
  { keywords: ["arroz", "pasta", "avena", "pan", "tortita", "patata", "boniato", "noquis", "fajita", "wrap"], p: 8, f: 2, c: 55 },
  { keywords: ["yogur", "yogurt", "leche", "queso fresco", "cottage"], p: 8, f: 4, c: 6 },
  { keywords: ["hummus", "legumbre", "garbanzo", "lenteja", "alubia"], p: 8, f: 10, c: 20 },
  { keywords: ["aguacate", "frutos secos", "almendra", "nuez", "cacahuete", "aove", "aceite oliva"], p: 3, f: 45, c: 10 },
  { keywords: ["fruta", "piña", "kiwi", "platano", "plátano", "manzana", "pera", "fresa", "uva", "sandia"], p: 1, f: 0, c: 16 },
  { keywords: ["verdura", "ensalada", "lechuga", "espinaca", "brocoli", "brócoli", "tomate", "pepino", "calabacin"], p: 2, f: 0, c: 5 },
];

function round1(n: number): number {
  return Math.round(Math.max(0, n) * 10) / 10;
}

/** Categoría aproximada para una keyword: usamos los pesos relativos de la
 *  regla para clasificar al alimento (proteína dominante → "proteina", etc.). */
function categoryFromRule(rule: FoodRule): string {
  // Pesos relativos para decidir la categoría.
  const max = Math.max(rule.p * 4, rule.c * 4, rule.f * 9);
  if (rule.f * 9 === max) return "grasa";
  if (rule.p * 4 === max) return "proteina";
  if (rule.c * 4 === max) return "carbohidrato";
  return "otro";
}

/** Fallback determinista: extrae "Xg <food>" y aplica reglas. */
export function estimateMacrosFallback(text: string): MacroEstimateResult {
  let p = 0, f = 0, c = 0;
  const lower = text.toLowerCase();
  const ingredients: EstimatedIngredient[] = [];

  // Detecta patrones "200g pollo", "100 g arroz" etc.
  const gramsRegex = /(\d+(?:[.,]\d+)?)\s*(?:g|gr|gramos|ml)\s*(?:de\s+)?([a-zA-Záéíóúñü\s]{2,50})/gi;
  for (const match of lower.matchAll(gramsRegex)) {
    const qty = Number(match[1].replace(",", "."));
    const food = match[2].trim().replace(/[+,.]$/, "").trim();
    if (!Number.isFinite(qty)) continue;
    const rule = FOOD_RULES.find((r) => r.keywords.some((k) => food.includes(k)));
    if (!rule) {
      // Sin regla todavía añadimos el ingrediente (sin macros pero con
      // cantidad — sirve para la lista de la compra).
      ingredients.push({ name: food.slice(0, 60), quantityG: Math.round(qty), category: "otro" });
      continue;
    }
    p += (qty / 100) * rule.p;
    f += (qty / 100) * rule.f;
    c += (qty / 100) * rule.c;
    ingredients.push({
      name: food.slice(0, 60),
      quantityG: Math.round(qty),
      category: categoryFromRule(rule),
    });
  }

  // Huevos (cuenta por unidad ~50g cada uno)
  const eggMatches = [...lower.matchAll(/(\d+)\s*huev/g)];
  const eggs = eggMatches.reduce((acc, m) => acc + Number(m[1]), 0);
  if (eggs > 0) {
    p += eggs * 6;
    f += eggs * 5;
    c += eggs * 0.5;
    ingredients.push({ name: "huevo", quantityG: eggs * 50, category: "proteina" });
  }

  // Si no se detectó nada, devuelve algo razonable como mínimo
  if (p + f + c < 3) {
    p = 25; f = 10; c = 35;
  }

  p = round1(p); f = round1(f); c = round1(c);
  return {
    kcal: Math.round(kcalFromMacros(p, c, f)),
    protein: p,
    carbs: c,
    fat: f,
    source: "fallback",
    notes: "Estimación aproximada (sin IA). Revisa y ajusta si hace falta.",
    ingredients: ingredients.length > 0 ? ingredients : undefined,
  };
}

/** Llama a Anthropic Claude para estimar macros. Lanza si no hay API key o falla la llamada. */
async function estimateMacrosClaude(text: string): Promise<MacroEstimateResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("No ANTHROPIC_API_KEY");

  const SYSTEM = `Eres un nutricionista experto y meticuloso con los números. Estimas macros de comidas para atletas de CrossFit/Hyrox usando tablas nutricionales estándar (BEDCA, USDA).

Devuelves SIEMPRE un JSON exacto con esta forma:
{
  "protein": <gramos totales>,
  "carbs": <gramos totales>,
  "fat": <gramos totales>,
  "kcal": <kcal totales>,
  "ingredients": [
    { "name": "<alimento>", "quantityG": <gramos>, "category": "<categoria>" }
  ]
}
Sin texto adicional. Sin markdown. Solo el JSON.

REGLAS DE PRECISIÓN (críticas):
1. Calcula MENTALMENTE ingrediente a ingrediente, sumando al final. NO redondees a ojo el total.
2. Las kcal DEBEN cuadrar con la fórmula 4·proteína + 9·grasa + 4·carbos. Si no cuadran, has hecho mal alguna cifra → recalcula.
3. Convierte ml de líquidos a gramos (250 ml leche → 250 g) y unidades a gramos estándar (1 huevo M → 50 g, 1 plátano mediano → 120 g, 1 manzana → 200 g, 1 yogur natural → 125 g).
4. Macros TOTALES de la comida descrita (no por 100 g). Si falta cantidad, asume ración estándar de atleta adulto.

En "ingredients" desglosa cada alimento individual con su cantidad en gramos. Categorías válidas: proteina | carbohidrato | grasa | verdura | lacteo | suplemento | otro.

Ejemplos de referencia rápidos (kcal/100 g):
- avena: 380 (P13, C66, G7)
- leche semi: 47 (P3.3, C5, G1.6)
- whey: 380 (P75, C8, G6)
- plátano: 89 (P1, C23, G0.3)
- pollo pechuga: 110 (P23, C0, G1.5)
- arroz cocido: 130 (P3, C28, G0.3)
- huevo entero: 155 (P13, C1, G11)
- aguacate: 160 (P2, C9, G15)
- yogur natural: 60 (P4, C5, G3)`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      // Subido de Haiku a Sonnet 4.6: notablemente más preciso con números
      // pequeños (macros). Latencia ~2-4 s y coste ~10x mayor que Haiku,
      // pero merece la pena por la fiabilidad del cálculo.
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: SYSTEM,
      messages: [{ role: "user", content: text }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Claude API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const reply = data.content?.find((c) => c.type === "text")?.text ?? "";
  // Busca el JSON en la respuesta (por si Claude añade algo)
  const jsonMatch = reply.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude no devolvió JSON parseable");
  const parsed = JSON.parse(jsonMatch[0]) as Partial<Macros> & { ingredients?: unknown };

  const protein = round1(Number(parsed.protein) || 0);
  const carbs = round1(Number(parsed.carbs) || 0);
  const fat = round1(Number(parsed.fat) || 0);

  // Validación de coherencia 4-9-4. Si el modelo devolvió kcal que no cuadra
  // con los macros (a veces los suma mal o se inventa el total), forzamos
  // el valor derivado de la fórmula. Margen 15% para tolerar redondeos
  // razonables sin descartar respuestas válidas.
  const derivedKcal = Math.round(kcalFromMacros(protein, carbs, fat));
  const reportedKcal = Number(parsed.kcal) > 0 ? Math.round(Number(parsed.kcal)) : 0;
  let kcal = derivedKcal;
  if (reportedKcal > 0 && derivedKcal > 0) {
    const ratio = reportedKcal / derivedKcal;
    if (ratio >= 0.85 && ratio <= 1.15) {
      // Cuadra dentro del margen: confiamos en el reportado del modelo
      // (suele estar redondeado de forma más natural).
      kcal = reportedKcal;
    } else {
      // Discrepancia grande: el modelo se equivocó en el total. Usamos
      // el derivado de macros para mantener coherencia interna.
      kcal = derivedKcal;
    }
  }

  // Sanitización de ingredients: filtramos lo inválido y limitamos a 12.
  const ingredients: EstimatedIngredient[] = [];
  if (Array.isArray(parsed.ingredients)) {
    for (const ing of parsed.ingredients) {
      if (!ing || typeof ing !== "object") continue;
      const r = ing as Record<string, unknown>;
      const name = String(r.name ?? "").trim().slice(0, 80);
      if (!name) continue;
      const qty = Number(r.quantityG);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const rawCat = typeof r.category === "string" ? r.category : "";
      const category = ALLOWED_CATEGORIES.includes(rawCat) ? rawCat : "otro";
      ingredients.push({ name, quantityG: Math.round(qty), category });
      if (ingredients.length >= 12) break;
    }
  }

  return {
    kcal,
    protein,
    carbs,
    fat,
    source: "ai",
    ingredients: ingredients.length > 0 ? ingredients : undefined,
  };
}

/** Entrada principal: intenta IA y cae a fallback si falla. Nunca lanza. */
export async function estimateMacros(text: string): Promise<MacroEstimateResult> {
  const cleaned = text.trim().slice(0, 500);
  if (!cleaned) {
    return { kcal: 0, protein: 0, carbs: 0, fat: 0, source: "fallback", notes: "Texto vacío" };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await estimateMacrosClaude(cleaned);
    } catch (e) {
      console.warn("[macroEstimator] Claude failed, using fallback:", (e as Error).message);
    }
  }
  return estimateMacrosFallback(cleaned);
}
