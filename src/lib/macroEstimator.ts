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
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, n) * 10) / 10;
}

/** Convierte a número tolerando el patrón "expression string" que a veces
 *  devuelve Sonnet en el input de una tool ("120*380/100 + 30*380/100").
 *  Si es número, lo devuelve. Si es string con SOLO dígitos, espacios,
 *  puntos, comas y operadores + - * / ( ), evalúa la expresión. Rechaza
 *  cualquier otra cosa (no ejecuta código arbitrario). */
function toNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v !== "string") return 0;
  const trimmed = v.trim();
  if (!trimmed) return 0;
  // Caso simple: string que ya representa un número.
  const asNum = Number(trimmed.replace(",", "."));
  if (Number.isFinite(asNum)) return asNum;
  // Caso Sonnet perezoso: expresión aritmética. Whitelist estricta.
  if (!/^[\d\s+\-*/().,]+$/.test(trimmed)) return 0;
  try {
    const normalized = trimmed.replace(/,/g, ".");
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${normalized});`)();
    return Number.isFinite(result) ? Number(result) : 0;
  } catch {
    return 0;
  }
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

/** Llama a Anthropic Claude para estimar macros. Lanza si no hay API key o falla la llamada.
 *
 *  IMPLEMENTACIÓN 2026-07: tool_choice forzado + temperature 0. Esto hace
 *  que la estimación sea prácticamente determinista — dos llamadas con el
 *  mismo texto devuelven los mismos números, y pequeños cambios (bajar
 *  90g → 80g de avena) escalan proporcionalmente sin saltos raros.
 *
 *  Además inyecta el BRIEF DE MACROS del equipo (/biblioteca/brief-macros):
 *  notas + adjuntos Excel/CSV/PDF con tablas de equivalencias. La IA lo
 *  usa como referencia PRIORITARIA para los alimentos que aparezcan en
 *  ellos. Los adjuntos estables se cachean con prompt caching. */
async function estimateMacrosClaude(text: string): Promise<MacroEstimateResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("No ANTHROPIC_API_KEY");

  // Cargamos el brief de macros para meterlo como contexto estable en el
  // system prompt (cacheable). Si no hay brief o falla la carga, seguimos
  // sin él — mejor estimar sin brief que romper.
  const briefBlocks = await loadMacroBriefBlocks();

  const BRIEF_INSTRUCTION = briefBlocks.hasBrief
    ? `\n\n⛔ FUENTE DE VERDAD PRIORITARIA — BRIEF DE MACROS DEL EQUIPO:
Antes de estimar, LEE el brief y sus adjuntos (arriba en este system + PDFs en el user message). Si el alimento aparece en las tablas del brief, usa EXACTAMENTE los macros del brief — ganan sobre la tabla de referencia rápida de abajo. Solo para alimentos que NO estén en el brief, tira de la tabla de referencia y de BEDCA/USDA.`
    : "";

  const SYSTEM = `Eres un nutricionista experto y meticuloso con los números. Estimas macros de comidas para atletas de CrossFit/Hyrox usando tablas nutricionales estándar (BEDCA, USDA).${BRIEF_INSTRUCTION}${briefBlocks.notesBlock}${briefBlocks.textAttachmentsBlock}

Tu ÚNICA salida es llamar a la tool submit_estimate con los macros calculados.

REGLAS DE PRECISIÓN (críticas):
1. Calcula ingrediente a ingrediente. Multiplica (gramos / 100) por la tabla de referencia y suma. NO estimes a ojo el total.
2. Las kcal DEBEN cuadrar con la fórmula 4·proteína + 9·grasa + 4·carbos. Si tras sumar no cuadran, has hecho mal alguna cifra intermedia → recalcula esa cifra ANTES de llamar a la tool.
3. Convierte ml de líquidos a gramos (250 ml leche → 250 g) y unidades a gramos estándar:
   · 1 huevo M → 50 g
   · 1 plátano mediano → 120 g
   · 1 manzana → 200 g
   · 1 yogur natural → 125 g
   · 1 rebanada de pan → 30 g
4. Macros TOTALES de la comida descrita (no por 100 g). Si falta cantidad de algún alimento, asume ración estándar de atleta adulto (100 g proteína, 60 g fruta, 30 g grasa).
5. DETERMINISMO: si un ingrediente se repite en dos llamadas distintas, usa EXACTAMENTE los mismos macros por 100 g. No introduzcas variabilidad "clínica".
6. FORMATO DE LOS NÚMEROS (crítico): protein, carbs, fat y kcal DEBEN ser NÚMEROS ya calculados y sumados. Ejemplo correcto: kcal: 720. Ejemplo INCORRECTO: kcal: "120*380/100 + 250*47/100 + 30*380/100". Haz tú las multiplicaciones y sumas MENTALMENTE antes de llamar a la tool y entrega solo el número final. Si dudas del cálculo, hazlo paso a paso en tu cabeza y solo entrega el total.

