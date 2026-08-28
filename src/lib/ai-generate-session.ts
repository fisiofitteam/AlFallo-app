import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import {
  getAiTrainingBrief,
  BRIEF_KIND_LABEL,
  type BriefKind,
  type AiTrainingBriefData,
} from "@/lib/ai-training-brief";

// Motor de generación de UNA sesión con Claude + tool-use forzado. El endpoint
// /api/ai/generate-session envuelve esta función con auth y validación; el
// bucle de macrociclo vive en el cliente (AiGenerateProgramModal).

const MODEL = "claude-sonnet-4-6";
const MAX_OUTPUT_TOKENS = 4000;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada.");
  _client = new Anthropic({ apiKey });
  return _client;
}

export type GeneratedBlock = {
  heading: string;
  body: string;
  exercises: string[];
};

export type GeneratedSession = {
  title: string;
  description: string | null;
  blocks: GeneratedBlock[];
};

export type GenerateSessionInput = {
  kind: BriefKind;
  prompt: string;
  dayOfWeek?: number | null;
  durationMin?: number | null;
  extraContext?: string | null;
};

export type GenerateSessionResult = {
  session: GeneratedSession;
  meta: {
    model: string;
    kind: BriefKind;
    exampleIds: string[];
    inputTokens: number;
    outputTokens: number;
    elapsedMs: number;
  };
};

function composeSystemFromFields(kind: BriefKind, b: AiTrainingBriefData): string {
  const modality = BRIEF_KIND_LABEL[kind] ?? kind;
  const parts: string[] = [];
  parts.push(
    `Eres el coach generando UNA sesión de entrenamiento de modalidad ${modality}. Devuelve tu respuesta usando la tool provista.`,
  );
  if (b.philosophy.trim()) parts.push(`## Filosofía\n${b.philosophy.trim()}`);
  if (b.voiceTone.trim()) parts.push(`## Voz y tono\n${b.voiceTone.trim()}`);
  if (b.structureHints.trim()) parts.push(`## Estructura\n${b.structureHints.trim()}`);
  if (b.formats.trim()) parts.push(`## Formatos y notación\n${b.formats.trim()}`);
  if (b.intensityRules.trim()) parts.push(`## Intensidad\n${b.intensityRules.trim()}`);
  if (b.vocabulary.trim()) parts.push(`## Vocabulario\n${b.vocabulary.trim()}`);
  if (b.dos.trim()) parts.push(`## Do's\n${b.dos.trim()}`);
  if (b.donts.trim()) parts.push(`## Don'ts\n${b.donts.trim()}`);
  if (b.goodExamples.trim()) parts.push(`## Ejemplos buenos\n${b.goodExamples.trim()}`);
  if (b.badExamples.trim()) parts.push(`## Ejemplos malos\n${b.badExamples.trim()}`);
  return parts.join("\n\n");
}

