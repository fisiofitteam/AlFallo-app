import { Dumbbell } from "lucide-react";
import { requireOnboardedClient } from "@/lib/client-session";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Entreno · Al Fallo" };

export default async function TrainingPage() {
  await requireOnboardedClient();
  return (
    <ComingSoon
      icon={Dumbbell}
      title="Entrenamiento"
      description="Acceso a tu plan de entreno actual y a su histórico."
    />
  );
}
