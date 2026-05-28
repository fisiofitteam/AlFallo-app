import { ChefHat } from "lucide-react";
import { requireOnboardedClient } from "@/lib/client-session";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Recetas · Al Fallo" };

export default async function RecetasPage() {
  await requireOnboardedClient();
  return (
    <ComingSoon
      icon={ChefHat}
      title="Recetas"
      description="Un recetario adaptado a tu plan, con macros calculados y pasos sencillos."
    />
  );
}
