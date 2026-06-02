"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  UtensilsCrossed,
  Users,
  TrendingUp,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";

// Bottom-nav del atleta. Sustituimos "Registro" por "Comunidad" para meter
// el nuevo módulo sin saturar la barra (max 5 ítems en móvil).
const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/cliente", label: "Inicio", icon: Home },
  { href: "/cliente/plan", label: "Mi plan", icon: UtensilsCrossed },
  { href: "/cliente/comunidad", label: "Comunidad", icon: Users },
  { href: "/cliente/checkin", label: "Check-in", icon: ClipboardCheck },
  { href: "/cliente/progreso", label: "Progreso", icon: TrendingUp },
];

export function ClientBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-lg items-center justify-around border-t border-border bg-surface px-2 pb-[env(safe-area-inset-bottom)] pt-1">
      {ITEMS.map((item) => {
        const active = item.href === "/cliente" ? pathname === "/cliente" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-2 text-xs transition ${
              active ? "text-primary" : "text-muted"
            }`}
          >
            <Icon size={22} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
