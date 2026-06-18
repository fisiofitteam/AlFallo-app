import "server-only";
import { kcalFromMacros } from "@/lib/nutrition";

/**
 * Generador de plan nutricional inicial con IA.
 *
 * A diferencia de Harris-Benedict (que solo calcula los objetivos y crea
 * placeholders), aquí la IA escribe el contenido real de cada opción
 * con alimentos concretos y cantidades en gramos.
 *
 * Estructura devuelta: 1 día tipo (entreno) con 5 comidas fijas
 * (desayuno, media_manana, comida, merienda, cena) y 3 OPCIONES por
 * comida. Cada opción es un menú completo, sus macros suman lo previsto
 * para esa comida, y las 3 opciones de una misma comida tienen macros
 * equivalentes entre sí (para que el atleta elija una).
 *
 * El prompt incluye el brief de /biblioteca/brief-ia (filosofía,
 * alimentos preferidos, equivalencias, ejemplos…). Los PDFs adjuntos
 * del brief van como content blocks document; Excel/CSV se inyectan
 * como texto en el system prompt. Eso lo orquesta el caller
 * (generateWithClaude).
 *
 * Si no hay ANTHROPIC_API_KEY o Claude falla, devolvemos un fallback
 * razonable con 3 opciones por comida para que el nutri no se quede
 * sin nada.
 */

const MEAL_NAMES = ["desayuno", "media_manana", "comida", "merienda", "cena"] as const;
type MealName = (typeof MEAL_NAMES)[number];

const DAY_TYPES = ["entreno", "descanso", "mixto"] as const;

export type GeneratedOption = {
  text: string;
  protein: number;
  carbs: number;
  fat: number;
  kcal: number;
  // Solo presente en comida/cena: subgrupo combinable
  // (intro|grasas|carbos|proteina|postre). Para otras comidas es null.
  subType?: string | null;
};

const COMPOSED_SUBTYPES = ["intro", "grasas", "carbos", "proteina", "postre"] as const;
export type GeneratedMeal = { name: MealName; options: GeneratedOption[] };
export type GeneratedDay = {
  name: string;
  dayType: (typeof DAY_TYPES)[number];
  meals: GeneratedMeal[];
};
export type GeneratedPlan = {
  days: GeneratedDay[];
  source: "ai" | "fallback";
  /** Texto para la card de Observaciones del plan. Lo escribe la IA cuando
   *  está disponible; en modo fallback es un placeholder genérico. */
  notes?: string;
  /** Texto para la card de Suplementación del plan. Lo escribe la IA con la
   *  propuesta basada en el brief + ficha del cliente. Vacío si la IA no
   *  lo devolvió y en fallback. */
  supplementation?: string;
};

export type PlanContext = {
  clientName: string;
  sex: string | null;
  birthDate: Date | null;
  heightCm: number | null;
  weightKg: number | null;
  weeklyFrequency: number | null;
  level: string | null;
  boxName: string | null;
  goal: string | null;
  targetWeightKg: number | null;
  dietaryStyle: string | null;
  allergies: string[];
  intolerances: string[];
  dislikes: string[];
  medicalConditions: string | null;
  medication: string | null;
  kcalTraining: number | null;
  proteinTraining: number | null;
  carbsTraining: number | null;
  fatTraining: number | null;
  /** IDs de las SpecialConsideration marcadas en la ficha del cliente. */
  specialConsiderationIds?: string[];

  /** Si el plan es de competición, el contexto pegado por el nutri
   * (WODs, horarios, fecha del evento). En este modo se fuerza el brief
   * de 'rendimiento' como goal-specific, ignorando el objetivo del cliente. */
  competitionContext?: string | null;
  competitionName?: string | null;

  /** Instrucciones escritas por el nutri al añadir el plan: peticiones
   *  concretas para la IA (énfasis, alimentos a forzar, presentación, etc.). */
  userInstructions?: string | null;
};

