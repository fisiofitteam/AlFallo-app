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

  // El email es la clave por la que el atleta hace login (que normaliza a
  // lowercase). Si aquí se guarda con mayúsculas, findUnique nunca cuadra y
  // "email o contraseña incorrectos" se vuelve permanente.
  const rawEmail = parseStr(formData.get("email"));
  const email = rawEmail ? rawEmail.trim().toLowerCase() : null;

  const client = await prisma.client.create({
    data: {
      fullName,
      email,
      phone: parseStr(formData.get("phone")),
      status: parseStr(formData.get("status")) ?? "pendiente_revision",
      nutritionistId,
    },
  });

  // Si el form incluye datos del primer periodo (meses > 0) creamos el alta
  // en el mismo paso. Así el CEO no tiene que ir a la pestaña "Programa"
  // después. Todos los campos son opcionales; si falta la duración lo
  // saltamos.
  const initialMonths = parseIntOrNull(formData.get("initialPeriodMonths"));
  if (initialMonths && initialMonths > 0) {
    const startRaw = parseStr(formData.get("initialStartDate"));
    const startDate = startRaw ? new Date(startRaw) : new Date();
    if (!Number.isNaN(startDate.getTime())) {
      const { applySubscriptionPeriod } = await import("@/lib/subscriptions");
      await applySubscriptionPeriod({
        clientId: client.id,
        periodMonths: initialMonths,
        startDate,
        amountPaid: parseNumber(formData.get("initialAmountPaid")),
        paymentMethod: parseStr(formData.get("initialPaymentMethod")),
        notes: parseStr(formData.get("initialNotes")),
        isRenewal: false,
      });
    }
  }

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

/** Cambia los días de la semana en los que le pedimos check-in al atleta.
 *  Acepta N valores (1..7). Deduplicados y ordenados. Si no llega ninguno
 *  válido, no se aplica el cambio (se preserva la config anterior). */
