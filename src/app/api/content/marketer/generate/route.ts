import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getActiveProfessional } from "@/lib/session";
import { canUseMarketerIA } from "@/lib/marketer-access";
import { getAiBrief, type AiBrief } from "@/lib/ai-brief";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Vercel Pro admite hasta 300s. En Hobby cae a 60 y hay que limitar weeksAhead.
export const maxDuration = 300;

const MODEL = "claude-sonnet-4-6";
const MAX_OUTPUT_TOKENS = 6000;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada.");
  _client = new Anthropic({ apiKey });
  return _client;
}

function systemPrompt(brief: AiBrief): string {
  return [
    "Eres el Marketer IA de AL FALLO NUTRITION PERFORMANCE, un servicio online premium de nutrición para atletas amateur de CrossFit y Hyrox.",
    "Tu trabajo: diseñar estrategias de contenido de Instagram accionables — semanas con tema central y piezas concretas (título + idea principal + objetivos + rationale).",
    "",
    "CONTEXTO DE MARCA:",
    brief.brand,
    "",
    "VOZ Y TONO:",
    brief.voiceTone,
    "",
    "SÍ HACER:",
    brief.dos,
    "",
    "NO HACER:",
    brief.donts,
    "",
    "ESTRUCTURA HABITUAL DE UNA SEMANA:",
    brief.structureHints,
    "",
    "EJEMPLOS BUENOS (referencia de nivel):",
    brief.goodExamples,
    "",
    "EJEMPLOS A EVITAR (AI-slop o fuera de marca):",
    brief.badExamples,
    "",
    "OBJETIVOS DE PIEZA (elige 1-2 por pieza):",
    "  - atraer: hook de alcance frío, tema polémico o gancho fuerte",
    "  - conectar: contenido personal, historia, día a día",
    "  - educar: mito vs realidad, técnica, tutorial nutricional",
    "  - convertir: CTA a Performance o lead magnet, testimonio, resultado",
    "  - lanzamiento: pieza de un bloque de lanzamiento (recordatorio, urgencia, apertura, cierre)",
    "",
    "TIPOS DE SEMANA:",
    "  - educativa: mezcla estándar, sin lanzamiento activo",
    "  - objeciones: rebatir creencias limitantes del cliente ideal",
    "  - lanzamiento: promoción activa de Performance",
    "  - recuperacion: bajar intensidad tras lanzamiento, aportar valor puro",
    "",
    "FORMATOS DISPONIBLES:",
    "  - reel: vídeo corto vertical (default para alcance e identificación)",
    "  - carousel: 6-10 slides (default para profundizar y educar)",
    "  - infographic: pieza estática única",
    "  - image: foto suelta (behind the scenes / personal)",
    "  - live: directo",
    "",
    "REGLAS DE SALIDA:",
    "- Responde SOLO con la herramienta `submit_strategy`, sin texto adicional.",
    "- Si el usuario especifica una fecha de lanzamiento, alinea la semana de lanzamiento con esa fecha.",
    "- Si el usuario pide una mezcla concreta (ej. 3 reels + 1 carrusel/semana), respétala EXACTAMENTE.",
    "- Títulos cortos y específicos (nunca genéricos tipo 'Sobre los hidratos').",
    "- 'hook' = IDEA PRINCIPAL de la pieza en 1-2 frases (qué se cuenta + ángulo/tono). NO es el gancho literal del vídeo — el creador escribirá los planos concretos después. Ej: 'Reel confrontacional sobre por qué el descanso no cura el hombro. Termina con CTA a Performance.'",
    "- Rationale en 1-2 frases explicando por qué esa pieza en ese slot dentro del arco.",
    "- En piezas de venta, menciona AL FALLO NUTRITION PERFORMANCE y CTA 'Escribe PERFORMANCE' en el rationale/hook.",
    "- Nunca prometas resultados garantizados. Nunca uses lenguaje fitness genérico ni cursi.",
  ].join("\n");
}

function buildUserPrompt(input: {
  brief: string;
  targetDate?: string;
  startWeek?: string;
  weeksAhead: number;
  piecesPerWeek?: Record<string, number>;
  recentThemes: string[];
}): string {
  const mix =
    input.piecesPerWeek && Object.keys(input.piecesPerWeek).length > 0
      ? Object.entries(input.piecesPerWeek)
          .filter(([, n]) => n && n > 0)
          .map(([f, n]) => `${n}× ${f}`)
          .join(" + ")
      : "libre — decide tú la mezcla óptima";
  const themesLine =
    input.recentThemes.length > 0
      ? `\n\nTEMAS RECIENTES YA TRATADOS (evita repetirlos exactos):\n${input.recentThemes
          .slice(0, 12)
          .map((t) => `- ${t}`)
          .join("\n")}`
      : "";
  const startLine = input.startWeek
    ? `a partir del lunes ${input.startWeek}`
    : "a partir del próximo lunes";
  return [
    `BRIEF DEL USUARIO:\n${input.brief.trim()}`,
    input.targetDate ? `\nFECHA OBJETIVO (lanzamiento): ${input.targetDate}` : "",
    `\nHORIZONTE: ${input.weeksAhead} semana${input.weeksAhead === 1 ? "" : "s"} ${startLine}.`,
    `\nMEZCLA POR SEMANA: ${mix}`,
    themesLine,
    "\n\nGenera la estrategia usando la herramienta `submit_strategy`.",
  ].join("");
}

