import { redirect } from "next/navigation";
import { getActiveClient } from "@/lib/client-session";
import { BrandMark } from "@/components/brand-mark";
import { ClientLoginForm } from "./login-form";

export const metadata = { title: "Entrar · Al Fallo" };

export default async function ClientLoginPage() {
  if (await getActiveClient()) redirect("/cliente");

  return (
    <main className="shell min-h-screen bg-bg text-text flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark size={48} />
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Al Fallo</h1>
          <p className="mt-1 text-sm text-muted">Tu app de nutrición</p>
        </div>
        <ClientLoginForm />
      </div>
    </main>
  );
}
