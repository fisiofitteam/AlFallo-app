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

/** Ingrediente individual de una opción, en gramos para que la lista de
 *  compra pueda sumarlo. La IA convierte ml/unidades a gramos aproximados
 *  ("250 ml leche" → 250, "1 plátano" → ~120). */
export type GeneratedIngredient = {
  name: string;
  quantityG: number;
  /** proteina | carbohidrato | grasa | verdura | lacteo | suplemento | otro */
  category?: string | null;
};

export type GeneratedOption = {
  text: string;
  protein: number;
  carbs: number;
  fat: number;
  kcal: number;
  // Solo presente en comida/cena: subgrupo combinable
  // (intro|grasas|carbos|proteina|postre). Para otras comidas es null.
  subType?: string | null;
  /** Desglose de la opción en alimentos individuales con cantidad en gramos.
   *  La IA siempre debería devolverlo para que la lista de la compra agregue
   *  correctamente. Si falta, /cliente/compra cae a la opción entera como
   *  una línea. */
  ingredients?: GeneratedIngredient[];
};

const INGREDIENT_CATEGORIES = [
  "proteina",
  "carbohidrato",
  "grasa",
  "verdura",
  "lacteo",
  "suplemento",
  "otro",
] as const;

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

  /** Instrucción de ESTE intento de generación. La pone el nutri en el modal
   *  de revisión al pulsar "Ajustar" ("añade más variedad de proteína", etc.).
   *  Se inyecta con prioridad alta para que la IA corrija el draft anterior. */
  attemptInstruction?: string | null;
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

╔══════════════════════════════════════════════════════════════════╗
║  ⚠️ OBJETIVO DIARIO DE MACROS — ESTO ES LO PRIMERO QUE LEES Y    ║
║  LO PRIMERO QUE TIENES QUE CUMPLIR. El plan se diseña EN TORNO   ║
║  a estos números, no al revés.                                   ║
╠══════════════════════════════════════════════════════════════════╣
║  KCAL:      ${String(ctx.kcalTraining ?? "?").padEnd(8)}                                          ║
║  PROTEÍNA:  ${String((ctx.proteinTraining ?? "?") + " g").padEnd(8)}                                         ║
║  CARBOS:    ${String((ctx.carbsTraining ?? "?") + " g").padEnd(8)}                                         ║
║  GRASA:     ${String((ctx.fatTraining ?? "?") + " g").padEnd(8)}                                         ║
╚══════════════════════════════════════════════════════════════════╝

REGLA NO NEGOCIABLE sobre macros:
- La SUMA de UNA combinación del día (1 opción del desayuno + 1 de media_mañana + 1 de cada subgrupo en comida y cena + 1 de merienda) DEBE quedar dentro de ±5% en CADA uno de los cuatro objetivos de arriba.
- Si no cuadra, AJUSTA las cantidades en gramos hasta que cuadre. NO redondees ni "aproximes" sin más.
- Tras escribir cada opción, recalcula sus macros con 4·P + 9·G + 4·C y verifica que la suma del día cuadra. Si no, reescribe la opción con cantidades distintas.
- NUNCA inventes objetivos distintos a los anteriores. NUNCA escribas un plan que sume menos del 95% ni más del 105% del kcal objetivo.
- Si los objetivos vienen como "?" (no fijados), pide al nutri que los fije; mientras tanto usa una estimación razonable.

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

INSTRUCCIONES
- Devuelve EXACTAMENTE 1 día (name "Día tipo", dayType "entreno").
- 5 comidas en este orden: desayuno, media_manana, comida, merienda, cena.
- Para "desayuno", "media_manana" y "merienda": 2 OPCIONES intercambiables; cada opción es UN MENÚ COMPLETO con alimentos y cantidades en gramos. Las 2 opciones con macros similares entre sí (±10%). No uses "subType" en estas.
- Para "comida" y "cena": en lugar de opciones planas, devuelve opciones agrupadas por "subType" (campo obligatorio) con la siguiente distribución (CANTIDADES EXACTAS, no más):
    * intro    → 1 opción  (verduras / ensalada / gazpacho / entrante ligero)
    * grasas   → 2 opciones (cada una un ALIMENTO graso suelto: hummus, aguacate, queso, frutos secos, AOVE…)
    * carbos   → 2 opciones (cada una un ALIMENTO con la ración: arroz, pasta, quinoa, legumbres, patata…)
    * proteina → 2 opciones (cada una una proteína con la ración: pollo, ternera, pescado azul, pescado blanco, tofu…)
    * postre   → 1 opción (fruta de temporada normalmente)
  El atleta combinará 1 opción de cada subgrupo. Por eso los macros de cada opción dentro de un subgrupo deben ser SIMILARES entre sí (intercambiables), y la SUMA "intro + grasa elegida + carbo elegido + proteína elegida + postre" debe acercarse a las kcal/macros que tocan en esa comida (la comida y la cena suman juntas ~50-55 % del total diario).
