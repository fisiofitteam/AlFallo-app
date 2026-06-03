"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import { parseStr } from "@/lib/clients";
import { CATEGORIES, type MeetingCategory } from "./categories";

async function requireManager() {
  const prof = await requireProfessional();
  if (!isManager(prof.role)) redirect("/reuniones");
  return prof;
}

function parseCategory(value: FormDataEntryValue | null): MeetingCategory {
  const v = parseStr(value);
  return v && (CATEGORIES as readonly string[]).includes(v) ? (v as MeetingCategory) : "otras";
}

function parseDate(value: FormDataEntryValue | null): Date | null {
  const s = parseStr(value);
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  // Guardamos como mediodía UTC para evitar ambigüedad de zona horaria al
  // formatear; el feed solo muestra la fecha, no la hora.
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
}

export async function createMeeting(formData: FormData) {
  const prof = await requireManager();
  const title = parseStr(formData.get("title"));
  if (!title) return;

  const category = parseCategory(formData.get("category"));
  const meeting = await prisma.meeting.create({
    data: {
      title,
      objective: parseStr(formData.get("objective")),
      body: parseStr(formData.get("body")) ?? "",
      category,
      date: parseDate(formData.get("date")),
      createdById: prof.id,
    },
  });
  revalidatePath("/reuniones");
  return meeting.id;
}

export async function updateMeeting(formData: FormData) {
  await requireManager();
  const id = parseStr(formData.get("id"));
  if (!id) return;
  const title = parseStr(formData.get("title"));
  if (!title) return;
  await prisma.meeting.update({
    where: { id },
    data: {
      title,
      objective: parseStr(formData.get("objective")),
      body: parseStr(formData.get("body")) ?? "",
      category: parseCategory(formData.get("category")),
      date: parseDate(formData.get("date")),
    },
  });
  revalidatePath("/reuniones");
}

export async function deleteMeeting(formData: FormData) {
  await requireManager();
  const id = parseStr(formData.get("id"));
  if (!id) return;
  await prisma.meeting.delete({ where: { id } });
  revalidatePath("/reuniones");
}

export async function togglePinMeeting(formData: FormData) {
  await requireManager();
  const id = parseStr(formData.get("id"));
  if (!id) return;
  const m = await prisma.meeting.findUnique({ where: { id }, select: { pinned: true } });
  if (!m) return;
  await prisma.meeting.update({ where: { id }, data: { pinned: !m.pinned } });
  revalidatePath("/reuniones");
}
