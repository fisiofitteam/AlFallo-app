"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { createTeamMember, type CreateTeamMemberState } from "./actions";

const initial: CreateTeamMemberState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition hover:opacity-90 disabled:opacity-60"
    >
      <Plus size={16} /> {pending ? "Creando…" : "Crear miembro"}
    </button>
  );
}

export function NewMemberForm({
  roleOptions,
}: {
  roleOptions: { value: string; label: string }[];
}) {
  const [state, formAction] = useFormState(createTeamMember, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // Limpia el formulario tras crear con éxito.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  const baseField =
    "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary";

  return (
    <form ref={formRef} action={formAction} className="rounded-2xl border border-border bg-surface p-5">
      <p className="mb-3 text-sm font-semibold">Añadir miembro al equipo</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="space-y-1.5">
          <span className="block text-sm font-medium">Nombre completo</span>
          <input name="fullName" required className={baseField} placeholder="Jess Moya" />
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-medium">Email</span>
          <input name="email" type="email" required className={baseField} placeholder="jess@alfallo.com" />
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-medium">Rol</span>
          <select name="role" required defaultValue="" className={baseField}>
            <option value="" disabled>
              Selecciona un rol…
            </option>
            {roleOptions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="block text-sm font-medium">Cargo (opcional)</span>
          <input
            name="title"
            className={baseField}
            placeholder="Ej. Head Success Nutritionist"
          />
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-medium">Contraseña inicial</span>
          <input
            name="password"
            type="text"
            minLength={6}
            className={baseField}
            placeholder="Déjala vacía para generar una"
          />
        </label>
      </div>

      {state.error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">{state.error}</p>
      )}

      {state.success && (
        <div className="mt-3 rounded-lg bg-primary-soft px-3 py-2 text-sm text-primary">
          <p className="font-semibold">✓ Miembro creado: {state.success.fullName}</p>
          <p>
            Email: <span className="font-mono">{state.success.email}</span>
          </p>
          <p>
            Contraseña: <span className="font-mono font-semibold">{state.success.password}</span>{" "}
            <span className="text-xs">(pásale estos datos para que entre y la cambie)</span>
          </p>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <div className="w-full sm:w-auto">
          <Submit />
        </div>
      </div>
    </form>
  );
}
