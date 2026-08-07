import Link from "next/link";
import { redirect } from "next/navigation";
import { LogIn, Pencil, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional, getRealProfessional } from "@/lib/session";
import { ALL_ROLES, ROLE_LABELS, type Role } from "@/lib/roles";
import { NewMemberForm } from "./new-member-form";
import { DeleteMemberButton } from "./delete-button";
import { startImpersonation, stopImpersonation } from "./impersonate-actions";

export const metadata = { title: "Equipo · Al Fallo Nutrition" };

function formatLastLogin(d: Date | null): string {
  if (!d) return "—";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - t.getTime()) / 86400000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  if (diff < 7) return `Hace ${diff} días`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export default async function TeamPage() {
  const me = await requireProfessional();
  const real = await getRealProfessional();
  // Dirección real siempre puede entrar aquí, incluso si está viendo el
  // panel como otro miembro (para poder cambiar o salir).
  const isRealCeo = real?.role === "ceo";
  if (!isRealCeo && me.role !== "ceo" && me.role !== "head_coach") redirect("/");

  const members = await prisma.professional.findMany({
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
  });

  const roleOptions = ALL_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  const canManage = isRealCeo;
  const currentImpersonatedId = me.impersonating ? me.id : null;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold md:text-3xl">Equipo</h1>
        <p className="mt-1 text-muted">Gestiona el acceso del equipo.</p>
      </header>

      {/* Botón "+ Invitar profesional" plegable, alineado a la derecha */}
      {canManage && (
        <details className="group mb-5">
          <summary className="ml-auto flex w-fit cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition hover:opacity-90 [&::-webkit-details-marker]:hidden">
            <Plus size={16} /> <span className="group-open:hidden">Invitar profesional</span>
            <span className="hidden group-open:inline">Cerrar</span>
          </summary>
          <div className="mt-3">
            <NewMemberForm roleOptions={roleOptions} />
          </div>
        </details>
      )}

      {/* Tabla de miembros */}
      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-5 py-3 font-semibold">Nombre</th>
              <th className="hidden px-5 py-3 font-semibold md:table-cell">Email</th>
              <th className="px-5 py-3 font-semibold">Rol</th>
              <th className="hidden px-5 py-3 font-semibold sm:table-cell">Estado</th>
              <th className="hidden px-5 py-3 font-semibold lg:table-cell">Último acceso</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isSelf = m.id === me.id;
              return (
                <tr key={m.id} className="border-t border-border hover:bg-surface-2/40">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                        {m.fullName.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {m.fullName}
                          {isSelf && <span className="ml-1.5 text-xs font-normal text-muted">(tú)</span>}
                        </p>
                        {m.title && <p className="truncate text-xs text-muted">{m.title}</p>}
                        {/* Email en móvil bajo el nombre */}
                        <p className="truncate text-xs text-muted md:hidden">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-5 py-4 text-muted md:table-cell">{m.email}</td>
                  <td className="px-5 py-4">
                    <span className="inline-block rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-700">
                      {ROLE_LABELS[m.role as Role] ?? m.role}
                    </span>
                  </td>
                  <td className="hidden px-5 py-4 sm:table-cell">
                    {m.isActive ? (
                      <span className="inline-block rounded-full bg-[#e7f6ec] px-2.5 py-0.5 text-xs font-medium text-[#15803d]">
                        ✓ Activo
                      </span>
                    ) : (
                      <span className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                        Inactivo
                      </span>
                    )}
                  </td>
                  <td className="hidden px-5 py-4 text-muted lg:table-cell">{formatLastLogin(m.lastLoginAt)}</td>
                  <td className="px-3 py-4">
                    {canManage ? (
                      <div className="flex items-center justify-end gap-1">
                        {!isSelf && m.isActive && (
                          m.id === currentImpersonatedId ? (
                            <form action={stopImpersonation}>
                              <button
                                type="submit"
                                className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-200"
                              >
                                Salir
                              </button>
                            </form>
                          ) : (
                            <form action={startImpersonation}>
                              <input type="hidden" name="professionalId" value={m.id} />
                              <button
                                type="submit"
                                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary-soft"
                              >
                                <LogIn size={13} /> Entrar como
                              </button>
                            </form>
                          )
                        )}
                        <Link
                          href={`/equipo/${m.id}`}
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition hover:bg-surface-2 hover:text-text"
                        >
                          <Pencil size={13} /> Editar
                        </Link>
                        {!isSelf && <DeleteMemberButton id={m.id} name={m.fullName} />}
                      </div>
                    ) : (
                      <span />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
