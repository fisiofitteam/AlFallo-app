// Tipos válidos de notificaciones in-app y helpers de preferencias.
// Los Professional pueden DESACTIVAR tipos concretos en notificationPrefs Json
// (forma: { "lead_new": false, "call_reminder": true, ... }).

export const NOTIFICATION_TYPES = [
  {
    value: "lead_new",
    label: "Lead nuevo",
    description: "Cuando llega un lead nuevo desde la landing pública.",
    defaultRoles: ["setter"],
  },
  {
    value: "lead_assigned",
    label: "Lead asignado",
    description: "Cuando el setter te asigna un lead concreto.",
    defaultRoles: ["closer", "ceo", "head_coach"],
  },
  {
    value: "call_reminder",
    label: "Recordatorio de llamada",
    description: "El día anterior a la videoconsulta agendada.",
    defaultRoles: ["closer", "ceo", "head_coach"],
  },
  {
    value: "renewal_window",
    label: "Renovación en ventana",
    description:
      "Cuando un cliente entra en la ventana de aviso de renovación (21 días).",
    defaultRoles: ["nutricionista", "head_coach", "ceo"],
  },
  {
    value: "satisfaction_submitted",
    label: "Formulario de satisfacción respondido",
    description: "Cuando un atleta envía un formulario de satisfacción.",
    defaultRoles: ["nutricionista", "head_coach", "ceo"],
  },
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]["value"];

export function isValidNotificationType(t: string): t is NotificationType {
  return NOTIFICATION_TYPES.some((n) => n.value === t);
}

// A partir de notificationPrefs (Json), devuelve los tipos DESACTIVADOS.
// Un tipo se considera desactivado si la pref es explícitamente `false`.
export function disabledTypesFromPrefs(prefs: unknown): string[] {
  if (!prefs || typeof prefs !== "object") return [];
  const obj = prefs as Record<string, unknown>;
  const disabled: string[] = [];
  for (const k of Object.keys(obj)) {
    if (obj[k] === false) disabled.push(k);
  }
  return disabled;
}