- Aplica las equivalencias y porciones del brief para que las cantidades sean coherentes con cómo medimos en el equipo.
- Adapta a la cultura gastronómica española.
- Para cada opción devuelves SOLO: text + kcal + protein + carbs + fat (+ subType en comida/cena). Sin array "ingredients" — para que la respuesta sea más compacta y rápida.

ADEMÁS, en la raíz del JSON devuelves dos campos de texto que se muestran al atleta tal cual:
- "notes" (Observaciones generales del plan): 4-8 frases concretas con pautas que aplican a TODO el plan: hidratación, horarios alrededor del entreno, qué hacer si come fuera, manejo del fin de semana, descanso, señales para ajustar. Sé específico para ESTE atleta (objetivo, nivel, preferencias) — nada genérico tipo "come sano". Sigue el tono del brief del equipo.
- "supplementation" (Suplementación propuesta): lista corta (3-6 ítems) con producto + dosis + cuándo tomarlo, adaptada al objetivo, al horario de entreno y a lo que ya está tomando el atleta (lo tienes en RESTRICCIONES → Suplementos). Si el brief o las consideraciones especiales mencionan suplementos concretos, prioriza esos. Si no hace falta suplementar nada, devuelve un texto breve explicando por qué.

⚠️ ANTES DE ESCRIBIR EL JSON — RECORDATORIO FINAL DE MACROS:
Vuelve a leer los objetivos al principio (KCAL/PROTEÍNA/CARBOS/GRASA). Suma mentalmente la combinación canónica del día (desayuno opción 1 + media_mañana opción 1 + comida intro+grasas[0]+carbos[0]+proteina[0]+postre + merienda opción 1 + cena intro+grasas[0]+carbos[0]+proteina[0]+postre). Esa suma DEBE estar a ±5% en los CUATRO macros. Si no cuadra, ajusta cantidades en gramos AHORA antes de escribir el JSON.

Devuelve SOLO el JSON con esta forma exacta (sin markdown, sin texto fuera del JSON). Los NÚMEROS del ejemplo son SOLO ilustración de formato: calcula los tuyos a partir de los macros objetivo del cliente, NO los copies tal cual:
{
  "notes": "Pauta breve de hidratación, horarios, etc.",
  "supplementation": "- Producto: dosis · cuándo …",
  "days": [
    {
      "name": "Día tipo",
      "dayType": "entreno",
      "meals": [
        {
          "name": "desayuno",
          "options": [
            {
              "text": "120 g avena + 250 ml leche + 30 g whey + 1 plátano",
              "kcal": 480, "protein": 35, "carbs": 65, "fat": 9
            }
          ]
        },
        {
          "name": "comida",
          "options": [
            {
              "subType": "proteina",
              "text": "155 g pechuga de pollo",
              "kcal": 163, "protein": 36, "carbs": 0, "fat": 2
            },
            {
              "subType": "carbos",
              "text": "120 g arroz integral cocido",
              "kcal": 430, "protein": 8, "carbs": 92, "fat": 3
            }
          ]
        }
      ]
    }
  ]
}`;
}

const SYSTEM_PROMPT = `Eres nutricionista deportiva del equipo de Al Fallo, trabajando con atletas de CrossFit y Hyrox.
Diseñas planes realistas, adaptados al perfil del atleta y a la cultura gastronómica española.

ANTES de escribir el JSON, en tu pensamiento haz esta checklist OBLIGATORIA:
1. Lee el brief GLOBAL completo y anota las reglas, filosofía y restricciones.
2. Lee el brief del OBJETIVO del cliente (si aplica) y anota su énfasis.
3. Lee las CONSIDERACIONES ESPECIALES marcadas del cliente y respétalas.
4. Lee las REGLAS GLOBALES DEL EQUIPO (PlanGenerationRule activas). Son IRROMPIBLES.
5. Lee las INSTRUCCIONES DEL NUTRICIONISTA para ESTE plan. Tienen prioridad sobre todo lo anterior si hay conflicto.
6. Comprueba RESTRICCIONES del cliente: alergias, intolerancias, "no quiere comer" y estilo dietético. Estos alimentos NUNCA aparecen.
7. Comprueba el OBJETIVO DIARIO DE MACROS y diseña las opciones para que la suma de UNA combinación (1 opción de cada comida simple + 1 opción de cada subgrupo de comida/cena) cuadre dentro de ±10% del objetivo en kcal y P/C/G.
8. Para cada opción, calcula los macros INGREDIENTE A INGREDIENTE (no a ojo) y comprueba que kcal = 4·proteína + 9·grasa + 4·carbos antes de escribir el JSON. Si no cuadra, RECALCULA.
9. Devuelve "ingredients" con cantidades en gramos (convierte ml y unidades) y categoría correcta. Cada opción dentro del mismo subgrupo debe tener macros similares (±10%) entre sí: son intercambiables.

