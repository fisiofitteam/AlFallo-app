import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActiveProfessional } from "@/lib/session";
import { canManageContent } from "@/lib/roles";
import { canUseMarketerIA } from "@/lib/marketer-access";
import { ContentNav } from "@/components/ContentNav";
import { DossierMonthPicker } from "@/components/DossierMonthPicker";
import { DossierPrintButton } from "@/components/DossierPrintButton";
import { PieceInlineText } from "@/components/PieceInlineText";
import { PieceBlocksInlineEditor } from "@/components/PieceBlocksInlineEditor";
import { PieceStatusInlineSelect } from "@/components/PieceStatusInlineSelect";
import { BODY_ZONES, WEEK_TYPES, DAY_LABELS } from "@/lib/content-templates";
import {
  parseGoals,
  goalColor,
  goalLabel,
  GOAL_COLOR_CLASSES,
  piecePublishDate,
} from "@/lib/content-formats";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dossier de contenido · Al Fallo" };

const MONTH_NAMES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function parseMonthKey(raw: string | undefined): { year: number; month: number; key: string } {
  const now = new Date();
  const fallback = { year: now.getFullYear(), month: now.getMonth() + 1 };
  if (!raw) {
    const { year, month } = fallback;
    return { year, month, key: `${year}-${pad(month)}` };
  }
  const match = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!match) {
    const { year, month } = fallback;
    return { year, month, key: `${year}-${pad(month)}` };
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return { year: fallback.year, month: fallback.month, key: `${fallback.year}-${pad(fallback.month)}` };
  }
  return { year, month, key: `${year}-${pad(month)}` };
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
}

