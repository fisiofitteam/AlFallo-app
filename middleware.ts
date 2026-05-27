import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "afn_session";

// El middleware solo comprueba la PRESENCIA de la cookie (barrera barata).
// La validez real de la sesión y los permisos se revalidan en cada
// página/server action con lib/session.ts.
export function middleware(req: NextRequest) {
  // Modo desarrollo: deja pasar sin cookie (ver lib/session.ts). NUNCA en producción.
  if (process.env.NODE_ENV !== "production" && process.env.DEV_BYPASS_AUTH === "true") {
    return NextResponse.next();
  }

  const hasCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (!hasCookie) {
    const url = new URL("/login", req.url);
    url.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Protege todo salvo /login, las rutas /api, y los estáticos de Next.
export const config = {
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico|manifest.webmanifest).*)"],
};
