import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const DOMAIN = "alfallo-gasolina-session-v1:";

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 24) throw new Error("Missing secure session key");
  return value;
}

export function signedAttempt(id: string): string {
  return createHmac("sha256", secret()).update(DOMAIN + id).digest("hex");
}
export function validSignedAttempt(id: string, supplied: unknown): boolean {
  if (typeof supplied !== "string" || !/^[a-f0-9]{64}$/.test(supplied) || !/^c[a-z0-9]{10,}$/.test(id)) return false;
  const a = Buffer.from(signedAttempt(id), "hex");
  const b = Buffer.from(supplied, "hex");
  return timingSafeEqual(a, b);
}
