"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Moon, Sun } from "lucide-react";
import { navForRole, ROLE_LABELS, type Role } from "@/lib/roles";
import { LogoutButton } from "@/components/logout-button";

type Props = {
  professional: { fullName: string; email: string; role: string; imageUrl: string | null };
  children: React.ReactNode;
};

const THEME_KEY = "afn-theme";

export function PanelShell({ professional, children }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(true);

  // Tema persistente (por defecto oscuro).
  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved) setDark(saved === "dark");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  }, [dark]);

  // Cierra el menú móvil al navegar.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const items = navForRole(professional.role);
  const roleLabel = ROLE_LABELS[professional.role as Role] ?? professional.role;

  return (
    <div className={`shell ${dark ? "dark" : ""} min-h-screen bg-bg text-text`}>
      {/* Cabecera móvil */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
          className="rounded-lg p-1.5 hover:bg-surface-2"
        >
          <Menu size={22} />
        </button>
        <span className="font-bold">
          Al Fallo <span className="text-primary">Nutrition</span>
        </span>
        <button
          onClick={() => setDark((d) => !d)}
          aria-label="Cambiar tema"
          className="rounded-lg p-1.5 hover:bg-surface-2"
        >
          {dark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      <div className="flex">
        {/* Overlay móvil */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-surface transition-transform md:static md:translate-x-0 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-5 py-4">
            <Link href="/" className="text-lg font-bold">
              Al Fallo <span className="text-primary">Nutrition</span>
            </Link>
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
              className="rounded-lg p-1.5 hover:bg-surface-2 md:hidden"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
            {items.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? "bg-primary text-primary-fg font-medium"
                      : "text-muted hover:bg-surface-2 hover:text-text"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border p-3">
            <div className="mb-1 flex items-center gap-3 px-3 py-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-fg">
                {professional.fullName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{professional.fullName}</p>
                <p className="truncate text-xs text-muted">{roleLabel}</p>
              </div>
            </div>
            <button
              onClick={() => setDark((d) => !d)}
              className="mb-1 hidden w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-text md:flex"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
              {dark ? "Tema claro" : "Tema oscuro"}
            </button>
            <LogoutButton />
          </div>
        </aside>

        {/* Contenido */}
        <main className="min-h-screen flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
