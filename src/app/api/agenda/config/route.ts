import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRealProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";

export const dynamic = "force-dynamic";

async function authorized() {
  const user = await getRealProfessional();
  return Boolean(user && isManager(user.role));
}

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  if (!(await authorized())) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  const [shifts, closers, connected] = await Promise.all([
    prisma.defaultClosingShift.findMany({
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      include: { closer: { select: { fullName: true } } },
    }),
    prisma.professional.findMany({
      where: { isActive: true, role: { in: ["closer", "ceo", "head_coach"] } },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.googleCalendarConnection.findFirst({ orderBy: { createdAt: "desc" }, select: { googleEmail: true } }),
  ]);
  const oauthConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI && process.env.ENCRYPTION_KEY &&
    process.env.GOOGLE_REDIRECT_URI.endsWith("/api/agenda/google/callback"),
  );
  return NextResponse.json({
    shifts, closers,
    connectedEmail: connected?.googleEmail ?? null,
    oauthConfigured,
  }, { headers: noStore });
}

const validTime = (value: unknown): value is string =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

export async function POST(req: NextRequest) {
  if (!(await authorized())) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  let data: Record<string, unknown>;
  try { data = await req.json(); } catch { return NextResponse.json({ error: "Formato incorrecto" }, { status: 400 }); }
  const dayOfWeek = Number(data.dayOfWeek);
  const slotDurationMinutes = Number(data.slotDurationMinutes);
  const startTime = data.startTime;
  const endTime = data.endTime;
  const closerId = data.closerId;
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7 ||
      !validTime(startTime) || !validTime(endTime) || minutes(endTime) <= minutes(startTime) ||
      ![30, 45, 60].includes(slotDurationMinutes) ||
      minutes(endTime) - minutes(startTime) < slotDurationMinutes ||
      typeof closerId !== "string") {
    return NextResponse.json({ error: "Revisa día, horario y duración" }, { status: 400 });
  }
  const closer = await prisma.professional.findFirst({
    where: { id: closerId, isActive: true, role: { in: ["closer", "ceo", "head_coach"] } },
    select: { id: true },
  });
  if (!closer) return NextResponse.json({ error: "Selecciona un closer activo" }, { status: 400 });
  const sameDay = await prisma.defaultClosingShift.findMany({ where: { dayOfWeek } });
  if (sameDay.some((s) => minutes(startTime) < minutes(s.endTime) && minutes(endTime) > minutes(s.startTime))) {
    return NextResponse.json({ error: "Ya existe una franja que se solapa con ese horario" }, { status: 409 });
  }
  const shift = await prisma.defaultClosingShift.create({
    data: { dayOfWeek, startTime, endTime, slotDurationMinutes, closerId },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: shift.id });
}

export async function DELETE(req: NextRequest) {
  if (!(await authorized())) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  let data: { id?: unknown };
  try { data = await req.json(); } catch { return NextResponse.json({ error: "Formato incorrecto" }, { status: 400 }); }
  if (typeof data.id !== "string" || !data.id) return NextResponse.json({ error: "Falta el ID" }, { status: 400 });
  await prisma.defaultClosingShift.deleteMany({ where: { id: data.id } });
  return NextResponse.json({ ok: true });
}
