import "server-only";
import { prisma } from "@/lib/prisma";

const MADRID_TZ = "Europe/Madrid";
const DAY_MS = 86_400_000;

/** Fecha (a 00:00 UTC) del día natural de HOY en Madrid. Usamos UTC como
 *  representación estable para no depender del TZ del servidor. */
export function todayKey(now = new Date()): Date {
  const madrid = new Date(now.toLocaleString("en-US", { timeZone: MADRID_TZ }));
  return new Date(Date.UTC(madrid.getFullYear(), madrid.getMonth(), madrid.getDate()));
}

/** Date a 00:00 UTC del día ISO 8601 para una fecha dada. */
export function dayKey(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Suma N días manteniendo 00:00 UTC. */
export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

/** Lunes 00:00 UTC de la semana ISO 8601 a la que pertenece `d`. */
export function weekStart(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const back = (day + 6) % 7; // días atrás hasta lunes
  return addDays(d, -back);
}

export type HabitDefinitionLite = {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  weeklyTarget: number;
  order: number;
  active: boolean;
};

export async function listActiveHabits(): Promise<HabitDefinitionLite[]> {
  return prisma.habitDefinition.findMany({
    where: { active: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
}

export async function listAllHabits(): Promise<HabitDefinitionLite[]> {
  return prisma.habitDefinition.findMany({
    orderBy: [{ active: "desc" }, { order: "asc" }, { createdAt: "asc" }],
  });
}

/** Estado de HOY del cliente: para cada hábito activo, ¿está marcado? */
export async function getTodayStatus(clientId: string, now = new Date()) {
  const today = todayKey(now);
  const habits = await listActiveHabits();
  const logs = await prisma.habitLog.findMany({
    where: { clientId, date: today, habitId: { in: habits.map((h) => h.id) } },
    select: { habitId: true, done: true },
  });
  const doneMap = new Map(logs.map((l) => [l.habitId, l.done]));
  return {
    date: today,
    habits: habits.map((h) => ({ ...h, doneToday: !!doneMap.get(h.id) })),
  };
}

/** Toggle idempotente del check de HOY del cliente para un hábito. */
export async function toggleHabitToday(
  clientId: string,
  habitId: string,
  now = new Date(),
): Promise<{ done: boolean }> {
  const today = todayKey(now);
  const existing = await prisma.habitLog.findUnique({
    where: { clientId_habitId_date: { clientId, habitId, date: today } },
  });
  if (existing) {
    await prisma.habitLog.delete({ where: { id: existing.id } });
    return { done: false };
  }
  await prisma.habitLog.create({
    data: { clientId, habitId, date: today, done: true },
  });
  return { done: true };
}

/** Devuelve las últimas N semanas ISO (más recientes primero) con:
 *   - weekStart (lunes 00:00 UTC)
 *   - para cada hábito activo: doneCount, target, achieved (doneCount≥target).
 */
export async function getRecentWeeks(clientId: string, weeks = 8, now = new Date()) {
  const habits = await listActiveHabits();
  if (habits.length === 0) return { habits: [], weeks: [] };

  const currentWeekStart = weekStart(dayKey(now));
  const firstWeek = addDays(currentWeekStart, -(weeks - 1) * 7);
  const rangeEnd = addDays(currentWeekStart, 7);

  const logs = await prisma.habitLog.findMany({
    where: {
      clientId,
      habitId: { in: habits.map((h) => h.id) },
      date: { gte: firstWeek, lt: rangeEnd },
    },
    select: { habitId: true, date: true },
  });

  const buckets = new Map<string, Map<string, number>>();
  for (let i = 0; i < weeks; i++) {
    const ws = addDays(firstWeek, i * 7);
    buckets.set(ws.toISOString(), new Map());
  }
  for (const l of logs) {
    const ws = weekStart(dayKey(l.date));
    const key = ws.toISOString();
    const inner = buckets.get(key);
    if (!inner) continue;
    inner.set(l.habitId, (inner.get(l.habitId) ?? 0) + 1);
  }

  const weeksOut = Array.from(buckets.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([iso, inner]) => {
      const wStart = new Date(iso);
      const entries = habits.map((h) => {
        const doneCount = inner.get(h.id) ?? 0;
        return {
          habitId: h.id,
          doneCount,
          target: h.weeklyTarget,
          achieved: doneCount >= h.weeklyTarget,
        };
      });
      return { weekStart: wStart, entries };
    });

  return { habits, weeks: weeksOut };
}

/** Rachas por hábito basadas en semanas ISO ganadas. La semana en curso NO
 *  rompe la racha aunque aún no haya alcanzado su target — se computa hasta
 *  la semana anterior y se suma la actual si ya la ha ganado. */
export async function getHabitStreaks(clientId: string, now = new Date()) {
  const habits = await listActiveHabits();
  if (habits.length === 0) return [];

  const currentWeekStart = weekStart(dayKey(now));
  // Buscamos histórico hasta 2 años atrás por seguridad; en la práctica la
  // mayoría no tendrá ni un año.
  const from = addDays(currentWeekStart, -104 * 7);
  const rangeEnd = addDays(currentWeekStart, 7);

  const logs = await prisma.habitLog.findMany({
    where: {
      clientId,
      habitId: { in: habits.map((h) => h.id) },
      date: { gte: from, lt: rangeEnd },
    },
    select: { habitId: true, date: true },
  });

  // Agrupamos: habitId → weekStartISO → count
  const perHabit = new Map<string, Map<string, number>>();
  for (const h of habits) perHabit.set(h.id, new Map());
  for (const l of logs) {
    const iso = weekStart(dayKey(l.date)).toISOString();
    const inner = perHabit.get(l.habitId)!;
    inner.set(iso, (inner.get(iso) ?? 0) + 1);
  }

  return habits.map((h) => {
    const inner = perHabit.get(h.id)!;
    // Racha actual: retroceder desde semana pasada mientras esté ganada.
    // Sumar +1 si la semana en curso ya está ganada.
    let current = 0;
    const currentIso = currentWeekStart.toISOString();
    const currentWon = (inner.get(currentIso) ?? 0) >= h.weeklyTarget;
    let cursor = addDays(currentWeekStart, -7);
    while ((inner.get(cursor.toISOString()) ?? 0) >= h.weeklyTarget) {
      current += 1;
      cursor = addDays(cursor, -7);
    }
    if (currentWon) current += 1;

    // Mejor racha: escaneo secuencial ordenando por semana asc.
    const isoKeys = Array.from(inner.keys()).sort();
    let best = 0;
    let run = 0;
    // Rellenamos huecos considerando ganada / perdida por semana.
    if (isoKeys.length > 0) {
      let cur = new Date(isoKeys[0]);
      const last = new Date(isoKeys[isoKeys.length - 1]);
      while (cur.getTime() <= last.getTime()) {
        const won = (inner.get(cur.toISOString()) ?? 0) >= h.weeklyTarget;
        if (won) {
          run += 1;
          if (run > best) best = run;
        } else {
          run = 0;
        }
        cur = addDays(cur, 7);
      }
    }
    best = Math.max(best, current);

    return {
      habitId: h.id,
      name: h.name,
      emoji: h.emoji,
      weeklyTarget: h.weeklyTarget,
      currentStreak: current,
      bestStreak: best,
    };
  });
}
