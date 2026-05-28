import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, KeyRound, UserCheck, UserX } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { ALL_ROLES, ROLE_LABELS, type Role } from "@/lib/roles";
import { Field, TextInput } from "@/components/form-ui";
import { DeleteMemberButton } from "../delete-button";
import { setMemberPassword, toggleMemberActive, updateMember } from "../actions";

export const metadata = { title: "Editar miembro · Al Fallo Nutrition" };

export default async function EditMemberPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const me = await requireProfessional();
  if (me.role !== "ceo") redirect("/");

  const m = await prisma.professional.findUnique({ where: { id: params.id } });
  if (!m) redirect("/equipo");

  const isSelf = m.id === me.id;
  const roleOptions = ALL_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
  const errorMsg =
    searchParams.error === "email-en-uso"
      ? "Ese email ya lo usa otro miembro del equipo."
      : null;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/equipo"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary"
      >
        <ArrowLeft size={16} /> Equipo
      </Link>

      <header className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-xl font-bold text-primary">
          {m.fullName.slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{m.fullName}</h1>
          <p className="text-sm text-muted">
            {ROLE_LABELS[m.role as Role] ?? m.role}
            {m.title && ` · ${m.title}`}
            {!m.isActive && <span className="ml-2 text-red-600">· Inactivo</span>}
          </p>
        </div>
      </header>

      {errorMsg && (
        <p className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMsg}</p>
      )}

      {/* ── Datos generales ─────────────────────────────────── */}
      <form action={updateMember} className="mb-6 space-y-4 rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Datos</h2>
        <input type="hidden" name="id" value={m.id} />
        <Field label="Nombre completo" htmlFor="fullName">
          <TextInput id="fullName" name="fullName" defaultValue={m.fullName} required />
        </Field>
        <Field label="Email" htmlFor="email">
          <TextInput id="email" name="email" type="email" defaultValue={m.email} required />
        </Field>
        <Field label="Cargo" htmlFor="title" hint="Texto libre (ej. Head Success Nutritionist)">
          <TextInput id="title" name="title" defaultValue={m.title ?? ""} />
        </Field>
        <Field label="Rol" htmlFor="role" hint={isSelf ? "No puedes cambiar tu propio rol." : undefined}>
          <select
            id="role"
            name="role"
            defaultValue={m.role}
            disabled={isSelf}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-60"
          >
            {roleOptions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end">
          <button className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition hover:opacity-90">
            Guardar cambios
          </button>
        </div>
      </form>

      {/* ── Acceso ──────────────────────────────────────────── */}
      <section className="mb-6 space-y-4 rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Acceso</h2>
        <form action={setMemberPassword} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={m.id} />
          <div className="min-w-[220px] flex-1">
            <Field label="Restablecer contraseña" htmlFor="password" hint="Mínimo 6 caracteres. Cierra su sesión activa.">
              <TextInput id="password" name="password" type="text" minLength={6} required />
            </Field>
          </div>
          <button className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface-2">
            <KeyRound size={15} /> Restablecer
          </button>
        </form>

        {!isSelf && (
          <form action={toggleMemberActive}>
            <input type="hidden" name="id" value={m.id} />
            <button
              className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-medium ${
                m.isActive
                  ? "border-border text-muted hover:bg-red-50 hover:text-red-600"
                  : "border-[#1fa971] text-[#1fa971] hover:bg-[#e7f6ec]"
              }`}
            >
              {m.isActive ? (
                <>
                  <UserX size={15} /> Desactivar acceso
                </>
              ) : (
                <>
                  <UserCheck size={15} /> Reactivar acceso
                </>
              )}
            </button>
          </form>
        )}
      </section>

      {/* ── Zona peligrosa ──────────────────────────────────── */}
      {!isSelf && (
        <section className="rounded-2xl border border-red-200 bg-red-50/30 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-red-700">Eliminar del equipo</h2>
          <p className="mb-3 mt-1 text-sm text-muted">
            Esto borra al miembro. Los clientes que tuviera asignados quedarán "sin asignar" y los planes/check-ins
            que creó se conservan sin atribución. No se puede deshacer.
          </p>
          <DeleteMemberButton id={m.id} name={m.fullName} variant="full" />
        </section>
      )}
    </div>
  );
}
