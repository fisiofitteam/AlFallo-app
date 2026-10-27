import { NextRequest, NextResponse } from "next/server";
import { getRealProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import { buildAuthUrl } from "@/lib/googleOAuth";

export async function GET(req: NextRequest) {
  const user = await getRealProfessional();
  if (!user || !isManager(user.role)) return NextResponse.redirect(new URL("/login", req.url));
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET ||
      !process.env.GOOGLE_REDIRECT_URI?.endsWith("/api/agenda/google/callback")) {
    return NextResponse.redirect(new URL("/ajustes/agenda?error=oauth-config", req.url));
  }
  const state = crypto.randomUUID();
  const response = NextResponse.redirect(buildAuthUrl(state));
  response.cookies.set("afn_agenda_oauth_state", state, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600,
    path: "/api/agenda/google",
  });
  return response;
}
