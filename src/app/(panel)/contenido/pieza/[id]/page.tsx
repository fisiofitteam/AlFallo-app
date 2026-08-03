import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveProfessional } from "@/lib/session";
import { PieceEditor } from "@/components/PieceEditor";

export default async function PiecePage({ params }: { params: { id: string } }) {
  const user = (await getActiveProfessional())!;
  if (user.role !== "ceo" && user.role !== "head_coach") redirect("/");

  const piece = await prisma.contentPiece.findUnique({
    where: { id: params.id },
    include: {
      week: true,
    },
  });
  if (!piece) notFound();

  // Hermanas (mismas semana) para navegación
  const siblings = await prisma.contentPiece.findMany({
    where: { weekId: piece.weekId },
    orderBy: { dayOfWeek: "asc" },
    select: { id: true, dayOfWeek: true, format: true, status: true },
  });

  const idx = siblings.findIndex((s) => s.id === piece.id);
  const prevId = idx > 0 ? siblings[idx - 1].id : null;
  const nextId = idx < siblings.length - 1 ? siblings[idx + 1].id : null;

  const blocks = JSON.parse(piece.blocks) as { id: string; label: string; content: string; order: number }[];

  // El primer bloque del guion es SIEMPRE el gancho. Si la pieza no lo trae
  // (piezas antiguas o plantillas que no lo definen), lo inyectamos aquí en
  // render — no se persiste hasta que el usuario edite y guarde.
  const hasGancho = blocks.length > 0 && blocks[0].label.trim().toLowerCase() === "gancho";
  if (!hasGancho) {
    blocks.unshift({ id: `gancho-${piece.id}`, label: "Gancho", content: "", order: 0 });
    blocks.forEach((b, i) => (b.order = i));
  }

  return (
    <PieceEditor
      piece={{
        id: piece.id,
        weekId: piece.weekId,
        dayOfWeek: piece.dayOfWeek,
        format: piece.format,
        title: piece.title,
        goals: piece.goals,
        goal: piece.goal,
        ctaType: piece.ctaType,
        dmKeyword: piece.dmKeyword,
        recordingInstructions: piece.recordingInstructions,
        blocks,
        caption: piece.caption,
        recordingLocation: piece.recordingLocation,
        recordingOutfit: piece.recordingOutfit,
        recordingMaterial: piece.recordingMaterial,
        consentSigned: piece.consentSigned,
        finalFileUrl: piece.finalFileUrl,
        editorNotes: piece.editorNotes,
        status: piece.status,
        metricsReach: piece.metricsReach,
        metricsSaves: piece.metricsSaves,
        metricsShares: piece.metricsShares,
        metricsComments: piece.metricsComments,
        metricsDmKeyword: piece.metricsDmKeyword,
        metricsConversions: piece.metricsConversions,
        metricsFilledAt: piece.metricsFilledAt?.toISOString() ?? null,
      }}
      week={{
        id: piece.week.id,
        centralTheme: piece.week.centralTheme,
        leadMagnetKeyword: piece.week.leadMagnetKeyword,
      }}
      prevId={prevId}
      nextId={nextId}
    />
  );
}
