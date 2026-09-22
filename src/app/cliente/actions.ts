"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import {
  CLIENT_SESSION_COOKIE,
  clientSessionCookieOptions,
  createClientSession,
  deleteClientSession,
} from "@/lib/client-auth";
import { requireClient, requireOnboardedClient } from "@/lib/client-session";
import { parseIntOrNull, parseList, parseNumber, parseStr } from "@/lib/clients";
import { CONTRACT_TEXT, CONTRACT_VERSION } from "@/lib/contract";

export type ClientLoginState = { error?: string };

export async function clientLogin(_prev: ClientLoginState, formData: FormData): Promise<ClientLoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Introduce email y contraseña." };

  const client = await prisma.client.findUnique({ where: { email } });
  const invalid: ClientLoginState = { error: "Email o contraseña incorrectos." };
  if (!client || !client.passwordHash) return invalid;

  const ok = await verifyPassword(password, client.passwordHash);
  if (!ok) return invalid;

  const { token } = await createClientSession(client.id);
  cookies().set(CLIENT_SESSION_COOKIE, token, clientSessionCookieOptions);
  redirect("/cliente");
}

export async function clientLogout() {
  const token = cookies().get(CLIENT_SESSION_COOKIE)?.value;
  if (token) await deleteClientSession(token);
  cookies().delete(CLIENT_SESSION_COOKIE);
  redirect("/cliente/login");
}

export async function submitOnboarding(formData: FormData) {
  const client = await requireClient();

  const accepted = formData.get("acceptContract") === "on";
  const dni = parseStr(formData.get("contractDNI"));
  if (!accepted || !dni) return; // el form valida estos campos

  // El form es CONFIGURABLE desde /biblioteca/onboarding. Leemos su estructura
  // para saber qué campos pedir y qué tipo tienen. Los IDs CORE mapean a
  // columnas tipadas de NutritionProfile; los IDs "extra:*" van a JSON.
  const { getOnboardingFormConfig } = await import("@/lib/onboardingFormConfig");
  const { isCustomField } = await import("@/lib/onboarding-form");
  const config = await getOnboardingFormConfig();

  // Recolector de respuestas tipadas para campos core conocidos. Los que
  // no aparecen en la config (porque están hidden) quedan en null.
  const core: Record<string, unknown> = {
    sex: null,
    birthDate: null,
    goal: null,
    weightKg: null,
    heightCm: null,
    targetWeightKg: null,
    weeklyFrequency: null,
    level: null,
    boxName: null,
    dietaryStyle: null,
    allergies: [],
    intolerances: [],
    dislikes: [],
    supplements: [],
    medicalConditions: null,
    medication: null,
  };
  const extras: Record<string, unknown> = {};

  for (const section of config.sections) {
    for (const f of section.fields) {
      if (f.hidden) continue;
      const raw = formData.get(f.id);
      const value =
        f.type === "number"
          ? parseNumber(raw)
          : f.type === "date"
            ? (parseStr(raw) ? new Date(parseStr(raw) + "T00:00:00.000Z") : null)
            : f.type === "tags"
              ? parseList(raw)
              : f.type === "checkbox"
                ? raw === "on"
                : parseStr(raw);

      if (isCustomField(f.id)) {
        extras[f.id.slice("extra:".length)] = value;
      } else if (f.id === "heightCm" || f.id === "weeklyFrequency") {
        core[f.id] = parseIntOrNull(raw);
      } else {
        core[f.id] = value;
      }
    }
  }

  // Snapshot completo para auditoría (anamnesisData en Client).
  const snapshot = { ...core, extras };

  await prisma.nutritionProfile.upsert({
    where: { clientId: client.id },
    create: { clientId: client.id, ...(core as object), extraAnswers: extras as object },
    update: { ...(core as object), extraAnswers: extras as object },
  });

  // Snapshot del contrato firmado: el efectivo en el momento del clic
  // (el de la config si lo hay, si no el default). Así queda evidencia legal.
  const effectiveContract =
    config.contractText && config.contractText.trim() ? config.contractText : CONTRACT_TEXT;

  await prisma.client.update({
    where: { id: client.id },
    data: {
      anamnesisData: snapshot as object,
      anamnesisCompletedAt: new Date(),
      contractSignedAt: new Date(),
      contractDNI: dni,
      contractVersion: CONTRACT_VERSION,
      contractTextSnapshot: effectiveContract,
      status: "onboarding",
    },
  });

  redirect("/cliente");
}

