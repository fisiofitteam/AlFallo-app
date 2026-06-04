import "server-only";
import { prisma } from "@/lib/prisma";
import {
  BRIEF_SCOPES,
  type BriefScope,
  type BriefShape,
} from "@/lib/ai-brief-types";

// Re-exportamos los tipos/constantes públicos para que quien ya tiraba de
// aiBrief siga funcionando, y los nuevos consumidores puedan venir de
// ai-brief-types directamente.
export { BRIEF_SCOPES, BRIEF_SCOPE_LABELS } from "@/lib/ai-brief-types";
export type { BriefScope, BriefShape } from "@/lib/ai-brief-types";

function emptyBrief(scope: BriefScope): BriefShape {
  return {
    scope,
    philosophy: "",
    preferredFoods: "",
    avoidFoods: "",
    equivalences: "",
    additionalRules: "",
    examplePlans: "",
  };
}

export async function getAllBriefs(): Promise<BriefShape[]> {
  const rows = await prisma.aIPlanBrief.findMany();
  const byScope = new Map(rows.map((r) => [r.scope, r]));
  return BRIEF_SCOPES.map((s) => {
    const row = byScope.get(s);
    if (!row) return emptyBrief(s);
    return {
      scope: s,
      philosophy: row.philosophy,
      preferredFoods: row.preferredFoods,
      avoidFoods: row.avoidFoods,
      equivalences: row.equivalences,
      additionalRules: row.additionalRules,
      examplePlans: row.examplePlans,
    };
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
  const map = new Map(rows.map((r) => [r.scope, r]));
  const globalRow = map.get("global");
  const goalRow = goal ? map.get(goal) : null;
  return {
    global: globalRow
      ? {
          scope: "global",
          philosophy: globalRow.philosophy,
          preferredFoods: globalRow.preferredFoods,
          avoidFoods: globalRow.avoidFoods,
          equivalences: globalRow.equivalences,
          additionalRules: globalRow.additionalRules,
          examplePlans: globalRow.examplePlans,
        }
      : emptyBrief("global"),
    goal: goalRow
      ? {
          scope: goalRow.scope as BriefScope,
          philosophy: goalRow.philosophy,
          preferredFoods: goalRow.preferredFoods,
          avoidFoods: goalRow.avoidFoods,
          equivalences: goalRow.equivalences,
          additionalRules: goalRow.additionalRules,
          examplePlans: goalRow.examplePlans,
        }
      : null,
  };
}

export async function saveBrief(brief: BriefShape): Promise<void> {
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
    },
    update: {
      philosophy: brief.philosophy,
      preferredFoods: brief.preferredFoods,
      avoidFoods: brief.avoidFoods,
      equivalences: brief.equivalences,
      additionalRules: brief.additionalRules,
      examplePlans: brief.examplePlans,
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
