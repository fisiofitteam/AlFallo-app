import "server-only";

// Helpers OAuth Google (sin SDK pesado: fetch directo al endpoint de tokens).
// Tabla del bundle: el refreshToken vive en BD (cifrado con lib/encryption);
// cuando el accessToken caduca, llamamos a refreshAccessToken para renovar.

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export type RefreshedTokens = {
  access_token: string;
  expires_in: number; // segundos hasta que caduca
  refresh_token?: string; // a veces Google devuelve uno nuevo; si no, mantén el viejo
  scope?: string;
  token_type?: string;
};

export async function refreshAccessToken(refreshToken: string): Promise<RefreshedTokens> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Faltan GOOGLE_CLIENT_ID o GOOGLE_CLIENT_SECRET en el entorno");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google OAuth refresh falló (${res.status}): ${text || res.statusText}`);
  }
  return (await res.json()) as RefreshedTokens;
}

// Genera la URL de autorización para el "Conectar Google Calendar" del CEO.
// scope incluye calendar (read+write) + offline para obtener refresh token.
export function buildAuthUrl(state?: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error("Faltan GOOGLE_CLIENT_ID o GOOGLE_REDIRECT_URI en el entorno");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "consent", // garantiza que devuelva refresh_token la primera vez
    include_granted_scopes: "true",
    ...(state ? { state } : {}),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Intercambia el `code` del callback por tokens.
export async function exchangeCode(code: string): Promise<RefreshedTokens & { refresh_token: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Faltan variables de Google OAuth en el entorno");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google OAuth exchange falló (${res.status}): ${text || res.statusText}`);
  }
  const json = (await res.json()) as RefreshedTokens;
  if (!json.refresh_token) {
    throw new Error("Google no devolvió refresh_token; revisa que el flow use prompt=consent");
  }
  return json as RefreshedTokens & { refresh_token: string };
}

// Devuelve el email de la cuenta Google asociada al access token.
export async function getGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error("No se pudo leer el email de la cuenta Google");
  }
  const data = (await res.json()) as { email?: string };
  if (!data.email) throw new Error("La respuesta de Google no contiene email");
  return data.email;
}
