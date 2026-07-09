import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import { getCheckInFormConfig } from "@/lib/checkinFormConfig";
import { CheckInFormEditor } from "@/components/CheckInFormEditor";

export const metadata = { title: "Check-in avanzado · Biblioteca" };
export const dynamic = "force-dynamic";

export default async function CheckInFormPage() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
        Solo el equipo de nutrición puede editar el formulario de check-in avanzado.
      </p>
    );
  }
  const config = await getCheckInFormConfig();
  return <CheckInFormEditor initial={config} />;
}
