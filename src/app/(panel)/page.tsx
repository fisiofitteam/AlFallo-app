import { Users, UserCheck, Clock, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { isManager, navForRole } from "@/lib/roles";
import { CLIENT_ACCESS_ROLES, clientScopeWhere } from "@/lib/clients";

export const metadata = { title: "Panel · Al Fallo Nutrition" };

export default async function DashboardPage() {
  const prof = await requireProfessional();
  const shortcuts = navForRole(prof.role).filter((i) => i.href !== "/");
  const firstName = prof.fullName.split(" ")[0];

  // Conteos reales de clientes (alcance según rol). Los roles sin acceso a
  // clientes (setter/closer) no ven estas tarjetas.
  const canSeeClients = CLIENT_ACCESS_ROLES.includes(prof.role);
  const scope = canSeeClients ? clientScopeWhere(prof) : null;
  const [total, pendientes, activos] = scope
    ? await Promise.all([
        prisma.client.count({ where: scope }),
        prisma.client.count({ where: { ...scope, status: { in: ["pendiente_revision", "onboarding"] } } }),
        prisma.client.count({ where: { ...scope, status: "activo" } }),
      ])
    : [0, 0, 0];

  const STATS = [
    { label: "Total clientes", value: total, icon: Users, cardClass: "bg-[#fbe9f1]", numClass: "text-[#e6197e]" },
    { label: "Pendientes", value: pendientes, icon: Clock, cardClass: "bg-[#fdecd9]", numClass: "text-[#e07b1a]" },
    { label: "Activos", value: activos, icon: UserCheck, cardClass: "bg-[#e7f6ec]", numClass: "text-[#1fa971]" },
  ];

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
      {canSeeClients && (
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
      )}

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
