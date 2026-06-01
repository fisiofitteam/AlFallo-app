import "server-only";
import { kcalFromMacros, type Macros } from "@/lib/nutrition";

/**
 * Estimador de macros desde texto libre.
 *
 * Estrategia:
 *  1. Si hay ANTHROPIC_API_KEY configurada, llama a Claude Haiku (~$0.0002/llamada).
 *  2. Si Claude falla o no hay API key, usa el fallback determinista (FOOD_RULES)
 *     que mapea keywords ("pollo", "arroz") a macros por 100g — portado de Lovable.
 *
 * Devuelve siempre macros válidos y el campo `source` para que la UI pueda
 * indicar al nutri si la estimación es IA o aproximación local.
 */

export type MacroEstimateResult = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  source: "ai" | "fallback";
  notes?: string;
};

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

/** Fallback determinista: extrae "Xg <food>" y aplica reglas. */
export function estimateMacrosFallback(text: string): MacroEstimateResult {
  let p = 0, f = 0, c = 0;
  const lower = text.toLowerCase();

  // Detecta patrones "200g pollo", "100 g arroz" etc.
  const gramsRegex = /(\d+(?:[.,]\d+)?)\s*(?:g|gr|gramos|ml)\s*(?:de\s+)?([a-zA-Záéíóúñü\s]{2,50})/gi;
  for (const match of lower.matchAll(gramsRegex)) {
    const qty = Number(match[1].replace(",", "."));
    const food = match[2];
    if (!Number.isFinite(qty)) continue;
    const rule = FOOD_RULES.find((r) => r.keywords.some((k) => food.includes(k)));
    if (!rule) continue;
    p += (qty / 100) * rule.p;
    f += (qty / 100) * rule.f;
    c += (qty / 100) * rule.c;
  }

  // Huevos (cuenta por unidad ~50g cada uno)
  const eggMatches = [...lower.matchAll(/(\d+)\s*huev/g)];
  const eggs = eggMatches.reduce((acc, m) => acc + Number(m[1]), 0);
  if (eggs > 0) {
    p += eggs * 6;
    f += eggs * 5;
    c += eggs * 0.5;
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
  };
}

/** Llama a Anthropic Claude para estimar macros. Lanza si no hay API key o falla la llamada. */
async function estimateMacrosClaude(text: string): Promise<MacroEstimateResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("No ANTHROPIC_API_KEY");

  const SYSTEM = `Eres un nutricionista experto. Estimas macros de comidas para atletas de CrossFit/Hyrox.
Devuelves SIEMPRE un JSON exacto con esta forma:
{"protein": <gramos>, "carbs": <gramos>, "fat": <gramos>, "kcal": <kcal totales>}
Sin texto adicional. Sin markdown. Solo el JSON.
Sé realista: tienes que estimar macros TOTALES de la comida descrita (no por 100g).
Si la descripción no especifica cantidades, asume porciones normales de un atleta adulto.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
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
  const parsed = JSON.parse(jsonMatch[0]) as Partial<Macros>;

  const protein = round1(Number(parsed.protein) || 0);
  const carbs = round1(Number(parsed.carbs) || 0);
  const fat = round1(Number(parsed.fat) || 0);
  const kcal = Number(parsed.kcal) > 0 ? Math.round(Number(parsed.kcal)) : Math.round(kcalFromMacros(protein, carbs, fat));

  return { kcal, protein, carbs, fat, source: "ai" };
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
