"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  ShoppingCart,
  TrendingUp,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

// Barra inferior fija de la PWA del cliente. 5 atajos clave; el resto se
// alcanza desde el mosaico de la home. Marca activa cuando el pathname
// empieza por su href (así "/cliente/plan/cualquier-cosa" sigue resaltando
// "Mi plan").
//
// Check-in no aparece aquí: se accede SOLO desde el aviso rosa de la home
// el día que toca (ver lib/weeklyCheckin).
type Tab = { href: string; label: string; icon: LucideIcon };

const TABS: Tab[] = [
  { href: "/cliente", label: "Inicio", icon: Home },
  { href: "/cliente/plan", label: "Mi plan", icon: UtensilsCrossed },
  { href: "/cliente/compra", label: "Mi compra", icon: ShoppingCart },
  { href: "/cliente/comunidad", label: "Comunidad", icon: Users },
  { href: "/cliente/progreso", label: "Progreso", icon: TrendingUp },
];

function isActive(pathname: string, href: string): boolean {
  // Caso especial: "/cliente" solo está activo en la home exacta. Si no,
  // estaría activo en todas las páginas.
  if (href === "/cliente") return pathname === "/cliente";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ClientTabBar() {
  const pathname = usePathname() ?? "";
  return (
    <nav
      aria-label="Navegación principal"
      // pb-[env(safe-area-inset-bottom)] mete espacio extra en iPhones con notch.
      className="sticky bottom-0 z-30 mt-auto border-t border-border bg-bg/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = isActive(pathname, t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition ${
                  active ? "text-primary" : "text-muted hover:text-text"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
