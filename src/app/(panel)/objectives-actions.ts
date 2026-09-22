"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import {
  MAX_DAY_ITEMS,
  MAX_WEEK_ITEMS,
  quarterKey,
  monthKey,
  weekKey,
  dayKey,
  type ObjectiveItem,
} from "@/lib/objectives";

function s(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

async function upsert(kind: string, periodKey: string, content: object, professionalId: string) {
  await prisma.professionalObjective.upsert({
    where: {
      professionalId_kind_periodKey: { professionalId, kind, periodKey },
    },
    create: { professionalId, kind, periodKey, content: content as unknown as Prisma.InputJsonValue },
    update: { content: content as unknown as Prisma.InputJsonValue },
  });
  revalidatePath("/");
}

export async function saveQuarterObjective(formData: FormData) {
  const prof = await requireProfessional();
  const content = {
    theme: s(formData.get("theme")).slice(0, 500),
    marketing: s(formData.get("marketing")).slice(0, 2000),
    ventas: s(formData.get("ventas")).slice(0, 2000),
    servicio: s(formData.get("servicio")).slice(0, 2000),
    ceo: s(formData.get("ceo")).slice(0, 2000),
  };
  await upsert("quarter", quarterKey(), content, prof.id);
}

export async function saveMonthObjective(formData: FormData) {
  const prof = await requireProfessional();
  const content = { focus: s(formData.get("focus")).slice(0, 1000) };
  await upsert("month", monthKey(), content, prof.id);
}

function parseItems(formData: FormData, max: number): ObjectiveItem[] {
  const items: ObjectiveItem[] = [];
  for (let i = 0; i < max; i++) {
    const text = s(formData.get(`text_${i}`));
    const done = String(formData.get(`done_${i}`)) === "1";
    const id = s(formData.get(`id_${i}`)) || `item_${i}`;
    if (text || done) items.push({ id, text: text.slice(0, 300), done });
  }
  return items;
}

export async function saveWeekObjective(formData: FormData) {
  const prof = await requireProfessional();
  const items = parseItems(formData, MAX_WEEK_ITEMS);
  await upsert("week", weekKey(), { items }, prof.id);
}

export async function saveDayObjective(formData: FormData) {
  const prof = await requireProfessional();
  const items = parseItems(formData, MAX_DAY_ITEMS);
  await upsert("day", dayKey(), { items }, prof.id);
}
