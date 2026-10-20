/**
 * Additive content schema upgrade. Run from the app directory with its own env:
 * node --env-file=.env scripts/upgrade-content-panel.mjs --apply --backup-dir=/secure/path
 * No updates/inserts/deletes are issued against existing content tables.
 * Existing columns are snapshotted and checked byte-for-byte in one transaction.
 */
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const db = new PrismaClient();
const tables = ["ContentPiece", "ContentWeek", "ClinicalCase", "ContentIdea", "WinningHook", "LeadMagnet", "ScriptTemplate", "WeeklyTemplate", "CalendarEvent", "AiContentBrief"];
const quote = (name) => `"${name.replaceAll('"', '""')}"`;
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const apply = process.argv.includes("--apply");
const backupDir = process.argv.find((a) => a.startsWith("--backup-dir="))?.slice(13);
if (apply && !backupDir) throw new Error("--backup-dir is required for an upgrade");

async function columns(tx) {
  const result = {};
  for (const table of tables) {
    const rows = await tx.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = ${table}
      ORDER BY ordinal_position
    `;
    if (!rows.length) throw new Error(`Missing existing table: ${table}`);
    result[table] = rows.map((r) => r.column_name);
  }
  return result;
}

async function snapshot(tx, fields) {
  const data = {};
  for (const table of tables) {
    data[table] = await tx.$queryRawUnsafe(
      `SELECT row_to_json(t)::text AS row FROM (SELECT ${fields[table].map(quote).join(", ")} FROM ${quote(table)} ORDER BY "id") t`,
    );
  }
  return data;
}

try {
  const result = await db.$transaction(async (tx) => {
    if (apply) await tx.$executeRawUnsafe(`LOCK TABLE ${tables.map(quote).join(", ")} IN SHARE ROW EXCLUSIVE MODE`);
    const fields = await columns(tx);
    const before = await snapshot(tx, fields);
    if (apply) {
      mkdirSync(backupDir, { recursive: true, mode: 0o700 });
      const file = join(backupDir, `al-fallo-content-${new Date().toISOString().replaceAll(":", "-")}.json`);
      writeFileSync(file, JSON.stringify({ fields, data: before }), { mode: 0o600, flag: "wx" });
      const sql = readFileSync(new URL("./content-panel-additions.sql", import.meta.url), "utf8");
      if (/\b(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+\"|INSERT\s+INTO)\b/i.test(sql)) throw new Error("Non-additive SQL rejected");
      for (const statement of sql.split(";").map((s) => s.replace(/^--.*$/gm, "").trim()).filter(Boolean)) {
        if (statement.includes('ADD CONSTRAINT "StoryIdea_templateSlotId_fkey"')) {
          const exists = await tx.$queryRaw`SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = current_schema() AND constraint_name = 'StoryIdea_templateSlotId_fkey'`;
          if (exists.length) continue;
        }
        await tx.$executeRawUnsafe(statement);
      }
      const after = await snapshot(tx, fields);
      if (hash(before) !== hash(after)) throw new Error("Content changed during upgrade; rolling back");
    }
    return { applied: apply, contentUnchanged: true, checksum: hash(before), counts: Object.fromEntries(tables.map((t) => [t, before[t].length])) };
  }, { timeout: 60000, maxWait: 10000 });
  console.log(JSON.stringify(result));
} finally {
  await db.$disconnect();
}
