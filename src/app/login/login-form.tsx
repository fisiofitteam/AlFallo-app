"use client";

import { useFormState, useFormStatus } from "react-dom";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-fg transition hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export function LoginForm({ from }: { from: string }) {
  const [state, formAction] = useFormState(login, initialState);

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-border bg-surface p-6">
      <input type="hidden" name="from" value={from} />

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
          className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-primary"
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
          className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{state.error}</p>
      )}

      <SubmitButton />
    </form>
  );
}
