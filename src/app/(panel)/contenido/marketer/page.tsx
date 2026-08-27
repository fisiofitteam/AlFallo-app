import { redirect } from "next/navigation";
import { getActiveProfessional } from "@/lib/session";
import { canUseMarketerIA } from "@/lib/marketer-access";
import { ContentNav } from "@/components/ContentNav";
import { MarketerIAView } from "@/components/MarketerIAView";

export const metadata = { title: "Marketer IA · Al Fallo Nutrition" };
export const dynamic = "force-dynamic";

export default async function MarketerIAPage() {
  const user = await getActiveProfessional();
  if (!user) redirect("/login");
  if (!canUseMarketerIA(user.email)) redirect("/contenido");

  return (
    <main>
      <ContentNav active="marketer" showMarketer />
      <header className="mb-5">
        <h1 className="text-2xl font-bold md:text-3xl">🧠 Marketer IA</h1>
        <p className="mt-1 text-sm text-muted">
          Escribe un brief libre y la IA propone semanas de contenido con piezas concretas —
          usando la voz de Al Fallo Nutrition Performance. Con un clic las añades al calendario.
        </p>
      </header>
      <MarketerIAView />
    </main>
  );
}
