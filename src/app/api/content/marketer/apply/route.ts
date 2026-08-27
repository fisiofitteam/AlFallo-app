import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveProfessional } from "@/lib/session";
import { canUseMarketerIA } from "@/lib/marketer-access";
import { isoWeekRange } from "@/lib/content-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_GOALS = ["atraer", "conectar", "educar", "convertir", "lanzamiento"] as const;
const ALLOWED_FORMATS = ["reel", "carousel", "infographic", "image", "live"] as const;
const ALLOWED_WEEK_TYPES = ["educativa", "objeciones", "lanzamiento", "recuperacion"] as const;
type WeekType = (typeof ALLOWED_WEEK_TYPES)[number];

export async function POST(req: NextRequest) {
  const user = await getActiveProfessional();
  if (!user || !canUseMarketerIA(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const weekIn = body?.week ?? {};
  const pieceIn = body?.piece ?? {};

  const year = Math.round(Number(weekIn.year));
  const weekNumber = Math.round(Number(weekIn.weekNumber));
  if (!year || !weekNumber || weekNumber < 1 || weekNumber > 53) {
    return NextResponse.json(
      { error: "year y weekNumber válidos requeridos" },
      { status: 400 },
    );
  }

  const dayOfWeek = Math.round(Number(pieceIn.dayOfWeek));
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
    return NextResponse.json({ error: "dayOfWeek debe ser 1..7" }, { status: 400 });
  }

  const format = String(pieceIn.format ?? "");
  if (!(ALLOWED_FORMATS as readonly string[]).includes(format)) {
    return NextResponse.json(
      { error: `format debe ser: ${ALLOWED_FORMATS.join(", ")}` },
      { status: 400 },
    );
  }

  const title = typeof pieceIn.title === "string" ? pieceIn.title.trim() : "";
  const hook = typeof pieceIn.hook === "string" ? pieceIn.hook.trim() : "";
  const goalsRaw = Array.isArray(pieceIn.goals) ? pieceIn.goals : [];
  const goals = goalsRaw
    .map((g: unknown) => String(g))
    .filter((g: string) => (ALLOWED_GOALS as readonly string[]).includes(g));

  // Reutiliza la semana si ya existe (mismo year + weekNumber) o la crea con
  // los datos que la IA propuso. Así se pueden añadir varias piezas de la
  // propuesta sin duplicar semanas.
  let week = await prisma.contentWeek.findFirst({ where: { year, weekNumber } });
  let weekCreated = false;
  if (!week) {
    const weekTypeIn = String(weekIn.weekType ?? "");
    const weekType: WeekType = (ALLOWED_WEEK_TYPES as readonly string[]).includes(weekTypeIn)
      ? (weekTypeIn as WeekType)
      : "educativa";
    const limitingBeliefs = Array.isArray(weekIn.limitingBeliefs)
      ? weekIn.limitingBeliefs.map(String)
      : [];
    const { start, end } = isoWeekRange(year, weekNumber);
    week = await prisma.contentWeek.create({
      data: {
        year,
        weekNumber,
        startDate: start,
        endDate: end,
        centralTheme: String(weekIn.centralTheme ?? "").trim() || "",
        bodyZone: String(weekIn.bodyZone ?? "mixta").trim() || "mixta",
        weekType,
        limitingBeliefs: JSON.stringify(limitingBeliefs),
        mixValue: 50,
        mixBeliefs: 30,
        mixConversion: 20,
        status: "planning",
      },
    });
    weekCreated = true;
  }

  const piece = await prisma.contentPiece.create({
    data: {
      weekId: week.id,
      dayOfWeek,
      format,
      title: title || null,
      hook: hook || null,
      goals: JSON.stringify(goals),
      goal: "",
      ctaType: "",
      dmKeyword: week.leadMagnetKeyword ?? null,
      blocks: "[]",
      status: "idea",
    },
  });

  return NextResponse.json({
    ok: true,
    pieceId: piece.id,
    weekId: week.id,
    weekCreated,
  });
}