async function runGenerate(req: NextRequest) {
  const user = await getActiveProfessional();
  if (!user || !canUseMarketerIA(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const briefText = typeof body?.brief === "string" ? body.brief.trim() : "";
  if (briefText.length < 10) {
    return NextResponse.json(
      { error: "Escribe un brief más detallado (mínimo 10 caracteres)" },
      { status: 400 },
    );
  }
  const weeksAhead = Math.max(1, Math.min(8, Math.round(Number(body?.weeksAhead) || 2)));
  const targetDate =
    typeof body?.targetDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.targetDate)
      ? body.targetDate
      : undefined;
  const startWeek =
    typeof body?.startWeek === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.startWeek)
      ? body.startWeek
      : undefined;
  const piecesPerWeek =
    body?.piecesPerWeek && typeof body.piecesPerWeek === "object"
      ? (body.piecesPerWeek as Record<string, number>)
      : undefined;

  const recentWeeks = await prisma.contentWeek.findMany({
    orderBy: { startDate: "desc" },
    take: 6,
    select: { centralTheme: true },
  });
  const recentThemes = recentWeeks
    .map((w) => w.centralTheme?.trim())
    .filter((t): t is string => !!t);

  const brief = await getAiBrief();

  const tool: Anthropic.Tool = {
    name: "submit_strategy",
    description: "Envía la estrategia de contenido propuesta.",
    input_schema: {
      type: "object",
      required: ["strategy", "weeks"],
      properties: {
        strategy: {
          type: "string",
          description: "Resumen del arco narrativo (2-4 frases).",
        },
        weeks: {
          type: "array",
          items: {
            type: "object",
            required: ["weekOffset", "centralTheme", "bodyZone", "weekType", "pieces"],
            properties: {
              weekOffset: {
                type: "number",
                description: "0 = semana de inicio, 1 = la siguiente...",
              },
              centralTheme: { type: "string" },
              bodyZone: { type: "string" },
              weekType: {
                type: "string",
                enum: ["educativa", "objeciones", "lanzamiento", "recuperacion"],
              },
              limitingBeliefs: { type: "array", items: { type: "string" } },
              pieces: {
                type: "array",
                items: {
                  type: "object",
                  required: ["dayOfWeek", "format", "title", "hook", "goals", "rationale"],
                  properties: {
                    dayOfWeek: { type: "number", description: "1=Lun ... 7=Dom" },
                    format: {
                      type: "string",
                      enum: ["reel", "carousel", "infographic", "image", "live"],
                    },
                    title: { type: "string" },
                    hook: { type: "string" },
                    goals: {
                      type: "array",
                      items: {
                        type: "string",
                        enum: ["atraer", "conectar", "educar", "convertir", "lanzamiento"],
                      },
                    },
                    rationale: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  try {
    const msg = await client().messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: systemPrompt(brief),
      tools: [tool],
      tool_choice: { type: "tool", name: "submit_strategy" },
      messages: [
        {
          role: "user",
          content: buildUserPrompt({
            brief: briefText,
            targetDate,
            startWeek,
            weeksAhead,
            piecesPerWeek,
            recentThemes,
          }),
        },
      ],
    });

    const toolUse = msg.content.find(
      (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
    );
    if (!toolUse) {
      const textFallback = msg.content
        .filter((c): c is Anthropic.TextBlock => c.type === "text")
        .map((c) => c.text)
        .join("\n")
        .slice(0, 500);
      console.warn("[marketer/generate] Sin tool_use. Text:", textFallback);
      return NextResponse.json({ error: "La IA no devolvió estrategia" }, { status: 502 });
    }
    const parsed = toolUse.input as { strategy?: string; weeks?: unknown };
    return NextResponse.json({
      ok: true,
      strategy: String(parsed.strategy ?? ""),
      weeks: Array.isArray(parsed.weeks) ? parsed.weeks : [],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error llamando a la IA";
    console.error("[marketer/generate] Anthropic:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    return await runGenerate(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error inesperado generando estrategia";
    console.error("[marketer/generate] top-level:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
