import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, IMPERSONATE_COOKIE } from "@/lib/auth";
import { isManager } from "@/lib/roles";

export type ActiveProfessional = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  imageUrl: string | null;
  isManager: boolean; // ceo || head_coach
  // Presente solo cuando la CEO está viendo el panel como otro miembro.
  // Contiene su identidad real para poder pintar el banner y ofrecer salida.
  impersonating?: { id: string; fullName: string; email: string };
};

function calcIsManager(role: string): boolean {
  return role === "ceo" || role === "head_coach";
}

function devBypassProfessional(): ActiveProfessional | null {
  if (process.env.NODE_ENV !== "production" && process.env.DEV_BYPASS_AUTH === "true") {
    return {
      id: "dev",
      fullName: "Dirección (dev)",
      email: "dev@local",
      role: "ceo",
      imageUrl: null,
      isManager: true,
    };
  }
  return null;
}

// Devuelve la identidad REAL de la sesión, ignorando cualquier impersonación
// activa. Úsalo cuando necesites saber quién controla el navegador (p. ej.
// la propia página /ver-como o para permitir salir de la impersonación).
export const getRealProfessional = cache(async (): Promise<ActiveProfessional | null> => {
  const dev = devBypassProfessional();
  if (dev) return dev;

  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { professional: true },
  });

  if (!session) return null;
  if (session.expiresAt < new Date()) return null;
  if (!session.professional.isActive) return null;

  const { id, fullName, email, role, imageUrl } = session.professional;
  return { id, fullName, email, role, imageUrl, isManager: calcIsManager(role) };
});

// Resuelve cookie -> sesión válida -> Professional activo. Devuelve null si no hay.
// Si la CEO tiene activa una cookie de impersonación válida, devuelve la ficha
// del profesional impersonado con el marcador `impersonating` apuntando a la
// identidad real. `cache` evita re-consultar dentro de la misma petición.
export const getActiveProfessional = cache(async (): Promise<ActiveProfessional | null> => {
  const real = await getRealProfessional();
  if (!real) return null;

  // Solo la CEO puede impersonar. Si el rol real es otro, se ignora la cookie.
  if (real.role !== "ceo") return real;

  const impersonateId = cookies().get(IMPERSONATE_COOKIE)?.value;
  if (!impersonateId || impersonateId === real.id) return real;

  const target = await prisma.professional.findUnique({ where: { id: impersonateId } });
  if (!target || !target.isActive) return real;

  return {
    id: target.id,
    fullName: target.fullName,
    email: target.email,
    role: target.role,
    imageUrl: target.imageUrl,
    isManager: calcIsManager(target.role),
    impersonating: { id: real.id, fullName: real.fullName, email: real.email },
  };
});

// Para páginas/server actions del panel: exige sesión o redirige a /login.
export async function requireProfessional(): Promise<ActiveProfessional> {
  const prof = await getActiveProfessional();
  if (!prof) redirect("/login");
  return prof;
}

// Exige uno de los roles indicados; si no, redirige al inicio del panel.
export async function requireRole(...roles: string[]): Promise<ActiveProfessional> {
  const prof = await requireProfessional();
  if (!roles.includes(prof.role)) redirect("/");
  return prof;
}

export async function requireManager(): Promise<ActiveProfessional> {
  const prof = await requireProfessional();
  if (!isManager(prof.role)) redirect("/");
  return prof;
}

// Exige que la sesión REAL sea CEO, ignorando impersonación. Para acciones
// exclusivas del superadmin (activar/cambiar/salir de "ver como").
export async function requireRealCeo(): Promise<ActiveProfessional> {
  const real = await getRealProfessional();
  if (!real || real.role !== "ceo") redirect("/");
  return real;
}