En "ingredients" desglosa cada alimento individual con su cantidad en gramos. Categorías válidas: proteina | carbohidrato | grasa | verdura | lacteo | suplemento | otro.

Tabla de referencia rápida (kcal/100 g):
- avena: 380 (P13, C66, G7)
- leche semi: 47 (P3.3, C5, G1.6)
- whey: 380 (P75, C8, G6)
- plátano: 89 (P1, C23, G0.3)
- pollo pechuga: 110 (P23, C0, G1.5)
- pavo pechuga: 105 (P22, C0, G1.5)
- ternera magra: 190 (P26, C0, G9)
- salmón: 210 (P20, C0, G14)
- atún natural: 130 (P29, C0, G1)
- arroz cocido: 130 (P3, C28, G0.3)
- pasta cocida: 160 (P5, C31, G1)
- patata cocida: 85 (P2, C19, G0.1)
- boniato: 90 (P2, C21, G0.1)
- pan: 260 (P9, C50, G3)
- huevo entero: 155 (P13, C1, G11)
- clara: 50 (P11, C1, G0)
- aguacate: 160 (P2, C9, G15)
- aceite oliva: 900 (P0, C0, G100)
- yogur natural: 60 (P4, C5, G3)
- yogur griego: 130 (P9, C4, G10)
- queso curado: 400 (P25, C1, G33)
- almendras: 580 (P21, C22, G50)
- lentejas cocidas: 115 (P9, C20, G0.4)
- garbanzos cocidos: 120 (P8, C22, G1.5)
- brócoli: 34 (P3, C7, G0.4)`;

  const estimateTool = {
    name: "submit_estimate",
    description: "Entrega la estimación de macros calculada.",
    input_schema: {
      type: "object",
      required: ["protein", "carbs", "fat", "kcal"],
      properties: {
        protein: { type: "number", description: "gramos totales" },
        carbs: { type: "number", description: "gramos totales" },
        fat: { type: "number", description: "gramos totales" },
        kcal: { type: "number", description: "kcal totales, coherentes con 4·P + 9·G + 4·C" },
        ingredients: {
          type: "array",
          items: {
            type: "object",
            required: ["name", "quantityG"],
            properties: {
              name: { type: "string" },
              quantityG: { type: "number" },
              category: {
                type: "string",
                description: "proteina|carbohidrato|grasa|verdura|lacteo|suplemento|otro",
              },
            },
          },
        },
      },
    },
  };

  // System como array con cache_control ephemeral: el brief cambia poco;
  // dos llamadas seguidas dentro de 5 min pagan ~10% por estos tokens.
  const systemBlocks = [
    {
      type: "text",
      text: SYSTEM,
      cache_control: { type: "ephemeral" as const },
    },
  ];

  // El user content lleva los PDFs del brief (bloques document) + el texto
  // de la opción a estimar. Los PDFs se cargan una vez y aprovechan cache.
  const userContent: unknown =
    briefBlocks.pdfBlocks.length > 0
      ? [...briefBlocks.pdfBlocks, { type: "text", text }]
      : text;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      // temperature 0 = máxima consistencia. Dos llamadas con el mismo
      // texto devuelven los mismos números (o casi, hay ligera aleatoriedad
      // interna de sampling que Anthropic no elimina totalmente).
      temperature: 0,
      system: systemBlocks,
      messages: [{ role: "user", content: userContent }],
      tools: [estimateTool],
      // tool_choice forzado: el modelo DEBE llamar submit_estimate → no
      // puede responder por texto ni razonar en voz alta.
      tool_choice: { type: "tool", name: "submit_estimate" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Claude API ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; name?: string; input?: unknown }>;
  };
  const toolBlock = data.content?.find(
    (c) => c.type === "tool_use" && c.name === "submit_estimate",
  );
  if (!toolBlock || !toolBlock.input) {
    throw new Error("Claude no llamó a submit_estimate");
  }
  const parsed = toolBlock.input as Partial<Macros> & { ingredients?: unknown };

  // Sonnet a veces devuelve los campos numéricos como STRING con la fórmula
  // literal ("120*380/100 + 250*47/100 + …") en vez de resolverla. El
  // schema JSON dice `number` pero tool_use no lo valida strict, y el
  // string pasa. Number("…") = NaN → macros a 0. Salvaguarda: si viene
  // string, evaluamos la expresión aritmética (solo dígitos y operadores).
  const protein = round1(toNumber(parsed.protein));
  const carbs = round1(toNumber(parsed.carbs));
  const fat = round1(toNumber(parsed.fat));

  // Validación de coherencia 4-9-4. Si el modelo devolvió kcal que no cuadra
  // con los macros (a veces los suma mal o se inventa el total), forzamos
  // el valor derivado de la fórmula. Margen 15% para tolerar redondeos
  // razonables sin descartar respuestas válidas.
  const derivedKcal = Math.round(kcalFromMacros(protein, carbs, fat));
  const kcalNum = toNumber(parsed.kcal);
  const reportedKcal = kcalNum > 0 ? Math.round(kcalNum) : 0;
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

/** Bloques del brief de macros del equipo para inyectar en la llamada:
 *   · notesBlock: string con las notas escritas por el nutri (o "").
 *   · textAttachmentsBlock: string con el texto extraído de Excel/CSV/TXT.
 *   · pdfBlocks: array de bloques `document` con los PDF en base64 para
 *     el user message (Claude los lee nativos).
 *   · hasBrief: bandera para saber si añadir la instrucción de prioridad.
 *
 *  Si el brief no existe o falla la descarga, devuelve todo vacío y el
 *  estimador sigue funcionando con solo la tabla de referencia interna. */
async function loadMacroBriefBlocks(): Promise<{
  notesBlock: string;
  textAttachmentsBlock: string;
  pdfBlocks: Array<{
    type: "document";
    source: { type: "base64"; media_type: "application/pdf"; data: string };
    title?: string;
  }>;
  hasBrief: boolean;
}> {
  try {
    const { getMacroBrief } = await import("@/lib/macroBrief");
    const { fetchAttachmentContent } = await import("@/lib/macroBriefContent");
    const brief = await getMacroBrief();

    const hasNotes = !!(brief.notes && brief.notes.trim().length > 0);
    const hasAttachments = brief.attachments.length > 0;
    if (!hasNotes && !hasAttachments) {
      return { notesBlock: "", textAttachmentsBlock: "", pdfBlocks: [], hasBrief: false };
    }

    const notesBlock = hasNotes
      ? `\n\n=== NOTAS DEL BRIEF DE MACROS ===\n${brief.notes!.trim()}`
      : "";

    const textParts: string[] = [];
    const pdfBlocks: Array<{
      type: "document";
      source: { type: "base64"; media_type: "application/pdf"; data: string };
      title?: string;
    }> = [];

    for (const att of brief.attachments) {
      const content = await fetchAttachmentContent(att);
      if (!content) continue;
      if (content.kind === "pdf") {
        pdfBlocks.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: content.base64 },
          title: att.name,
        });
      } else {
        textParts.push(`\n\n[ADJUNTO · ${att.name}]\n${content.text}`);
      }
    }
    const textAttachmentsBlock = textParts.length > 0
      ? `\n\n=== TABLAS DEL BRIEF (adjuntos texto/Excel/CSV) ===${textParts.join("")}`
      : "";

    return {
      notesBlock,
      textAttachmentsBlock,
      pdfBlocks,
      hasBrief: hasNotes || textParts.length > 0 || pdfBlocks.length > 0,
    };
  } catch (e) {
    console.warn("[macroEstimator] loadMacroBriefBlocks failed:", (e as Error).message);
    return { notesBlock: "", textAttachmentsBlock: "", pdfBlocks: [], hasBrief: false };
  }
}

/** El nutri usa "/" para dar alternativas equivalentes del mismo alimento
 *  ("150 g pollo / pavo", "120 g avena / muesli"). SOLO la primera opción
 *  debe contar para los macros — la segunda es un intercambio para el
 *  atleta. Aquí strippeamos "/ <palabra>" antes de mandar el texto al
 *  estimador (IA o fallback). El texto original que el atleta ve NO se
 *  toca — este filtro solo aplica al input del cálculo.
 *
 *  Regla: elimina "/" seguido de la próxima palabra (hasta el siguiente
 *  espacio o separador +,.). Encadenables: "pollo / pavo / ternera" →
 *  "pollo". */
export function stripSlashAlternatives(text: string): string {
  let out = text;
  // Repetimos hasta que no queden slashes — así "/pavo / ternera" cae en
  // dos pasadas y no requiere regex greedy inseguro.
  for (let i = 0; i < 5; i++) {
    const next = out.replace(/\s*\/\s*[^+,.\/\s][^+,.\/\s]*/g, "");
    if (next === out) break;
    out = next;
  }
  return out;
}

/** Entrada principal: intenta IA y cae a fallback si falla. Nunca lanza. */
export async function estimateMacros(text: string): Promise<MacroEstimateResult> {
  const cleaned = stripSlashAlternatives(text.trim()).slice(0, 500);
  if (!cleaned) {
    return { kcal: 0, protein: 0, carbs: 0, fat: 0, source: "fallback", notes: "Texto vacío" };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const ai = await estimateMacrosClaude(cleaned);
      // Defensa: si Claude devuelve macros = 0 con texto no vacío, es una
      // respuesta rara. En vez de aceptarlos y dejar la opción a 0 en la
      // UI, tiramos del fallback determinista para al menos dar algo.
      if (ai.kcal === 0 && ai.protein === 0 && ai.carbs === 0 && ai.fat === 0) {
        console.warn("[macroEstimator] Claude devolvió todo 0 con texto no vacío, usando fallback:", cleaned);
        return estimateMacrosFallback(cleaned);
      }
      return ai;
    } catch (e) {
      console.warn("[macroEstimator] Claude failed, using fallback:", (e as Error).message);
    }
  }
  return estimateMacrosFallback(cleaned);
}