function ageFromBirthDate(d: Date | null): number | null {
  if (!d) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

function buildUserPrompt(ctx: PlanContext): string {
  const age = ageFromBirthDate(ctx.birthDate);
  const list = (xs: string[]) => (xs.length ? xs.join(", ") : "—");
  return `Diseña UN DÍA TIPO de plan nutricional para este atleta.

CLIENTE
Nombre: ${ctx.clientName}
Edad: ${age ?? "no indicada"} · Sexo: ${ctx.sex ?? "no indicado"}
Altura: ${ctx.heightCm ? ctx.heightCm + " cm" : "no indicada"} · Peso: ${ctx.weightKg ? ctx.weightKg + " kg" : "no indicado"}

DEPORTE
Box / gimnasio: ${ctx.boxName ?? "—"}
Nivel: ${ctx.level ?? "—"} · Días entrenando/semana: ${ctx.weeklyFrequency ?? "—"}

OBJETIVO
Meta: ${ctx.goal ?? "no indicada"}${ctx.targetWeightKg ? " · Peso objetivo: " + ctx.targetWeightKg + " kg" : ""}

RESTRICCIONES (RESPÉTALAS ESTRICTAMENTE)
- Estilo dietético: ${ctx.dietaryStyle ?? "omnívoro"}
- Alergias: ${list(ctx.allergies)}
- Intolerancias: ${list(ctx.intolerances)}
- No quiere comer: ${list(ctx.dislikes)}
- Condiciones médicas: ${ctx.medicalConditions ?? "—"}
- Medicación: ${ctx.medication ?? "—"}

OBJETIVOS DIARIOS DE MACROS (día de entreno)
${ctx.kcalTraining ?? "?"} kcal · ${ctx.proteinTraining ?? "?"} g P · ${ctx.carbsTraining ?? "?"} g C · ${ctx.fatTraining ?? "?"} g G

INSTRUCCIONES
- Devuelve EXACTAMENTE 1 día (name "Día tipo", dayType "entreno").
- 5 comidas en este orden: desayuno, media_manana, comida, merienda, cena.
- Para "desayuno", "media_manana" y "merienda": 3 OPCIONES intercambiables; cada opción es UN MENÚ COMPLETO con alimentos y cantidades en gramos. Las 3 opciones con macros similares entre sí (±10%). No uses "subType" en estas.
- Para "comida" y "cena": en lugar de opciones planas, devuelve opciones agrupadas por "subType" (campo obligatorio) con la siguiente distribución:
    * intro    → 1 opción  (verduras / ensalada / gazpacho / entrante ligero)
    * grasas   → 3-4 opciones (cada una un ALIMENTO graso suelto a elegir: hummus, aguacate, queso, frutos secos, AOVE en cantidad…)
    * carbos   → 4-5 opciones (cada una un ALIMENTO con la ración: 120 g arroz integral cocido, 120 g pasta, 120 g quinoa, 150 g legumbres, 180 g patata…)
    * proteina → 4-5 opciones (cada una una proteína con la ración: 155 g pollo, 170 g ternera, 200 g pescado azul, 210 g pescado blanco, tofu…)
    * postre   → 1 opción (fruta de temporada normalmente)
  El atleta combinará 1 opción de cada subgrupo. Por eso los macros de cada opción dentro de un subgrupo deben ser SIMILARES entre sí (intercambiables), y la SUMA "intro + grasa elegida + carbo elegido + proteína elegida + postre" debe acercarse a las kcal/macros que tocan en esa comida (la comida y la cena suman juntas ~50-55 % del total diario).
- Aplica las equivalencias y porciones del brief para que las cantidades sean coherentes con cómo medimos en el equipo.
- Adapta a la cultura gastronómica española.

ADEMÁS, en la raíz del JSON devuelves dos campos de texto que se muestran al atleta tal cual:
- "notes" (Observaciones generales del plan): 4-8 frases concretas con pautas que aplican a TODO el plan: hidratación, horarios alrededor del entreno, qué hacer si come fuera, manejo del fin de semana, descanso, señales para ajustar. Sé específico para ESTE atleta (objetivo, nivel, preferencias) — nada genérico tipo "come sano". Sigue el tono del brief del equipo.
- "supplementation" (Suplementación propuesta): lista corta (3-6 ítems) con producto + dosis + cuándo tomarlo, adaptada al objetivo, al horario de entreno y a lo que ya está tomando el atleta (lo tienes en RESTRICCIONES → Suplementos). Si el brief o las consideraciones especiales mencionan suplementos concretos, prioriza esos. Si no hace falta suplementar nada, devuelve un texto breve explicando por qué.

Devuelve SOLO el JSON con esta forma exacta, sin markdown, sin texto fuera del JSON:
{
  "notes": "Hidrátate con 35 ml/kg/día … (texto plano, salto de línea con \\n permitido)",
  "supplementation": "- Creatina monohidrato: 5 g/día …\\n- Omega-3: …",
  "days": [
    {
      "name": "Día tipo",
      "dayType": "entreno",
      "meals": [
        {
          "name": "desayuno",
          "options": [
            { "text": "120 g avena + 250 ml leche + 30 g whey + 1 plátano", "kcal": 480, "protein": 35, "carbs": 65, "fat": 9 },
            { "text": "...", "kcal": 470, "protein": 32, "carbs": 60, "fat": 12 },
            { "text": "...", "kcal": 475, "protein": 36, "carbs": 55, "fat": 11 }
          ]
        },
        {
          "name": "comida",
          "options": [
            { "subType": "intro", "text": "Ensalada variada + 200 ml gazpacho", "kcal": 80, "protein": 3, "carbs": 12, "fat": 2 },
            { "subType": "grasas", "text": "50 g hummus", "kcal": 89, "protein": 4, "carbs": 7, "fat": 5 },
            { "subType": "grasas", "text": "100 g aguacate", "kcal": 179, "protein": 2, "carbs": 9, "fat": 15 },
            { "subType": "carbos", "text": "120 g arroz integral cocido", "kcal": 430, "protein": 8, "carbs": 92, "fat": 3 },
            { "subType": "carbos", "text": "120 g quinoa cocida", "kcal": 439, "protein": 17, "carbs": 77, "fat": 7 },
            { "subType": "proteina", "text": "155 g pechuga de pollo", "kcal": 163, "protein": 36, "carbs": 0, "fat": 2 },
            { "subType": "proteina", "text": "200 g salmón a la plancha", "kcal": 394, "protein": 40, "carbs": 0, "fat": 26 },
            { "subType": "postre", "text": "1 melocotón (200 g)", "kcal": 80, "protein": 1, "carbs": 19, "fat": 0 }
          ]
        }
      ]
    }
  ]
}`;
}

const SYSTEM_PROMPT =
  "Eres nutricionista deportiva del equipo de Al Fallo, trabajando con atletas de CrossFit y Hyrox. " +
  "Diseñas planes realistas, adaptados al perfil del atleta y a la cultura gastronómica española. " +
  "Sigues estrictamente el brief del equipo (filosofía, alimentos preferidos/a evitar, equivalencias) " +
  "que se te facilita en el system prompt junto a las instrucciones base. " +
  "Respondes SIEMPRE en JSON válido con la estructura exacta especificada. " +
  "Sin markdown, sin comentarios, sin texto fuera del JSON.";

// Extrae notes/supplementation del JSON devuelto por la IA. Limita longitud
// para que no se cuele un bloque kilométrico que rompa la UI (la columna en
// BD acepta más, pero la card sigue siendo una textarea para humanos).
function extractPlanCopy(raw: unknown): { notes: string | null; supplementation: string | null } {
  if (!raw || typeof raw !== "object") return { notes: null, supplementation: null };
  const obj = raw as Record<string, unknown>;
  const clip = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t ? t.slice(0, 4000) : null;
  };
  return {
    notes: clip(obj.notes),
    supplementation: clip(obj.supplementation),
  };
}

