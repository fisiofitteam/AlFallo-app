import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { exchangeCode, getGoogleEmail } from "@/lib/googleOAuth";
import { getRealProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";

export async function GET(req: NextRequest) {
  const base = new URL("/ajustes/agenda", req.url);
  const state = req.nextUrl.searchParams.get("state");
  const stored = req.cookies.get("afn_agenda_oauth_state")?.value;
  const code = req.nextUrl.searchParams.get("code");
  const user = await getRealProfessional();
  if (!user || !isManager(user.role) || !state || !stored || state !== stored || !code) {
    base.searchParams.set("error", "oauth-state");
    return NextResponse.redirect(base);
  }
  try {
    const tokens = await exchangeCode(code);
    const email = await getGoogleEmail(tokens.access_token);
    // No se modifica ningún evento de Calendar. Se sustituye la conexión
    // guardada solo después de completar correctamente la autenticación.
    await prisma.$transaction([
      prisma.googleCalendarConnection.deleteMany(),
      prisma.googleCalendarConnection.create({
        data: {
          googleEmail: email,
          accessTokenEnc: encrypt(tokens.access_token),
          refreshTokenEnc: encrypt(tokens.refresh_token),
          tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        },
      }),
    ]);
    base.searchParams.set("connected", "1");
  } catch (error) {
    console.error("Calendar OAuth connection failed", error);
    base.searchParams.set("error", "oauth-failed");
  }
  const response = NextResponse.redirect(base);
  response.cookies.set("afn_agenda_oauth_state", "", { maxAge: 0, path: "/api/agenda/google" });
  return response;
}
