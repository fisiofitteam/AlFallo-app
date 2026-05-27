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
import { requireClient } from "@/lib/client-session";
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

  const profileData = {
    goal: parseStr(formData.get("goal")),
    weightKg: parseNumber(formData.get("weightKg")),
    heightCm: parseIntOrNull(formData.get("heightCm")),
    targetWeightKg: parseNumber(formData.get("targetWeightKg")),
    weeklyFrequency: parseIntOrNull(formData.get("weeklyFrequency")),
    level: parseStr(formData.get("level")),
    boxName: parseStr(formData.get("boxName")),
    dietaryStyle: parseStr(formData.get("dietaryStyle")),
    allergies: parseList(formData.get("allergies")),
    intolerances: parseList(formData.get("intolerances")),
    dislikes: parseList(formData.get("dislikes")),
    supplements: parseList(formData.get("supplements")),
    medicalConditions: parseStr(formData.get("medicalConditions")),
    medication: parseStr(formData.get("medication")),
  };

  // La ficha nutricional se rellena con lo que declara el atleta.
  await prisma.nutritionProfile.upsert({
    where: { clientId: client.id },
    create: { clientId: client.id, ...profileData },
    update: profileData,
  });

  await prisma.client.update({
    where: { id: client.id },
    data: {
      anamnesisData: profileData as object,
      anamnesisCompletedAt: new Date(),
      contractSignedAt: new Date(),
      contractDNI: dni,
      contractVersion: CONTRACT_VERSION,
      contractTextSnapshot: CONTRACT_TEXT,
      status: "onboarding",
    },
  });

  redirect("/cliente");
}

export async function saveDailyLog(formData: FormData) {
  const client = await requireClient();

  // Fecha del registro (por defecto hoy), normalizada a medianoche UTC.
  const dateStr = parseStr(formData.get("date")) ?? new Date().toISOString().slice(0, 10);
  const date = new Date(`${dateStr}T00:00:00.000Z`);

  const data = {
    weightKg: parseNumber(formData.get("weightKg")),
    energy: parseIntOrNull(formData.get("energy")),
    hunger: parseIntOrNull(formData.get("hunger")),
    sleepHours: parseNumber(formData.get("sleepHours")),
    adherencePct: parseIntOrNull(formData.get("adherencePct")),
    notes: parseStr(formData.get("notes")),
  };

  await prisma.dailyLog.upsert({
    where: { clientId_date: { clientId: client.id, date } },
    create: { clientId: client.id, date, ...data },
    update: data,
  });

  revalidatePath("/cliente/registro");
  revalidatePath("/cliente/progreso");
  revalidatePath("/cliente");
}
