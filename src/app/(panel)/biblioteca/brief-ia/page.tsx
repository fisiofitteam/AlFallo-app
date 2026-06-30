import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES } from "@/lib/clients";
import { getAllSpecialConsiderations } from "@/lib/specialConsiderations";
import { SpecialConsiderationsEditor } from "@/components/SpecialConsiderationsEditor";

export const metadata = { title: "Consideraciones especiales · Biblioteca" };
export const dynamic = "force-dynamic";

/**
 * Esta página antes contenía el brief de IA + reglas IA + feedback IA.
 * Con el cambio a plantillas (la IA no genera planes desde brief) todo
 * eso quedó muerto. Solo se mantiene el CRUD de Consideraciones
 * Especiales porque los nutris las siguen marcando en la ficha del
 * cliente y se muestran en el listado y la ficha.
 *
 * La URL legacy `/biblioteca/brief-ia` se conserva para no romper enlaces
 * guardados; el label de la tab se actualiza a "Consideraciones".
 */
export default async function ConsideracionesPage() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
        Solo el equipo de nutrición puede editar las consideraciones especiales.
      </p>
    );
  }
  const specials = await getAllSpecialConsiderations();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Consideraciones especiales</h1>
        <p className="text-sm text-muted">
          Etiquetas con descripción que el nutri puede marcar en la ficha de un cliente:
          alergias frecuentes, patologías, restricciones puntuales, etc. Se ven en el listado
          de clientes y en su ficha.
        </p>
      </header>
      <SpecialConsiderationsEditor initial={specials} />
    </div>
  );
}
