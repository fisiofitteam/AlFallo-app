import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export const CLIENT_SESSION_COOKIE = "afn_client_session";
const SESSION_DAYS = 60;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

export async function createClientSession(clientId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MS);
  await prisma.clientSession.create({ data: { token, clientId, expiresAt } });
  return { token, expiresAt };
}

export async function deleteClientSession(token: string) {
  await prisma.clientSession.deleteMany({ where: { token } });
}

export const clientSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MS / 1000,
};
