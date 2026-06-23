import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import {
  ChefHat,
  ClipboardCheck,
  Dumbbell,
  GraduationCap,
  ShoppingCart,
  Stethoscope,
  TrendingUp,
  Users,
  UtensilsCrossed,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireOnboardedClient } from "@/lib/client-session";
import { getDailyQuote } from "@/lib/dailyQuote";
import { shouldShowCheckInReminder } from "@/lib/weeklyCheckin";

export const metadata = { title: "Al Fallo" };

type Section = {
  key: string; // también nombre del archivo en /public/avocados/<key>.png
  href: string;
  label: string;
  icon: LucideIcon; // fallback si no hay imagen
  ready: boolean;
};

// Lista MAESTRA de secciones del cliente. El mosaico de la home solo pinta
// las que tienen `ready: true` — los placeholders se ocultan hasta que se
// monten para no enseñar tiles muertos. Mantén los `ready: false` aquí (con
// su icono/key) para que sea trivial activarlos cuando toque.
const SECTIONS: Section[] = [
  { key: "plan", href: "/cliente/plan", label: "Mi plan", icon: UtensilsCrossed, ready: true },
  { key: "comunidad", href: "/cliente/comunidad", label: "Comunidad", icon: Users, ready: true },
  { key: "recetas", href: "/cliente/recetas", label: "Recetas", icon: ChefHat, ready: true },
  { key: "recursos", href: "/cliente/recursos", label: "Recursos", icon: GraduationCap, ready: true },
  { key: "compra", href: "/cliente/compra", label: "Tu compra", icon: ShoppingCart, ready: true },
  { key: "progreso", href: "/cliente/progreso", label: "Mi progreso", icon: TrendingUp, ready: true },
  { key: "training", href: "/cliente/training", label: "Entreno", icon: Dumbbell, ready: false },
  { key: "nutri", href: "/cliente/nutricionista", label: "Tu nutri", icon: Stethoscope, ready: false },
];
const VISIBLE_SECTIONS = SECTIONS.filter((s) => s.ready);

// Si existe public/avocados/<key>.png devuelve la ruta; si no, null.
function avocadoSrc(key: string): string | null {
  // Acepta png o webp.
  for (const ext of ["png", "webp", "jpg"]) {
    const file = path.join(process.cwd(), "public", "avocados", `${key}.${ext}`);
    if (existsSync(file)) return `/avocados/${key}.${ext}`;
  }
  return null;
}

// Calcula si hay publicaciones en /comunidad que el cliente todavía no ha visto.
// Compara el último post (ajeno) con `communityLastSeenAt`. Si nunca ha entrado,
// cualquier post cuenta como novedad.
async function hasNewCommunity(clientId: string): Promise<boolean> {
  const me = await prisma.client.findUnique({
    where: { id: clientId },
    select: { communityLastSeenAt: true },
  });
  const latest = await prisma.communityFeedPost.findFirst({
    where: { published: true, NOT: { authorClientId: clientId } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!latest) return false;
  if (!me?.communityLastSeenAt) return true;
  return latest.createdAt > me.communityLastSeenAt;
}

export default async function ClientHomePage() {
  const me = await requireOnboardedClient();
  const newCommunity = await hasNewCommunity(me.id);
  // Frase del día (estable durante todo el calendario, ver lib/dailyQuote).
  const quote = getDailyQuote();
  // Aviso de check-in: solo se ve el lunes hasta que el cliente lo envía.
  const showCheckInReminder = await shouldShowCheckInReminder(me.id);

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

      {/* Frase motivacional del día. Rota por día del año (ver lib/dailyQuote)
          para que el cliente no se queme con la misma frase eternamente. */}
      <h1 className="relative text-[2rem] font-extrabold leading-tight tracking-tight">
        {quote.head}
        <br />
        <span className="text-primary">{quote.tail}</span>
      </h1>

      {/* Aviso del check-in semanal — visible solo el día del aviso si todavía
          no lo han enviado. Recuadro rosa translúcido para que destaque sin
          robarle la portada a la frase. */}
      {showCheckInReminder ? <CheckInReminderCard /> : null}

      {/* Mosaico de secciones — solo las "ready". Las que no, se ocultan
          hasta que estén montadas (sin badges "Pronto" que ensucien la UI). */}
      <div className="relative mt-7 grid grid-cols-2 gap-3">
        {VISIBLE_SECTIONS.map((s) => {
          const Icon = s.icon;
          const avocado = avocadoSrc(s.key);
          return (
            <Link
              key={s.href}
              href={s.href}
              className="group relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-border bg-surface p-4 text-center transition hover:border-primary hover:bg-surface-2"
            >
              {avocado ? (
                <Image
                  src={avocado}
                  alt={s.label}
                  width={140}
                  height={140}
                  className="h-[58%] w-auto object-contain transition group-hover:scale-105"
                  priority
                />
              ) : (
                <Icon
                  size={48}
                  className="text-primary transition group-hover:scale-110"
                  strokeWidth={1.6}
                />
              )}
              <span className="text-base font-bold">{s.label}</span>
              {s.key === "comunidad" && newCommunity && (
                <span
                  aria-label="Hay novedades"
                  className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-fg shadow-md"
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                  Nuevo
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Banner rosa translúcido que invita a hacer el check-in semanal. Se pinta
 *  debajo de la frase motivacional cuando toca (lunes y aún no enviado). */
function CheckInReminderCard() {
  return (
    <Link
      href="/cliente/checkin"
      className="relative mt-5 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4 backdrop-blur-sm transition hover:bg-primary/15"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-fg shadow-md">
        <ClipboardCheck size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-primary">Hoy toca check-in</p>
        <p className="text-xs leading-snug text-text/80">
          Cuéntanos cómo te ha ido la semana — peso, perímetros y sensaciones.
        </p>
      </div>
      <ArrowRight size={18} className="shrink-0 text-primary" />
    </Link>
  );
}
