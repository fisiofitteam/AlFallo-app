"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import { parseStr } from "@/lib/clients";
import { ONEOFF_MODES } from "@/lib/oneoff-tasks";

const TARGET_ROLES = ["nutricionista", "head_coach"];

async function requireManager() {
  const prof = await requireProfessional();
  if (!isManager(prof.role)) redirect("/");
  return prof;
}

function parseDate(value: FormDataEntryValue | null): Date | null {
  const s = parseStr(value);
  if (!s) return null;
  // <input type="date"> manda "YYYY-MM-DD". Lo interpretamos como medianoche
  // Madrid (mismo criterio que la BD), igual que en weekly-tasks.ts.
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  // 12 UTC para esquivar DST, luego restamos offset de Madrid.
  const noonUTC = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 12));
  const off = madridOffset(noonUTC);
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), 0, -off));
}

function madridOffset(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    timeZoneName: "shortOffset",
  }).formatToParts(at);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+1";
  const m = tz.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 60;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + (m[3] ? Number(m[3]) : 0));
}

function parseRole(value: FormDataEntryValue | null): string {
  const v = parseStr(value);
  return v && TARGET_ROLES.includes(v) ? v : "nutricionista";
}

function parseInt2(value: FormDataEntryValue | null): number | null {
  const n = Number(parseStr(value));
  return Number.isFinite(n) ? n : null;
}

export async function createOneOffTask(formData: FormData) {
  const prof = await requireManager();
  const title = parseStr(formData.get("title"));
  const modeRaw = parseStr(formData.get("mode")) ?? "";
  if (!title || !ONEOFF_MODES.includes(modeRaw as typeof ONEOFF_MODES[number])) return;

  const targetRole = parseRole(formData.get("targetRole"));
  const assigneeId = parseStr(formData.get("assigneeId"));

  // Recogemos los campos según modo; validamos por seguridad.
  const data: {
    title: string;
    description: string | null;
    targetRole: string;
    assigneeId: string | null;
    mode: string;
    date?: Date | null;
    startDate?: Date | null;
    endDate?: Date | null;
    nthWeek?: number | null;
    weekday?: number | null;
    until?: Date | null;
    createdById: string;
  } = {
    title,
    description: parseStr(formData.get("description")),
    targetRole,
    assigneeId: assigneeId || null,
    mode: modeRaw,
    createdById: prof.id,
  };

  if (modeRaw === "single") {
    const date = parseDate(formData.get("date"));
    if (!date) return;
    data.date = date;
  } else if (modeRaw === "range") {
    const start = parseDate(formData.get("startDate"));
    const end = parseDate(formData.get("endDate"));
    if (!start || !end || end < start) return;
    data.startDate = start;
    data.endDate = end;
  } else if (modeRaw === "monthly_weekday") {
    const nth = parseInt2(formData.get("nthWeek"));
    const wd = parseInt2(formData.get("weekday"));
    if (!nth || ![1, 2, 3, 4, -1].includes(nth)) return;
    if (!wd || wd < 1 || wd > 7) return;
    data.nthWeek = nth;
    data.weekday = wd;
    data.until = parseDate(formData.get("until"));
  }

  await prisma.oneOffTaskTemplate.create({ data });
  revalidatePath("/tareas");
  revalidatePath("/");
}

export async function deleteOneOffTask(formData: FormData) {
  await requireManager();
  const id = parseStr(formData.get("id"));
  if (!id) return;
  await prisma.oneOffTaskTemplate.delete({ where: { id } });
  revalidatePath("/tareas");
  revalidatePath("/");
}
