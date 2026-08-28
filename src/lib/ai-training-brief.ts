import { prisma } from "@/lib/prisma";

// Un brief por modalidad (kind). Cada modalidad tiene su propia voz de marca
// y su propio banco de ejemplos.

export type BriefKind = string;

export const BUILTIN_BRIEF_KINDS = ["crossfit", "hyrox", "hybrid"] as const;
export const BRIEF_KINDS: string[] = [...BUILTIN_BRIEF_KINDS];

export function isBuiltinBriefKind(x: unknown): x is (typeof BUILTIN_BRIEF_KINDS)[number] {
  return typeof x === "string" && (BUILTIN_BRIEF_KINDS as readonly string[]).includes(x);
}

export function isBriefKind(x: unknown): x is BriefKind {
  return typeof x === "string" && x.trim().length > 0;
}

export const BRIEF_KIND_LABEL: Record<string, string> = {
  crossfit: "CrossFit",
  hyrox: "Hyrox",
  hybrid: "Híbrido",
};

export type AiTrainingBriefData = {
  systemPrompt: string;
  philosophy: string;
  voiceTone: string;
  structureHints: string;
  formats: string;
  intensityRules: string;
  vocabulary: string;
  dos: string;
  donts: string;
  goodExamples: string;
  badExamples: string;
};

const EMPTY: AiTrainingBriefData = {
  systemPrompt: "",
  philosophy: "",
  voiceTone: "",
  structureHints: "",
  formats: "",
  intensityRules: "",
  vocabulary: "",
  dos: "",
  donts: "",
  goodExamples: "",
  badExamples: "",
};

function toData(row: {
  systemPrompt: string;
  philosophy: string;
  voiceTone: string;
  structureHints: string;
  formats: string;
  intensityRules: string;
  vocabulary: string;
  dos: string;
  donts: string;
  goodExamples: string;
  badExamples: string;
}): AiTrainingBriefData {
  return {
    systemPrompt: row.systemPrompt,
    philosophy: row.philosophy,
    voiceTone: row.voiceTone,
    structureHints: row.structureHints,
    formats: row.formats,
    intensityRules: row.intensityRules,
    vocabulary: row.vocabulary,
    dos: row.dos,
    donts: row.donts,
    goodExamples: row.goodExamples,
    badExamples: row.badExamples,
  };
}

export async function getAiTrainingBrief(kind: BriefKind): Promise<AiTrainingBriefData> {
  const row = await prisma.aiTrainingBrief.findUnique({ where: { id: kind } });
  if (!row) return { ...EMPTY };
  return toData(row);
}

export async function updateAiTrainingBrief(
  kind: BriefKind,
  patch: Partial<AiTrainingBriefData>,
  updatedById?: string | null,
): Promise<AiTrainingBriefData> {
  const row = await prisma.aiTrainingBrief.upsert({
    where: { id: kind },
    update: { ...patch, updatedById: updatedById ?? undefined },
    create: {
      id: kind,
      ...EMPTY,
      ...patch,
      updatedById: updatedById ?? undefined,
    },
  });
  return toData(row);
}

/** Vacía todos los campos del brief (id se conserva por si se quiere resembrar). */
export async function clearAiTrainingBrief(kind: BriefKind, updatedById?: string | null) {
  await prisma.aiTrainingBrief.upsert({
    where: { id: kind },
    update: { ...EMPTY, updatedById: updatedById ?? undefined },
    create: { id: kind, ...EMPTY, updatedById: updatedById ?? undefined },
  });
}
