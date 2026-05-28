"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  createSession,
  deleteSession,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "/");

  if (!email || !password) {
    return { error: "Introduce email y contraseña." };
  }

  const professional = await prisma.professional.findUnique({ where: { email } });

  // Mensaje genérico: no revelamos si el email existe.
  const invalid: LoginState = { error: "Email o contraseña incorrectos." };
  if (!professional || !professional.isActive) return invalid;

  const ok = await verifyPassword(password, professional.passwordHash);
  if (!ok) return invalid;

  const { token } = await createSession(professional.id);
  await prisma.professional.update({
    where: { id: professional.id },
    data: { lastLoginAt: new Date() },
  });
  cookies().set(SESSION_COOKIE, token, sessionCookieOptions);

  // Evita open-redirect: solo rutas internas.
  const dest = from.startsWith("/") && !from.startsWith("//") ? from : "/";
  redirect(dest);
}

export async function logout() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(token);
  cookies().delete(SESSION_COOKIE);
  redirect("/login");
}
