import Link from "next/link";
import {
  ChefHat,
  ClipboardCheck,
  Dumbbell,
  MessageCircle,
  NotebookPen,
  ShoppingCart,
  Stethoscope,
  TrendingUp,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { requireOnboardedClient } from "@/lib/client-session";

export const metadata = { title: "Al Fallo" };

type Section = { href: string; label: string; icon: LucideIcon; ready: boolean };

const SECTIONS: Section[] = [
  { href: "/cliente/plan", label: "Mi plan", icon: UtensilsCrossed, ready: true },
  { href: "/cliente/recetas", label: "Recetas", icon: ChefHat, ready: false },
  { href: "/cliente/compra", label: "Tu compra", icon: ShoppingCart, ready: false },
  { href: "/cliente/checkin", label: "Check-in", icon: ClipboardCheck, ready: true },
  { href: "/cliente/registro", label: "Registro", icon: NotebookPen, ready: true },
  { href: "/cliente/progreso", label: "Mi progreso", icon: TrendingUp, ready: true },
  { href: "/cliente/training", label: "Entreno", icon: Dumbbell, ready: false },
  { href: "/cliente/nutricionista", label: "Tu nutri", icon: Stethoscope, ready: false },
];

export default async function ClientHomePage() {
  await requireOnboardedClient();

  return (
    <div className="relative pt-1">
      {/* Marca de agua: "A" gigante semitransparente al fondo */}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={0.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute left-1/2 top-32 h-[120vmin] w-[120vmin] -translate-x-1/2 -translate-y-1/4 text-primary opacity-[0.05]"
      >
        <path d="M4 21 L12 3 L20 21" />
        <path d="M7.7 14 H16.3" />
      </svg>

      {/* Frase motivacional */}
      <h1 className="relative text-[2rem] font-extrabold leading-tight tracking-tight">
        Lo difícil era empezar.
        <br />
        <span className="text-primary">Ya estás aquí.</span>
      </h1>

      {/* Mosaico de secciones */}
      <div className="relative mt-7 grid grid-cols-2 gap-3">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="group relative flex aspect-square flex-col items-center justify-center gap-2.5 overflow-hidden rounded-2xl border border-border bg-surface p-4 text-center transition hover:border-primary hover:bg-surface-2"
            >
              <Icon size={44} className="text-primary transition group-hover:scale-110" strokeWidth={1.6} />
              <span className="text-base font-bold">{s.label}</span>
              {!s.ready && (
                <span className="absolute right-2 top-2 rounded-full bg-primary-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                  Pronto
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
