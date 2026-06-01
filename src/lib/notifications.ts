import "server-only";
import { prisma } from "@/lib/prisma";
import { disabledTypesFromPrefs } from "@/lib/notification-types";

/**
 * Notificaciones in-app del equipo.
 *
 * Patrón: cada notificación se "dirige" mediante:
 *   - targetRole: a TODOS los miembros activos de ese rol
 *   - targetProfessionalId: a un miembro concreto
 *
 * Visibilidad por rol:
 *   - SETTER → ve targetRole="setter".
 *   - CLOSER, CEO, head_coach → ven targetProfessionalId = su.id.
 *     (En la app fisio había un head_success específico; aquí mapeo a head_coach.)
 *   - NUTRICIONISTA → ve targetProfessionalId = su.id.
 */

export type NotifierUser = {
  id: string;
  role: string;
};

async function disabledTypesForUser(professionalId: string): Promise<string[]> {
  const p = await prisma.professional.findUnique({
    where: { id: professionalId },
    select: { notificationPrefs: true },
  });
  return disabledTypesFromPrefs(p?.notificationPrefs);
}

export async function getUnreadNotificationsForUser(user: NotifierUser, limit = 20) {
  const where = visibilityWhereFor(user);
  if (!where) return [];
  const disabled = await disabledTypesForUser(user.id);
  return prisma.teamNotification.findMany({
    where: { ...where, readAt: null, ...(disabled.length ? { type: { notIn: disabled } } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function countUnreadForUser(user: NotifierUser): Promise<number> {
  const where = visibilityWhereFor(user);
  if (!where) return 0;
  const disabled = await disabledTypesForUser(user.id);
  return prisma.teamNotification.count({
    where: { ...where, readAt: null, ...(disabled.length ? { type: { notIn: disabled } } : {}) },
  });
}

// Quién ve qué.
function visibilityWhereFor(user: NotifierUser): Record<string, unknown> | null {
  if (user.role === "setter") {
    return { targetRole: "setter" };
  }
  if (user.role === "nutricionista") {
    return { targetProfessionalId: user.id };
  }
  if (user.role === "head_coach") {
    // El head_coach ve lo que le envían a él y lo que va a su rol.
    return { OR: [{ targetProfessionalId: user.id }, { targetRole: "head_coach" }] };
  }
  if (user.role === "closer" || user.role === "ceo") {
    return { targetProfessionalId: user.id };
  }
  return null;
}

// Notifica a TODOS los setters activos.
export async function notifySetters(params: {
  type: string;
  title: string;
  body: string;
  leadId?: string;
  actionUrl?: string;
}): Promise<number> {
  await prisma.teamNotification.create({
    data: {
      targetRole: "setter",
      targetProfessionalId: null,
      type: params.type,
      title: params.title,
      body: params.body,
      leadId: params.leadId,
      actionUrl: params.actionUrl,
    },
  });
  return prisma.professional.count({
    where: { isActive: true, role: "setter" },
  });
}

// Notifica a un profesional concreto (closer / nutricionista / etc.).
export async function notifyProfessional(params: {
  professionalId: string;
  type: string;
  title: string;
  body: string;
  leadId?: string;
  actionUrl?: string;
}): Promise<void> {
  await prisma.teamNotification.create({
    data: {
      targetProfessionalId: params.professionalId,
      targetRole: null,
      type: params.type,
      title: params.title,
      body: params.body,
      leadId: params.leadId,
      actionUrl: params.actionUrl,
    },
  });
}

// Notifica a todos los head_coach activos.
export async function notifyHeadCoach(params: {
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
}): Promise<void> {
  await prisma.teamNotification.create({
    data: {
      targetRole: "head_coach",
      targetProfessionalId: null,
      type: params.type,
      title: params.title,
      body: params.body,
      actionUrl: params.actionUrl,
    },
  });
}

export async function markNotificationRead(notificationId: string, user: NotifierUser): Promise<boolean> {
  const notif = await prisma.teamNotification.findUnique({ where: { id: notificationId } });
  if (!notif) return false;
  if (notif.targetProfessionalId && notif.targetProfessionalId !== user.id) return false;
  if (notif.targetRole && notif.targetRole !== user.role && user.role !== "ceo") return false;
  await prisma.teamNotification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
  return true;
}

// Marca como leídas TODAS las notifs de un lead dirigidas a un destinatario.
// Se usa cuando la acción ligada al lead se completa (setter "avisado", etc.).
export async function markLeadNotificationsRead(params: {
  leadId: string;
  targetRole?: string;
  targetProfessionalId?: string;
}): Promise<void> {
  const where: Record<string, unknown> = { leadId: params.leadId, readAt: null };
  if (params.targetRole) where.targetRole = params.targetRole;
  if (params.targetProfessionalId) where.targetProfessionalId = params.targetProfessionalId;
  await prisma.teamNotification.updateMany({
    where,
    data: { readAt: new Date() },
  });
}
