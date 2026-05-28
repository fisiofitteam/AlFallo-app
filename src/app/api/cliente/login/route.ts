import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import {
  CLIENT_SESSION_COOKIE,
  clientSessionCookieOptions,
  createClientSession,
} from "@/lib/client-auth";

// Login del atleta vía POST clásico (sin React server actions).
// Pone la cookie por HTTP y redirige a /cliente; los errores vuelven con ?error=.
export async function POST(req: NextRequest) {
  const base = new URL(req.url).origin;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.redirect(new URL("/cliente/login?error=bad-request", base), { status: 303 });
  }

  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!email || !password) {
    return NextResponse.redirect(new URL("/cliente/login?error=missing", base), { status: 303 });
  }

  const client = await prisma.client.findUnique({ where: { email } });
  if (!client || !client.passwordHash) {
    return NextResponse.redirect(new URL("/cliente/login?error=invalid", base), { status: 303 });
  }

  const ok = await verifyPassword(password, client.passwordHash);
  if (!ok) {
    return NextResponse.redirect(new URL("/cliente/login?error=invalid", base), { status: 303 });
  }

  const { token } = await createClientSession(client.id);
  const res = NextResponse.redirect(new URL("/cliente", base), { status: 303 });
  res.cookies.set(CLIENT_SESSION_COOKIE, token, clientSessionCookieOptions);
  return res;
}
