import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveProfessional } from "@/lib/session";
import { canManageContent } from "@/lib/roles";
import { canUseMarketerIA } from "@/lib/marketer-access";
import { ContentNav } from "@/components/ContentNav";

export const dynamic = "force-dynamic";

export default async function LeadMagnetsIndexPage() {
  const user = await getActiveProfessional();
  if (!user) redirect("/login");
  if (!canManageContent(user.role)) redirect("/");
  // Al Fallo's own resources: never import FisioFit's clinical tests or leads.
  const leadMagnets = await prisma.leadMagnet.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });
  return (
    <main className="p-4 md:p-6 max-w-[1200px] mx-auto">
      <ContentNav active="lead-magnets" role={user.role} showMarketer={canUseMarketerIA(user.email)} />
      <header className="mb-5">
        <h1 className="text-xl font-semibold">🧲 Lead magnets</h1>
        <p className="text-xs text-neutral-500 mt-0.5">Tests y descargables que captan leads desde Instagram / anuncios.</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {leadMagnets.map((lead) => (
          <Link key={lead.id} href="/contenido/banco?tab=leadmagnets"
            className="block rounded-xl p-5 transition-colors"
            style={{ background: "white", border: "1px solid #E5E5E5" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-neutral-500 mb-1">{lead.active ? "Activo" : "Inactivo"}</div>
                <h2 className="text-lg font-semibold">{lead.name}</h2>
                <p className="text-sm text-neutral-600 mt-1">{lead.description}</p>
              </div>
              <span className="text-neutral-400 text-xl">→</span>
            </div>
            {lead.keyword && <div className="text-sm text-neutral-600 mt-4">Palabra clave: <b>{lead.keyword}</b></div>}
            {lead.url && <div className="text-[11px] text-neutral-500 mt-3">URL pública: <code className="break-all">{lead.url}</code></div>}
          </Link>
        ))}
      </div>
      {leadMagnets.length === 0 && <p className="text-sm text-neutral-500 py-8 text-center border border-dashed border-neutral-200 rounded-xl">No hay lead magnets creados.</p>}
      <Link href="/contenido/banco?tab=leadmagnets" className="btn btn-primary mt-4">Gestionar lead magnets</Link>
    </main>
  );
}
