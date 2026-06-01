import "server-only";
import { kcalFromMacros } from "@/lib/nutrition";

/**
 * Generador de plan nutricional inicial con IA.
 *
 * Toma el perfil del cliente + objetivos de macros y pide a Claude Sonnet
 * que diseñe 2 días (entreno + descanso) con 4-5 comidas y 1-2 items por
 * comida, ajustando los totales a los objetivos.
 *
 * Si no hay ANTHROPIC_API_KEY o falla, devuelve un plan plantilla genérico
 * para que el nutricionista no se quede sin nada.
 */

const MEAL_TYPES = ["desayuno", "media_manana", "pre_wod", "post_wod", "comida", "merienda", "cena", "snack", "otro"] as const;
const DAY_TYPES = ["entreno", "descanso", "mixto"] as const;

export type GeneratedItem = { text: string; protein: number; carbs: number; fat: number; kcal: number };
export type GeneratedMeal = { name: (typeof MEAL_TYPES)[number]; items: GeneratedItem[] };
export type GeneratedDay = { name: string; dayType: (typeof DAY_TYPES)[number]; meals: GeneratedMeal[] };
export type GeneratedPlan = { days: GeneratedDay[]; source: "ai" | "fallback"; notes?: string };

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
  kcalRest: number | null;
  proteinRest: number | null;
  carbsRest: number | null;
  fatRest: number | null;
};

function ageFromBirthDate(d: Date | null): number | null {
  if (!d) return null;
  const diff = Date.now() - d.getTime();
  const years = diff / (365.25 * 24 * 60 * 60 * 1000);
  return Math.floor(years);
}

function buildUserPrompt(ctx: PlanContext): string {
  const age = ageFromBirthDate(ctx.birthDate);
  const list = (xs: string[]) => (xs.length ? xs.join(", ") : "—");
  return `Diseña un plan nutricional INICIAL (2 días: entreno y descanso) para este atleta.

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

OBJETIVOS DIARIOS DE MACROS
- Día de entreno: ${ctx.kcalTraining ?? "?"} kcal · ${ctx.proteinTraining ?? "?"} g P · ${ctx.carbsTraining ?? "?"} g C · ${ctx.fatTraining ?? "?"} g G
- Día de descanso: ${ctx.kcalRest ?? ctx.kcalTraining ?? "?"} kcal · ${ctx.proteinRest ?? ctx.proteinTraining ?? "?"} g P · ${ctx.carbsRest ?? ctx.carbsTraining ?? "?"} g C · ${ctx.fatRest ?? ctx.fatTraining ?? "?"} g G

INSTRUCCIONES
- Crea 2 días: "Día de entreno" (dayType="entreno") y "Día de descanso" (dayType="descanso").
- Cada día con 4-5 comidas razonables. En el día de entreno incluye un "pre_wod" y un "post_wod".
- Cada comida con 1-2 items realistas. Los items son descripciones con cantidades en gramos y los macros correspondientes.
- La SUMA de macros del día debe acercarse a los objetivos (±10%).
- Adapta la cultura gastronómica a España.
- VALORES VÁLIDOS para meal.name: ${MEAL_TYPES.join(" | ")}.
- VALORES VÁLIDOS para day.dayType: ${DAY_TYPES.join(" | ")}.

Devuelve SOLO el JSON con esta forma exacta, sin texto adicional ni markdown:
{
  "days": [
    {
      "name": "Día de entreno",
      "dayType": "entreno",
      "meals": [
        {
          "name": "desayuno",
          "items": [
            { "text": "200g avena con leche, plátano y nueces", "protein": 25, "carbs": 80, "fat": 15, "kcal": 555 }
          ]
        }
      ]
    }
  ]
}`;
}

const SYSTEM_PROMPT =
  "Eres una nutricionista deportiva con 10+ años trabajando con atletas de CrossFit y Hyrox. " +
  "Diseñas planes realistas, adaptados al perfil del atleta y a su cultura gastronómica. " +
  "Respondes SIEMPRE en JSON válido con la estructura exacta especificada. " +
  "Sin markdown, sin comentarios, sin texto fuera del JSON.";

