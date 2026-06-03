"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import { parseStr } from "@/lib/clients";
import { WEEKDAY_VALUES } from "@/lib/weekly-tasks";

// Solo CEO + head_coach configuran tareas semanales.
async function requireManager() {
  const prof = await requireProfessional();
  if (!isManager(prof.role)) redirect("/");
  return prof;
}

function parseDay(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return WEEKDAY_VALUES.includes(n) ? n : null;
}

export async function createWeeklyTask(formData: FormData) {
  const prof = await requireManager();
  const title = parseStr(formData.get("title"));
  if (!title) return;
  const dayOfWeek = parseDay(formData.get("dayOfWeek")) ?? 1;
  const assigneeId = parseStr(formData.get("assigneeId"));
  // Orden = al final del día.
  const count = await prisma.weeklyTaskTemplate.count({ where: { dayOfWeek, active: true } });
  await prisma.weeklyTaskTemplate.create({
    data: {
      title,
      description: parseStr(formData.get("description")),
      dayOfWeek,
      order: count,
      assigneeId: assigneeId || null,
      createdById: prof.id,
    },
  });
  revalidatePath("/tareas");
  revalidatePath("/");
}

export async function updateWeeklyTask(formData: FormData) {
  await requireManager();
  const id = parseStr(formData.get("id"));
  if (!id) return;
  const title = parseStr(formData.get("title"));
  const dayOfWeek = parseDay(formData.get("dayOfWeek"));
  const assigneeId = parseStr(formData.get("assigneeId"));
  if (!title || dayOfWeek === null) return;

  await prisma.weeklyTaskTemplate.update({
    where: { id },
    data: {
      title,
      description: parseStr(formData.get("description")),
      dayOfWeek,
      assigneeId: assigneeId || null,
    },
  });
  revalidatePath("/tareas");
  revalidatePath("/");
}

export async function deleteWeeklyTask(formData: FormData) {
  await requireManager();
  const id = parseStr(formData.get("id"));
  if (!id) return;
  // Borrado real: las completions se borran en cascada (FK Cascade).
  await prisma.weeklyTaskTemplate.delete({ where: { id } });
  revalidatePath("/tareas");
  revalidatePath("/");
}

export async function toggleActive(formData: FormData) {
  await requireManager();
  const id = parseStr(formData.get("id"));
  if (!id) return;
  const current = await prisma.weeklyTaskTemplate.findUnique({
    where: { id },
    select: { active: true },
  });
  if (!current) return;
  await prisma.weeklyTaskTemplate.update({
    where: { id },
    data: { active: !current.active },
  });
  revalidatePath("/tareas");
  revalidatePath("/");
}
