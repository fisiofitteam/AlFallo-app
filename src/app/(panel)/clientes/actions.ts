"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { hashPassword } from "@/lib/auth";
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

// Establece/restablece la contraseña de acceso del cliente a la app.
export async function setClientPassword(formData: FormData) {
  const prof = await requireClientAccess();
  const clientId = String(formData.get("clientId"));
  const client = await loadClientForEdit(clientId, prof);

  const password = parseStr(formData.get("password"));
  if (!password || password.length < 6) return; // mínimo razonable
  if (!client.email) return; // necesita email para poder iniciar sesión

  await prisma.client.update({
    where: { id: clientId },
    data: { passwordHash: await hashPassword(password) },
  });
  revalidatePath(`/clientes/${clientId}`);
}

// El nutricionista responde y marca un check-in como revisado.
export async function reviewCheckIn(formData: FormData) {
  const prof = await requireClientAccess();
  const checkInId = String(formData.get("checkInId"));
  const checkIn = await prisma.checkIn.findUnique({ where: { id: checkInId } });
  if (!checkIn) redirect("/clientes");
  await loadClientForEdit(checkIn.clientId, prof);

  await prisma.checkIn.update({
    where: { id: checkInId },
    data: {
      reviewNotes: parseStr(formData.get("reviewNotes")),
      status: "revisado",
      reviewedById: prof.id,
      reviewedAt: new Date(),
    },
  });
  revalidatePath(`/clientes/${checkIn.clientId}`);
}

// Guarda los objetivos diarios de macros del cliente (entreno y descanso).
export async function updateMacroTargets(formData: FormData) {
  const prof = await requireClientAccess();
  const clientId = String(formData.get("clientId"));
  await loadClientForEdit(clientId, prof);

  const data = {
    kcalTraining: parseNumber(formData.get("kcalTraining")),
    proteinTraining: parseNumber(formData.get("proteinTraining")),
    carbsTraining: parseNumber(formData.get("carbsTraining")),
    fatTraining: parseNumber(formData.get("fatTraining")),
    kcalRest: parseNumber(formData.get("kcalRest")),
    proteinRest: parseNumber(formData.get("proteinRest")),
    carbsRest: parseNumber(formData.get("carbsRest")),
    fatRest: parseNumber(formData.get("fatRest")),
    notes: parseStr(formData.get("notes")),
  };

  await prisma.macroTargets.upsert({
    where: { clientId },
    create: { clientId, ...data },
    update: data,
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
