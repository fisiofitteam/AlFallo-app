import { requireManager } from "@/lib/session";
import { AgendaSettings } from "@/components/AgendaSettings";

export const metadata = { title: "Agenda comercial · Al Fallo" };
export const dynamic = "force-dynamic";

export default async function AgendaSettingsPage() {
  await requireManager();
  return <AgendaSettings />;
}
