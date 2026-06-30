import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import { getTemplate, type TemplateStructure, emptyStructure } from "@/lib/nutritionTemplates";
import { NutritionTemplateEditor } from "@/components/NutritionTemplateEditor";

export const metadata = { title: "Editor de plantilla · Al Fallo" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: { id: string } }) {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/");

  const tpl = await getTemplate(params.id);
  if (!tpl) redirect("/biblioteca/plantillas");

  const structure =
    (tpl.structure as unknown as TemplateStructure) ?? emptyStructure();
  // Si la estructura existe pero está vacía (días = []) ponemos la
  // estructura estándar para que el editor tenga algo que mostrar.
  const safeStructure =
    structure.days && structure.days.length > 0 ? structure : emptyStructure();

  return (
    <div className="space-y-4">
      <Link
        href="/biblioteca/plantillas"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary"
      >
        <ArrowLeft size={14} /> Volver a plantillas
      </Link>

      <NutritionTemplateEditor
        initial={{
          id: tpl.id,
          sex: tpl.sex,
          goal: tpl.goal,
          name: tpl.name,
          description: tpl.description,
          notes: tpl.notes,
          supplementation: tpl.supplementation,
          structure: safeStructure,
        }}
      />
    </div>
  );
}
