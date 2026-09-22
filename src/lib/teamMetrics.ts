import { prisma } from "@/lib/prisma";
import { parseQuestions } from "@/lib/satisfactionForms";

export type PeriodPreset = "mensual" | "trimestral" | "anual" | "custom";

export type Period = { from: Date; to: Date; label: string; preset: PeriodPreset };

export function resolvePeriod(
  preset: PeriodPreset,
  now: Date = new Date(),
  customFrom?: Date | null,
  customTo?: Date | null,
): Period {
  if (preset === "custom" && customFrom && customTo) {
    return { from: customFrom, to: customTo, label: "Personalizado", preset };
  }
  const y = now.getFullYear();
  const m = now.getMonth();
  if (preset === "trimestral") {
    const qStart = Math.floor(m / 3) * 3;
    return {
      from: new Date(y, qStart, 1, 0, 0, 0, 0),
      to: new Date(y, qStart + 3, 1, 0, 0, 0, 0),
      label: `Q${Math.floor(m / 3) + 1} ${y}`,
      preset,
    };
  }
  if (preset === "anual") {
    return {
      from: new Date(y, 0, 1, 0, 0, 0, 0),
      to: new Date(y + 1, 0, 1, 0, 0, 0, 0),
      label: `${y}`,
      preset,
    };
  }
  return {
    from: new Date(y, m, 1, 0, 0, 0, 0),
    to: new Date(y, m + 1, 1, 0, 0, 0, 0),
    label: now.toLocaleDateString("es-ES", { month: "long", year: "numeric" }),
    preset: "mensual",
  };
}

export type SatisfactionBreakdown = {
  average: number | null; // 0-10 normalizado
  count: number; // número de respuestas puntuadas
};

export type TeamSatisfactionMetrics = {
  global: SatisfactionBreakdown;
  byProfessional: Array<{
    professionalId: string | null;
    professionalName: string;
    metrics: SatisfactionBreakdown;
  }>;
};

/**
 * Media global de satisfacción (normalizada a 0-10) en el rango indicado.
 * Solo cuentan respuestas a preguntas escala marcadas como
 * `isSatisfactionScore`. Cada respuesta escala se reescala a 0-10.
 * También devuelve el desglose por nutricionista asignado al cliente.
 */
export async function getTeamSatisfaction(period: Period): Promise<TeamSatisfactionMetrics> {
  const responses = await prisma.satisfactionResponse.findMany({
    where: { submittedAt: { gte: period.from, lt: period.to } },
    include: {
      form: { select: { questions: true } },
      client: { select: { nutritionistId: true } },
    },
  });

  const professionals = await prisma.professional.findMany({
    where: { isActive: true, role: { in: ["nutricionista", "head_coach"] } },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  });

  const scoresByProf = new Map<string | null, number[]>();
  const globalScores: number[] = [];

  for (const r of responses) {
    const questions = parseQuestions(r.form.questions);
    const scaleScored = questions.filter(
      (q): q is Extract<typeof q, { type: "scale" }> =>
        q.type === "scale" && !!q.isSatisfactionScore,
    );
    if (scaleScored.length === 0) continue;
    const answers = (r.answers ?? {}) as Record<string, number | string>;
    const profId = r.client?.nutritionistId ?? null;
    const bucket = scoresByProf.get(profId) ?? [];
    for (const q of scaleScored) {
      const raw = answers[q.id];
      const val = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(val)) continue;
      const min = Math.min(q.scaleMin, q.scaleMax);
      const max = Math.max(q.scaleMin, q.scaleMax);
      if (max === min) continue;
      const normalized = ((val - min) / (max - min)) * 10;
      bucket.push(normalized);
      globalScores.push(normalized);
    }
    scoresByProf.set(profId, bucket);
  }

  const average = (arr: number[]): number | null =>
    arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length;

  const byProfessional: TeamSatisfactionMetrics["byProfessional"] = professionals.map((p) => ({
    professionalId: p.id,
    professionalName: p.fullName,
    metrics: {
      average: average(scoresByProf.get(p.id) ?? []),
      count: (scoresByProf.get(p.id) ?? []).length,
    },
  }));

  const orphanScores = scoresByProf.get(null) ?? [];
  if (orphanScores.length > 0) {
    byProfessional.push({
      professionalId: null,
      professionalName: "Sin nutri asignado",
      metrics: { average: average(orphanScores), count: orphanScores.length },
    });
  }

  return {
    global: { average: average(globalScores), count: globalScores.length },
    byProfessional,
  };
}