function clampPlan(raw: unknown): GeneratedDay[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as { days?: unknown };
  if (!Array.isArray(obj.days)) return [];
  const result: GeneratedDay[] = [];
  for (const d of obj.days) {
    if (!d || typeof d !== "object") continue;
    const day = d as Record<string, unknown>;
    const name = typeof day.name === "string" ? day.name : "Día tipo";
    const dayType = (DAY_TYPES as readonly string[]).includes(String(day.dayType))
      ? (day.dayType as (typeof DAY_TYPES)[number])
      : "entreno";
    const meals: GeneratedMeal[] = [];
    if (Array.isArray(day.meals)) {
      for (const m of day.meals) {
        if (!m || typeof m !== "object") continue;
        const meal = m as Record<string, unknown>;
        const mname = (MEAL_NAMES as readonly string[]).includes(String(meal.name))
          ? (meal.name as MealName)
          : null;
        if (!mname) continue;
        // Aceptamos "options" (nuevo) o "items" (legacy) por compat.
        const arr = Array.isArray(meal.options)
          ? meal.options
          : Array.isArray(meal.items)
            ? meal.items
            : [];
        const options: GeneratedOption[] = [];
        const isComposed = mname === "comida" || mname === "cena";
        // Para comida/cena no aplicamos el cap de 3: cada subgrupo aporta varias.
        // Cap global generoso (24) para evitar respuestas absurdas.
        const cap = isComposed ? 24 : 3;
        for (const opt of arr) {
          if (!opt || typeof opt !== "object") continue;
          const o = opt as Record<string, unknown>;
          const text = String(o.text ?? "").slice(0, 400);
          if (!text.trim()) continue;
          const rawSubType = typeof o.subType === "string" ? o.subType : null;
          const subType =
            rawSubType && (COMPOSED_SUBTYPES as readonly string[]).includes(rawSubType)
              ? rawSubType
              : null;
          const protein = Math.max(0, Number(o.protein) || 0);
          const carbs = Math.max(0, Number(o.carbs) || 0);
          const fat = Math.max(0, Number(o.fat) || 0);
          const kcal =
            Number(o.kcal) > 0 ? Number(o.kcal) : Math.round(kcalFromMacros(protein, carbs, fat));
          options.push({ text, protein, carbs, fat, kcal: Math.round(kcal), subType });
          if (options.length >= cap) break;
        }
        if (options.length > 0) meals.push({ name: mname, options });
      }
    }
    if (meals.length > 0) result.push({ name, dayType, meals });
  }
  return result;
}

