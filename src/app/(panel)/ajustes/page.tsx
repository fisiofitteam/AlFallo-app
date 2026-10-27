import Link from "next/link";
import { CalendarDays, ExternalLink, Settings2 } from "lucide-react";
import { requireProfessional } from "@/lib/session";

export const metadata = { title: "Ajustes · Al Fallo" };
export default async function SettingsPage() {
  const user = await requireProfessional();
  return <main className="mx-auto max-w-4xl px-3 py-6">
    <h1 className="text-2xl font-bold">Ajustes</h1>
    <p className="mt-1 mb-6 text-muted text-sm">Configuración de Al Fallo Nutrition.</p>
    {user.isManager ? <div className="grid gap-3 sm:grid-cols-2">
      <Link href="/ajustes/agenda" className="rounded-2xl border border-border bg-surface p-5 hover:border-primary flex gap-3"><CalendarDays className="text-primary"/><span><strong>Agenda comercial</strong><span className="block text-sm text-muted mt-1">Conecta Google Calendar y gestiona los horarios de reserva.</span></span></Link>
      <Link href="/biblioteca/landings" className="rounded-2xl border border-border bg-surface p-5 hover:border-primary flex gap-3"><Settings2 className="text-primary"/><span><strong>Personalización de landings</strong><span className="block text-sm text-muted mt-1">Edita los textos, fotos y argumentos comerciales.</span></span></Link>
      <Link href="/agenda" target="_blank" className="rounded-2xl border border-border bg-surface p-5 hover:border-primary flex gap-3"><ExternalLink className="text-primary"/><span><strong>Ver landing pública</strong><span className="block text-sm text-muted mt-1">Abre la página para reservar llamadas.</span></span></Link>
    </div> : <p className="text-sm text-muted">Pide a dirección que configure las integraciones.</p>}
  </main>;
}
