"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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

export async function submitCheckIn(formData: FormData) {
  const client = await requireOnboardedClient();

  // Anti-doble-submit: si el atleta ya envió un check-in esta semana
  // (sin querer le dio dos veces, o vuelve a entrar más tarde), no creamos
  // otro registro. Para editar las respuestas usa updateCheckIn.
  const { hasCheckInThisWeek } = await import("@/lib/weeklyCheckin");
  if (await hasCheckInThisWeek(client.id)) {
    revalidatePath("/cliente/checkin");
    return;
  }

  const checkIn = await prisma.checkIn.create({
    data: {
      clientId: client.id,
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
}

/** Edita las respuestas del check-in de esta semana del atleta. Solo lo
 *  permitimos si el check-in pertenece a este cliente y está dentro de la
 *  semana actual (mismo criterio que el aviso del lunes). Si la nutri ya
 *  lo revisó, igualmente se puede tocar; la UI muestra una advertencia. */
export async function updateCheckIn(formData: FormData) {
  const client = await requireOnboardedClient();
  const id = parseStr(formData.get("id"));
  if (!id) return;
  const existing = await prisma.checkIn.findUnique({ where: { id } });
  if (!existing || existing.clientId !== client.id) return;

  // Solo permitimos editar el check-in de ESTA semana (no historicos).
  const { hasCheckInThisWeek } = await import("@/lib/weeklyCheckin");
  if (!(await hasCheckInThisWeek(client.id))) return;

  await prisma.checkIn.update({
    where: { id },
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

  await persistCustomMetricValues(client.id, id, formData);

  revalidatePath("/cliente/checkin");
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