/** Plan fallback (sin IA): 1 día con 5 comidas × 3 opciones razonables. */
function fallbackPlan(): GeneratedDay[] {
  return [
    {
      name: "Día tipo",
      dayType: "entreno",
      meals: [
        {
          name: "desayuno",
          options: [
            { text: "80 g avena + 250 ml leche semi + 1 plátano + 30 g nueces", protein: 22, carbs: 75, fat: 22, kcal: 596 },
            { text: "3 huevos revueltos + 80 g pan integral + 1/2 aguacate + 20 g lomo embuchado", protein: 30, carbs: 45, fat: 25, kcal: 595 },
            { text: "150 g yogur natural + 50 g claras + 30 g whey + 50 g copos de avena + 80 g frutos rojos", protein: 45, carbs: 60, fat: 8, kcal: 492 },
          ],
        },
        {
          name: "media_manana",
          options: [
            { text: "1 plátano + 25 g almendras", protein: 6, carbs: 30, fat: 12, kcal: 248 },
            { text: "150 g queso fresco batido + 15 g miel + 30 g nueces", protein: 18, carbs: 25, fat: 18, kcal: 334 },
            { text: "2 tortitas de arroz + 20 g crema de cacahuete + 1 manzana", protein: 6, carbs: 40, fat: 12, kcal: 292 },
          ],
        },
        {
          name: "comida",
          options: [
            { subType: "intro", text: "Verduras a la plancha o ensalada variada + 200 ml gazpacho", protein: 3, carbs: 14, fat: 3, kcal: 100 },
            { subType: "grasas", text: "50 g hummus", protein: 4, carbs: 7, fat: 5, kcal: 89 },
            { subType: "grasas", text: "100 g aguacate", protein: 2, carbs: 9, fat: 15, kcal: 179 },
            { subType: "grasas", text: "30 g queso curado", protein: 7, carbs: 0, fat: 10, kcal: 117 },
            { subType: "carbos", text: "120 g arroz integral cocido", protein: 8, carbs: 92, fat: 3, kcal: 430 },
            { subType: "carbos", text: "120 g pasta integral cocida", protein: 16, carbs: 78, fat: 3, kcal: 401 },
            { subType: "carbos", text: "120 g quinoa cocida", protein: 17, carbs: 77, fat: 7, kcal: 439 },
            { subType: "carbos", text: "150 g legumbres cocidas", protein: 12, carbs: 35, fat: 2, kcal: 220 },
            { subType: "proteina", text: "155 g pechuga de pollo", protein: 36, carbs: 0, fat: 2, kcal: 164 },
            { subType: "proteina", text: "170 g ternera magra", protein: 36, carbs: 0, fat: 5, kcal: 189 },
            { subType: "proteina", text: "210 g pescado blanco", protein: 36, carbs: 0, fat: 2, kcal: 162 },
            { subType: "proteina", text: "200 g salmón a la plancha", protein: 40, carbs: 0, fat: 26, kcal: 394 },
            { subType: "postre", text: "1 manzana mediana (200 g)", protein: 1, carbs: 22, fat: 0, kcal: 96 },
          ],
        },
        {
          name: "merienda",
          options: [
            { text: "200 g yogur griego + 80 g arándanos + 20 g almendras", protein: 18, carbs: 25, fat: 14, kcal: 290 },
            { text: "1 tortita de avena (50 g) + 20 g crema de cacahuete", protein: 12, carbs: 35, fat: 12, kcal: 280 },
            { text: "Tostada 60 g pan integral + 80 g pavo + tomate + AOVE", protein: 22, carbs: 35, fat: 10, kcal: 320 },
          ],
        },
        {
          name: "cena",
          options: [
            { subType: "intro", text: "Crema de calabacín o verduras al vapor", protein: 4, carbs: 12, fat: 2, kcal: 80 },
            { subType: "grasas", text: "10 g AOVE en la ensalada", protein: 0, carbs: 0, fat: 10, kcal: 90 },
            { subType: "grasas", text: "1/2 aguacate (75 g)", protein: 2, carbs: 7, fat: 11, kcal: 134 },
            { subType: "grasas", text: "20 g frutos secos", protein: 4, carbs: 4, fat: 11, kcal: 124 },
            { subType: "carbos", text: "80 g pan integral", protein: 7, carbs: 40, fat: 2, kcal: 200 },
            { subType: "carbos", text: "150 g patata cocida", protein: 3, carbs: 30, fat: 0, kcal: 130 },
            { subType: "carbos", text: "100 g arroz basmati cocido", protein: 3, carbs: 28, fat: 1, kcal: 130 },
            { subType: "proteina", text: "180 g pescado blanco", protein: 32, carbs: 0, fat: 2, kcal: 140 },
            { subType: "proteina", text: "150 g pavo", protein: 32, carbs: 0, fat: 3, kcal: 155 },
            { subType: "proteina", text: "3 huevos (170 g) en tortilla", protein: 22, carbs: 1, fat: 16, kcal: 240 },
            { subType: "proteina", text: "150 g tofu firme", protein: 15, carbs: 3, fat: 9, kcal: 145 },
            { subType: "postre", text: "1 yogur natural sin azúcar (125 g)", protein: 5, carbs: 6, fat: 3, kcal: 65 },
          ],
        },
      ],
    },
  ];
}

