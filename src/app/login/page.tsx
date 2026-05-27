import { redirect } from "next/navigation";
import { getActiveProfessional } from "@/lib/session";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar · Al Fallo Nutrition" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { from?: string };
}) {
  // Si ya hay sesión válida, no mostramos el login.
  if (await getActiveProfessional()) redirect("/");

  return (
    <main className="shell min-h-screen bg-bg text-text flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark size={44} />
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Al Fallo</h1>
          <p className="mt-1 text-sm text-muted">Panel del equipo</p>
        </div>
        <LoginForm from={searchParams.from ?? "/"} />
      </div>
    </main>
  );
}