Respondes SIEMPRE en JSON válido con la estructura exacta especificada. Sin markdown, sin comentarios, sin texto fuera del JSON.

IMPORTANTE: si el brief dice "evitar X", esa palabra NUNCA aparece en el plan. Si dice "preferir Y", aparece en al menos una opción de cada comida principal. Si dice "no usar Z marca", esa marca no se nombra.`;

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
          // ingredients (descomposición de la opción para la lista de compra).
          // Validamos cada uno: nombre no vacío, cantidad numérica >0, categoría
          // de la lista permitida. Limitamos a 12 ingredientes por opción para
          // que la IA no nos cuele un poema.
          const ingredients: GeneratedIngredient[] = [];
          if (Array.isArray(o.ingredients)) {
            for (const ing of o.ingredients) {
              if (!ing || typeof ing !== "object") continue;
              const r = ing as Record<string, unknown>;
              const name = String(r.name ?? "").trim().slice(0, 80);
              if (!name) continue;
              const qty = Number(r.quantityG);
              if (!Number.isFinite(qty) || qty <= 0) continue;
              const rawCat = typeof r.category === "string" ? r.category : "";
              const category =
                (INGREDIENT_CATEGORIES as readonly string[]).includes(rawCat) ? rawCat : "otro";
              ingredients.push({ name, quantityG: Math.round(qty), category });
              if (ingredients.length >= 12) break;
            }
          }
          options.push({
            text,
            protein,
            carbs,
            fat,
            kcal: Math.round(kcal),
            subType,
            ingredients: ingredients.length > 0 ? ingredients : undefined,
          });
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

/**
 * Intenta reparar un JSON truncado a la mitad (stop_reason=max_tokens en
 * Claude). Estrategia simple:
 *   1. Si el último carácter es una coma, la quitamos.
 *   2. Si estamos dentro de un string (cuenta de comillas sin escapar es
 *      impar), cerramos la comilla.
 *   3. Contamos llaves y corchetes abiertos sin cerrar y los cerramos al
 *      final en el orden inverso al que se abrieron.
 *
 * No es JSON5 ni un parser completo, pero rescata la mayoría de truncados
 * típicos de respuestas LLM. Si no consigue arreglar nada útil devuelve null.
 */
function tryRepairTruncatedJson(s: string): string | null {
  let work = s.trim();
  // Si termina con coma + espacios, quitamos la coma (típico al cortar
  // entre items de array).
  work = work.replace(/,\s*$/, "");

  // ¿Estamos a mitad de una string? Contar comillas no escapadas. Si es
  // impar, cerramos.
  let inString = false;
  let escape = false;
  for (let i = 0; i < work.length; i++) {
    const c = work[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (c === '"') inString = !inString;
  }
  if (inString) work += '"';

  // Contar balance de { } y [ ] (ignorando los que estén dentro de strings).
  const stack: string[] = [];
  inString = false;
  escape = false;
  for (let i = 0; i < work.length; i++) {
    const c = work[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === "{" || c === "[") stack.push(c);
    else if (c === "}") {
      if (stack[stack.length - 1] === "{") stack.pop();
    } else if (c === "]") {
      if (stack[stack.length - 1] === "[") stack.pop();
    }
  }
  // Cerramos lo que quedó abierto, en orden inverso.
  while (stack.length > 0) {
    const open = stack.pop()!;
    work = work.replace(/,\s*$/, ""); // quita coma trailing antes de cerrar
    work += open === "{" ? "}" : "]";
  }
  return work;
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

  // Reglas globales + aprendizajes recientes (PlanGenerationRule +
  // razones de PlanGenerationFeedback). Se inyectan antes que las
  // instrucciones específicas del plan para que sean siempre tenidas en
  // cuenta — son cómo aprende la IA del equipo.
  const { buildLearningPromptBlocks } = await import("@/lib/planFeedback");
  const learningBlocks = await buildLearningPromptBlocks();
  for (const block of learningBlocks) textBlocks.push(block);

  // Instrucciones del nutri al añadir el plan: van como bloque dedicado al
  // final del system prompt, antes (sobre) el contexto de competición. Así
  // tienen prioridad alta sobre los briefs y consideraciones.
  if (ctx.userInstructions && ctx.userInstructions.trim()) {
    textBlocks.push(
      `\n\n=== INSTRUCCIONES DEL NUTRICIONISTA PARA ESTE PLAN ===\n${ctx.userInstructions.trim()}\n\nEstas instrucciones son prioritarias: si entran en conflicto con el brief general, sigue lo que diga el nutri aquí.`,
    );
  }

  // Ajuste del intento actual: el nutri viene del modal de revisión y la IA
  // tiene que corregir el draft anterior siguiendo esta indicación.
  if (ctx.attemptInstruction && ctx.attemptInstruction.trim()) {
    textBlocks.push(
      `\n\n=== AJUSTE PARA ESTA GENERACIÓN ===\n${ctx.attemptInstruction.trim()}\n\nEsta es una RE-GENERACIÓN: el nutri ha rechazado el intento anterior pidiendo este cambio concreto. Aplícalo manteniendo todo lo bueno del plan.`,
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

  // Helper interno: una sola llamada a Claude. Sonnet 4.6 SIN extended
  // thinking — la combinación Opus 4.7 + thinking que intentamos antes
  // fallaba silenciosamente y caía al fallback hardcoded. Sonnet sin
  // thinking es el modo PROBADO que sí responde.
  async function callClaude(
    system: string,
    messages: Array<{ role: "user" | "assistant"; content: unknown }>,
  ) {
    const body: Record<string, unknown> = {
      model: "claude-sonnet-4-6",
      // Bajado a 12000 para que la respuesta de Sonnet termine en <60 s
      // (cap de Vercel Hobby). Para conseguirlo, también pedimos al prompt
      // que NO incluya el array ingredients[] (era ~50 % del output).
      // La lista de la compra del cliente sigue funcionando con el parser
      // regex del texto en /cliente/compra como fallback.
      max_tokens: 12000,
      system,
      messages,
    };
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey as string,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      throw new Error(`Sonnet 4.6 → ${r.status}: ${errText.slice(0, 200)}`);
    }
    const json = (await r.json()) as {
      content?: Array<{ type: string; text?: string }>;
      stop_reason?: string;
    };
    const text = json.content?.find((c) => c.type === "text")?.text ?? "";

    // Quitamos posibles fences ```json … ``` antes de extraer el JSON.
    let cleaned = text
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    // Buscamos el JSON. Si Sonnet añade texto antes de la primera "{",
    // lo descartamos. Igual con basura después de la última "}".
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end < 0 || end <= start) {
      // Log de la respuesta cruda para diagnosticar en Vercel.
      console.error(
        "[plan-gen] Sonnet respondió pero sin JSON parseable. stop_reason:",
        json.stop_reason,
        "respuesta (primeros 500 chars):",
        text.slice(0, 500),
      );
      throw new Error(
        `Sonnet no devolvió JSON parseable (stop_reason=${json.stop_reason ?? "?"})`,
      );
    }
    const jsonText = cleaned.slice(start, end + 1);
    try {
      return { rawText: text, parsed: JSON.parse(jsonText) as unknown };
    } catch (parseErr) {
      // Si stop_reason fue max_tokens, el JSON está truncado. Intentamos
      // repararlo: contar llaves/corchetes abiertos sin cerrar y cerrarlos
      // al final. Mejor un plan parcial que el fallback hardcoded.
      if (json.stop_reason === "max_tokens" || json.stop_reason === "length") {
        const repaired = tryRepairTruncatedJson(jsonText);
        if (repaired) {
          try {
            console.warn(
              "[plan-gen] JSON truncado por max_tokens, reparado y parseado.",
            );
            return { rawText: text, parsed: JSON.parse(repaired) as unknown };
          } catch (repairErr) {
            console.error(
              "[plan-gen] Reparación JSON falló:",
              (repairErr as Error).message,
            );
          }
        }
      }
      console.error(
        "[plan-gen] JSON.parse falló:",
        (parseErr as Error).message,
        "stop_reason:",
        json.stop_reason,
        "json extraído (primeros 800 chars):",
        jsonText.slice(0, 800),
      );
      throw new Error(
        `Sonnet devolvió JSON inválido (${(parseErr as Error).message.slice(0, 100)})`,
      );
    }
  }

  // 1) Primera llamada con extended thinking.
  let parsed = (await callClaude(fullSystem, [{ role: "user", content: userContent }])).parsed;
  let days = clampPlan(parsed);
  if (days.length === 0) throw new Error("Plan generado vacío");

  // 2) Validación post-generación: si tenemos targets concretos y la suma
  //    canónica del día se desvía >12% en alguno, segunda llamada con un
  //    prompt focalizado pidiéndole AJUSTAR cantidades.
  if (
    ctx.kcalTraining != null &&
    ctx.proteinTraining != null &&
    ctx.carbsTraining != null &&
    ctx.fatTraining != null
  ) {
    const target = {
      kcal: ctx.kcalTraining,
      protein: ctx.proteinTraining,
      carbs: ctx.carbsTraining,
      fat: ctx.fatTraining,
    };
    const sum = sumCanonicalDay(days);
    const deviation = (a: number, b: number) => (b > 0 ? Math.abs(a - b) / b : 0);
    const offBy12 =
      deviation(sum.kcal, target.kcal) > 0.12 ||
      deviation(sum.protein, target.protein) > 0.12 ||
      deviation(sum.carbs, target.carbs) > 0.12 ||
      deviation(sum.fat, target.fat) > 0.12;

    if (offBy12) {
      console.log(
        `[plan-gen] La primera respuesta se desvía (${sum.kcal}/${sum.protein}/${sum.carbs}/${sum.fat} vs target ${target.kcal}/${target.protein}/${target.carbs}/${target.fat}). Lanzando retry de corrección.`,
      );
      // Mensaje cortísimo y específico al modelo: tu plan se sale; reescríbelo
      // ajustando SOLO cantidades en gramos, manteniendo los alimentos.
      const correction = `Tu plan anterior sumó ${sum.kcal} kcal · P${sum.protein} · C${sum.carbs} · G${sum.fat} para la combinación canónica del día.

