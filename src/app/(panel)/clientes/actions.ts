"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import {
  CLIENT_ACCESS_ROLES,
  isManagerRole,
  parseIntOrNull,
  parseList,
  parseNumber,
  parseStr,
} from "@/lib/clients";

async function requireClientAccess() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/");
  return prof;
}

// Comprueba que el profesional puede ver/editar ESTE cliente.
async function loadClientForEdit(clientId: string, prof: { id: string; role: string }) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) redirect("/clientes");
  if (!isManagerRole(prof.role) && client.nutritionistId !== prof.id) redirect("/clientes");
  return client;
}

export async function createClient(formData: FormData) {
  const prof = await requireClientAccess();

  const fullName = parseStr(formData.get("fullName"));
  if (!fullName) return; // el form marca el campo como requerido

  // Managers pueden asignar; un nutricionista se auto-asigna.
  let nutritionistId: string | null;
  if (isManagerRole(prof.role)) {
    nutritionistId = parseStr(formData.get("nutritionistId"));
  } else {
    nutritionistId = prof.id;
  }

  const client = await prisma.client.create({
    data: {
      fullName,
      email: parseStr(formData.get("email")),
      phone: parseStr(formData.get("phone")),
      status: parseStr(formData.get("status")) ?? "pendiente_revision",
      nutritionistId,
    },
  });

  revalidatePath("/clientes");
  redirect(`/clientes/${client.id}`);
}

export async function reassignNutritionist(formData: FormData) {
  const prof = await requireClientAccess();
  if (!isManagerRole(prof.role)) redirect("/clientes"); // solo managers reasignan

  const clientId = String(formData.get("clientId"));
  await loadClientForEdit(clientId, prof);

  await prisma.client.update({
    where: { id: clientId },
    data: { nutritionistId: parseStr(formData.get("nutritionistId")) },
  });

  revalidatePath(`/clientes/${clientId}`);
}

export async function updateClientStatus(formData: FormData) {
  const prof = await requireClientAccess();
  const clientId = String(formData.get("clientId"));
  await loadClientForEdit(clientId, prof);

  await prisma.client.update({
    where: { id: clientId },
    data: { status: parseStr(formData.get("status")) ?? "pendiente_revision" },
  });

  revalidatePath(`/clientes/${clientId}`);
}

export async function updateNutritionProfile(formData: FormData) {
  const prof = await requireClientAccess();
  const clientId = String(formData.get("clientId"));
  await loadClientForEdit(clientId, prof);

  const birthDateRaw = parseStr(formData.get("birthDate"));

  const data = {
    sex: parseStr(formData.get("sex")),
    birthDate: birthDateRaw ? new Date(birthDateRaw) : null,
    heightCm: parseIntOrNull(formData.get("heightCm")),
    weightKg: parseNumber(formData.get("weightKg")),
    bodyFatPct: parseNumber(formData.get("bodyFatPct")),
    waistCm: parseNumber(formData.get("waistCm")),
    hipCm: parseNumber(formData.get("hipCm")),
    armCm: parseNumber(formData.get("armCm")),
    boxName: parseStr(formData.get("boxName")),
    yearsTraining: parseIntOrNull(formData.get("yearsTraining")),
    weeklyFrequency: parseIntOrNull(formData.get("weeklyFrequency")),
    level: parseStr(formData.get("level")),
    trainingSchedule: parseStr(formData.get("trainingSchedule")),
    allergies: parseList(formData.get("allergies")),
    intolerances: parseList(formData.get("intolerances")),
    dislikes: parseList(formData.get("dislikes")),
    dietaryStyle: parseStr(formData.get("dietaryStyle")),
    supplements: parseList(formData.get("supplements")),
    medicalConditions: parseStr(formData.get("medicalConditions")),
    medication: parseStr(formData.get("medication")),
    goal: parseStr(formData.get("goal")),
    targetWeightKg: parseNumber(formData.get("targetWeightKg")),
    timeframe: parseStr(formData.get("timeframe")),
  };

  await prisma.nutritionProfile.upsert({
    where: { clientId },
    create: { clientId, ...data },
    update: data,
  });

  revalidatePath(`/clientes/${clientId}`);
}
