"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { weekStartFor } from "@/lib/weekly-tasks";

const ALLOWED_TOGGLERS = ["nutricionista", "head_coach"];

/**
 * Marca o desmarca una tarea semanal para el profesional actual y la semana
 * actual (lunes 00:00 Madrid). Solo nutricionistas y head_coach pueden marcar.
 * El CEO ve la tarjeta solo para administrar.
 */
export async function toggleWeeklyTask(templateId: string) {
  const prof = await requireProfessional();
  if (!ALLOWED_TOGGLERS.includes(prof.role)) {
    throw new Error("Tu rol no marca tareas semanales.");
  }

  // Comprobamos que la plantilla existe y, si tiene asignatario, que es el actor.
  const template = await prisma.weeklyTaskTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, assigneeId: true, active: true },
  });
  if (!template || !template.active) throw new Error("Tarea no disponible.");
  if (template.assigneeId && template.assigneeId !== prof.id) {
    throw new Error("Esta tarea no está asignada a ti.");
  }

  const weekStart = weekStartFor();
  const existing = await prisma.weeklyTaskCompletion.findUnique({
    where: {
      templateId_professionalId_weekStart: {
        templateId,
        professionalId: prof.id,
        weekStart,
      },
    },
  });

  if (existing) {
    await prisma.weeklyTaskCompletion.delete({ where: { id: existing.id } });
  } else {
    await prisma.weeklyTaskCompletion.create({
      data: { templateId, professionalId: prof.id, weekStart },
    });
  }

  revalidatePath("/");
}
