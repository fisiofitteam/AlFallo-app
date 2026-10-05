import "server-only";
import { prisma } from "@/lib/prisma";
import { monthKey } from "@/lib/finance";

/** Idempotente: para cada RecurringExpense activo cuya fecha de inicio
 *  (si tiene) ya haya llegado y cuyo día del mes ≤ hoy, crea la Transaction
 *  gasto correspondiente al mes `now` si todavía no existe. El unique
 *  `(recurringExpenseId, periodKey)` del schema garantiza no duplicar. */
export async function ensureRecurringExpensesForMonth(now = new Date()): Promise<number> {
  const period = monthKey(now);
  const today = now.getUTCDate();

  const rows = await prisma.recurringExpense.findMany({
    where: { active: true },
  });
  if (rows.length === 0) return 0;

  const existing = await prisma.transaction.findMany({
    where: {
      periodKey: period,
      recurringExpenseId: { in: rows.map((r) => r.id) },
    },
    select: { recurringExpenseId: true },
  });
  const already = new Set(existing.map((t) => t.recurringExpenseId));

  const monthStartUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  let created = 0;
  for (const r of rows) {
    if (already.has(r.id)) continue;
    // Respetamos ventana [startDate, endDate].
    if (r.startDate && r.startDate > monthStartUTC) continue;
    if (r.endDate && r.endDate < monthStartUTC) continue;
    const day = Math.min(28, Math.max(1, r.dayOfMonth));
    if (day > today) continue; // aún no ha llegado el día del mes
    const chargeDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day),
    );
    try {
      await prisma.transaction.create({
        data: {
          type: "gasto",
          category: r.category,
          description: r.description ?? r.name,
          amount: r.amount,
          date: chargeDate,
          source: "recurring",
          recurringExpenseId: r.id,
          periodKey: period,
        },
      });
      created++;
    } catch {
      // El unique nos cubre; ignoramos colisiones de carrera.
    }
  }
  return created;
}
