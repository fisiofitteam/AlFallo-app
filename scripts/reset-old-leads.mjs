/**
 * Borra los Leads y ScheduledCalls del CRM viejo para poder aplicar el
 * nuevo schema. NO toca clientes, planes, equipo, contenido ni finanzas.
 *
 * Uso: node --env-file=.env scripts/reset-old-leads.mjs
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

try {
  // SQL crudo: las columnas del viejo schema desaparecen tras db:push,
  // así que usamos delete genérico sobre cualquier fila existente.
  const callsDel = await p.$executeRawUnsafe('DELETE FROM "ScheduledCall"');
  const salesNulled = await p.$executeRawUnsafe(
    'UPDATE "Sale" SET "leadId" = NULL WHERE "leadId" IS NOT NULL',
  );
  const leadsDel = await p.$executeRawUnsafe('DELETE FROM "Lead"');

  console.log(`✓ ScheduledCall borrados: ${callsDel}`);
  console.log(`✓ Sale con leadId puesto a NULL: ${salesNulled}`);
  console.log(`✓ Lead borrados: ${leadsDel}`);
  console.log("\nAhora ejecuta: npm run db:push -- --accept-data-loss");
} finally {
  await p.$disconnect();
}
