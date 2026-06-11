import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireOnboardedClient } from "@/lib/client-session";
import { ClientTabBar } from "@/components/cliente/ClientTabBar";
import { clientLogout } from "../actions";

export default async function ClientAppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireOnboardedClient();
  const firstName = me.fullName.split(" ")[0];

  return (
    <div className="shell-cliente min-h-screen bg-bg text-text">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col">
        {/* Cabecera fija: avatar + saludo + cerrar sesión */}
        <header className="sticky top-0 z-30 flex items-center justify-between bg-bg/80 px-5 py-4 backdrop-blur-md">
          <Link href="/cliente" className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary bg-surface text-base font-bold text-primary">
                {firstName.slice(0, 1).toUpperCase()}
              </div>
              <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-bg bg-[#4ade80]" />
            </div>
            <div className="text-left">
              <p className="text-xs text-muted">Bienvenido</p>
              <p className="text-base font-bold leading-tight">{firstName}</p>
            </div>
          </Link>
          <form action={clientLogout}>
            <button
              aria-label="Cerrar sesión"
              className="rounded-lg p-2 text-muted transition hover:bg-surface-2 hover:text-text"
            >
              <LogOut size={18} />
            </button>
          </form>
        </header>

        {/* pb-24 deja hueco para que la tab bar sticky no tape el contenido. */}
        <main className="flex-1 px-5 pb-24">{children}</main>

        {/* Barra inferior fija con los 5 atajos principales. */}
        <ClientTabBar />
      </div>
    </div>
  );
}
