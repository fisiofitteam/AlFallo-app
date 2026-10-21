import { prisma } from "@/lib/prisma";
import { ensureRenewalNotifications } from "@/lib/subscriptions";
import { withHeartbeatCache } from "@/lib/heartbeat-cache";

export type Kpi = {
  key: string;
  label: string;
  value: string;
  hint?: string;
  tone: "neutral" | "accent" | "muted";
  href?: string;
};

/** Calcula los KPIs de la cabecera del panel. Algunos son placeholder ("—")
 *  cuando falta el sistema que los produce (adherencia, tasa de renovación). */
export async function getPanelKpis(now = new Date()): Promise<Kpi[]> {
  const in30d = new Date(now);
  in30d.setDate(in30d.getDate() + 30);
  const in7d = new Date(now);
  in7d.setDate(in7d.getDate() + 7);

  // Hearbeat: al cargar el panel garantizamos que los periodos en la ventana
  // de aviso tengan su notificación. Idempotente (dedup por refKey).
  // Cache 5 min: suficiente para que no se dispare en cada click dentro
  // del panel. El job es idempotente — no pasa nada si se omite.
  withHeartbeatCache(
    `renewal-notifications:${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`,
    5 * 60 * 1000,
    () => ensureRenewalNotifications(now),
  ).catch((e) => console.error("ensureRenewalNotifications", e));

  const [totalClientes, sinAsignar, renovanEn30d, formulariosPendientes, llamadas7d] = await Promise.all([
    prisma.client.count(),
    prisma.client.count({ where: { nutritionistId: null, status: { not: "baja" } } }),
    // Periodos activos que vencen en los próximos 30d — desde aquí gestiona
    // el equipo las renovaciones anticipadas.
    prisma.subscriptionPeriod.count({
      where: {
        status: "active",
        endDate: { gte: now, lte: in30d },
      },
    }),
    prisma.checkIn.count({ where: { reviewedAt: null } }),
    prisma.scheduledCall.count({ where: { scheduledAt: { gte: now, lte: in7d } } }),
  ]);

  return [
    { key: "totales", label: "Pacientes totales", value: String(totalClientes), tone: "neutral", href: "/clientes" },
    { key: "sinAsignar", label: "Sin asignar", value: String(sinAsignar), tone: "neutral", href: "/clientes?filter=unassigned" },
    { key: "renuevan30", label: "Renuevan en 30d", value: String(renovanEn30d), tone: "accent", href: "/renovaciones" },
    { key: "formularios", label: "Formularios por revisar", value: String(formulariosPendientes), tone: "accent", href: "/revisar/formularios" },
    { key: "adherencia", label: "Adherencia media", value: "—", hint: "Pendiente sistema", tone: "muted" },
    { key: "renovacion", label: "Tasa renovación", value: "—", hint: "Pendiente sistema", tone: "muted" },
    { key: "llamadas", label: "Llamadas (7 días)", value: String(llamadas7d), tone: "neutral", href: "/clientes/llamadas-seguimiento" },
  ];
}
