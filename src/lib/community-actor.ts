import "server-only";
import { getActiveProfessional } from "@/lib/session";
import { getActiveClient } from "@/lib/client-session";

/**
 * Quién está actuando en la comunidad: equipo o cliente.
 * Cada Post / Comment / Reaction se persiste con UNA de las dos FKs
 * (authorProfessionalId o authorClientId), nunca las dos.
 */

export type CommunityActor =
  | { kind: "team"; professionalId: string; clientId: null; name: string; imageUrl: string | null; isManager: boolean }
  | { kind: "client"; professionalId: null; clientId: string; name: string; imageUrl: string | null; isManager: false };

export async function getCommunityActor(): Promise<CommunityActor | null> {
  // Si hay sesión de equipo activa, esa gana (caso CEO logueado mira /comunidad).
  const pro = await getActiveProfessional();
  if (pro) {
    return {
      kind: "team",
      professionalId: pro.id,
      clientId: null,
      name: pro.fullName,
      imageUrl: pro.imageUrl,
      isManager: pro.isManager,
    };
  }
  const client = await getActiveClient();
  if (client) {
    return {
      kind: "client",
      professionalId: null,
      clientId: client.id,
      name: client.fullName,
      imageUrl: null, // los clientes no tienen photo todavía
      isManager: false,
    };
  }
  return null;
}

// Helpers de moderación: managers + nutricionistas (cuando son equipo) pueden
// borrar contenido ajeno. Los clientes solo pueden borrar lo suyo.
export function canModerate(actor: CommunityActor | null): boolean {
  if (!actor) return false;
  return actor.kind === "team";
}

// Solo CEO + head_coach pueden crear/editar cursos y lecciones.
export function canEditCourses(actor: CommunityActor | null, role: string | null = null): boolean {
  if (!actor || actor.kind !== "team") return false;
  // En este helper no tenemos el rol directamente; el caller lo pasa
  // como segundo arg si lo conoce. Si no, asumimos isManager (CEO+head_coach).
  if (role) return role === "ceo" || role === "head_coach";
  return actor.isManager;
}
