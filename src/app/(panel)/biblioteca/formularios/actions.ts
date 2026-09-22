"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import { parseQuestions, type SatisfactionQuestion } from "@/lib/satisfactionForms";

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

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function createForm(formData: FormData) {
  await requireManager();
  const name = parseStr(formData.get("name"));
  const weekOffsetRaw = parseStr(formData.get("weekOffset"));
  const weekOffset = weekOffsetRaw ? Number(weekOffsetRaw) : NaN;
  if (!name || !Number.isFinite(weekOffset) || weekOffset < 0) return;
  const created = await prisma.satisfactionForm.create({
    data: {
      name: name.slice(0, 120),
      weekOffset: Math.floor(weekOffset),
      active: true,
      questions: [] as unknown as Prisma.InputJsonValue,
    },
  });
  revalidatePath("/biblioteca/formularios");
  redirect(`/biblioteca/formularios/${created.id}`);
}

export async function toggleFormActive(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  const current = await prisma.satisfactionForm.findUnique({
    where: { id },
    select: { active: true },
  });
  if (!current) return;
  await prisma.satisfactionForm.update({
    where: { id },
    data: { active: !current.active },
  });
  revalidatePath("/biblioteca/formularios");
}

export async function deleteForm(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  await prisma.satisfactionForm.delete({ where: { id } });
  revalidatePath("/biblioteca/formularios");
}

export async function updateFormMeta(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  const name = parseStr(formData.get("name"));
  const weekOffsetRaw = parseStr(formData.get("weekOffset"));
  const weekOffset = weekOffsetRaw ? Number(weekOffsetRaw) : NaN;
  if (!name || !Number.isFinite(weekOffset) || weekOffset < 0) return;
  await prisma.satisfactionForm.update({
    where: { id },
    data: { name: name.slice(0, 120), weekOffset: Math.floor(weekOffset) },
  });
  revalidatePath("/biblioteca/formularios");
  revalidatePath(`/biblioteca/formularios/${id}`);
}

async function withQuestions(id: string, mutate: (qs: SatisfactionQuestion[]) => SatisfactionQuestion[]) {
  const form = await prisma.satisfactionForm.findUnique({ where: { id } });
  if (!form) return;
  const current = parseQuestions(form.questions);
  const next = mutate(current);
  await prisma.satisfactionForm.update({
    where: { id },
    data: { questions: next as unknown as Prisma.InputJsonValue },
  });
  revalidatePath(`/biblioteca/formularios/${id}`);
}

export async function addQuestion(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  const type = String(formData.get("type"));
  if (type !== "scale" && type !== "text") return;
  await withQuestions(id, (qs) => {
    if (type === "scale") {
      return [
        ...qs,
        {
          id: newId(),
          type: "scale",
          label: "Nueva pregunta",
          required: false,
          scaleMin: 1,
          scaleMax: 10,
          scaleMinLabel: "",
          scaleMaxLabel: "",
        },
      ];
    }
    return [
      ...qs,
      { id: newId(), type: "text", label: "Nueva pregunta", required: false, placeholder: "" },
    ];
  });
}

export async function updateQuestion(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  const questionId = String(formData.get("questionId"));
  const label = parseStr(formData.get("label")) ?? "";
  const required = String(formData.get("required")) === "1";
  await withQuestions(id, (qs) =>
    qs.map((q) => {
      if (q.id !== questionId) return q;
      if (q.type === "scale") {
        const scaleMinRaw = parseStr(formData.get("scaleMin"));
        const scaleMaxRaw = parseStr(formData.get("scaleMax"));
        const scaleMinLabel = parseStr(formData.get("scaleMinLabel")) ?? "";
        const scaleMaxLabel = parseStr(formData.get("scaleMaxLabel")) ?? "";
        const scaleMin = scaleMinRaw ? Number(scaleMinRaw) : 1;
        const scaleMax = scaleMaxRaw ? Number(scaleMaxRaw) : 10;
        return {
          ...q,
          label,
          required,
          scaleMin: Number.isFinite(scaleMin) ? scaleMin : 1,
          scaleMax: Number.isFinite(scaleMax) ? scaleMax : 10,
          scaleMinLabel,
          scaleMaxLabel,
        };
      }
      return {
        ...q,
        label,
        required,
        placeholder: parseStr(formData.get("placeholder")) ?? "",
      };
    }),
  );
}

export async function removeQuestion(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  const questionId = String(formData.get("questionId"));
  await withQuestions(id, (qs) => qs.filter((q) => q.id !== questionId));
}

export async function moveQuestion(formData: FormData) {
  await requireManager();
  const id = String(formData.get("id"));
  const questionId = String(formData.get("questionId"));
  const dir = String(formData.get("direction")) === "up" ? -1 : 1;
  await withQuestions(id, (qs) => {
    const idx = qs.findIndex((q) => q.id === questionId);
    if (idx < 0) return qs;
    const j = idx + dir;
    if (j < 0 || j >= qs.length) return qs;
    const swap = [...qs];
    [swap[idx], swap[j]] = [swap[j], swap[idx]];
    return swap;
  });
}