async function generateWithClaude(
  ctx: PlanContext,
): Promise<{ days: GeneratedDay[]; notes: string | null; supplementation: string | null }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("No ANTHROPIC_API_KEY");

  // Inyectamos el brief global + el brief específico del objetivo del cliente
  // (los configura el manager desde /biblioteca/brief-ia).
  const { getBriefForGoal, assembleAIBrief } = await import("@/lib/aiBrief");
  const { listBriefAttachments, fetchAttachmentContent, attachmentKind } = await import(
    "@/lib/briefAttachments"
  );
  const { getSpecialConsiderationsByIds } = await import("@/lib/specialConsiderations");
  // En modo competición forzamos el brief 'rendimiento' aunque el goal del
  // cliente sea otro. En modo regular, usamos el brief del goal del cliente.
  const isCompetition = !!(ctx.competitionContext && ctx.competitionContext.trim());
  const briefGoal = isCompetition ? "rendimiento" : ctx.goal;
  const { global, goal } = await getBriefForGoal(briefGoal);
  const briefText = assembleAIBrief(global, goal);

  const attachments = listBriefAttachments(global, goal);
  const resolved = await Promise.all(
    attachments.map(async (a) => ({ doc: a, content: await fetchAttachmentContent(a) })),
  );

  const textBlocks: string[] = [];
  type DocumentBlock = {
    type: "document";
    source: { type: "base64"; media_type: "application/pdf"; data: string };
    title?: string;
  };
  const documentBlocks: DocumentBlock[] = [];

  for (const r of resolved) {
    if (!r.content) continue;
    if (r.content.kind === "pdf") {
      documentBlocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: r.content.base64 },
        title: `${r.doc.label} · ${r.doc.name}`,
      });
    } else {
      textBlocks.push(`\n\n[ADJUNTO · ${r.doc.label} · ${r.doc.name}]\n${r.content.text}`);
    }
  }

  // Consideraciones especiales: descripción + dieta de ejemplo (si la hay).
  const specials = await getSpecialConsiderationsByIds(ctx.specialConsiderationIds ?? []);
  if (specials.length > 0) {
    const lines: string[] = ["\n\n=== CONSIDERACIONES ESPECIALES DEL CLIENTE ==="];
    for (const c of specials) {
      lines.push(`\n[${c.title.toUpperCase()}]`);
      if (c.description.trim()) lines.push(c.description.trim());
      // Si tiene adjunto, lo añadimos como bloque document (PDF) o como texto.
      if (c.examplePlanUrl && c.examplePlanName) {
        const kind = attachmentKind(c.examplePlanName);
        const content = await fetchAttachmentContent({
          label: `Consideración · ${c.title}`,
          name: c.examplePlanName,
          url: c.examplePlanUrl,
          kind,
        });
        if (content?.kind === "pdf") {
          documentBlocks.push({
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: content.base64 },
            title: `Consideración · ${c.title} · ${c.examplePlanName}`,
          });
        } else if (content && (content.kind === "spreadsheet" || content.kind === "csv" || content.kind === "text")) {
          lines.push(`\n[DIETA DE EJEMPLO · ${c.examplePlanName}]\n${content.text}`);
        }
      }
    }
    textBlocks.push(lines.join("\n"));
  }

  // Instrucciones del nutri al añadir el plan: van como bloque dedicado al
  // final del system prompt, antes (sobre) el contexto de competición. Así
  // tienen prioridad alta sobre los briefs y consideraciones.
  if (ctx.userInstructions && ctx.userInstructions.trim()) {
    textBlocks.push(
      `\n\n=== INSTRUCCIONES DEL NUTRICIONISTA PARA ESTE PLAN ===\n${ctx.userInstructions.trim()}\n\nEstas instrucciones son prioritarias: si entran en conflicto con el brief general, sigue lo que diga el nutri aquí.`,
    );
  }

  // Contexto de la competición (solo cuando ctx.competitionContext está set).
  if (isCompetition) {
    const tag = ctx.competitionName?.trim()
      ? `CONTEXTO DE COMPETICIÓN · ${ctx.competitionName.trim()}`
      : "CONTEXTO DE COMPETICIÓN";
    textBlocks.push(
      `\n\n=== ${tag} ===\nEl plan debe estructurarse en torno a la prueba descrita. Tienes en cuenta WODs, horarios, fecha del evento y necesidades específicas de carga de hidratos / día-evento.\n\n${ctx.competitionContext!.trim()}`,
    );
  }

  const fullSystem = briefText
    ? `${SYSTEM_PROMPT}\n\n${briefText}${textBlocks.join("")}`
    : `${SYSTEM_PROMPT}${textBlocks.join("")}`;

  const userContent: unknown =
    documentBlocks.length > 0
      ? [...documentBlocks, { type: "text", text: buildUserPrompt(ctx) }]
      : buildUserPrompt(ctx);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4500,
      system: fullSystem,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Claude API ${res.status}: ${errText.slice(0, 200)}`);
  }
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const reply = data.content?.find((c) => c.type === "text")?.text ?? "";
  const jsonMatch = reply.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Claude no devolvió JSON parseable");
  const parsed = JSON.parse(jsonMatch[0]);
  const days = clampPlan(parsed);
  if (days.length === 0) throw new Error("Plan generado vacío");
  const { notes, supplementation } = extractPlanCopy(parsed);
  return { days, notes, supplementation };
}

export async function generatePlanDraft(ctx: PlanContext): Promise<GeneratedPlan> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { days, notes, supplementation } = await generateWithClaude(ctx);
      return {
        days,
        source: "ai",
        notes: notes ?? undefined,
        supplementation: supplementation ?? undefined,
      };
    } catch (e) {
      console.warn("[planGenerator] Claude failed, using fallback:", (e as Error).message);
    }
  }
  return {
    days: fallbackPlan(),
    source: "fallback",
    notes: "Plantilla genérica (sin IA). Edítala para adaptarla al cliente.",
  };
}
