import { Flame, Target } from "lucide-react";
import { requireOnboardedClient } from "@/lib/client-session";
import {
  getHabitStreaks,
  getRecentWeeks,
  getTodayStatus,
} from "@/lib/habits";
import { HabitTodayCard, type HabitTodayItem } from "@/components/cliente/HabitTodayCard";
import { prisma } from "@/lib/prisma";
import { weekStart, todayKey, addDays } from "@/lib/habits";

export const metadata = { title: "Mis hábitos · Al Fallo" };
export const dynamic = "force-dynamic";

function weekLabel(ws: Date): string {
  const end = new Date(ws);
  end.setUTCDate(end.getUTCDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  return `${fmt(ws)} → ${fmt(end)}`;
}

export default async function HabitsPage() {
  const me = await requireOnboardedClient();

  const today = await getTodayStatus(me.id);
  const streaks = await getHabitStreaks(me.id);
  const recent = await getRecentWeeks(me.id, 8);

  // Recalculamos count semanal para pasar a la tarjeta compacta.
  let habitItems: HabitTodayItem[] = [];
  if (today.habits.length > 0) {
    const wStart = weekStart(todayKey());
    const wEnd = addDays(wStart, 7);
    const weekLogs = await prisma.habitLog.groupBy({
      by: ["habitId"],
      where: {
        clientId: me.id,
        habitId: { in: today.habits.map((h) => h.id) },
        date: { gte: wStart, lt: wEnd },
      },
      _count: { habitId: true },
    });
    const countByHabit = new Map(weekLogs.map((l) => [l.habitId, l._count.habitId]));
    habitItems = today.habits.map((h) => ({
      id: h.id,
      name: h.name,
      emoji: h.emoji,
      weeklyTarget: h.weeklyTarget,
      doneToday: h.doneToday,
      weekDoneCount: countByHabit.get(h.id) ?? 0,
    }));
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Mis hábitos</h1>
      <p className="mt-1 text-sm text-muted">
        Pequeños cambios que suman a lo grande. Marca cada día lo que hayas cumplido.
      </p>

      {habitItems.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          Todavía no hay hábitos configurados. Vuelve pronto o pregunta a tu nutri.
        </div>
      ) : (
        <>
          <HabitTodayCard items={habitItems} />

          {/* Racha por hábito */}
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
              Rachas
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {streaks.map((s) => (
                <div
                  key={s.habitId}
                  className="rounded-2xl border border-border bg-surface p-4"
                >
                  <p className="flex items-center gap-1 text-sm font-semibold">
                    {s.emoji ? <span>{s.emoji}</span> : <Target size={14} />}
                    {s.name}
                  </p>
                  <div className="mt-2 flex items-baseline gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted">
                        Actual
                      </p>
                      <p className="flex items-baseline gap-1 text-2xl font-bold text-primary">
                        <Flame size={16} className="text-amber-500" />
                        {s.currentStreak}
                        <span className="text-xs font-medium text-muted">
                          {s.currentStreak === 1 ? "sem." : "sem."}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted">
                        Mejor
                      </p>
                      <p className="text-lg font-semibold text-text">
                        {s.bestStreak}{" "}
                        <span className="text-xs font-medium text-muted">
                          {s.bestStreak === 1 ? "sem." : "sem."}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Últimas semanas */}
          <section className="mt-6">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
              Últimas semanas
            </h2>
            <div className="space-y-2">
              {recent.weeks.map((w, idx) => (
                <article
                  key={w.weekStart.toISOString()}
                  className="rounded-2xl border border-border bg-surface p-4"
                >
                  <p className="mb-2 text-xs font-semibold text-muted">
                    {idx === 0 ? "Esta semana" : weekLabel(w.weekStart)}
                  </p>
                  <ul className="space-y-1">
                    {recent.habits.map((h) => {
                      const entry = w.entries.find((e) => e.habitId === h.id);
                      const doneCount = entry?.doneCount ?? 0;
                      const target = h.weeklyTarget;
                      const achieved = entry?.achieved ?? false;
                      const pct = Math.min(100, Math.round((doneCount / target) * 100));
                      return (
                        <li key={h.id} className="flex items-center gap-3">
                          <span className="w-32 shrink-0 truncate text-sm">
                            {h.emoji ? <span className="mr-1">{h.emoji}</span> : null}
                            {h.name}
                          </span>
                          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-bg">
                            <div
                              className={`h-full rounded-full ${
                                achieved ? "bg-emerald-500" : "bg-primary"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span
                            className={`w-16 text-right text-xs tabular-nums ${
                              achieved ? "font-semibold text-emerald-600" : "text-muted"
                            }`}
                          >
                            {doneCount} / {target}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
