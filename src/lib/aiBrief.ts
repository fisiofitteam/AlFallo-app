import "server-only";
import { prisma } from "@/lib/prisma";
import {
  BRIEF_SCOPES,
  type BriefAttachment,
  type BriefScope,
  type BriefShape,
} from "@/lib/ai-brief-types";

export { BRIEF_SCOPES, BRIEF_SCOPE_LABELS } from "@/lib/ai-brief-types";
export type { BriefScope, BriefShape, BriefAttachment } from "@/lib/ai-brief-types";

function emptyBrief(scope: BriefScope): BriefShape {
  return {
    scope,
    philosophy: "",
    preferredFoods: "",
    avoidFoods: "",
    equivalences: "",
    additionalRules: "",
    examplePlans: "",
    equivalencesAttachments: [],
    examplePlansAttachments: [],
  };
}

// Fila de Prisma (parcial) con los campos legacy y los nuevos arrays.
type Row = {
  scope: string;
  philosophy: string;
  preferredFoods: string;
  avoidFoods: string;
  equivalences: string;
  additionalRules: string;
  examplePlans: string;
  equivalencesFileUrl: string | null;
  equivalencesFileName: string | null;
  examplePlansFileUrl: string | null;
  examplePlansFileName: string | null;
  equivalencesAttachments: unknown;
  examplePlansAttachments: unknown;
};

function safeAttachmentList(value: unknown): BriefAttachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (!v || typeof v !== "object") return null;
      const url = (v as { url?: unknown }).url;
      const name = (v as { name?: unknown }).name;
      if (typeof url !== "string" || typeof name !== "string") return null;
      return { url, name };
    })
    .filter((x): x is BriefAttachment => x !== null);
}

// Mergea el archivo legacy (1 archivo, *FileUrl/*FileName) al INICIO del
// array de adjuntos si no estaba ya. Así no se pierden subidas previas y la
// migración a múltiples es transparente.
function mergeLegacy(
  legacyUrl: string | null,
  legacyName: string | null,
  list: BriefAttachment[],
): BriefAttachment[] {
  if (!legacyUrl) return list;
  const already = list.some((a) => a.url === legacyUrl);
  if (already) return list;
  const name = legacyName?.trim() || "archivo";
  return [{ url: legacyUrl, name }, ...list];
}

function shape(row: Row): BriefShape {
  return {
    scope: row.scope as BriefScope,
    philosophy: row.philosophy,
    preferredFoods: row.preferredFoods,
    avoidFoods: row.avoidFoods,
    equivalences: row.equivalences,
    additionalRules: row.additionalRules,
    examplePlans: row.examplePlans,
    equivalencesAttachments: mergeLegacy(
      row.equivalencesFileUrl,
      row.equivalencesFileName,
      safeAttachmentList(row.equivalencesAttachments),
    ),
    examplePlansAttachments: mergeLegacy(
      row.examplePlansFileUrl,
      row.examplePlansFileName,
      safeAttachmentList(row.examplePlansAttachments),
    ),
  };
}

export async function getAllBriefs(): Promise<BriefShape[]> {
  const rows = await prisma.aIPlanBrief.findMany();
  const byScope = new Map(rows.map((r) => [r.scope, r as Row]));
  return BRIEF_SCOPES.map((s) => {
    const row = byScope.get(s);
    if (!row) return emptyBrief(s);
    return shape(row);
  });
}

export async function getBriefForGoal(
  goal: string | null,
): Promise<{ global: BriefShape; goal: BriefShape | null }> {
  const wanted: BriefScope[] = ["global"];
  if (goal && (BRIEF_SCOPES as readonly string[]).includes(goal)) {
    wanted.push(goal as BriefScope);
  }
  const rows = await prisma.aIPlanBrief.findMany({ where: { scope: { in: wanted } } });
  const map = new Map(rows.map((r) => [r.scope, r as Row]));
  const globalRow = map.get("global");
  const goalRow = goal ? map.get(goal) : null;
  return {
    global: globalRow ? shape(globalRow) : emptyBrief("global"),
    goal: goalRow ? shape(goalRow) : null,
  };
}

export async function saveBrief(brief: BriefShape): Promise<void> {
  // Al guardar: escribimos la lista nueva en *Attachments y limpiamos los
  // campos legacy (*FileUrl/*FileName) para evitar duplicados. Si la lista
  // quedó vacía, ambos quedan nulos.
  await prisma.aIPlanBrief.upsert({
    where: { scope: brief.scope },
    create: {
      scope: brief.scope,
      philosophy: brief.philosophy,
      preferredFoods: brief.preferredFoods,
      avoidFoods: brief.avoidFoods,
      equivalences: brief.equivalences,
      additionalRules: brief.additionalRules,
      examplePlans: brief.examplePlans,
      equivalencesFileUrl: null,
      equivalencesFileName: null,
      examplePlansFileUrl: null,
      examplePlansFileName: null,
      equivalencesAttachments: brief.equivalencesAttachments as object,
      examplePlansAttachments: brief.examplePlansAttachments as object,
    },
    update: {
      philosophy: brief.philosophy,
      preferredFoods: brief.preferredFoods,
      avoidFoods: brief.avoidFoods,
      equivalences: brief.equivalences,
      additionalRules: brief.additionalRules,
      examplePlans: brief.examplePlans,
      equivalencesFileUrl: null,
      equivalencesFileName: null,
      examplePlansFileUrl: null,
      examplePlansFileName: null,
      equivalencesAttachments: brief.equivalencesAttachments as object,
      examplePlansAttachments: brief.examplePlansAttachments as object,
    },
  });
}

export function assembleAIBrief(global: BriefShape, goalSpecific: BriefShape | null): string {
  const parts: string[] = [];

  function appendBlock(brief: BriefShape, label: string) {
    const blocks: { tag: string; body: string }[] = [
      { tag: "FILOSOFÍA NUTRICIONAL", body: brief.philosophy },
      { tag: "ALIMENTOS PREFERIDOS", body: brief.preferredFoods },
      { tag: "ALIMENTOS A EVITAR", body: brief.avoidFoods },
      { tag: "EQUIVALENCIAS Y PORCIONES", body: brief.equivalences },
      { tag: "REGLAS ADICIONALES", body: brief.additionalRules },
      { tag: "DIETAS DE EJEMPLO (sirven de plantilla de estilo y estructura, no copies literal)", body: brief.examplePlans },
    ];
    const nonEmpty = blocks.filter((b) => b.body.trim());
    if (nonEmpty.length === 0) return;
    parts.push(`=== ${label} ===`);
    for (const b of nonEmpty) {
      parts.push(`[${b.tag}]\n${b.body.trim()}`);
    }
  }

  appendBlock(global, "BRIEF GLOBAL");
  if (goalSpecific) {
    appendBlock(goalSpecific, `BRIEF ESPECÍFICO · ${goalSpecific.scope}`);
  }

  return parts.join("\n\n");
}
