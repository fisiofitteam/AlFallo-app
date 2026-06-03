"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import { parseStr } from "@/lib/clients";
import { WEEKDAY_VALUES } from "@/lib/weekly-tasks";

// Roles que pueden recibir tareas semanales (= roles destino válidos).
const TARGET_ROLES = ["nutricionista", "head_coach"];

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

function parseRole(value: FormDataEntryValue | null): string {
  const v = parseStr(value);
  return v && TARGET_ROLES.includes(v) ? v : "nutricionista";
}

export async function createWeeklyTask(formData: FormData) {
  const prof = await requireManager();
  const title = parseStr(formData.get("title"));
  if (!title) return;
  const dayOfWeek = parseDay(formData.get("dayOfWeek")) ?? 1;
  const targetRole = parseRole(formData.get("targetRole"));
  const assigneeId = parseStr(formData.get("assigneeId"));

  const count = await prisma.weeklyTaskTemplate.count({
    where: { dayOfWeek, targetRole, active: true },
  });

  await prisma.weeklyTaskTemplate.create({
    data: {
      title,
      description: parseStr(formData.get("description")),
      dayOfWeek,
      order: count,
      targetRole,
      assigneeId: assigneeId || null,
      createdById: prof.id,
    },
  });
  revalidatePath("/tareas");
  revalidatePath("/");
}

export async function renameWeeklyTask(formData: FormData) {
  await requireManager();
  const id = parseStr(formData.get("id"));
  const title = parseStr(formData.get("title"));
  if (!id || !title) return;
  await prisma.weeklyTaskTemplate.update({ where: { id }, data: { title } });
  revalidatePath("/tareas");
  revalidatePath("/");
}

export async function moveWeeklyTask(formData: FormData) {
  await requireManager();
  const id = parseStr(formData.get("id"));
  const dayOfWeek = parseDay(formData.get("dayOfWeek"));
  if (!id || dayOfWeek === null) return;
  await prisma.weeklyTaskTemplate.update({ where: { id }, data: { dayOfWeek } });
  revalidatePath("/tareas");
  revalidatePath("/");
}

export async function deleteWeeklyTask(formData: FormData) {
  await requireManager();
  const id = parseStr(formData.get("id"));
  if (!id) return;
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
