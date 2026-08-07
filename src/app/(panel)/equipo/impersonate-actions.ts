"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { IMPERSONATE_COOKIE, impersonateCookieOptions } from "@/lib/auth";
import { requireRealCeo } from "@/lib/session";

// Activa el modo "ver como" para Dirección. Valida que el objetivo exista,
// esté activo y no sea Dirección misma. Redirige al inicio del panel; la
// pantalla real de aterrizaje la decide el rol impersonado (p. ej. marketing
// aterriza en /contenido).
export async function startImpersonation(formData: FormData) {
  const real = await requireRealCeo();
  const targetId = String(formData.get("professionalId") ?? "");
  if (!targetId || targetId === real.id) return;

  const target = await prisma.professional.findUnique({
    where: { id: targetId },
    select: { id: true, isActive: true },
  });
  if (!target || !target.isActive) return;

  cookies().set(IMPERSONATE_COOKIE, target.id, impersonateCookieOptions);
  redirect("/");
}

// Sale del modo "ver como" y vuelve a la vista real de Dirección. Idempotente.
export async function stopImpersonation() {
  await requireRealCeo();
  cookies().delete(IMPERSONATE_COOKIE);
  redirect("/equipo");
}
