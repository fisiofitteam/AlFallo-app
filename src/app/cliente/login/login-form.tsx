"use client";

import { useFormState, useFormStatus } from "react-dom";
import { clientLogin, type ClientLoginState } from "../actions";

const initialState: ClientLoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-fg transition hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export function ClientLoginForm() {
  const [state, formAction] = useFormState(clientLogin, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none focus:border-primary"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm outline-none focus:border-primary"
        />
      </div>
      {state.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{state.error}</p>
      )}
      <SubmitButton />
    </form>
  );
}
