import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE } from "@/lib/auth";
import { isManager } from "@/lib/roles";

export type ActiveProfessional = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  imageUrl: string | null;
  isManager: boolean; // ceo || head_coach
};

function calcIsManager(role: string): boolean {
  return role === "ceo" || role === "head_coach";
}

// Resuelve cookie -> sesión válida -> Professional activo. Devuelve null si no hay.
// `cache` evita re-consultar dentro de la misma petición (layout + página).
export const getActiveProfessional = cache(async (): Promise<ActiveProfessional | null> => {
  // Modo desarrollo: entra como CEO sin BD ni login. NUNCA en producción.
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