const STOPWORDS = new Set([
  "el", "la", "los", "las", "un", "una", "de", "del", "al", "y", "o", "con", "sin",
  "en", "por", "para", "que", "es", "hoy", "toca", "tocan", "hacer", "sesion",
  "sesión", "min", "minutos",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

type ExampleRow = {
  id: string;
  title: string;
  summary: string;
  focusTags: string;
  description: string | null;
  blocksJSON: string;
  exerciseNames: string;
};

function scoreExample(promptTokens: string[], e: ExampleRow): number {
  const hay = [e.title, e.summary, e.focusTags, e.description ?? "", e.exerciseNames]
    .join(" ")
    .toLowerCase();
  const hayNorm = hay.normalize("NFD").replace(/[̀-ͯ]/g, "");
  let s = 0;
  for (const t of promptTokens) {
    if (hayNorm.includes(t)) s += 1;
    if (e.title.toLowerCase().includes(t)) s += 1;
    if (e.focusTags.toLowerCase().includes(t)) s += 1;
  }
  return s;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function retrieveExamples(
  kind: BriefKind,
  prompt: string,
  topN = 4,
): Promise<ExampleRow[]> {
  const all = await prisma.aiSessionExample.findMany({
    where: { kind },
    select: {
      id: true,
      title: true,
      summary: true,
      focusTags: true,
      description: true,
      blocksJSON: true,
      exerciseNames: true,
    },
  });
  if (all.length === 0) return [];
  const tokens = tokenize(prompt);
  if (tokens.length === 0) return shuffle(all).slice(0, topN);
  const scored = all.map((e) => ({ e, s: scoreExample(tokens, e) }));
  scored.sort((a, b) => b.s - a.s);
  if (scored[0].s === 0) return shuffle(all).slice(0, topN);
  return scored.slice(0, topN).map((x) => x.e);
}

function renderExample(e: ExampleRow): string {
  let blocks: { heading: string; body: string; exercises?: string[] }[] = [];
  try {
    const parsed = JSON.parse(e.blocksJSON);
    if (Array.isArray(parsed)) blocks = parsed;
  } catch {
    /* noop */
  }
  const lines: string[] = [];
  lines.push(`## ${e.title}`);
  if (e.description) lines.push(`> ${e.description}`);
  for (const b of blocks) {
    lines.push("");
    lines.push(`**${b.heading}**`);
    lines.push(b.body);
  }
  return lines.join("\n");
}

const TOOL_NAME = "emit_session";
const TOOL_SCHEMA: Anthropic.Tool = {
  name: TOOL_NAME,
  description: "Emite la sesión generada como JSON estructurado.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Título corto de la sesión." },
      description: {
        type: "string",
        description:
          "Intro opcional (2-4 líneas). Si no aporta, devuelve cadena vacía.",
      },
      blocks: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            heading: {
              type: "string",
              description: "Nombre del bloque en MAYÚSCULAS (WARM UP, WOD, ACCESORIO, ...).",
            },
            body: {
              type: "string",
              description:
                "Cuerpo con formato, ejercicios, cargas y pausas. Usa saltos de línea reales.",
            },
            exercises: {
              type: "array",
              items: { type: "string" },
              description: "Nombres de ejercicios del bloque, para contexto anti-repetición.",
            },
          },
          required: ["heading", "body", "exercises"],
        },
      },
    },
    required: ["title", "blocks"],
  },
};

export async function generateSession(input: GenerateSessionInput): Promise<GenerateSessionResult> {
  const t0 = Date.now();
  const brief = await getAiTrainingBrief(input.kind);
  const system = brief.systemPrompt.trim()
    ? brief.systemPrompt.trim()
    : composeSystemFromFields(input.kind, brief);
  const examples = await retrieveExamples(input.kind, input.prompt, 4);

  const contextParts: string[] = [];
  if (typeof input.dayOfWeek === "number") {
    const names = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
    contextParts.push(`Día: ${names[input.dayOfWeek] ?? input.dayOfWeek}`);
  }
  if (typeof input.durationMin === "number") {
    contextParts.push(`Duración objetivo: ${input.durationMin} min`);
  }
  if (input.extraContext?.trim()) contextParts.push(`Extra: ${input.extraContext.trim()}`);

  const exampleBlock =
    examples.length > 0
      ? `Ejemplos de mi estilo (usa como referencia; NO los copies literales):\n\n${examples
          .map(renderExample)
          .join("\n\n---\n\n")}`
      : "";

  const userMessage = [
    exampleBlock,
    contextParts.length > 0 ? `Contexto: ${contextParts.join(" · ")}` : "",
    `Pedido del coach:\n${input.prompt.trim()}`,
    `Genera UNA sesión completa devolviéndola con la tool \`${TOOL_NAME}\`.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await client().messages.create({
    model: MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    system,
    tools: [TOOL_SCHEMA],
    tool_choice: { type: "tool", name: TOOL_NAME },
    messages: [{ role: "user", content: userMessage }],
  });

  const tu = res.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use",
  );
  if (!tu) throw new Error("Claude no llamó a la tool emit_session");
  const raw = tu.input as {
    title?: string;
    description?: string | null;
    blocks?: Array<{ heading?: string; body?: string; exercises?: string[] }>;
  };
  if (!raw?.title || !Array.isArray(raw?.blocks)) {
    throw new Error("Salida sin title o blocks");
  }

  const session: GeneratedSession = {
    title: raw.title,
    description:
      typeof raw.description === "string" && raw.description.trim() ? raw.description : null,
    blocks: raw.blocks.map((b) => ({
      heading: String(b.heading ?? ""),
      body: String(b.body ?? ""),
      exercises: Array.isArray(b.exercises) ? b.exercises.map(String) : [],
    })),
  };

  return {
    session,
    meta: {
      model: MODEL,
      kind: input.kind,
      exampleIds: examples.map((e) => e.id),
      inputTokens: res.usage?.input_tokens ?? 0,
      outputTokens: res.usage?.output_tokens ?? 0,
      elapsedMs: Date.now() - t0,
    },
  };
}
