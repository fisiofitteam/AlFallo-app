import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, ClipboardList, ExternalLink, Magnet, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getActiveProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import { ContentNav } from "@/components/ContentNav";
import { canUseMarketerIA } from "@/lib/marketer-access";

export const metadata = { title: "Lead magnets · Al Fallo" };
export const dynamic = "force-dynamic";

/**
 * Panel de captación independiente, inspirado en FisioFit.
 * Se muestran EXCLUSIVAMENTE lead magnets reales de la BD de Al Fallo.
 * No se importan tests clínicos, datos, respuestas ni tarjetas de FisioFit.
 */
export default async function LeadMagnetsIndexPage() {
  const user = await getActiveProfessional();
  if (!user) redirect("/login");
  if (!isManager(user.role)) redirect("/");

  const leadMagnets = await prisma.leadMagnet.findMany({
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });

  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 30);
  const ids = leadMagnets.map((lm) => lm.id);
  const [all, completed, clicked] = ids.length
    ? await Promise.all([
        prisma.leadMagnetResponse.groupBy({
          by: ["leadMagnetId"], where: { leadMagnetId: { in: ids }, createdAt: { gte: from } },
          _count: { _all: true },
        }),
        prisma.leadMagnetResponse.groupBy({
          by: ["leadMagnetId"], where: { leadMagnetId: { in: ids }, createdAt: { gte: from }, status: "completed" },
          _count: { _all: true },
        }),
        prisma.leadMagnetResponse.groupBy({
          by: ["leadMagnetId"], where: { leadMagnetId: { in: ids }, createdAt: { gte: from }, whatsappClickedAt: { not: null } },
          _count: { _all: true },
        }),
      ])
    : [[], [], []];

  const counts = (rows: typeof all) => new Map(rows.map((r) => [r.leadMagnetId, r._count._all]));
  const totalMap = counts(all);
  const completedMap = counts(completed);
  const clickedMap = counts(clicked);

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6">
      <ContentNav active="lead-magnets" role={user.role} showMarketer={canUseMarketerIA(user.email)} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-[#c01769]">
            <Magnet size={15} /> CAPTACIÓN DE LEADS
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Lead magnets</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            Tus recursos y tests de captación, con respuestas y resultados de los últimos 30 días.
          </p>
        </div>
        {leadMagnets.length > 0 && (
          <Link href="/contenido/banco?tab=leadmagnets" className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
            Gestionar fichas
          </Link>
        )}
      </div>

      {leadMagnets.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-[#efb8d1] bg-gradient-to-b from-[#fff7fb] to-white px-5 py-14 text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[#fde7f1] text-[#e6197e]">
            <Magnet size={28} strokeWidth={1.7} />
          </div>
          <h2 className="text-lg font-semibold text-neutral-900">Aquí aparecerán tus lead magnets</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-neutral-600">
            El módulo ya está preparado para organizar cada recurso, consultar sus respuestas y medir su rendimiento.
            Todavía no se ha creado ninguno. Cuando definamos el primero para Al Fallo, se incorporará aquí.
          </p>
          <div className="mx-auto mt-6 flex max-w-xl flex-wrap justify-center gap-4 text-xs text-neutral-500">
            <span className="inline-flex items-center gap-1.5"><ClipboardList size={15} /> Respuestas individuales</span>
            <span className="inline-flex items-center gap-1.5"><BarChart3 size={15} /> Métricas y exportación</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck size={15} /> Datos separados de FisioFit</span>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {leadMagnets.map((lm) => {
            const total = totalMap.get(lm.id) ?? 0;
            const done = completedMap.get(lm.id) ?? 0;
            const wa = clickedMap.get(lm.id) ?? 0;
            return (
              <article key={lm.id} className="rounded-2xl border border-neutral-200 bg-white p-5 transition-shadow hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Recurso de captación</span>
                    <h2 className="mt-1 text-lg font-semibold text-neutral-900">{lm.name}</h2>
                    {lm.description && <p className="mt-1 line-clamp-3 text-sm text-neutral-600">{lm.description}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${lm.active ? "bg-[#fce7f1] text-[#af195f]" : "bg-neutral-100 text-neutral-500"}`}>
                    {lm.active ? "Activo" : "Inactivo"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <MetricTile label="Iniciados · 30d" value={total} />
                  <MetricTile label="Completados" value={done} />
                  <MetricTile label="Clics WhatsApp" value={wa} />
                </div>
                {lm.keyword && <p className="mt-3 text-xs text-neutral-500">Palabra clave: <span className="font-semibold text-neutral-900">{lm.keyword}</span></p>}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-3">
                  <Link href={`/contenido/lead-magnets/${lm.id}`} className="text-sm font-semibold text-[#c01769] hover:underline">Ver métricas y respuestas →</Link>
                  {lm.url && <a href={lm.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900"><ExternalLink size={13} /> Abrir recurso</a>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-2.5">
      <p className="text-[10px] leading-tight text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-900">{value}</p>
    </div>
  );
}
