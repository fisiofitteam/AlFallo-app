import { redirect } from "next/navigation";
import { requireProfessional } from "@/lib/session";

// La home de /crm redirige al panel apropiado según el rol del usuario.
// Setter → ve sus leads pendientes de avisar al closer.
// Closer / CEO / head_coach / (setter como fallback) → ve la agenda de llamadas.
export default async function CrmRoot() {
  const prof = await requireProfessional();
  if (prof.role === "setter") redirect("/crm/leads-setter");
  if (["closer", "ceo", "head_coach"].includes(prof.role)) redirect("/crm/llamadas-venta");
  redirect("/");
}
