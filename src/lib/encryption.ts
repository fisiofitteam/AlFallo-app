import "server-only";
import crypto from "node:crypto";

// Cifrado simétrico AES-256-GCM para guardar tokens sensibles en BD
// (en particular: access/refresh tokens de Google Calendar).
//
// ENCRYPTION_KEY debe ser 32 bytes en hex (64 caracteres). Se puede generar con:
//   openssl rand -hex 32
//
// Formato del ciphertext devuelto: <iv-hex>:<authTag-hex>:<ciphertext-hex>

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "Falta ENCRYPTION_KEY en .env (32 bytes hex). Genera una con: openssl rand -hex 32",
    );
  }
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY debe ser 32 bytes (64 chars hex)");
  }
  return buf;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96 bits recomendado para GCM
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Ciphertext con formato inválido");
  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
