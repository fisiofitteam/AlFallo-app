import { requireProfessional } from "@/lib/session";
import { PanelShell } from "@/components/panel-shell";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  // Revalida la sesión en servidor (el middleware solo mira que exista la cookie).
  const professional = await requireProfessional();

  return <PanelShell professional={professional}>{children}</PanelShell>;
}
