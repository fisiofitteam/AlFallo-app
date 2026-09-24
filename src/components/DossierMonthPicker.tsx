"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function thisMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function DossierMonthPicker({ value }: { value: string }) {
  const router = useRouter();

  function go(next: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("m", next);
    router.push(url.pathname + url.search);
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-1 py-1 shadow-sm">
      <button
        type="button"
        onClick={() => go(shiftMonth(value, -1))}
        className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
        title="Mes anterior"
        aria-label="Mes anterior"
      >
        <ChevronLeft size={16} />
      </button>
      <input
        type="month"
        value={value}
        onChange={(e) => e.target.value && go(e.target.value)}
        className="bg-transparent px-1 py-0.5 text-sm font-medium text-neutral-800 outline-none"
      />
      <button
        type="button"
        onClick={() => go(shiftMonth(value, 1))}
        className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
        title="Mes siguiente"
        aria-label="Mes siguiente"
      >
        <ChevronRight size={16} />
      </button>
      <button
        type="button"
        onClick={() => go(thisMonthKey())}
        className="ml-1 inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-2 py-1 text-xs font-semibold text-white hover:opacity-90"
        title="Ir al mes actual"
      >
        <CalendarDays size={12} /> Este mes
      </button>
    </div>
  );
}
