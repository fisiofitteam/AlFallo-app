import "server-only";
import { prisma } from "@/lib/prisma";

export type SpecialConsiderationDTO = {
  id: string;
  title: string;
  description: string;
  examplePlanUrl: string | null;
  examplePlanName: string | null;
  order: number;
};

/** Lista todas las consideraciones activas, ordenadas como el manager las dejó. */
export async function getAllSpecialConsiderations(): Promise<SpecialConsiderationDTO[]> {
  const rows = await prisma.specialConsideration.findMany({
    where: { active: true },
    orderBy: [{ order: "asc" }, { title: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    examplePlanUrl: r.examplePlanUrl,
    examplePlanName: r.examplePlanName,
    order: r.order,
  }));
}

export async function getSpecialConsiderationsByIds(
  ids: string[],
): Promise<SpecialConsiderationDTO[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.specialConsideration.findMany({
    where: { id: { in: ids }, active: true },
    orderBy: [{ order: "asc" }, { title: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    examplePlanUrl: r.examplePlanUrl,
    examplePlanName: r.examplePlanName,
    order: r.order,
  }));
}
