"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES, isManagerRole } from "@/lib/clients";

async function requireClientAccess(clientId: string) {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/");
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, nutritionistId: true },
  });
  if (!client) redirect("/clientes");
  if (!isManagerRole(prof.role) && client.nutritionistId !== prof.id) redirect("/clientes");
  return prof;
}

function toNumberOrNull(v: FormDataEntryValue | null): number | null {
  if (typeof v !== "string") return null;
  const n = Number(v.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Interpreta la entrada como valor numérico según la unidad. Para tiempos
 *  acepta "MM:SS", "M:SS", o segundos crudos ("240"). Devuelve segundos. */
function parseValueForUnit(raw: string, unit: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (unit === "s" && s.includes(":")) {
    const [mm, ss] = s.split(":");
    const m = Number(mm);
    const sec = Number(ss);
    if (!Number.isFinite(m) || !Number.isFinite(sec) || sec < 0 || sec >= 60) return null;
    return m * 60 + sec;
  }
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export async function addStrengthRecord(formData: FormData) {
  const prof = await requireProfessional();
  const clientId = String(formData.get("clientId"));
  await requireClientAccess(clientId);
  const markId = String(formData.get("markId"));
  const mark = await prisma.strengthMark.findUnique({
    where: { id: markId },
    select: { unit: true, active: true },
  });
  if (!mark || !mark.active) return;
  const rawValue = String(formData.get("value") ?? "");
  const value = parseValueForUnit(rawValue, mark.unit);
  if (value == null) return;
  const dateRaw = formData.get("date");
  const date =
    typeof dateRaw === "string" && dateRaw ? new Date(dateRaw) : new Date();
  if (Number.isNaN(date.getTime())) return;
  const notesRaw = formData.get("notes");
  const notes =
    typeof notesRaw === "string" && notesRaw.trim() ? notesRaw.trim().slice(0, 400) : null;
  await prisma.strengthRecord.create({
    data: {
      markId,
      clientId,
      value,
      date,
      notes,
      createdById: prof.id,
    },
  });
  revalidatePath(`/clientes/${clientId}`);
}

export async function deleteStrengthRecord(formData: FormData) {
  const prof = await requireProfessional();
  const id = String(formData.get("id"));
  const rec = await prisma.strengthRecord.findUnique({
    where: { id },
    select: { clientId: true },
  });
  if (!rec) return;
  await requireClientAccess(rec.clientId);
  await prisma.strengthRecord.delete({ where: { id } });
  revalidatePath(`/clientes/${rec.clientId}`);
  // No usamos prof.id — solo para asegurar sesión activa.
  void prof;
}

export { parseValueForUnit };
