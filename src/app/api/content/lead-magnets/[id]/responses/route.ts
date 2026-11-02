import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveProfessional } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/content/lead-magnets/[id]/responses
 * Elimina únicamente las respuestas solicitadas que pertenezcan al recurso.
 * Para proteger datos reales, solo CEO; máximo 50 por operación; sin
 * borrado global, sin modificar el LeadMagnet ni otros módulos del CRM.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getActiveProfessional();
  if (!user || user.role !== "ceo") {
    return NextResponse.json({ error: "Solo dirección (CEO) puede borrar respuestas." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 50 ||
      !ids.every((id) => typeof id === "string" && /^[a-zA-Z0-9_-]{10,64}$/.test(id)) ||
      new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: "Selecciona entre 1 y 50 respuestas válidas." }, { status: 400 });
  }

  const resource = await prisma.leadMagnet.findUnique({
    where: { id: params.id }, select: { id: true },
  });
  if (!resource) return NextResponse.json({ error: "Lead magnet no encontrado." }, { status: 404 });

  const where = { leadMagnetId: resource.id, id: { in: ids as string[] } };
  const matches = await prisma.leadMagnetResponse.count({ where });
  if (matches !== ids.length) {
    return NextResponse.json({
      error: "Alguna respuesta no existe o pertenece a otro recurso. Actualiza la página y vuelve a seleccionar.",
    }, { status: 409 });
  }

  const result = await prisma.leadMagnetResponse.deleteMany({ where });
  return NextResponse.json({ ok: true, deleted: result.count }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