export default async function DossierPage({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  const user = await getActiveProfessional();
  if (!user) redirect("/login");
  if (!canManageContent(user.role)) redirect("/");

  const { year, month, key } = parseMonthKey(searchParams.m);

  // Rango del mes en UTC (ContentWeek.startDate/endDate se guardan como UTC).
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59));

  // Semanas cuyo intervalo intersecta el mes: (weekStart <= monthEnd) AND (weekEnd >= monthStart).
  const weeks = await prisma.contentWeek.findMany({
    where: {
      AND: [{ startDate: { lte: monthEnd } }, { endDate: { gte: monthStart } }],
    },
    orderBy: [{ startDate: "asc" }],
    include: {
      pieces: {
        where: { format: "reel" },
        orderBy: [{ dayOfWeek: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  const totalReels = weeks.reduce((n, w) => n + w.pieces.length, 0);

  return (
    <main>
      <ContentNav active="dossier" showMarketer={canUseMarketerIA(user.email)} />

      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 print:mb-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">📄 Dossier de contenido</h1>
          <p className="mt-0.5 text-xs text-neutral-500 print:text-neutral-700">
            Guion mensual de todos los reels. Título, guion y notas se autoguardan al escribir.
            Solo se muestran piezas con formato <strong>reel</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <DossierMonthPicker value={key} />
          <DossierPrintButton />
        </div>
      </header>

      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="text-lg font-semibold capitalize text-neutral-800">
          {MONTH_NAMES[month - 1]} {year}
        </h2>
        <span className="text-xs text-neutral-500">
          {weeks.length} {weeks.length === 1 ? "semana" : "semanas"} · {totalReels}{" "}
          {totalReels === 1 ? "reel" : "reels"}
        </span>
      </div>

      {weeks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/60 p-10 text-center text-sm text-neutral-500">
          No hay semanas planificadas que caigan en este mes.{" "}
          <Link href="/contenido/calendario" className="text-neutral-800 underline">
            Ir al calendario
          </Link>{" "}
          para crear una.
        </div>
      ) : (
        <div className="space-y-6">
          {weeks.map((w) => {
            const zone = BODY_ZONES.find((z) => z.value === w.bodyZone)?.label ?? w.bodyZone;
            const type = WEEK_TYPES.find((t) => t.value === w.weekType)?.label ?? w.weekType;
            return (
              <section key={w.id} className="print:break-inside-avoid">
                <header className="mb-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 print:border-neutral-300 print:bg-white">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-500">
                        Semana {w.weekNumber} · {w.year}
                      </p>
                      <h3 className="mt-0.5 text-lg font-bold text-neutral-900">
                        {w.centralTheme || "Sin tema"}
                      </h3>
                    </div>
                    <p className="text-xs text-neutral-500">
                      {shortDate(w.startDate)} → {shortDate(w.endDate)}
                    </p>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                    <span>{zone}</span>
                    <span>{type}</span>
                    {w.leadMagnetName ? (
                      <span>
                        Lead magnet: <strong>{w.leadMagnetName}</strong>
                        {w.leadMagnetKeyword ? (
                          <span className="ml-1 font-mono text-neutral-500">
                            ({w.leadMagnetKeyword})
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                    {w.kpiName ? (
                      <span>
                        KPI: <strong>{w.kpiName}</strong>
                        {w.kpiTarget != null ? ` · objetivo ${w.kpiTarget}` : ""}
                      </span>
                    ) : null}
                  </div>
                </header>

                {w.pieces.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-neutral-200 bg-white p-4 text-center text-xs text-neutral-400">
                    Sin reels en esta semana. Añádelos desde el calendario o desde la ficha de la semana.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {w.pieces.map((p, i) => {
                      const publishDate = piecePublishDate(w.startDate, p.dayOfWeek);
                      const goals = parseGoals(p.goals);
                      return (
                        <article
                          key={p.id}
                          className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm print:break-inside-avoid print:border-neutral-300 print:shadow-none"
                        >
                          <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                                Reel {i + 1} · {DAY_LABELS[p.dayOfWeek]}
                              </p>
                              <PieceInlineText
                                pieceId={p.id}
                                field="title"
                                initial={p.title}
                                placeholder="Título del reel"
                                variant="title"
                                className="mt-0.5"
                              />
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              {publishDate ? (
                                <span className="text-xs text-neutral-500">
                                  📅 {shortDate(publishDate)}
                                </span>
                              ) : null}
                              <PieceStatusInlineSelect pieceId={p.id} status={p.status} />
                            </div>
                          </div>

                          {goals.length > 0 ? (
                            <div className="mb-3 flex flex-wrap gap-1">
                              {goals.map((g) => (
                                <span
                                  key={g}
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${GOAL_COLOR_CLASSES[goalColor(g)]}`}
                                >
                                  {goalLabel(g)}
                                </span>
                              ))}
                            </div>
                          ) : null}

                          <div className="mb-4">
                            <PieceBlocksInlineEditor pieceId={p.id} initial={parseBlocks(p.blocks)} />
                          </div>

                          {(p.recordingLocation || p.recordingOutfit || p.recordingMaterial) ? (
                            <div className="mb-4 rounded-lg border border-neutral-100 bg-neutral-50/60 p-3 text-xs text-neutral-600 print:border-neutral-200">
                              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                                Producción
                              </p>
                              <ul className="space-y-0.5">
                                {p.recordingLocation ? <li>📍 {p.recordingLocation}</li> : null}
                                {p.recordingOutfit ? <li>👕 {p.recordingOutfit}</li> : null}
                                {p.recordingMaterial ? <li>🎒 {p.recordingMaterial}</li> : null}
                              </ul>
                            </div>
                          ) : null}

                          <div className="mb-3">
                            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                              Notas para editor
                            </p>
                            <PieceInlineText
                              pieceId={p.id}
                              field="editorNotes"
                              initial={p.editorNotes}
                              placeholder="Instrucciones específicas para el editor…"
                            />
                          </div>

                          {p.finalFileUrl ? (
                            <p className="mb-2 text-xs text-neutral-600">
                              <span className="text-neutral-400">Archivo final:</span>{" "}
                              <a
                                href={p.finalFileUrl}
                                className="text-blue-600 underline"
                                target="_blank"
                                rel="noreferrer"
                              >
                                {p.finalFileUrl}
                              </a>
                            </p>
                          ) : null}

                          <div className="mt-3 flex justify-end border-t border-neutral-100 pt-2 text-xs print:hidden">
                            <Link
                              href={`/contenido/pieza/${p.id}`}
                              className="text-neutral-500 hover:text-neutral-900"
                            >
                              Editar pieza →
                            </Link>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

function parseBlocks(raw: string | null | undefined): unknown {
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
