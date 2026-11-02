import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import { csvField, leadMagnetResponseWhere, normalizeLeadMagnetFilters } from "@/lib/lead-magnet-report";

export const dynamic = "force-dynamic";

/** CSV privado; no se aceptan descargas sin permiso de dirección. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getActiveProfessional();
  if (!user || !isManager(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const magnet = await prisma.leadMagnet.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!magnet) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filters = normalizeLeadMagnetFilters(Object.fromEntries(req.nextUrl.searchParams.entries()));
  const rows = await prisma.leadMagnetResponse.findMany({
    where: leadMagnetResponseWhere(magnet.id, filters),
    orderBy: { createdAt: "desc" }, take: 10000,
    select: {
      id: true, createdAt: true, completedAt: true, fullName: true,
      email: true, phone: true, instagram: true, status: true,
      campaign: true, source: true, resultJson: true, whatsappClickedAt: true,
    },
  });
  const headers = ["ID", "Inicio", "Fin", "Nombre", "Email", "Telefono", "Instagram", "Estado", "Campana", "Origen", "Resultado", "Click WhatsApp"];
  const csv = `\uFEFF${headers.map(csvField).join(";")}\r\n${rows.map((r) => [
    r.id, r.createdAt, r.completedAt, r.fullName, r.email, r.phone, r.instagram,
    r.status, r.campaign, r.source, r.resultJson, r.whatsappClickedAt,
  ].map(csvField).join(";")).join("\r\n")}`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="al-fallo-lead-magnet-${magnet.id}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
