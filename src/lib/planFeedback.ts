import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Cargas que alimentan el prompt de la IA cuando genera un plan:
 *  - REGLAS GLOBALES → todas las PlanGenerationRule activas, en orden.
 *  - APRENDIZAJES PREVIOS → las últimas N razones de planes valorados
 *    como "bueno" o "malo" para que la IA refuerce lo que el equipo ha
 *    aplaudido y evite lo que ha rechazado.
 *
 * Los snapshots completos de los planes valorados NO se inyectan: son demasiado
 * grandes y descontextualizados (un plan que estuvo genial para X cliente puede
 * no aplicar a Y). Solo se inyectan las razones (frases del nutri).
 */

const RECENT_REASONS_LIMIT = 5;

export async function getActiveGenerationRules(): Promise<string[]> {
  const rows = await prisma.planGenerationRule.findMany({
    where: { active: true },
    orderBy: { order: "asc" },
    select: { text: true },
  });
  return rows.map((r) => r.text.trim()).filter((t) => t.length > 0);
}

export type RecentReasons = { good: string[]; bad: string[] };

export async function getRecentFeedbackReasons(): Promise<RecentReasons> {
  const [good, bad] = await Promise.all([
    prisma.planGenerationFeedback.findMany({
      where: { verdict: "good" },
      orderBy: { createdAt: "desc" },
      take: RECENT_REASONS_LIMIT,
      select: { reason: true },
    }),
    prisma.planGenerationFeedback.findMany({
      where: { verdict: "bad" },
      orderBy: { createdAt: "desc" },
      take: RECENT_REASONS_LIMIT,
      select: { reason: true },
    }),
  ]);
  return {
    good: good.map((r) => r.reason.trim()).filter((t) => t.length > 0),
    bad: bad.map((r) => r.reason.trim()).filter((t) => t.length > 0),
  };
}

/** Devuelve los bloques de texto ya formateados listos para concatenar al
 *  system prompt en planGenerator. Vacíos si no hay reglas ni feedback. */
export async function buildLearningPromptBlocks(): Promise<string[]> {
  const blocks: string[] = [];
  const [rules, reasons] = await Promise.all([
    getActiveGenerationRules(),
    getRecentFeedbackReasons(),
  ]);

  if (rules.length > 0) {
    const lines = ["\n\n=== REGLAS GLOBALES DEL EQUIPO ==="];
    rules.forEach((r, i) => lines.push(`${i + 1}. ${r}`));
    lines.push("\nEstas reglas son IRROMPIBLES y aplican a TODOS los planes que generas.");
    blocks.push(lines.join("\n"));
  }

  if (reasons.good.length > 0 || reasons.bad.length > 0) {
    const lines = ["\n\n=== APRENDIZAJES PREVIOS DEL EQUIPO ==="];
    if (reasons.good.length > 0) {
      lines.push("\nPlanes que el equipo aprobó (mantén estas ideas):");
      reasons.good.forEach((r, i) => lines.push(`  ✓ ${i + 1}. ${r}`));
    }
    if (reasons.bad.length > 0) {
      lines.push("\nPlanes que el equipo rechazó (evita estos errores):");
      reasons.bad.forEach((r, i) => lines.push(`  ✗ ${i + 1}. ${r}`));
    }
    blocks.push(lines.join("\n"));
  }

  return blocks;
}
