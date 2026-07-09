"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import { MARK_CATEGORIES, MARK_UNITS } from "@/lib/strengthMarks";

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

const ALLOWED_UNITS: Set<string> = new Set(MARK_UNITS.map((u) => u.value));
const ALLOWED_CATEGORIES: Set<string> = new Set(MARK_CATEGORIES.map((c) => c.value));

export async function createStrengthMark(formData: FormData) {
  await requireManager();
  const name = parseStr(formData.get("name"));
  if (!name) return;
  const category = parseStr(formData.get("category")) ?? "fuerza";
  const unit = parseStr(formData.get("unit")) ?? "kg";
  const rawDirection = parseStr(formData.get("direction"));
  const direction = rawDirection === "down" ? "down" : "up";
  if (!ALLOWED_UNITS.has(unit) || !ALLOWED_CATEGORIES.has(category)) return;
  const description = parseStr(formData.get("description"));
  const last = await prisma.strengthMark.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await prisma.strengthMark.create({
    data: {
      name: name.slice(0, 80),
      category,
      unit,
      direction,
      description: description?.slice(0, 400) ?? null,
      order: (last?.order ?? -1) + 1,
      active: true,
    },
  });
  revalidatePath("/biblioteca/marcas");
}

export async function updateStrengthMark(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  const name = parseStr(formData.get("name"));
  if (!name) return;
  const category = parseStr(formData.get("category")) ?? "fuerza";
  const unit = parseStr(formData.get("unit")) ?? "kg";
  const rawDirection = parseStr(formData.get("direction"));
  const direction = rawDirection === "down" ? "down" : "up";
  if (!ALLOWED_UNITS.has(unit) || !ALLOWED_CATEGORIES.has(category)) return;
  const description = parseStr(formData.get("description"));
  await prisma.strengthMark.update({
    where: { id },
    data: {
      name: name.slice(0, 80),
      category,
      unit,
      direction,
      description: description?.slice(0, 400) ?? null,
    },
  });
  revalidatePath("/biblioteca/marcas");
}

export async function toggleStrengthMarkActive(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  const current = await prisma.strengthMark.findUnique({
    where: { id },
    select: { active: true },
  });
  if (!current) return;
  await prisma.strengthMark.update({
    where: { id },
    data: { active: !current.active },
  });
  revalidatePath("/biblioteca/marcas");
}

export async function deleteStrengthMark(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  await prisma.strengthMark.delete({ where: { id } });
  revalidatePath("/biblioteca/marcas");
}

export async function moveStrengthMark(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  const dir = String(formData.get("direction")) === "up" ? "up" : "down";
  const all = await prisma.strengthMark.findMany({
    orderBy: { order: "asc" },
    select: { id: true },
  });
  const idx = all.findIndex((m) => m.id === id);
  if (idx < 0) return;
  const j = idx + (dir === "up" ? -1 : 1);
  if (j < 0 || j >= all.length) return;
  const swap = [...all];
  [swap[idx], swap[j]] = [swap[j], swap[idx]];
  // Reasignamos orders 0..N.
  await prisma.$transaction(
    swap.map((m, i) =>
      prisma.strengthMark.update({ where: { id: m.id }, data: { order: i } }),
    ),
  );
  revalidatePath("/biblioteca/marcas");
}