export async function setCheckInDaysOfWeek(formData: FormData) {
  const prof = await requireClientAccess();
  const clientId = String(formData.get("clientId"));
  await loadClientForEdit(clientId, prof);
  const raw = formData.getAll("days").map((v) => Number(v));
  const days = Array.from(
    new Set(raw.filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)),
  ).sort((a, b) => a - b);
  if (days.length === 0) return;
  await prisma.client.update({
    where: { id: clientId },
    data: { checkInDaysOfWeek: days },
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

export async function updateClientName(formData: FormData) {
  const prof = await requireClientAccess();
  const clientId = String(formData.get("clientId"));
  await loadClientForEdit(clientId, prof);

  const fullName = parseStr(formData.get("fullName"));
  if (!fullName) return;

  await prisma.client.update({
    where: { id: clientId },
    data: { fullName: fullName.slice(0, 120) },
  });

  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/clientes");
}

export async function updateClientEmail(formData: FormData) {
  const prof = await requireClientAccess();
  const clientId = String(formData.get("clientId"));
  await loadClientForEdit(clientId, prof);

  const raw = parseStr(formData.get("email"));
  const email = raw ? raw.toLowerCase() : null;

  if (email) {
    const clash = await prisma.client.findFirst({
      where: { email, NOT: { id: clientId } },
      select: { id: true },
    });
    if (clash) redirect(`/clientes/${clientId}?tab=ajustes&error=email-taken`);
  }

  await prisma.client.update({
    where: { id: clientId },
    data: { email },
  });

  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/clientes");
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

// Elimina un cliente por completo. Todas las relaciones tienen onDelete
// Cascade/SetNull en el esquema, así que Prisma se encarga de check-ins,
// planes, métricas, contraseñas, sesiones, comentarios de la comunidad...
// Se exige que quien lo pide teclee el nombre completo del cliente para
// evitar borrados accidentales, y se restringe a roles manager.
export async function deleteClient(formData: FormData) {
  const prof = await requireClientAccess();
  if (!isManagerRole(prof.role)) redirect("/clientes");

  const clientId = String(formData.get("clientId"));
  const client = await loadClientForEdit(clientId, prof);

  const confirmName = parseStr(formData.get("confirmName"));
  if (!confirmName || confirmName.trim() !== client.fullName.trim()) {
    // Nombre no coincide: abortamos silenciosamente. La UI ya no permite
    // enviar el formulario si el input no coincide, así que llegar aquí
    // solo pasa por manipulación directa.
    return;
  }

  await prisma.client.delete({ where: { id: clientId } });
  revalidatePath("/clientes");
  redirect("/clientes");
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

// Edita los valores numéricos + notas de un check-in en nombre del atleta
// (por si el atleta lo rellenó mal y avisa por chat). No cambia el estado
// de revisión ni las respuestas de métricas custom todavía.
export async function panelEditCheckInFields(formData: FormData) {
  const prof = await requireClientAccess();
  const checkInId = String(formData.get("checkInId"));
  const checkIn = await prisma.checkIn.findUnique({ where: { id: checkInId } });
  if (!checkIn) redirect("/clientes");
  await loadClientForEdit(checkIn.clientId, prof);

  await prisma.checkIn.update({
    where: { id: checkInId },
    data: {
      weightKg: parseNumber(formData.get("weightKg")),
      waistCm: parseNumber(formData.get("waistCm")),
      hipCm: parseNumber(formData.get("hipCm")),
      armCm: parseNumber(formData.get("armCm")),
      bodyFatPct: parseNumber(formData.get("bodyFatPct")),
      adherencePct: parseIntOrNull(formData.get("adherencePct")),
      energy: parseIntOrNull(formData.get("energy")),
      notes: parseStr(formData.get("notes")),
    },
  });
  revalidatePath(`/clientes/${checkIn.clientId}`);
}

// ─── Programa / periodos de suscripción ──────────────────────────────────

export async function createSubscriptionPeriod(formData: FormData) {
  const prof = await requireClientAccess();
  const clientId = String(formData.get("clientId"));
  await loadClientForEdit(clientId, prof);

  const periodMonthsRaw = parseIntOrNull(formData.get("periodMonths"));
  const startDateRaw = parseStr(formData.get("startDate"));
  const amountPaid = parseNumber(formData.get("amountPaid"));
  const paymentMethod = parseStr(formData.get("paymentMethod"));
  const notes = parseStr(formData.get("notes"));
  const isRenewal = String(formData.get("isRenewal")) === "1";

  const periodMonths = periodMonthsRaw && periodMonthsRaw > 0 ? periodMonthsRaw : 0;
  if (periodMonths <= 0) return;
  const startDate = startDateRaw ? new Date(startDateRaw) : new Date();
  if (Number.isNaN(startDate.getTime())) return;

  const { applySubscriptionPeriod } = await import("@/lib/subscriptions");
  await applySubscriptionPeriod({
    clientId,
    periodMonths,
    startDate,
    amountPaid,
    paymentMethod,
    notes,
    isRenewal,
  });

  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/clientes");
  revalidatePath("/");
}

export async function updateSubscriptionPeriod(formData: FormData) {
  const prof = await requireClientAccess();
  const id = String(formData.get("id"));
  const existing = await prisma.subscriptionPeriod.findUnique({ where: { id } });
  if (!existing) return;
  await loadClientForEdit(existing.clientId, prof);

  const periodMonthsRaw = parseIntOrNull(formData.get("periodMonths"));
  const startDateRaw = parseStr(formData.get("startDate"));
  const endDateRaw = parseStr(formData.get("endDate"));
  const status = parseStr(formData.get("status"));
  const amountPaid = parseNumber(formData.get("amountPaid"));
  const paymentMethod = parseStr(formData.get("paymentMethod"));
  const notes = parseStr(formData.get("notes"));

  const startDate = startDateRaw ? new Date(startDateRaw) : existing.startDate;
  const endDate = endDateRaw ? new Date(endDateRaw) : existing.endDate;
  const periodMonths = periodMonthsRaw && periodMonthsRaw > 0 ? periodMonthsRaw : existing.periodMonths;

  await prisma.subscriptionPeriod.update({
    where: { id },
    data: {
      periodMonths,
      startDate,
      endDate,
      status: status && ["active", "finished", "lost", "scheduled"].includes(status) ? status : existing.status,
      amountPaid,
      paymentMethod,
      notes,
    },
  });

  const { refreshClientCache } = await import("@/lib/subscriptions");
  await refreshClientCache(existing.clientId);

  revalidatePath(`/clientes/${existing.clientId}`);
  revalidatePath("/clientes");
  revalidatePath("/");
}

export async function deleteSubscriptionPeriod(formData: FormData) {
  const prof = await requireClientAccess();
  const id = String(formData.get("id"));
  const existing = await prisma.subscriptionPeriod.findUnique({ where: { id } });
  if (!existing) return;
  await loadClientForEdit(existing.clientId, prof);

  await prisma.subscriptionPeriod.delete({ where: { id } });

  const { refreshClientCache } = await import("@/lib/subscriptions");
  await refreshClientCache(existing.clientId);

  revalidatePath(`/clientes/${existing.clientId}`);
  revalidatePath("/clientes");
  revalidatePath("/");
}

// ─── Planes de competición ────────────────────────────────────────────────

function parseDateFromForm(v: FormDataEntryValue | null): Date | null {
  const raw = parseStr(v);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createCompetitionPlan(formData: FormData) {
  const prof = await requireClientAccess();
  const clientId = String(formData.get("clientId"));
  await loadClientForEdit(clientId, prof);

  const title = parseStr(formData.get("title"));
  if (!title) return;
  const startDate = parseDateFromForm(formData.get("startDate"));
  const endDate = parseDateFromForm(formData.get("endDate"));
  if (!startDate || !endDate) return;

  await prisma.competitionPlan.create({
    data: {
      clientId,
      title: title.slice(0, 120),
      description: parseStr(formData.get("description")),
      pdfUrl: parseStr(formData.get("pdfUrl")),
      pdfName: parseStr(formData.get("pdfName")),
      startDate,
      endDate,
      createdById: prof.id,
    },
  });
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/cliente");
  revalidatePath("/cliente/competicion");
}

export async function updateCompetitionPlan(formData: FormData) {
  const prof = await requireClientAccess();
  const id = String(formData.get("id"));
  const existing = await prisma.competitionPlan.findUnique({ where: { id } });
  if (!existing) return;
  await loadClientForEdit(existing.clientId, prof);

  const title = parseStr(formData.get("title")) ?? existing.title;
  const startDate = parseDateFromForm(formData.get("startDate")) ?? existing.startDate;
  const endDate = parseDateFromForm(formData.get("endDate")) ?? existing.endDate;
  // PDF: si viene pdfUrl explícito lo cambiamos; si viene clearPdf=1 lo limpiamos.
  const clearPdf = String(formData.get("clearPdf")) === "1";
  const nextPdfUrl = clearPdf ? null : (parseStr(formData.get("pdfUrl")) ?? existing.pdfUrl);
  const nextPdfName = clearPdf ? null : (parseStr(formData.get("pdfName")) ?? existing.pdfName);

  await prisma.competitionPlan.update({
    where: { id },
    data: {
      title: title.slice(0, 120),
      description: parseStr(formData.get("description")),
      pdfUrl: nextPdfUrl,
      pdfName: nextPdfName,
      startDate,
      endDate,
    },
  });
  revalidatePath(`/clientes/${existing.clientId}`);
  revalidatePath("/cliente");
  revalidatePath("/cliente/competicion");
}

export async function deleteCompetitionPlan(formData: FormData) {
  const prof = await requireClientAccess();
  const id = String(formData.get("id"));
  const existing = await prisma.competitionPlan.findUnique({ where: { id } });
  if (!existing) return;
  await loadClientForEdit(existing.clientId, prof);

  await prisma.competitionPlan.delete({ where: { id } });
  revalidatePath(`/clientes/${existing.clientId}`);
  revalidatePath("/cliente");
  revalidatePath("/cliente/competicion");
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
