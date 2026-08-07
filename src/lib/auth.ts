import "server-only";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "afn_session";
export const IMPERSONATE_COOKIE = "afn_impersonate";
const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

export const impersonateCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  // Sin maxAge: cookie de sesión que muere al cerrar el navegador para
  // evitar quedarse "viendo como" alguien sin darse cuenta.
};

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

// Crea una sesión en BD y devuelve el token + caducidad para fijar la cookie.
export async function createSession(professionalId: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await prisma.session.create({ data: { token, professionalId, expiresAt } });
  return { token, expiresAt };
}

export async function deleteSession(token: string) {
  await prisma.session.deleteMany({ where: { token } });
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MS / 1000,
};
