import { AgendaLanding } from "@/components/AgendaLanding";
import { getAgendaLandingCopy } from "@/lib/landing-config";

export const metadata = {
  title: "Reserva tu llamada · Al Fallo Nutrition",
  description:
    "Agenda una videoconsulta gratuita de valoración con el equipo de Al Fallo Nutrition. Diseñamos el plan nutricional que te lleve al siguiente nivel en tu CrossFit / Hyrox.",
};

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const copy = await getAgendaLandingCopy();
  return <AgendaLanding copy={copy} />;
}
