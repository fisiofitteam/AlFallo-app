import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Search, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES, clientScopeWhere, statusBadgeClass, statusLabel } from "@/lib/clients";

export const metadata = { title: "Clientes · Al Fallo Nutrition" };

export default async function ClientsPage({ searchParams }: { searchParams: { q?: string } }) {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/");

  const q = (searchParams.q ?? "").trim();
  const scope = clientScopeWhere(prof);

  const clients = await prisma.client.findMany({
    where: {
      ...scope,
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { nutritionist: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Clientes</h1>
          <p className="mt-1 text-muted">
            {prof.role === "nutricionista" ? "Tus atletas asignados" : "Todos los atletas"}
          </p>
        </div>
        <Link
          href="/clientes/nuevo"
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition hover:opacity-90"
        >
          <Plus size={18} />
          Nuevo cliente
        </Link>
      </header>

      <form className="mb-5">
        <div className="relative max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre o email…"
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
      </form>

      {clients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Users size={32} className="mx-auto text-muted" />
          <p className="mt-3 font-medium">{q ? "Sin resultados" : "Aún no hay clientes"}</p>
          <p className="mt-1 text-sm text-muted">
            {q ? "Prueba con otra búsqueda." : "Crea el primero con “Nuevo cliente”."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Nutricionista</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-t border-border transition hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${c.id}`} className="block font-medium hover:text-primary">
                      {c.fullName}
                      {c.email && <span className="block text-xs text-muted">{c.email}</span>}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">
                    {c.nutritionist?.fullName ?? "Sin asignar"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(c.status)}`}
                    >
                      {statusLabel(c.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
