"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";

async function requireManager() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/biblioteca");
  return prof;
}

function parseStr(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function parseWeeklyTarget(v: FormDataEntryValue | null): number {
  const n = typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return 7;
  return Math.min(7, Math.max(1, Math.round(n)));
}

export async function createHabit(formData: FormData) {
  await requireManager();
  const name = parseStr(formData.get("name"));
  if (!name) return;
  const emoji = parseStr(formData.get("emoji"));
  const description = parseStr(formData.get("description"));
  const weeklyTarget = parseWeeklyTarget(formData.get("weeklyTarget"));
  const last = await prisma.habitDefinition.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await prisma.habitDefinition.create({
    data: {
      name: name.slice(0, 60),
      emoji: emoji?.slice(0, 4) ?? null,
      description: description?.slice(0, 200) ?? null,
      weeklyTarget,
      order: (last?.order ?? -1) + 1,
      active: true,
    },
  });
  revalidatePath("/biblioteca/habitos");
  revalidatePath("/cliente");
}

export async function updateHabit(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  const name = parseStr(formData.get("name"));
  if (!name) return;
  await prisma.habitDefinition.update({
    where: { id },
    data: {
      name: name.slice(0, 60),
      emoji: parseStr(formData.get("emoji"))?.slice(0, 4) ?? null,
      description: parseStr(formData.get("description"))?.slice(0, 200) ?? null,
      weeklyTarget: parseWeeklyTarget(formData.get("weeklyTarget")),
    },
  });
  revalidatePath("/biblioteca/habitos");
  revalidatePath("/cliente");
}

export async function toggleHabitActive(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  const cur = await prisma.habitDefinition.findUnique({ where: { id }, select: { active: true } });
  if (!cur) return;
  await prisma.habitDefinition.update({ where: { id }, data: { active: !cur.active } });
  revalidatePath("/biblioteca/habitos");
  revalidatePath("/cliente");
}

export async function deleteHabit(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  await prisma.habitDefinition.delete({ where: { id } });
  revalidatePath("/biblioteca/habitos");
  revalidatePath("/cliente");
}

export async function moveHabit(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  const dir = String(formData.get("direction")) === "up" ? "up" : "down";
  const all = await prisma.habitDefinition.findMany({
    orderBy: { order: "asc" },
    select: { id: true },
  });
  const idx = all.findIndex((h) => h.id === id);
  if (idx < 0) return;
  const j = idx + (dir === "up" ? -1 : 1);
  if (j < 0 || j >= all.length) return;
  const swap = [...all];
  [swap[idx], swap[j]] = [swap[j], swap[idx]];
  await prisma.$transaction(
    swap.map((h, i) =>
      prisma.habitDefinition.update({ where: { id: h.id }, data: { order: i } }),
    ),
  );
  revalidatePath("/biblioteca/habitos");
}