PERO EL OBJETIVO ERA: ${target.kcal} kcal · P${target.protein} · C${target.carbs} · G${target.fat}.

La desviación es inaceptable. Reescribe el plan COMPLETO ajustando ÚNICAMENTE las cantidades en gramos de cada ingrediente para que la combinación canónica del día (1 opción del desayuno + 1 de media_mañana + 1 de cada subgrupo de comida + 1 de merienda + 1 de cada subgrupo de cena) sume el objetivo dentro de ±5%.

Mantén los mismos alimentos y la misma estructura. Solo cambian los gramos.

Tu plan anterior en formato JSON:
${JSON.stringify({ days }, null, 0).slice(0, 4000)}

Devuelve el JSON entero corregido (con notes, supplementation y days). Sin markdown.`;

      const retry = await callClaude(
        fullSystem,
        [{ role: "user", content: correction }],
      );
      const retryDays = clampPlan(retry.parsed);
      if (retryDays.length > 0) {
        parsed = retry.parsed;
        days = retryDays;
      }
    }
  }

  const { notes, supplementation } = extractPlanCopy(parsed);
  return { days, notes, supplementation };
}

/** Suma macros de la "combinación canónica" del día tipo: 1 opción de cada
 *  comida simple + 1 opción de cada subgrupo en comida/cena. Esto representa
 *  lo que el atleta come EN UN DÍA y debe cuadrar con el objetivo. */
function sumCanonicalDay(days: GeneratedDay[]): {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  let kcal = 0,
    protein = 0,
    carbs = 0,
    fat = 0;
  const day = days[0];
  if (!day) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const meal of day.meals) {
    const seen = new Set<string>();
    for (const o of meal.options) {
      const key = o.subType ?? "_flat";
      if (seen.has(key)) continue;
      seen.add(key);
      kcal += o.kcal;
      protein += o.protein;
      carbs += o.carbs;
      fat += o.fat;
      if (!o.subType) break;
    }
  }
  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  };
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
      const msg = (e as Error).message;
      console.error("[planGenerator] Claude FAILED, devolviendo fallback:", msg);
      return {
        days: fallbackPlan(),
        source: "fallback",
        // Aviso CLARO en las observaciones del plan para que el nutri no
        // se confunda y piense que esto es lo que la IA propuso. Antes
        // este texto era genérico; ahora incluye el error específico.
        notes: `⚠️ PLAN GENÉRICO (NO generado con IA). La llamada a la IA falló con: ${msg}. Revisa REPLICATE/ANTHROPIC API keys y los logs en Vercel. Mientras tanto este plan es una plantilla por defecto que debes ajustar manualmente.`,
      };
    }
  }
  return {
    days: fallbackPlan(),
    source: "fallback",
    notes:
      "⚠️ PLAN GENÉRICO. Falta ANTHROPIC_API_KEY en el servidor. Hasta que se configure no se puede generar con IA — esto es una plantilla por defecto.",
  };
}
