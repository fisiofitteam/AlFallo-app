import { Users, UserCheck, Clock, ArrowRight } from "lucide-react";
import { requireProfessional } from "@/lib/session";
import { isManager, navForRole } from "@/lib/roles";

export const metadata = { title: "Panel · Al Fallo Nutrition" };

// Tarjetas de resumen. En Fase 1 los números son placeholders (0);
// se conectarán a datos reales al construir Clientes (Fase 2).
const STATS = [
  { label: "Total clientes", value: 0, icon: Users, cardClass: "bg-[#fbe9f1]", numClass: "text-[#e6197e]" },
  { label: "Pendientes", value: 0, icon: Clock, cardClass: "bg-[#fdecd9]", numClass: "text-[#e07b1a]" },
  { label: "Activos", value: 0, icon: UserCheck, cardClass: "bg-[#e7f6ec]", numClass: "text-[#1fa971]" },
];

export default async function DashboardPage() {
  const prof = await requireProfessional();
  const shortcuts = navForRole(prof.role).filter((i) => i.href !== "/");
  const firstName = prof.fullName.split(" ")[0];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-7">
        <h1 className="text-2xl font-bold md:text-3xl">Panel de {firstName}</h1>
        <p className="mt-1 text-muted">
          Panel de gestión de Al Fallo Nutrition
          {isManager(prof.role) && " · acceso completo como manager"}
        </p>
      </header>

      {/* Tarjetas de resumen */}
      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STATS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`rounded-2xl p-5 ${s.cardClass}`}>
              <div className="flex items-center gap-2 text-sm text-zinc-600">
                <Icon size={16} />
                {s.label}
              </div>
              <p className={`mt-2 text-3xl font-bold ${s.numClass}`}>{s.value}</p>
            </div>
          );
        })}
      </section>

      {/* Accesos rápidos a los módulos disponibles según el rol */}
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
                className="group rounded-2xl border border-border bg-surface p-5 transition hover:border-primary"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon size={20} />
                </div>
                <p className="flex items-center gap-1 font-semibold">
                  {item.label}
                  <ArrowRight size={15} className="text-primary opacity-0 transition group-hover:opacity-100" />
                </p>
                <p className="mt-1 text-sm text-muted">Próximamente en su fase del roadmap.</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
