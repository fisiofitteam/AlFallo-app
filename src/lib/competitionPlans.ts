import "server-only";
import { prisma } from "@/lib/prisma";

/** Planes de competición vigentes hoy para el cliente (startDate ≤ hoy ≤ endDate).
 *  Se devuelve el más reciente por fecha de inicio primero. */
export async function listActiveCompetitionPlans(clientId: string, now = new Date()) {
  return prisma.competitionPlan.findMany({
    where: {
      clientId,
      startDate: { lte: now },
      endDate: { gte: startOfDay(now) },
    },
    orderBy: [{ startDate: "desc" }],
  });
}

/** El primer plan cuyo startDate es futuro (para banner "próximamente"). */
export async function nextUpcomingCompetitionPlan(clientId: string, now = new Date()) {
  return prisma.competitionPlan.findFirst({
    where: { clientId, startDate: { gt: now } },
    orderBy: { startDate: "asc" },
  });
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
