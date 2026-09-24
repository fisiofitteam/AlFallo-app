import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireProfessional } from "@/lib/session";
import { CLIENT_ACCESS_ROLES, CLIENT_STATUSES, isManagerRole } from "@/lib/clients";
import { Field, Select, TextInput } from "@/components/form-ui";
import { createClient } from "../actions";

export const metadata = { title: "Nuevo cliente · Al Fallo Nutrition" };

export default async function NewClientPage() {
  const prof = await requireProfessional();
  if (!CLIENT_ACCESS_ROLES.includes(prof.role)) redirect("/");

  const manager = isManagerRole(prof.role);
  const nutritionists = manager
    ? await prisma.professional.findMany({
        where: { isActive: true, role: { in: ["ceo", "head_coach", "nutricionista"] } },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      })
    : [];

  const statusOptions = CLIENT_STATUSES.map((s) => ({ value: s.value, label: s.label }));
  const nutritionistOptions = nutritionists.map((n) => ({ value: n.id, label: n.fullName }));

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/clientes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-primary">
        <ArrowLeft size={16} /> Clientes
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Nuevo cliente</h1>

      <form action={createClient} className="space-y-4 rounded-2xl border border-border bg-surface p-6">
        <Field label="Nombre completo" htmlFor="fullName">
          <TextInput id="fullName" name="fullName" required autoFocus />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="email">
            <TextInput id="email" name="email" type="email" />
          </Field>
          <Field label="Teléfono" htmlFor="phone">
            <TextInput id="phone" name="phone" type="tel" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Estado" htmlFor="status">
            <Select id="status" name="status" options={statusOptions} placeholder="Pendiente de revisión" />
          </Field>
          {manager && (
            <Field label="Nutricionista" htmlFor="nutritionistId">
              <Select
                id="nutritionistId"
                name="nutritionistId"
                options={nutritionistOptions}
                placeholder="Sin asignar"
              />
            </Field>
          )}
        </div>

        {!manager && (
          <p className="rounded-lg bg-primary-soft px-3 py-2 text-sm text-primary">
            El cliente se te asignará automáticamente.
          </p>
        )}

        <details className="rounded-xl border border-dashed border-border bg-bg/40 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-text">
            💼 Registrar alta y pago (opcional)
          </summary>
          <p className="mt-1 text-xs text-muted">
            Si el cliente ya ha contratado, rellena estos campos y creamos su primer
            periodo del programa a la vez. Si no, déjalo en blanco y lo añades más
            tarde desde la pestaña «Programa» de su ficha.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Duración (meses)" htmlFor="initialPeriodMonths">
              <TextInput
                id="initialPeriodMonths"
                name="initialPeriodMonths"
                type="number"
                min={1}
                max={24}
                placeholder="p. ej. 3"
              />
            </Field>
            <Field label="Fecha de inicio" htmlFor="initialStartDate">
              <TextInput id="initialStartDate" name="initialStartDate" type="date" />
            </Field>
            <Field label="Importe contratado (€)" htmlFor="initialAmountPaid">
              <TextInput
                id="initialAmountPaid"
                name="initialAmountPaid"
                type="number"
                step="0.01"
                min={0}
              />
            </Field>
            <Field label="Método de pago" htmlFor="initialPaymentMethod">
              <Select
                id="initialPaymentMethod"
                name="initialPaymentMethod"
                options={[
                  { value: "manual", label: "Manual / efectivo" },
                  { value: "transferencia", label: "Transferencia" },
                  { value: "bizum", label: "Bizum" },
                  { value: "stripe", label: "Stripe" },
                  { value: "paypal", label: "PayPal" },
                  { value: "otro", label: "Otro" },
                ]}
                placeholder="Manual"
              />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Notas (opcional)" htmlFor="initialNotes">
              <TextInput
                id="initialNotes"
                name="initialNotes"
                placeholder="Referencia de pago, condiciones, comentarios..."
              />
            </Field>
          </div>
        </details>

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/clientes" className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted hover:bg-surface-2">
            Cancelar
          </Link>
          <button
            type="submit"
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition hover:opacity-90"
          >
            Crear cliente
          </button>
        </div>
      </form>
    </div>
  );
}
