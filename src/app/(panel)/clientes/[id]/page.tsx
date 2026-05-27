import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import {
  CLIENT_ACCESS_ROLES,
  CLIENT_STATUSES,
  isManagerRole,
  statusBadgeClass,
  statusLabel,
} from "@/lib/clients";
import { FichaForm } from "./ficha-form";
import { reassignNutritionist, updateClientStatus } from "../actions";

const TABS = [
  { key: "ficha", label: "Ficha nutricional" },
  { key: "plan", label: "Plan", phase: "Fase 3" },
  { key: "restricciones", label: "Restricciones", phase: "Fase 5" },
  { key: "evolucion", label: "Evolución", phase: "Fase 5" },
  { key: "suscripcion", label: "Suscripción", phase: "Fase 6" },
  { key: "formularios", label: "Formularios / Check-ins", phase: "Fase 5" },
  { key: "consultas", label: "Consultas", phase: "Fase 5" },
] as const;

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/");

  const client = await prisma.client.findUnique({
    where: { id: params.id },
    include: { profile: true, nutritionist: { select: { fullName: true } } },
  });
  if (!client) redirect("/clientes");
  // Un nutricionista solo accede a sus clientes.
  if (!isManagerRole(prof.role) && client.nutritionistId !== prof.id) redirect("/clientes");

  const manager = isManagerRole(prof.role);
  const activeTab = TABS.find((t) => t.key === searchParams.tab) ?? TABS[0];

  const nutritionists = manager
    ? await prisma.professional.findMany({
        where: { isActive: true, role: { in: ["ceo", "head_coach", "nutricionista"] } },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      })
    : [];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/clientes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
        <ArrowLeft size={16} /> Clientes
      </Link>

      {/* Cabecera */}
      <header className="mb-6 rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary">
                {client.fullName.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold">{client.fullName}</h1>
                <p className="text-sm text-muted">
                  {client.email ?? "Sin email"}
                  {client.phone && ` · ${client.phone}`}
                </p>
              </div>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(client.status)}`}>
            {statusLabel(client.status)}
          </span>
        </div>

        {/* Controles: estado y (managers) asignación */}
        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <form action={updateClientStatus} className="flex items-end gap-2">
            <input type="hidden" name="clientId" value={client.id} />
            <label className="flex-1">
              <span className="mb-1 block text-xs font-medium text-muted">Estado</span>
              <select
                name="status"
                defaultValue={client.status}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              >
                {CLIENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-surface-2">
              Guardar
            </button>
          </form>

          {manager ? (
            <form action={reassignNutritionist} className="flex items-end gap-2">
              <input type="hidden" name="clientId" value={client.id} />
              <label className="flex-1">
                <span className="mb-1 block text-xs font-medium text-muted">Nutricionista</span>
                <select
                  name="nutritionistId"
                  defaultValue={client.nutritionistId ?? ""}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="">Sin asignar</option>
                  {nutritionists.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <button className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-surface-2">
                Guardar
              </button>
            </form>
          ) : (
            <div className="flex items-end">
              <p className="text-sm text-muted">
                Nutricionista: <span className="text-text">{client.nutritionist?.fullName ?? "Sin asignar"}</span>
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Pestañas */}
      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => {
          const active = t.key === activeTab.key;
          return (
            <Link
              key={t.key}
              href={`/clientes/${client.id}?tab=${t.key}`}
              className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition ${
                active
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent text-muted hover:text-text"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {/* Contenido de la pestaña */}
      {activeTab.key === "ficha" ? (
        <FichaForm clientId={client.id} profile={client.profile} />
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="font-medium">{activeTab.label}</p>
          <p className="mt-1 text-sm text-muted">
            Disponible en {"phase" in activeTab ? activeTab.phase : "una próxima fase"} del roadmap.
          </p>
        </div>
      )}
    </div>
  );
}
