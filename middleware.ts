import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "afn_session";
const CLIENT_SESSION_COOKIE = "afn_client_session";

// El middleware solo comprueba la PRESENCIA de la cookie (barrera barata).
// La validez real de la sesión y los permisos se revalidan en cada
// página/server action (lib/session.ts y lib/client-session.ts).
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Landing pública de agenda (/agenda/*): sin auth ─────────
  if (pathname.startsWith("/agenda")) {
    return NextResponse.next();
  }

  // ── App del atleta (/cliente/*) ──────────────────────────────
  if (pathname.startsWith("/cliente")) {
    if (pathname.startsWith("/cliente/login")) return NextResponse.next();
    if (!req.cookies.get(CLIENT_SESSION_COOKIE)?.value) {
      return NextResponse.redirect(new URL("/cliente/login", req.url));
    }
    return NextResponse.next();
  }

  // ── Panel del equipo ─────────────────────────────────────────
  // Modo desarrollo: deja pasar sin cookie (ver lib/session.ts). NUNCA en producción.
  if (process.env.NODE_ENV !== "production" && process.env.DEV_BYPASS_AUTH === "true") {
    return NextResponse.next();
  }

  if (!req.cookies.get(SESSION_COOKIE)?.value) {
    const url = new URL("/login", req.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Protege todo salvo /login, /api, y los estáticos de Next.
export const config = {
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico|manifest.webmanifest).*)"],
};
