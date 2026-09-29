"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, ArrowRight, Flame } from "lucide-react";
import { toggleTodayHabit } from "@/app/cliente/(app)/habitos/actions";

export type HabitTodayItem = {
  id: string;
  name: string;
  emoji: string | null;
  weeklyTarget: number;
  doneToday: boolean;
  weekDoneCount: number;
};

export function HabitTodayCard({ items }: { items: HabitTodayItem[] }) {
  if (items.length === 0) return null;
  return (
    <section className="relative mt-5 rounded-2xl border border-border bg-surface p-4">
      <header className="mb-3 flex items-baseline justify-between">
        <p className="text-sm font-bold text-text">Hábitos de hoy</p>
        <Link
          href="/cliente/habitos"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text"
        >
          Ver rachas <ArrowRight size={11} />
        </Link>
      </header>
      <ul className="space-y-1.5">
        {items.map((h) => (
          <HabitRow key={h.id} initial={h} />
        ))}
      </ul>
    </section>
  );
}

function HabitRow({ initial }: { initial: HabitTodayItem }) {
  const [state, setState] = useState(initial);
  const [pending, start] = useTransition();

  function onToggle() {
    if (pending) return;
    // Optimista: adelantamos el toggle y recalculamos el count de la semana.
    const nextDone = !state.doneToday;
    setState((s) => ({
      ...s,
      doneToday: nextDone,
      weekDoneCount: Math.max(0, s.weekDoneCount + (nextDone ? 1 : -1)),
    }));
    start(async () => {
      const result = await toggleTodayHabit(state.id);
      // Si el servidor discrepa (raro), corregimos.
      if (result.done !== nextDone) {
        setState((s) => ({
          ...s,
          doneToday: result.done,
          weekDoneCount: Math.max(0, s.weekDoneCount + (result.done !== nextDone ? -1 : 0)),
        }));
      }
    });
  }

  const achieved = state.weekDoneCount >= state.weeklyTarget;
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
          state.doneToday
            ? "border-emerald-300 bg-emerald-50"
            : "border-border bg-bg hover:bg-surface-2"
        } ${pending ? "opacity-70" : ""}`}
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
            state.doneToday
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-neutral-300 bg-white text-transparent"
          }`}
        >
          <Check size={14} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-sm font-medium text-text">
            {state.emoji ? <span>{state.emoji}</span> : null}
            {state.name}
          </span>
          <span className="text-[11px] text-muted">
            {state.weekDoneCount} / {state.weeklyTarget} esta semana
            {achieved ? (
              <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                <Flame size={9} /> semana ganada
              </span>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  );
}
