/**
 * Diagnóstico del login del cliente.
 * Restablece la contraseña de un cliente a una conocida ("test1234")
 * y prueba que se puede verificar.
 *
 * Uso: node --env-file=.env scripts/test-client-login.mjs alesfaus@gmail.com
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const email = process.argv[2];
if (!email) {
  console.error("Uso: node --env-file=.env scripts/test-client-login.mjs <email>");
  process.exit(1);
}

const p = new PrismaClient();
const KNOWN = "test1234";

const c = await p.client.findUnique({ where: { email: email.toLowerCase() } });
if (!c) {
  console.error(`❌ No hay cliente con email ${email}`);
  process.exit(1);
}

console.log(`Cliente: ${c.fullName} (${c.email})`);
console.log(`PasswordHash actual: ${c.passwordHash ? "presente" : "AUSENTE"}\n`);

// 1) Test rápido: ¿bcrypt funciona en ambos sentidos?
console.log("1) Test de bcrypt (hash + verify):");
const tmpHash = await bcrypt.hash(KNOWN, 12);
const tmpOk = await bcrypt.compare(KNOWN, tmpHash);
console.log(`   hash+verify de '${KNOWN}': ${tmpOk ? "✓ funciona" : "✗ FALLA"}\n`);

// 2) Reseteo la contraseña a 'test1234' usando exactamente el mismo método que setClientPassword
console.log("2) Reseteando contraseña a 'test1234' con bcrypt(12)…");
const newHash = await bcrypt.hash(KNOWN, 12);
await p.client.update({ where: { id: c.id }, data: { passwordHash: newHash } });
console.log("   ✓ Guardado en BD\n");

// 3) Releo y verifico contra el hash guardado
console.log("3) Releyendo de BD y verificando…");
const after = await p.client.findUnique({ where: { email: email.toLowerCase() }, select: { passwordHash: true } });
const ok = await bcrypt.compare(KNOWN, after.passwordHash);
console.log(`   verify('${KNOWN}', hashEnBD): ${ok ? "✓ COINCIDE" : "✗ NO COINCIDE"}`);

console.log("\n✅ Listo. Ahora prueba a entrar en /cliente/login con:");
console.log(`   email: ${c.email}`);
console.log(`   contraseña: ${KNOWN}\n`);

await p.$disconnect();
