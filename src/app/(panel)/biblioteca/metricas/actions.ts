"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import {
  isCoreField,
  isMetricType,
  METRIC_CATEGORIES,
  METRIC_FREQUENCIES,
} from "@/lib/metricDefinitions";

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

const ALLOWED_CATEGORIES: Set<string> = new Set(METRIC_CATEGORIES.map((c) => c.value));
const ALLOWED_FREQUENCIES: Set<string> = new Set(METRIC_FREQUENCIES.map((f) => f.value));

/** Serializa las opciones de un select desde el textarea "value|Label" por línea. */
function parseOptions(raw: string | null): Prisma.InputJsonValue | null {
  if (!raw) return null;
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const opts = lines
    .map((line) => {
      const [value, label] = line.split("|").map((s) => s.trim());
      if (!value) return null;
      return { value, label: label || value };
    })
    .filter((x): x is { value: string; label: string } => x !== null);
  return opts.length > 0 ? (opts as unknown as Prisma.InputJsonValue) : null;
}

export async function createMetric(formData: FormData) {
  await requireManager();
  const name = parseStr(formData.get("name"));
  if (!name) return;
  const type = parseStr(formData.get("type")) ?? "number";
  if (!isMetricType(type)) return;
  const unit = parseStr(formData.get("unit"));
  const description = parseStr(formData.get("description"));
  const category = parseStr(formData.get("category")) ?? "otros";
  if (!ALLOWED_CATEGORIES.has(category)) return;
  const frequency = parseStr(formData.get("frequency")) ?? "weekly";
  if (!ALLOWED_FREQUENCIES.has(frequency)) return;
  const rawCore = parseStr(formData.get("coreField"));
  const coreField = rawCore && isCoreField(rawCore) ? rawCore : null;
  const inBasic = String(formData.get("inBasic")) === "1";
  const inAdvanced = String(formData.get("inAdvanced")) === "1";
  const options = parseOptions(parseStr(formData.get("options")));
  const last = await prisma.metricDefinition.findFirst({
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await prisma.metricDefinition.create({
    data: {
      name: name.slice(0, 80),
      description: description?.slice(0, 400) ?? null,
      type,
      unit: unit?.slice(0, 12) ?? null,
      coreField,
      category,
      inBasic,
      inAdvanced,
      frequency,
      options: options ?? Prisma.JsonNull,
      order: (last?.order ?? -1) + 1,
      active: true,
    },
  });
  revalidatePath("/biblioteca/metricas");
  revalidatePath("/cliente/checkin");
}

export async function updateMetric(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  const name = parseStr(formData.get("name"));
  if (!name) return;
  const type = parseStr(formData.get("type")) ?? "number";
  if (!isMetricType(type)) return;
  const unit = parseStr(formData.get("unit"));
  const description = parseStr(formData.get("description"));
  const category = parseStr(formData.get("category")) ?? "otros";
  if (!ALLOWED_CATEGORIES.has(category)) return;
  const frequency = parseStr(formData.get("frequency")) ?? "weekly";
  if (!ALLOWED_FREQUENCIES.has(frequency)) return;
  const rawCore = parseStr(formData.get("coreField"));
  const coreField = rawCore && isCoreField(rawCore) ? rawCore : null;
  const inBasic = String(formData.get("inBasic")) === "1";
  const inAdvanced = String(formData.get("inAdvanced")) === "1";
  const options = parseOptions(parseStr(formData.get("options")));
  await prisma.metricDefinition.update({
    where: { id },
    data: {
      name: name.slice(0, 80),
      description: description?.slice(0, 400) ?? null,
      type,
      unit: unit?.slice(0, 12) ?? null,
      coreField,
      category,
      inBasic,
      inAdvanced,
      frequency,
      options: options ?? Prisma.JsonNull,
    },
  });
  revalidatePath("/biblioteca/metricas");
  revalidatePath("/cliente/checkin");
}

export async function toggleMetricActive(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  const current = await prisma.metricDefinition.findUnique({
    where: { id },
    select: { active: true },
  });
  if (!current) return;
  await prisma.metricDefinition.update({
    where: { id },
    data: { active: !current.active },
  });
  revalidatePath("/biblioteca/metricas");
}

export async function deleteMetric(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  await prisma.metricDefinition.delete({ where: { id } });
  revalidatePath("/biblioteca/metricas");
}

export async function moveMetric(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  const dir = String(formData.get("direction")) === "up" ? "up" : "down";
  const all = await prisma.metricDefinition.findMany({
    orderBy: { order: "asc" },
    select: { id: true },
  });
  const idx = all.findIndex((m) => m.id === id);
  if (idx < 0) return;
  const j = idx + (dir === "up" ? -1 : 1);
  if (j < 0 || j >= all.length) return;
  const swap = [...all];
  [swap[idx], swap[j]] = [swap[j], swap[idx]];
  await prisma.$transaction(
    swap.map((m, i) =>
      prisma.metricDefinition.update({ where: { id: m.id }, data: { order: i } }),
    ),
  );
  revalidatePath("/biblioteca/metricas");
}
