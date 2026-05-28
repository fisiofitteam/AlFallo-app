/**
 * Diagnóstico: lista clientes con su estado de acceso (email + contraseña).
 * Uso: node --env-file=.env scripts/check-clients.mjs
 */
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const clients = await p.client.findMany({
  select: {
    id: true,
    fullName: true,
    email: true,
    passwordHash: true,
    anamnesisCompletedAt: true,
    contractSignedAt: true,
    createdAt: true,
  },
  orderBy: { createdAt: "desc" },
});

console.log(`\nClientes en BD: ${clients.length}\n`);
for (const c of clients) {
  console.log(`• ${c.fullName}`);
  console.log(`  id:                ${c.id}`);
  console.log(`  email:             ${c.email ?? "(SIN EMAIL)"}`);
  console.log(`  passwordHash:      ${c.passwordHash ? "✓ guardado (" + c.passwordHash.length + " chars)" : "✗ NO GUARDADO"}`);
  console.log(`  onboarding:        ${c.anamnesisCompletedAt ? "✓" : "✗"} cuestionario, ${c.contractSignedAt ? "✓" : "✗"} contrato`);
  console.log("");
}

await p.$disconnect();
