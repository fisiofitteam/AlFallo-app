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

/** Activa o desactiva el check-in avanzado para un cliente. Toggle desde
 *  la pestaña Ajustes de la ficha. */
export async function setUseAdvancedCheckIn(formData: FormData) {
  const prof = await requireClientAccess();
  const clientId = String(formData.get("clientId"));
  await loadClientForEdit(clientId, prof);
  const enabled = String(formData.get("enabled")) === "1";
  await prisma.client.update({
    where: { id: clientId },
    data: { useAdvancedCheckIn: enabled },
  });
  revalidatePath(`/clientes/${clientId}`);
}

/** Actualiza las notas internas del nutri sobre el cliente. Texto libre
 *  que solo ve el equipo. Autosave desde el popover del header. */
export async function updateClientInternalNotes(formData: FormData) {
  const prof = await requireClientAccess();
  const clientId = String(formData.get("clientId"));
  await loadClientForEdit(clientId, prof);
  const raw = formData.get("notes");
  const notes = typeof raw === "string" && raw.trim().length > 0 ? raw.slice(0, 5000) : null;
  await prisma.client.update({ where: { id: clientId }, data: { internalNotes: notes } });
  revalidatePath(`/clientes/${clientId}`);
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

// (Eliminada: updateMacroTargets. La pestaña "Macros objetivo" se ha
//  quitado de la ficha del cliente. Los macros los pone el nutri en el
//  override del plan, o los calcula la IA desde el brief. La tabla
//  MacroTargets sigue en BD por si hay datos históricos.)

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
    // Consideraciones especiales: vienen como N inputs hidden con name
    // 'specialConsiderationIds'. Las recogemos con getAll() y filtramos.
    specialConsiderationIds: formData
      .getAll("specialConsiderationIds")
      .map((v) => (typeof v === "string" ? v : ""))
      .filter(Boolean),
    whatsappGroupUrl: parseStr(formData.get("whatsappGroupUrl")),
  };

  await prisma.nutritionProfile.upsert({
    where: { clientId },
    create: { clientId, ...data },
    update: data,
  });

  revalidatePath(`/clientes/${clientId}`);
}

// ─── Métricas personalizadas por cliente ───────────────────────────────────

/** Crea una métrica personalizada nueva para el cliente. Aparecerá como input
 *  extra en el check-in del atleta y como gráfica en Evolución. */
export async function addCustomMetric(formData: FormData) {
  const prof = await requireClientAccess();
  const clientId = String(formData.get("clientId"));
  await loadClientForEdit(clientId, prof);

  const name = parseStr(formData.get("name"));
  if (!name) return;
  const unit = parseStr(formData.get("unit"));
  const type = parseStr(formData.get("type")) === "scale" ? "scale" : "number";

  // Insertamos al final por orden.
  const last = await prisma.customMetric.aggregate({
    where: { clientId },
    _max: { order: true },
  });
  await prisma.customMetric.create({
    data: {
      clientId,
      name,
      unit,
      type,
      order: (last._max.order ?? 0) + 10,
    },
  });
  revalidatePath(`/clientes/${clientId}`);
}

/** Edita una métrica existente (nombre, unidad o tipo). */
export async function updateCustomMetric(formData: FormData) {
  const prof = await requireClientAccess();
  const id = String(formData.get("id"));
  const m = await prisma.customMetric.findUnique({ where: { id } });
  if (!m) return;
  await loadClientForEdit(m.clientId, prof);

  const name = parseStr(formData.get("name"));
  if (!name) return;
  const unit = parseStr(formData.get("unit"));
  const type = parseStr(formData.get("type")) === "scale" ? "scale" : "number";

  await prisma.customMetric.update({
    where: { id },
    data: { name, unit, type },
  });
  revalidatePath(`/clientes/${m.clientId}`);
}

/** Activa o desactiva una métrica. Las desactivadas no aparecen en el
 *  check-in nuevo, pero los valores históricos se conservan. */
export async function toggleCustomMetric(formData: FormData) {
  const prof = await requireClientAccess();
  const id = String(formData.get("id"));
  const m = await prisma.customMetric.findUnique({ where: { id } });
  if (!m) return;
  await loadClientForEdit(m.clientId, prof);
  await prisma.customMetric.update({
    where: { id },
    data: { active: !m.active },
  });
  revalidatePath(`/clientes/${m.clientId}`);
}

/** Borra una métrica con sus valores asociados. Para conservar histórico,
 *  usa toggleCustomMetric en su lugar. */
export async function deleteCustomMetric(formData: FormData) {
  const prof = await requireClientAccess();
  const id = String(formData.get("id"));
  const m = await prisma.customMetric.findUnique({ where: { id } });
  if (!m) return;
  await loadClientForEdit(m.clientId, prof);
  await prisma.customMetric.delete({ where: { id } });
  revalidatePath(`/clientes/${m.clientId}`);
}
