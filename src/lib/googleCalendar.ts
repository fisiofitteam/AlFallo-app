/**
 * Helpers de alto nivel para interactuar con Google Calendar.
 *
 * Centraliza la gestión del access_token (refresca automáticamente cuando
 * expira) y proporciona métodos sencillos para leer y crear eventos en la
 * agenda compartida que el CEO conecta en Ajustes → Integraciones.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import { refreshAccessToken } from "@/lib/googleOAuth";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

// Margen de seguridad: si el token expira en menos de 60s, lo refrescamos.
const TOKEN_EXPIRY_MARGIN_MS = 60_000;

/**
 * Obtiene un access_token válido (refresca si expiró) de la primera
 * conexión Google guardada en BD.
 */
export async function getValidAccessToken(): Promise<string> {
  const conn = await prisma.googleCalendarConnection.findFirst({
    orderBy: { createdAt: "desc" },
  });
  if (!conn) {
    throw new Error("No hay Google Calendar conectado. Conéctalo en Ajustes → Integraciones.");
  }

  const now = Date.now();
  const expiresAt = conn.tokenExpiresAt.getTime();

  if (expiresAt > now + TOKEN_EXPIRY_MARGIN_MS) {
    await prisma.googleCalendarConnection.update({
      where: { id: conn.id },
      data: { lastUsedAt: new Date() },
    });
    return decrypt(conn.accessTokenEnc);
  }

  // Token expirado: refrescar.
  if (!conn.refreshTokenEnc) {
    throw new Error("Token expirado y no hay refresh_token. Reconecta Google Calendar.");
  }
  const refreshToken = decrypt(conn.refreshTokenEnc);
  const newTokens = await refreshAccessToken(refreshToken);
  const newAccess = newTokens.access_token;
  const newExpiresAt = new Date(now + newTokens.expires_in * 1000);

  await prisma.googleCalendarConnection.update({
    where: { id: conn.id },
    data: {
      accessTokenEnc: encrypt(newAccess),
      tokenExpiresAt: newExpiresAt,
      lastUsedAt: new Date(),
      ...(newTokens.refresh_token && {
        refreshTokenEnc: encrypt(newTokens.refresh_token),
      }),
    },
  });

  return newAccess;
}

async function getCalendarId(): Promise<string> {
  const conn = await prisma.googleCalendarConnection.findFirst({
    orderBy: { createdAt: "desc" },
  });
  if (!conn) throw new Error("No hay conexión Google");
  return conn.googleEmail;
}

type CalendarEventTime = {
  dateTime: string;
  timeZone?: string;
};

export type CalendarEvent = {
  id: string;
  status: string;
  summary?: string;
  description?: string;
  start: CalendarEventTime;
  end: CalendarEventTime;
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: { entryPointType: string; uri?: string }[];
  };
};

export async function listEvents(timeMinISO: string, timeMaxISO: string): Promise<CalendarEvent[]> {
  const token = await getValidAccessToken();
  const calendarId = await getCalendarId();

  const params = new URLSearchParams({
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
    showDeleted: "false",
  });

  const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar list events failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return (data.items || []) as CalendarEvent[];
}

/**
 * Crea un evento en Calendar con Google Meet automático.
 *
 * Coanfitriones del equipo Al Fallo Nutrition: si quieres que ciertos
 * miembros del equipo aparezcan en TODAS las videoconsultas como asistentes,
 * añade sus emails al array TEAM_COHOSTS. Está vacío por defecto; cuando
 * llegue el momento te lo dejaré editable desde Equipo/Biblioteca.
 */
export async function createEventWithMeet(params: {
  title: string;
  description?: string;
  startISO: string;
  endISO: string;
  timeZone?: string;
  attendeeEmail: string;
  attendeeName?: string;
}): Promise<CalendarEvent> {
  const token = await getValidAccessToken();
  const calendarId = await getCalendarId();
  const tz = params.timeZone || "Europe/Madrid";

  // Coanfitriones del equipo (vacío por ahora; rellenar cuando se necesite).
  const TEAM_COHOSTS: { email: string; name: string }[] = [];

  const leadEmailLower = params.attendeeEmail.trim().toLowerCase();
  const cohostsFiltered = TEAM_COHOSTS.filter(
    (c) => c.email.toLowerCase() !== leadEmailLower,
  );

  const attendees = [
    { email: params.attendeeEmail, displayName: params.attendeeName },
    ...cohostsFiltered.map((c) => ({ email: c.email, displayName: c.name })),
  ];

  const body = {
    summary: params.title,
    description: params.description || "",
    start: { dateTime: params.startISO, timeZone: tz },
    end: { dateTime: params.endISO, timeZone: tz },
    attendees,
    conferenceData: {
      createRequest: {
        requestId: `alfallo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    reminders: { useDefault: true },
  };

  const url = `${CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Calendar create event failed: ${res.status} ${text}`);
  }

  return res.json();
}

export function getMeetLink(event: CalendarEvent): string | null {
  if (event.hangoutLink) return event.hangoutLink;
  const entry = event.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video");
  return entry?.uri || null;
}
