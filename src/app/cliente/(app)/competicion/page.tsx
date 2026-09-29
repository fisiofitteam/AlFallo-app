import Link from "next/link";
import { ArrowLeft, CalendarDays, Paperclip, Trophy } from "lucide-react";
import { requireOnboardedClient } from "@/lib/client-session";
import { listActiveCompetitionPlans, nextUpcomingCompetitionPlan } from "@/lib/competitionPlans";

export const metadata = { title: "Competición · Al Fallo" };
export const dynamic = "force-dynamic";

function fmtDate(d: Date): string {
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

export default async function CompetitionPage() {
  const me = await requireOnboardedClient();
  const active = await listActiveCompetitionPlans(me.id);
  const upcoming = active.length === 0 ? await nextUpcomingCompetitionPlan(me.id) : null;

  return (
    <div>
      <Link
        href="/cliente"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-text"
      >
        <ArrowLeft size={12} /> Volver
      </Link>
      <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold">
        <Trophy size={22} className="text-amber-500" /> Plan de competición
      </h1>
      <p className="mt-1 text-sm text-muted">
        Aquí tienes las instrucciones que tu nutri ha preparado para tu ventana
        de competición.
      </p>

      {active.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface/60 p-8 text-center text-sm text-muted">
          {upcoming ? (
            <>
              Tu próximo plan (<strong>{upcoming.title}</strong>) empieza el{" "}
              <strong>{fmtDate(upcoming.startDate)}</strong>. Te aparecerá aquí y en la
              home cuando llegue el día.
            </>
          ) : (
            <>Aún no tienes ningún plan de competición programado.</>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {active.map((p) => (
            <article key={p.id} className="rounded-2xl border border-border bg-surface p-5">
              <h2 className="text-lg font-bold">{p.title}</h2>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                <CalendarDays size={12} />
                {fmtDate(p.startDate)} → {fmtDate(p.endDate)}
              </p>

              {p.description ? (
                <div className="mt-4 whitespace-pre-wrap rounded-xl bg-bg/50 p-4 text-sm leading-relaxed text-text">
                  {p.description}
                </div>
              ) : null}

              {p.pdfUrl ? (
                <a
                  href={p.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90"
                >
                  <Paperclip size={14} /> {p.pdfName ?? "Descargar PDF"}
                </a>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
