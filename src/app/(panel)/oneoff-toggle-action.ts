"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { activeInstanceFor } from "@/lib/oneoff-tasks";

const ALLOWED_TOGGLERS = ["nutricionista", "head_coach"];

/**
 * Marca/desmarca una tarea puntual para el actor y la INSTANCIA activa hoy.
 * Si la tarea no está activa hoy (regla no aplica), no hace nada.
 */
export async function toggleOneOffTask(templateId: string) {
  const prof = await requireProfessional();
  if (!ALLOWED_TOGGLERS.includes(prof.role)) {
    throw new Error("Tu rol no marca tareas puntuales.");
  }

  const tpl = await prisma.oneOffTaskTemplate.findUnique({
    where: { id: templateId },
  });
  if (!tpl || !tpl.active) throw new Error("Tarea no disponible.");
  if (tpl.targetRole !== prof.role) throw new Error("No es tu rol.");
  if (tpl.assigneeId && tpl.assigneeId !== prof.id) {
    throw new Error("No te toca esta tarea.");
  }

  const instanceDate = activeInstanceFor({
    mode: tpl.mode,
    date: tpl.date,
    startDate: tpl.startDate,
    endDate: tpl.endDate,
    nthWeek: tpl.nthWeek,
    weekday: tpl.weekday,
    until: tpl.until,
  });
  if (!instanceDate) throw new Error("La tarea no está activa hoy.");

  const existing = await prisma.oneOffTaskCompletion.findUnique({
    where: {
      templateId_professionalId_instanceDate: {
        templateId,
        professionalId: prof.id,
        instanceDate,
      },
    },
  });
  if (existing) {
    await prisma.oneOffTaskCompletion.delete({ where: { id: existing.id } });
  } else {
    await prisma.oneOffTaskCompletion.create({
      data: { templateId, professionalId: prof.id, instanceDate },
    });
  }

  revalidatePath("/");
}
