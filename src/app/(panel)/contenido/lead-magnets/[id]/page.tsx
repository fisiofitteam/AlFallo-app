import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getActiveProfessional } from "@/lib/session";
import { isManager } from "@/lib/roles";
import { ContentNav } from "@/components/ContentNav";
import { canUseMarketerIA } from "@/lib/marketer-access";
import { leadMagnetResponseWhere, normalizeLeadMagnetFilters, reportParams } from "@/lib/lead-magnet-report";
import { MAIN_PROBLEMS, SESSION_TYPES, TRAINING_TIMES } from "@/lib/gasolina/quiz";

export const dynamic = "force-dynamic";
export const metadata = { title: "Respuestas de lead magnet · Al Fallo" };

function formatDate(date: Date | null): string {
  return date ? date.toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" }) : "—";
}

const FOCUS_LABELS = {
  preworkout: "Energía previa", carbs: "Hidratos", recovery: "Recuperación", structure: "Semana real",
} as const;
type FocusKey = keyof typeof FOCUS_LABELS;
function gasolinaData(raw: string | null): { focus?: FocusKey; trainingTime?: string; sessionType?: string; mainProblem?: string } | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || data.guide !== "gasolina-v1") return null;
    return {
      focus: data.focus in FOCUS_LABELS ? data.focus as FocusKey : undefined,
      trainingTime: TRAINING_TIMES.find((v) => v.id === data.trainingTime)?.label,
      sessionType: SESSION_TYPES.find((v) => v.id === data.sessionType)?.label,
      mainProblem: MAIN_PROBLEMS.find((v) => v.id === data.mainProblem)?.label,
    };
  } catch { return null; }
}

const PAGE_SIZE = 50;

