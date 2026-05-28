"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { requireProfessional } from "@/lib/session";
import { parseStr } from "@/lib/clients";
import { isValidRole } from "@/lib/roles";

// Solo el CEO puede gestionar el equipo (altas, rol, contraseñas, activación).
async function requireCeo() {
  const prof = await requireProfessional();
  if (prof.role !== "ceo") redirect("/");
  return prof;
}

export type CreateTeamMemberState = {
  error?: string;
  success?: { fullName: string; email: string; password: string };
};

export async function createTeamMember(
  _prev: CreateTeamMemberState,
  formData: FormData,
): Promise<CreateTeamMemberState> {
  await requireCeo();

  const fullName = parseStr(formData.get("fullName"));
  const email = parseStr(formData.get("email"))?.toLowerCase();
  const role = parseStr(formData.get("role"));
  const title = parseStr(formData.get("title"));
  let password = parseStr(formData.get("password"));

  if (!fullName || !email || !role) {
    return { error: "Nombre, email y rol son obligatorios." };
  }
  if (!isValidRole(role)) {
    return { error: "Rol no válido." };
  }

  const existing = await prisma.professional.findUnique({ where: { email } });
  if (existing) return { error: "Ya hay un miembro con ese email." };

  const generated = !password;
  if (!password) password = crypto.randomBytes(9).toString("base64url");
  if (password.length < 6) return { error: "La contraseña debe tener al menos 6 caracteres." };

  await prisma.professional.create({
    data: { fullName, email, role, title, passwordHash: await hashPassword(password) },
  });

  revalidatePath("/equipo");
  return {
    success: { fullName, email, password: generated ? password : "(la que indicaste)" },
  };
}

export async function setMemberPassword(formData: FormData) {
  await requireCeo();
  const id = String(formData.get("id"));
  const password = parseStr(formData.get("password"));
  if (!password || password.length < 6) return;
  await prisma.professional.update({
    where: { id },
    data: { passwordHash: await hashPassword(password) },
  });
  // Cierra sesiones activas de ese miembro para forzar nuevo login.
  await prisma.session.deleteMany({ where: { professionalId: id } });
  revalidatePath("/equipo");
}

export async function updateMember(formData: FormData) {
  const me = await requireCeo();
  const id = String(formData.get("id"));
  const role = parseStr(formData.get("role"));
  if (role && !isValidRole(role)) return;
  // Evita que el CEO se cambie a sí mismo el rol (queda sin acceso).
  if (id === me.id && role && role !== "ceo") return;

  // Email: opcional editar, normalizado y único.
  const emailRaw = parseStr(formData.get("email"));
  const newEmail = emailRaw ? emailRaw.toLowerCase() : null;
  if (newEmail) {
    const current = await prisma.professional.findUnique({ where: { id }, select: { email: true } });
    if (current && newEmail !== current.email) {
      const dup = await prisma.professional.findFirst({ where: { email: newEmail, NOT: { id } } });
      if (dup) redirect(`/equipo?error=email-en-uso`);
    }
  }

  await prisma.professional.update({
    where: { id },
    data: {
      fullName: parseStr(formData.get("fullName")) ?? undefined,
      email: newEmail ?? undefined,
      role: role ?? undefined,
      title: parseStr(formData.get("title")),
    },
  });
  revalidatePath("/equipo");
}

export async function toggleMemberActive(formData: FormData) {
  const me = await requireCeo();
  const id = String(formData.get("id"));
  if (id === me.id) return; // no se desactiva a sí mismo
  const m = await prisma.professional.findUnique({ where: { id }, select: { isActive: true } });
  if (!m) return;
  await prisma.professional.update({ where: { id }, data: { isActive: !m.isActive } });
  // Si se desactiva, cierra sus sesiones.
  if (m.isActive) {
    await prisma.session.deleteMany({ where: { professionalId: id } });
  }
  revalidatePath("/equipo");
}
