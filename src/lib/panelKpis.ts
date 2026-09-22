import { prisma } from "@/lib/prisma";

export type Kpi = {
  key: string;
  label: string;
  value: string;
  hint?: string;
  tone: "neutral" | "accent" | "muted";
};

/** Calcula los KPIs de la cabecera del panel. Algunos son placeholder ("—")
 *  cuando falta el sistema que los produce (adherencia, tasa de renovación). */
export async function getPanelKpis(now = new Date()): Promise<Kpi[]> {
  const in30d = new Date(now);
  in30d.setDate(in30d.getDate() + 30);
  const in7d = new Date(now);
  in7d.setDate(in7d.getDate() + 7);

  const [totalClientes, sinAsignar, renovanEn30d, formulariosPendientes, llamadas7d] = await Promise.all([
    prisma.client.count(),
    prisma.client.count({ where: { nutritionistId: null, status: { not: "baja" } } }),
    prisma.sale.count({
      where: {
        endDate: { gte: now, lte: in30d },
        clientId: { not: null },
      },
    }),
    prisma.checkIn.count({ where: { reviewedAt: null } }),
    prisma.scheduledCall.count({ where: { scheduledAt: { gte: now, lte: in7d } } }),
  ]);

  return [
    { key: "totales", label: "Pacientes totales", value: String(totalClientes), tone: "neutral" },
    { key: "sinAsignar", label: "Sin asignar", value: String(sinAsignar), tone: "neutral" },
    { key: "renuevan30", label: "Renuevan en 30d", value: String(renovanEn30d), tone: "accent" },
    { key: "formularios", label: "Formularios por revisar", value: String(formulariosPendientes), tone: "accent" },
    { key: "adherencia", label: "Adherencia media", value: "—", hint: "Pendiente sistema", tone: "muted" },
    { key: "renovacion", label: "Tasa renovación", value: "—", hint: "Pendiente sistema", tone: "muted" },
    { key: "llamadas", label: "Llamadas (7 días)", value: String(llamadas7d), tone: "neutral" },
  ];
}
