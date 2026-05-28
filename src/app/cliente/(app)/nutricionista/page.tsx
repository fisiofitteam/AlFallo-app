import { Stethoscope } from "lucide-react";
import { requireOnboardedClient } from "@/lib/client-session";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Tu nutri · Al Fallo" };

export default async function NutriPage() {
  await requireOnboardedClient();
  return (
    <ComingSoon
      icon={Stethoscope}
      title="Tu nutricionista"
      description="Habla directamente con tu nutricionista: dudas, ajustes y seguimiento."
    />
  );
}
