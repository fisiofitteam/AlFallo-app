import { requireProfessional } from "@/lib/session";
import { isManager, navForRole } from "@/lib/roles";

export const metadata = { title: "Inicio · Al Fallo Nutrition" };

export default async function DashboardPage() {
  const prof = await requireProfessional();
  const shortcuts = navForRole(prof.role).filter((i) => i.href !== "/");
  const firstName = prof.fullName.split(" ")[0];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold md:text-3xl">Hola, {firstName} 👋</h1>
        <p className="mt-1 text-muted">
          Bienvenido al panel de Al Fallo Nutrition.
          {isManager(prof.role) && " Tienes acceso completo como manager."}
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.href}
                className="rounded-2xl border border-border bg-surface p-5 transition hover:border-primary"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-primary">
                  <Icon size={20} />
                </div>
                <p className="font-semibold">{item.label}</p>
                <p className="mt-1 text-sm text-muted">Próximamente en su fase del roadmap.</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