// La página /cliente/registro y su action saveDailyLog se retiraron: el peso
// y el resto de variables semanales se capturan en el check-in. Los DailyLog
// históricos siguen en BD y la pestaña Evolución del panel los sigue
// mostrando si existían, pero ya no se crean nuevos.

export type CheckInResult = { ok: true } | { ok: false; error: string };

export async function submitCheckIn(formData: FormData): Promise<CheckInResult> {
  const client = await requireOnboardedClient();

  // Guard defensivo: si ya cumplió la petición vigente, la UI está en un
  // estado inconsistente (probablemente pestañas duplicadas). No crearlo
  // un segundo registro pero avisar al front en vez de silenciar.
  const { hasFulfilledLatestRequest } = await import("@/lib/weeklyCheckin");
  if (await hasFulfilledLatestRequest(client.id)) {
    revalidatePath("/cliente/checkin");
    return {
      ok: false,
      error: "Ya tienes un check-in registrado para esta petición. Recarga la página para editarlo.",
    };
  }

  const { coreData, extraAnswers } = await extractCheckInFieldsFromForm(formData);

  const checkIn = await prisma.checkIn.create({
    data: {
      clientId: client.id,
      ...coreData,
      extraAnswers:
        Object.keys(extraAnswers).length > 0
          ? (extraAnswers as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
    },
  });

  // Métricas personalizadas: los inputs vienen con name="metric_<metricId>".
  // Persistimos solo las activas y con valor numérico finito.
  await persistCustomMetricValues(client.id, checkIn.id, formData);

  // Al enviar el PRIMER check-in de la vida del atleta marcamos
  // initialCheckInDone=true. Así la home deja de mostrar el banner
  // "Registra tu medida inicial". Usamos updateMany con guard para
  // no pisar el timestamp updatedAt si ya estaba a true.
  await prisma.client.updateMany({
    where: { id: client.id, initialCheckInDone: false },
    data: { initialCheckInDone: true },
  });

  revalidatePath("/cliente/checkin");
  revalidatePath("/cliente");
  return { ok: true };
}

/** Edita cualquier check-in del atleta. El atleta puede corregir errores
 *  de rellenado también en check-ins pasados. La única guarda es que el
 *  check-in le pertenezca. */
export async function updateCheckIn(formData: FormData): Promise<CheckInResult> {
  const client = await requireOnboardedClient();
  const id = parseStr(formData.get("id"));
  if (!id) return { ok: false, error: "Falta el identificador del check-in." };
  const existing = await prisma.checkIn.findUnique({ where: { id } });
  if (!existing || existing.clientId !== client.id) {
    return { ok: false, error: "Ese check-in ya no está disponible." };
  }

  const { coreData, extraAnswers } = await extractCheckInFieldsFromForm(formData);

  await prisma.checkIn.update({
    where: { id },
    data: {
      ...coreData,
      extraAnswers:
        Object.keys(extraAnswers).length > 0
          ? (extraAnswers as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
    },
  });

  await persistCustomMetricValues(client.id, id, formData);

  revalidatePath("/cliente/checkin");
  revalidatePath(`/cliente/checkin/${id}`);
  return { ok: true };
}

/** Lee el FormData del check-in y separa los valores en:
 *   · coreData: mapea los coreField (weightKg, waistCm, ...) según el
 *     catálogo activo. Solo se incluyen las columnas de métricas que están
 *     en el catálogo (para no pisar columnas de métricas retiradas).
 *   · extraAnswers: dict {metricId: value} de las métricas sin coreField.
 *
 *  Convierte los inputs según type: number → Float, scale5/scale10 → Int,
 *  checkbox → Boolean, resto → String. Los valores vacíos van a null. */
async function extractCheckInFieldsFromForm(formData: FormData): Promise<{
  coreData: Record<string, string | number | null>;
  extraAnswers: Record<string, string | number | boolean | null>;
}> {
  const { listMetricDefinitions } = await import("@/lib/metricDefinitions");
  const metrics = await listMetricDefinitions();
  const coreData: Record<string, string | number | null> = {};
  const extraAnswers: Record<string, string | number | boolean | null> = {};

  for (const m of metrics) {
    const key = m.coreField ?? `extra:${m.id}`;
    const raw = formData.get(key);
    const isCore = !!m.coreField;

    if (m.type === "checkbox") {
      const checked = raw != null && raw !== "";
      if (isCore) coreData[m.coreField!] = checked ? "1" : null;
      else extraAnswers[m.id] = checked;
      continue;
    }

    if (raw == null || (typeof raw === "string" && raw.trim() === "")) {
      if (isCore) coreData[m.coreField!] = null;
      continue;
    }

    const strVal = String(raw);

    if (m.type === "number") {
      const n = Number(strVal.replace(",", "."));
      if (Number.isFinite(n)) {
        if (isCore) coreData[m.coreField!] = n;
        else extraAnswers[m.id] = n;
      } else if (isCore) {
        coreData[m.coreField!] = null;
      }
      continue;
    }

    if (m.type === "scale5" || m.type === "scale10") {
      const n = parseInt(strVal, 10);
      if (Number.isFinite(n)) {
        if (isCore) coreData[m.coreField!] = n;
        else extraAnswers[m.id] = n;
      } else if (isCore) {
        coreData[m.coreField!] = null;
      }
      continue;
    }

    // text | textarea | select
    if (isCore) coreData[m.coreField!] = strVal;
    else extraAnswers[m.id] = strVal;
  }

  return { coreData, extraAnswers };
}

/** Upsert de valores de métricas personalizadas para un check-in concreto.
 *  Lee inputs con prefijo `metric_<metricId>` del FormData, filtra solo las
 *  métricas ACTIVAS de ese cliente y guarda los valores numéricos. Si el
 *  valor está vacío o no es un número, borra la entrada (para que el cliente
 *  pueda "dejar en blanco" una métrica si se equivocó al rellenarla). */
async function persistCustomMetricValues(
  clientId: string,
  checkInId: string,
  formData: FormData,
) {
  const metrics = await prisma.customMetric.findMany({
    where: { clientId, active: true },
    select: { id: true },
  });
  for (const m of metrics) {
    const raw = formData.get(`metric_${m.id}`);
    const val = parseNumber(raw);
    if (val == null) {
      // Vacío → eliminamos cualquier valor previo de esa métrica en este
      // check-in (para borrar errores al editar).
      await prisma.customMetricValue.deleteMany({
        where: { metricId: m.id, checkInId },
      });
      continue;
    }
    await prisma.customMetricValue.upsert({
      where: { metricId_checkInId: { metricId: m.id, checkInId } },
      create: { metricId: m.id, checkInId, value: val },
      update: { value: val },
    });
  }
}

/** Valor de una marca desde el input del atleta. Acepta "MM:SS" para tiempos
 *  y número decimal para el resto. Devuelve null si no es válido. */
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

/** El propio atleta añade un registro para una marca del catálogo activo.
 *  createdById queda a null para distinguirlos de los que introduce el nutri. */
export async function addOwnStrengthRecord(formData: FormData) {
  const client = await requireOnboardedClient();
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
      clientId: client.id,
      value,
      date,
      notes,
      createdById: null,
    },
  });
  revalidatePath("/cliente/marcas");
}

export async function deleteOwnStrengthRecord(formData: FormData) {
  const client = await requireOnboardedClient();
  const id = String(formData.get("id"));
  const rec = await prisma.strengthRecord.findUnique({
    where: { id },
    select: { clientId: true },
  });
  // El atleta solo puede borrar registros suyos.
  if (!rec || rec.clientId !== client.id) return;
  await prisma.strengthRecord.delete({ where: { id } });
  revalidatePath("/cliente/marcas");
}
