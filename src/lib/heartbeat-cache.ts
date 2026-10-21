import "server-only";

// Cache en memoria por request-lifecycle del proceso para evitar ejecutar
// jobs de "heartbeat" (ensureRenewalNotifications, ensureRecurringExpenses…)
// en cada visita. En serverless cada Lambda tiene su propia memoria, así
// que esto da una ganancia dentro del mismo lambda caliente — justo lo
// que queremos para que una navegación encadenada no re-dispare el job.
//
// Si el proceso se congela y el lambda muere, el TTL caducará y la próxima
// navegación en caliente volverá a dispararlo. Suficiente para este caso.

type Entry = { expires: number; promise: Promise<unknown> };
const store = new Map<string, Entry>();

/**
 * Ejecuta `fn()` como mucho una vez cada `ttlMs` milisegundos por `key`.
 * Si llega una segunda llamada antes del TTL, se devuelve la promesa en
 * curso (deduplicación). Nunca lanza — captura y traga errores devolviendo
 * undefined (los heartbeats no deben romper la página).
 */
export async function withHeartbeatCache<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  const now = Date.now();
  const existing = store.get(key);
  if (existing && existing.expires > now) {
    try {
      return (await existing.promise) as T;
    } catch {
      return undefined;
    }
  }
  const promise = fn().catch(() => undefined as T | undefined) as Promise<T>;
  store.set(key, { expires: now + ttlMs, promise });
  try {
    return await promise;
  } catch {
    return undefined;
  }
}
