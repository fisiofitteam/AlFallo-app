import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRealProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import { listEvents } from "@/lib/googleCalendar";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico seguro: comprueba el acceso a Google Calendar sin escribir
 * ni crear eventos. Disponible solo a dirección.
 */
export async function GET() {
  const user = await getRealProfessional();
  if (!user || !isManager(user.role)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 403 });
  }
  const connection = await prisma.googleCalendarConnection.findFirst({
    orderBy: { createdAt: "desc" },
    select: { googleEmail: true },
  });
  if (!connection) {
    return NextResponse.json({ ok: false, error: "Conecta una cuenta de Google Calendar primero." }, {
      status: 409, headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json({ ok: false, error: "Faltan credenciales de Google OAuth en Vercel." }, {
      status: 503, headers: { "Cache-Control": "private, no-store" },
    });
  }
  try {
    const from = new Date();
    const to = new Date(from.getTime() + 7 * 86_400_000);
    const events = await listEvents(from.toISOString(), to.toISOString());
    return NextResponse.json({
      ok: true,
      connectedEmail: connection.googleEmail,
      checked: true,
      eventCount: events.length,
      checkedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    // El error detallado queda en el servidor, nunca exponemos tokens,
    // mensajes de API o información del calendario en la respuesta pública.
    console.error("Google Calendar diagnostic failed", err);
    return NextResponse.json({
      ok: false,
      error: "No hemos podido consultar Google Calendar. Revisa los permisos y vuelve a conectar la cuenta.",
    }, { status: 502, headers: { "Cache-Control": "private, no-store" } });
  }
}