export default async function LeadMagnetDetailPage({
  params, searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await getActiveProfessional();
  if (!user) redirect("/login");
  // Las respuestas contienen contactos. Marketing no accede a estos datos.
  if (!isManager(user.role)) redirect("/");

  const magnet = await prisma.leadMagnet.findUnique({ where: { id: params.id } });
  if (!magnet) notFound();

  const filters = normalizeLeadMagnetFilters(searchParams);
  const where = leadMagnetResponseWhere(magnet.id, filters);
  const pageNumber = Number(typeof searchParams.page === "string" ? searchParams.page : 1);
  const page = Number.isSafeInteger(pageNumber) ? Math.min(1000, Math.max(1, pageNumber)) : 1;

  const [total, completed, waClicks, responses] = await Promise.all([
    prisma.leadMagnetResponse.count({ where }),
    prisma.leadMagnetResponse.count({ where: { AND: [where, { status: "completed" }] } }),
    prisma.leadMagnetResponse.count({ where: { AND: [where, { whatsappClickedAt: { not: null } }] } }),
    prisma.leadMagnetResponse.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, createdAt: true, completedAt: true, fullName: true,
        email: true, phone: true, instagram: true, status: true,
        source: true, campaign: true, resultJson: true, whatsappClickedAt: true,
      },
    }),
  ]);
  const query = reportParams(filters);
  const url = `/contenido/lead-magnets/${magnet.id}`;
  const paginationHref = (p: number) => `${url}?${[query, `page=${p}`].filter(Boolean).join("&")}`;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const gasolina = magnet.keyword === "GASOLINA";
  const focusRows = gasolina && completed > 0 ? await prisma.leadMagnetResponse.findMany({
    where: { AND: [where, { status: "completed" }] },
    select: { resultJson: true }, take: 10000,
  }) : [];
  const focusCounts: Record<FocusKey, number> = { preworkout: 0, carbs: 0, recovery: 0, structure: 0 };
  for (const row of focusRows) {
    const focus = gasolinaData(row.resultJson)?.focus;
    if (focus) focusCounts[focus] += 1;
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6">
      <ContentNav active="lead-magnets" role={user.role} showMarketer={canUseMarketerIA(user.email)} />
      <Link href="/contenido/lead-magnets" className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-[#c01769]"><ArrowLeft size={14} /> Lead magnets</Link>
      <div className="mt-4 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#c01769]">Panel de respuestas</span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">{magnet.name}</h1>
          {magnet.description && <p className="mt-1 max-w-3xl text-sm text-neutral-600">{magnet.description}</p>}
          {magnet.keyword && <p className="mt-2 text-xs text-neutral-500">Palabra clave: <strong>{magnet.keyword}</strong></p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {magnet.url && <a href={magnet.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-medium hover:bg-neutral-50"><ExternalLink size={14} /> Abrir recurso</a>}
          <a href={`/api/content/lead-magnets/${magnet.id}/export?${query}`} className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-700"><Download size={14} /> Exportar CSV</a>
        </div>
      </div>

      <form method="GET" className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-[11px] font-medium text-neutral-600">Desde<input type="date" name="from" defaultValue={filters.from} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs" /></label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-neutral-600">Hasta<input type="date" name="to" defaultValue={filters.to} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs" /></label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-neutral-600">Estado
          <select name="status" defaultValue={filters.status} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs">
            <option value="">Todos</option><option value="started">En curso</option><option value="completed">Completados</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-neutral-600">WhatsApp
          <select name="whatsapp" defaultValue={filters.whatsapp} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs">
            <option value="">Todos</option><option value="yes">Con clic</option><option value="no">Sin clic</option>
          </select>
        </label>
        <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-[11px] font-medium text-neutral-600">Campaña<input type="text" name="campaign" defaultValue={filters.campaign} placeholder="Nombre de campaña" maxLength={100} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs" /></label>
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[11px] font-medium text-neutral-600">Buscar contacto<input type="search" name="q" defaultValue={filters.q} placeholder="Nombre, email, teléfono..." maxLength={100} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs" /></label>
        <button className="rounded-lg bg-[#e6197e] px-4 py-2 text-xs font-semibold text-white hover:bg-[#c01769]">Filtrar</button>
        <Link href={url} className="px-2 py-2 text-xs text-neutral-500 underline">Limpiar</Link>
      </form>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Iniciados" value={String(total)} />
        <Metric label="Completados" value={String(completed)} />
        <Metric label="Tasa de finalización" value={`${pct}%`} />
        <Metric label="Clics WhatsApp" value={String(waClicks)} />
      </div>

      {gasolina && (
        <section className="mb-5 rounded-xl border border-neutral-200 bg-white p-5">
          <h2 className="text-sm font-semibold">Qué necesitan los atletas · GASOLINA</h2>
          <p className="mt-1 text-xs text-neutral-500">Distribución de focos entre las respuestas completadas con los filtros actuales.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {(Object.keys(FOCUS_LABELS) as FocusKey[]).map((key) => {
              const value = focusCounts[key];
              const percentage = focusRows.length ? Math.round(value / focusRows.length * 100) : 0;
              return <div key={key}>
                <div className="mb-1 flex items-center justify-between text-xs"><span className="font-semibold">{FOCUS_LABELS[key]}</span><span className="text-neutral-500">{value} · {percentage}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-[#f6e7ef]"><div className="h-full rounded-full bg-[#e6197e]" style={{ width: percentage + "%" }} /></div>
              </div>;
            })}
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-4 py-3">
          <h2 className="text-sm font-semibold">Respuestas registradas</h2>
          <p className="text-xs text-neutral-500">{total} resultados · {PAGE_SIZE} por página</p>
        </div>
        {responses.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-semibold text-neutral-800">Todavía no hay respuestas para estos filtros.</p>
            <p className="mt-1 text-xs text-neutral-500">Cuando un futuro lead magnet registre respuestas, aparecerán aquí.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead><tr className="bg-neutral-50 text-[10px] uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3 font-semibold">Fecha</th><th className="px-4 py-3 font-semibold">Contacto</th>
                <th className="px-4 py-3 font-semibold">Estado</th><th className="px-4 py-3 font-semibold">Campaña</th>
                <th className="px-4 py-3 font-semibold">WhatsApp</th><th className="px-4 py-3 font-semibold">Resultado</th>
              </tr></thead>
              <tbody>{responses.map((row) => (
                <tr key={row.id} className="border-t border-neutral-100 align-top hover:bg-neutral-50">
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-500">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3"><p className="font-semibold text-neutral-900">{row.fullName || "Sin nombre"}</p>
                    {row.email && <p className="mt-1 text-neutral-500">{row.email}</p>}
                    {row.phone && <p className="mt-1 text-neutral-500">{row.phone}</p>}
                    {row.instagram && <p className="mt-1 text-neutral-500">{row.instagram}</p>}
                  </td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${row.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-600"}`}>{row.status === "completed" ? "Completado" : "En curso"}</span></td>
                  <td className="px-4 py-3 text-neutral-600">{row.campaign || row.source || "—"}</td>
                  <td className="px-4 py-3 text-neutral-600">{row.whatsappClickedAt ? "Sí" : "No"}</td>
                  <td className="px-4 py-3 text-neutral-700">
                    {row.resultJson ? <details className="max-w-xs">
                      <summary className="cursor-pointer text-[#c01769]">{gasolinaData(row.resultJson)?.focus ? FOCUS_LABELS[gasolinaData(row.resultJson)!.focus!] : "Ver respuesta"}</summary>
                      {gasolinaData(row.resultJson) ? <div className="mt-2 space-y-1 rounded bg-neutral-50 p-2 text-[11px]">
                        <p><strong>Horario:</strong> {gasolinaData(row.resultJson)?.trainingTime}</p>
                        <p><strong>Sesión:</strong> {gasolinaData(row.resultJson)?.sessionType}</p>
                        <p><strong>Principal dificultad:</strong> {gasolinaData(row.resultJson)?.mainProblem}</p>
                      </div> : <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-all rounded bg-neutral-50 p-2 text-[11px]">{row.resultJson}</pre>}
                    </details> : <span className="text-neutral-400">—</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {total > PAGE_SIZE && <div className="flex items-center justify-between gap-2 border-t border-neutral-100 px-4 py-3 text-xs">
          <span className="text-neutral-500">Página {page} de {Math.ceil(total / PAGE_SIZE)}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={paginationHref(page - 1)} className="rounded-lg border border-neutral-200 px-3 py-1.5 hover:bg-neutral-50">← Anterior</Link>}
            {page * PAGE_SIZE < total && <Link href={paginationHref(page + 1)} className="rounded-lg border border-neutral-200 px-3 py-1.5 hover:bg-neutral-50">Siguiente →</Link>}
          </div>
        </div>}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-neutral-200 bg-white p-4"><p className="text-xs text-neutral-500">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900">{value}</p></div>;
}
