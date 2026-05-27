import { LogOut } from "lucide-react";
import { requireOnboardedClient } from "@/lib/client-session";
import { BrandMark } from "@/components/brand-mark";
import { ClientBottomNav } from "@/components/client-bottom-nav";
import { clientLogout } from "../actions";

export default async function ClientAppLayout({ children }: { children: React.ReactNode }) {
  // Exige sesión de cliente y onboarding completo (si no, redirige).
  await requireOnboardedClient();

  return (
    <div className="shell min-h-screen bg-bg text-text">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface px-5 py-3">
          <span className="flex items-center gap-2">
            <BrandMark size={24} />
            <span className="font-extrabold tracking-tight">Al Fallo</span>
          </span>
          <form action={clientLogout}>
            <button aria-label="Cerrar sesión" className="rounded-lg p-2 text-muted hover:bg-surface-2">
              <LogOut size={18} />
            </button>
          </form>
        </header>

        <main className="flex-1 px-5 py-5 pb-24">{children}</main>
      </div>

      <ClientBottomNav />
    </div>
  );
}
