import { redirect } from "next/navigation";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import { getMacroBrief } from "@/lib/macroBrief";
import { MacroBriefEditor } from "@/components/MacroBriefEditor";

export const metadata = { title: "Brief macros IA · Biblioteca" };
export const dynamic = "force-dynamic";

export default async function BriefMacrosPage() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/biblioteca");

  const brief = await getMacroBrief();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Brief macros IA</h1>
        <p className="max-w-2xl text-sm text-muted">
          Aquí subes las tablas de equivalencias, listas de alimentos y notas que quieres que la IA
          use al calcular macros. Se inyecta en el prompt del estimador en cada opción de plantilla
          y en cada &quot;Recalcular macros&quot; del plan del cliente.
        </p>
      </header>
      <MacroBriefEditor
        initial={{ notes: brief.notes, attachments: brief.attachments }}
      />
    </div>
  );
}
