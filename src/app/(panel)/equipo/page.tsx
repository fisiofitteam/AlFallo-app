import { redirect } from "next/navigation";
import { KeyRound, UserCheck, UserX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { ALL_ROLES, ROLE_LABELS, type Role } from "@/lib/roles";
import { NewMemberForm } from "./new-member-form";
import { setMemberPassword, toggleMemberActive, updateMember } from "./actions";

export const metadata = { title: "Equipo · Al Fallo Nutrition" };

export default async function TeamPage({ searchParams }: { searchParams: { error?: string } }) {
  const me = await requireProfessional();
  if (me.role !== "ceo" && me.role !== "head_coach") redirect("/");

  const members = await prisma.professional.findMany({
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
  });

  const roleOptions = ALL_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  const canManage = me.role === "ceo";
  const errorMsg =
    searchParams.error === "email-en-uso"
      ? "Ese email ya lo usa otro miembro del equipo. Cambia uno de los dos."
      : null;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold md:text-3xl">Equipo</h1>
        <p className="mt-1 text-muted">
          {canManage
            ? "Da de alta, edita y gestiona el acceso de los miembros del equipo."
            : "Listado del equipo (solo el CEO puede editar)."}
        </p>
      </header>

      {errorMsg && (
        <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</p>
      )}

      {canManage && (
        <div className="mb-8">
          <NewMemberForm roleOptions={roleOptions} />
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Miembros</h2>

      <div className="space-y-3">
        {members.map((m) => {
          const isSelf = m.id === me.id;
          return (
            <article
              key={m.id}
              className={`rounded-2xl border border-border bg-surface p-5 ${m.isActive ? "" : "opacity-60"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-base font-bold text-primary">
                    {m.fullName.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold">
                      {m.fullName}
                      {isSelf && <span className="ml-2 text-xs text-muted">(tú)</span>}
                      {!m.isActive && <span className="ml-2 text-xs text-red-600">Inactivo</span>}
                    </p>
                    <p className="text-sm text-muted">{m.email}</p>
                    {m.title && <p className="text-xs text-muted">{m.title}</p>}
                  </div>
                </div>
                <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                  {ROLE_LABELS[m.role as Role] ?? m.role}
                </span>
              </div>

              {canManage && (
                <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border pt-4 md:grid-cols-2">
                  {/* Editar nombre / rol / cargo */}
                  <form action={updateMember} className="space-y-2">
                    <input type="hidden" name="id" value={m.id} />
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Editar</p>
                    <input
                      name="fullName"
                      defaultValue={m.fullName}
                      placeholder="Nombre completo"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <input
                      name="email"
                      type="email"
                      defaultValue={m.email}
                      placeholder="Email"
                      required
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <input
                      name="title"
                      defaultValue={m.title ?? ""}
                      placeholder="Cargo (ej. Head Success Nutritionist)"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                    />
                    <select
                      name="role"
                      defaultValue={m.role}
                      disabled={isSelf}
                      title={isSelf ? "No puedes cambiar tu propio rol" : undefined}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
                    >
                      {roleOptions.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                    <button className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2">
                      Guardar cambios
                    </button>
                  </form>

                  {/* Restablecer contraseña + activar/desactivar */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Acceso</p>
                    <form action={setMemberPassword} className="flex items-end gap-2">
                      <input type="hidden" name="id" value={m.id} />
                      <input
                        name="password"
                        type="text"
                        minLength={6}
                        placeholder="Nueva contraseña (mín. 6)"
                        required
                        className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                      <button
                        title="Restablecer contraseña"
                        className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2"
                      >
                        <KeyRound size={14} /> Restablecer
                      </button>
                    </form>
                    {!isSelf && (
                      <form action={toggleMemberActive}>
                        <input type="hidden" name="id" value={m.id} />
                        <button
                          className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium ${
                            m.isActive
                              ? "border-border text-muted hover:bg-red-50 hover:text-red-600"
                              : "border-[#1fa971] text-[#1fa971] hover:bg-[#e7f6ec]"
                          }`}
                        >
                          {m.isActive ? (
                            <>
                              <UserX size={14} /> Desactivar
                            </>
                          ) : (
                            <>
                              <UserCheck size={14} /> Reactivar
                            </>
                          )}
                        </button>
                      </form>
                    )}
                    <p className="text-[11px] text-muted">
                      Al restablecer contraseña o desactivar, se cierra su sesión activa.
                    </p>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
