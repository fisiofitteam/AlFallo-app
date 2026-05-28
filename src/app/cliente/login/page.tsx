import { redirect } from "next/navigation";
import { getActiveClient } from "@/lib/client-session";
import { BrandMark } from "@/components/brand-mark";

export const metadata = { title: "Entrar · Al Fallo" };

export default async function ClientLoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  if (await getActiveClient()) redirect("/cliente");

  const errorMsg =
    searchParams.error === "invalid"
      ? "Email o contraseña incorrectos."
      : searchParams.error === "missing"
      ? "Introduce email y contraseña."
      : searchParams.error
      ? "No se pudo iniciar sesión. Inténtalo de nuevo."
      : null;

  return (
    <main className="shell-cliente min-h-screen bg-bg text-text flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark size={48} />
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Al Fallo</h1>
          <p className="mt-1 text-sm text-muted">Tu app de nutrición</p>
        </div>

        <form method="POST" action="/api/cliente/login" className="space-y-4">
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

          {errorMsg && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{errorMsg}</p>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-fg transition hover:opacity-90"
          >
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