function clampPlan(raw: unknown): GeneratedDay[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as { days?: unknown };
  if (!Array.isArray(obj.days)) return [];
  const result: GeneratedDay[] = [];
  for (const d of obj.days) {
    if (!d || typeof d !== "object") continue;
    const day = d as Record<string, unknown>;
    const name = typeof day.name === "string" ? day.name : "Día";
    const dayType = (DAY_TYPES as readonly string[]).includes(String(day.dayType))
      ? (day.dayType as (typeof DAY_TYPES)[number])
      : "entreno";
    const meals: GeneratedMeal[] = [];
    if (Array.isArray(day.meals)) {
      for (const m of day.meals) {
        if (!m || typeof m !== "object") continue;
        const meal = m as Record<string, unknown>;
        const mname = (MEAL_TYPES as readonly string[]).includes(String(meal.name))
          ? (meal.name as (typeof MEAL_TYPES)[number])
          : "otro";
        const items: GeneratedItem[] = [];
        if (Array.isArray(meal.items)) {
          for (const it of meal.items) {
            if (!it || typeof it !== "object") continue;
            const item = it as Record<string, unknown>;
            const text = String(item.text ?? "").slice(0, 200);
            if (!text.trim()) continue;
            const protein = Math.max(0, Number(item.protein) || 0);
            const carbs = Math.max(0, Number(item.carbs) || 0);
            const fat = Math.max(0, Number(item.fat) || 0);
            const kcal = Number(item.kcal) > 0 ? Number(item.kcal) : Math.round(kcalFromMacros(protein, carbs, fat));
            items.push({ text, protein, carbs, fat, kcal: Math.round(kcal) });
          }
        }
        if (items.length > 0) meals.push({ name: mname, items });
      }
    }
    if (meals.length > 0) result.push({ name, dayType, meals });
  }
  return result;
}

/** Plantilla genérica que se usa si no hay API key o falla la IA. */
function fallbackPlan(): GeneratedDay[] {
  return [
    {
      name: "Día de entreno",
      dayType: "entreno",
      meals: [
        {
          name: "desayuno",
          items: [{ text: "80g avena con 250ml leche, 1 plátano y 30g nueces", protein: 22, carbs: 75, fat: 22, kcal: 596 }],
        },
        {
          name: "pre_wod",
          items: [{ text: "1 plátano + 1 puñado de almendras", protein: 4, carbs: 30, fat: 12, kcal: 244 }],
        },
        {
          name: "post_wod",
          items: [{ text: "Batido: 30g whey + 1 plátano + 250ml leche", protein: 32, carbs: 50, fat: 5, kcal: 373 }],
        },
        {
          name: "comida",
          items: [{ text: "200g pechuga de pollo + 150g arroz integral + ensalada con AOVE", protein: 50, carbs: 100, fat: 18, kcal: 762 }],
        },
        {
          name: "cena",
          items: [{ text: "200g salmón al horno + 200g boniato + verduras al vapor", protein: 42, carbs: 50, fat: 25, kcal: 593 }],
        },
      ],
    },
    {
      name: "Día de descanso",
      dayType: "descanso",
      meals: [
        {
          name: "desayuno",
          items: [{ text: "3 huevos revueltos + 1 tostada integral + aguacate", protein: 22, carbs: 25, fat: 25, kcal: 413 }],
        },
        {
          name: "comida",
          items: [{ text: "200g pescado blanco + 150g quinoa + verduras salteadas", protein: 42, carbs: 80, fat: 12, kcal: 596 }],
        },
        {
          name: "merienda",
          items: [{ text: "Yogur griego natural + frutos rojos + 20g almendras", protein: 20, carbs: 25, fat: 14, kcal: 306 }],
        },
        {
          name: "cena",
          items: [{ text: "200g pavo a la plancha + ensalada completa + 1 rebanada de pan", protein: 48, carbs: 35, fat: 12, kcal: 440 }],
        },
      ],
    },
  ];
}

async function generateWithClaude(ctx: PlanContext): Promise<GeneratedDay[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("No ANTHROPIC_API_KEY");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(ctx) }],
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
  return days;
}

export async function generatePlanDraft(ctx: PlanContext): Promise<GeneratedPlan> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const days = await generateWithClaude(ctx);
      return { days, source: "ai" };
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
