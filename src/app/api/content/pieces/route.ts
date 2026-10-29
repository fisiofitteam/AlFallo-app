import { canManageContent } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveProfessional } from "@/lib/session";
import { getOrCreateContentWeek, parsePieceDate } from "@/lib/content-piece-date";

function canAccess(role: string): boolean {
  return canManageContent(role);
}

/**
 * POST /api/content/pieces — crea una pieza directamente en una fecha.
 * `date: YYYY-MM-DD` es el flujo habitual del calendario y no exige crear
 * una semana; `weekId` + `dayOfWeek` sigue disponible por retrocompatibilidad.
 * Los contenedores semanales internos NO crean siete piezas de relleno.
 */
export async function POST(req: NextRequest) {
  const user = await getActiveProfessional();
  if (!user || !canAccess(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await req.json().catch(() => ({}));
  const date = data?.date === undefined ? null : parsePieceDate(data.date);
  if (data?.date !== undefined && !date) {
    return NextResponse.json({ error: "Fecha inválida (YYYY-MM-DD)" }, { status: 400 });
  }
  const weekId = typeof data?.weekId === "string" ? data.weekId.trim() : "";
  if (!date && !weekId) {
    return NextResponse.json({ error: "Debes indicar una fecha" }, { status: 400 });
  }
  if (date && weekId) {
    return NextResponse.json({ error: "Indica fecha o semana, no ambas" }, { status: 400 });
  }
  const dayOfWeek = date?.dayOfWeek ?? Number(data?.dayOfWeek);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
    return NextResponse.json({ error: "dayOfWeek debe ser 1..7" }, { status: 400 });
  }

  // Objetivos opcionales al crear (array de strings). Los filtramos
  // contra el catálogo válido para no aceptar basura.
  const ALLOWED_GOALS = ["atraer", "conectar", "educar", "convertir", "lanzamiento"];
  const goalsRaw = Array.isArray(data?.goals) ? data.goals : [];
  const goalsClean = goalsRaw
    .map((g: unknown) => String(g))
    .filter((g: string) => ALLOWED_GOALS.includes(g));

  // Mantener el endpoint legacy basado en semana para integraciones antiguas.
  // El nuevo calendario envía `date`; la semana se crea solo como contenedor
  // técnico, sin generar piezas adicionales.
  const createData = (resolvedWeek: { id: string; leadMagnetKeyword: string | null }) => ({
    weekId: resolvedWeek.id,
    dayOfWeek,
    format: typeof data?.format === "string" ? data.format : "",
    goal: "",
    goals: JSON.stringify(goalsClean),
    ctaType: "",
    dmKeyword: resolvedWeek.leadMagnetKeyword ?? null,
    title: typeof data?.title === "string" && data.title.trim() ? data.title.trim() : null,
    blocks: "[]",
    status: "idea",
  });
  const piece = date
    ? await prisma.$transaction(async (tx) => {
        // Serializar la creación del contenedor semanal para evitar duplicados
        // al crear dos piezas a la vez en una semana nueva.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(71026, ${date.year * 100 + date.weekNumber}::integer)`;
        const week = await getOrCreateContentWeek(tx, date);
        return tx.contentPiece.create({ data: createData(week) });
      }, { timeout: 15_000 })
    : await (async () => {
        const week = await prisma.contentWeek.findUnique({
          where: { id: weekId }, select: { id: true, leadMagnetKeyword: true },
        });
        if (!week) return null;
        return prisma.contentPiece.create({ data: createData(week) });
      })();
  if (!piece) return NextResponse.json({ error: "Semana no encontrada" }, { status: 404 });

  return NextResponse.json({ ok: true, id: piece.id, piece });
}

export async function PATCH(req: NextRequest) {
  const user = await getActiveProfessional();
  if (!user || !canAccess(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await req.json();
  const { id, ...rest } = data;
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const update: any = {};

  // Campos directos
  const textFields = [
    "title", "hook", "recordingInstructions", "caption",
    "format", "goal", "ctaType",
    "recordingLocation", "recordingOutfit", "recordingMaterial",
    "editorNotes", "finalFileUrl", "dmKeyword", "status",
  ];
  for (const k of textFields) {
    if (rest[k] !== undefined) update[k] = rest[k] || null;
  }

  if (rest.consentSigned !== undefined) update.consentSigned = !!rest.consentSigned;

  // Blocks: viene como array, lo guardamos como JSON string
  if (rest.blocks !== undefined) {
    update.blocks = JSON.stringify(rest.blocks);
  }

  // Goals: array de objetivos (selección múltiple). Validamos los valores.
  if (rest.goals !== undefined) {
    const validGoals = ["atraer", "conectar", "educar", "convertir", "lanzamiento"];
    const goalsArr = Array.isArray(rest.goals) ? rest.goals.filter((g: any) => validGoals.includes(g)) : [];
    update.goals = JSON.stringify(goalsArr);
  }

  // Mover directamente a cualquier fecha; se reutiliza o crea el contenedor
  // interno cuando la semana de destino todavía no existe.
  if (rest.date !== undefined) {
    const target = parsePieceDate(rest.date);
    if (!target || rest.weekId !== undefined || rest.dayOfWeek !== undefined) {
      return NextResponse.json({ error: "Fecha de destino inválida" }, { status: 400 });
    }
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(71026, ${target.year * 100 + target.weekNumber}::integer)`;
      const week = await getOrCreateContentWeek(tx, target);
      return tx.contentPiece.update({ where: { id }, data: { ...update, weekId: week.id, dayOfWeek: target.dayOfWeek } });
    }, { timeout: 15_000 }).then((piece) => NextResponse.json(piece));
  }
  if (rest.dayOfWeek !== undefined) {
    const dow = Number(rest.dayOfWeek);
    if (!Number.isInteger(dow) || dow < 1 || dow > 7) {
      return NextResponse.json({ error: "dayOfWeek debe ser 1-7" }, { status: 400 });
    }
    update.dayOfWeek = dow;
  }
  if (rest.weekId !== undefined) {
    const targetWeek = await prisma.contentWeek.findUnique({ where: { id: rest.weekId } });
    if (!targetWeek) return NextResponse.json({ error: "Semana destino no existe" }, { status: 400 });
    update.weekId = rest.weekId;
  }

  // Métricas
  const metricFields = [
    "metricsReach", "metricsSaves", "metricsShares",
    "metricsComments", "metricsDmKeyword", "metricsConversions",
  ];
  let touchedMetrics = false;
  for (const k of metricFields) {
    if (rest[k] !== undefined) {
      update[k] = rest[k] === "" || rest[k] === null ? null : Number(rest[k]);
      touchedMetrics = true;
    }
  }
  if (touchedMetrics) update.metricsFilledAt = new Date();
  if (rest.clearMetricsFilledAt) update.metricsFilledAt = null;

  const piece = await prisma.contentPiece.update({ where: { id }, data: update });
  return NextResponse.json(piece);
}
