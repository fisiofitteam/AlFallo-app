/**
 * Migración de datos: Neon -> Supabase (u otra Postgres).
 *
 * Lee de la BD vieja (LEGACY_DATABASE_URL) y escribe en la nueva (DATABASE_URL).
 * Las tablas se copian en orden de dependencias para respetar las FKs.
 * Usa `createMany({ skipDuplicates: true })` para que sea idempotente.
 *
 * Uso:
 *   1) En .env.local define LEGACY_DATABASE_URL (la antigua de Neon)
 *      y DATABASE_URL (la nueva de Supabase, pooled).
 *   2) Ejecuta: node --env-file=.env scripts/migrate-neon-to-supabase.mjs
 *      (con npm: `npm run db:migrate-neon`)
 */
import { PrismaClient } from "@prisma/client";

const LEGACY = process.env.LEGACY_DATABASE_URL;
const TARGET = process.env.DATABASE_URL;
if (!LEGACY || !TARGET) {
  console.error("❌ Faltan LEGACY_DATABASE_URL y/o DATABASE_URL en el entorno.");
  process.exit(1);
}
if (LEGACY === TARGET) {
  console.error("❌ LEGACY_DATABASE_URL y DATABASE_URL son la misma. Aborto.");
  process.exit(1);
}

const src = new PrismaClient({ datasources: { db: { url: LEGACY } } });
const dst = new PrismaClient({ datasources: { db: { url: TARGET } } });

// Orden de copia respetando dependencias (padres antes que hijos).
const TABLES = [
  "professional",
  "session",
  "client",
  "nutritionProfile",
  "clientSession",
  "dailyLog",
  "checkIn",
  "foodLibrary",
  "nutritionPlan",
  "planDay",
  "meal",
  "mealItem",
  "contentWeek",
  "contentPiece",
  "weeklyTemplate",
  "scriptTemplate",
  "leadMagnet",
  "clinicalCase",
  "winningHook",
  "contentIdea",
  "calendarEvent",
  "transaction",
  "payrollPayment",
  "quarterlyGoal",
  "lead",
  "scheduledCall",
  "sale",
];

async function copyTable(name) {
  const srcModel = src[name];
  const dstModel = dst[name];
  if (!srcModel || !dstModel) {
    console.warn(`⚠️  Modelo ${name} no encontrado, salto.`);
    return;
  }
  const rows = await srcModel.findMany();
  if (rows.length === 0) {
    console.log(`·  ${name}: 0 filas`);
    return;
  }
  // createMany no permite anidados; los rows son planos (FKs + valores).
  const result = await dstModel.createMany({ data: rows, skipDuplicates: true });
  console.log(`✓  ${name}: ${result.count}/${rows.length} filas copiadas`);
}

async function main() {
  console.log("Migrando datos\n  origen: " + LEGACY.replace(/:[^:@/]+@/, ":***@"));
  console.log("  destino: " + TARGET.replace(/:[^:@/]+@/, ":***@") + "\n");

  for (const t of TABLES) {
    try {
      await copyTable(t);
    } catch (e) {
      console.error(`✗  ${t}: ${e.message}`);
      throw e;
    }
  }

  console.log("\n✅ Migración completada.");
}

main()
  .catch((e) => {
    console.error("\n❌ Error migrando:", e);
    process.exit(1);
  })
  .finally(async () => {
    await src.$disconnect();
    await dst.$disconnect();
  });
