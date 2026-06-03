import { redirect } from "next/navigation";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import { LibraryTabs } from "@/components/LibraryTabs";

// Layout compartido de toda la sección /biblioteca/*. Renderiza la cabecera
// común y los tabs. Cada subruta solo añade su contenido.
export default async function BibliotecaLayout({ children }: { children: React.ReactNode }) {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/");

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-2">
        <h1 className="text-2xl font-bold md:text-3xl">Biblioteca</h1>
        <p className="mt-1 text-muted">Todo el contenido reutilizable del equipo.</p>
      </header>
      <LibraryTabs />
      {children}
    </div>
  );
}
