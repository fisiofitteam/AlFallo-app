# 🔐 Variables de entorno — App de Nutrición para Atletas de CrossFit

Este documento lista **todas las variables de entorno** que necesitará la nueva app,
agrupadas por servicio, con qué son, dónde conseguirlas y en qué entorno van.

> **Reglas de oro de seguridad**
> - Todo lo marcado como **SECRETO** va **solo** en variables de entorno de Vercel
>   (o en tu `.env.local`, que **nunca** se sube a git). Jamás en el repo ni en chats.
> - Añade `.env*` a `.gitignore`. Versiona únicamente un `.env.example` con valores vacíos.
> - Usa **claves de TEST** de Stripe en desarrollo y **claves LIVE** solo en producción.
> - Las variables con prefijo `NEXT_PUBLIC_` se exponen al navegador: ahí **nunca** pongas
>   un secreto.

---

## 1. Base de datos (PostgreSQL / Neon)

| Variable | Tipo | Descripción |
|---|---|---|
| `DATABASE_URL` | **SECRETO** | Cadena de conexión Postgres (pooled). En Neon: Dashboard → Connection string (con `?sslmode=require`). En dev usa una **rama** de Neon distinta a producción. |
| `DIRECT_URL` | **SECRETO** | (Opcional) Conexión directa sin pooler, para migraciones de Prisma. |

---

## 2. Autenticación / sesión

| Variable | Tipo | Descripción |
|---|---|---|
| `SESSION_SECRET` | **SECRETO** | Cadena aleatoria larga para firmar/cifrar la cookie de sesión. Genera con `openssl rand -base64 32`. |
| `APP_URL` | público | URL base de la app (ej. `https://nutriapp.vercel.app` o tu dominio). Se usa en emails y enlaces. |

---

## 3. Pagos (Stripe)

| Variable | Tipo | Descripción |
|---|---|---|
| `STRIPE_SECRET_KEY` | **SECRETO** | Clave secreta de Stripe (`sk_test_...` en dev, `sk_live_...` en prod). |
| `STRIPE_WEBHOOK_SECRET` | **SECRETO** | Secreto del endpoint de webhooks (`whsec_...`). Lo da Stripe al crear el webhook que apunta a `/api/webhooks/stripe`. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | público | Clave publicable (`pk_test_...`/`pk_live_...`) para el checkout en cliente, si lo usas. |

> Productos/precios: puedes crear los `price_xxx` en Stripe y guardarlos en BD o en env
> (ej. `STRIPE_PRICE_PLAN_3M`, `STRIPE_PRICE_PLAN_6M`). Recomendado: en BD/configurable.

---

## 4. Almacenamiento de ficheros (Vercel Blob)

| Variable | Tipo | Descripción |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | **SECRETO** | Token de lectura/escritura de Vercel Blob. Se crea en Vercel → Storage → Blob. Necesario para subir fotos de progreso, recetas y vídeos de la comunidad. |

---

## 5. Email transaccional (Resend)

| Variable | Tipo | Descripción |
|---|---|---|
| `RESEND_API_KEY` | **SECRETO** | API key de Resend (`re_...`). Para emails de bienvenida, recuperación de contraseña, avisos. |
| `EMAIL_FROM` | público | Remitente verificado, ej. `NutriApp <hola@tudominio.com>`. Requiere dominio verificado en Resend. |

---

## 6. Integración Meta (Instagram + Anuncios) — opcional, fase tardía

| Variable | Tipo | Descripción |
|---|---|---|
| `META_ACCESS_TOKEN` | **SECRETO** | Token de larga duración / System User token con permisos de Instagram Graph + Marketing API. |
| `META_IG_BUSINESS_ID` | **SECRETO** | ID de la cuenta de Instagram Business. |
| `META_AD_ACCOUNT_ID` | **SECRETO** | ID de la cuenta publicitaria (formato `act_xxxxx`). |
| `META_PAGE_ID` | **SECRETO** | (Opcional) ID de la página de Facebook vinculada. |
| `META_API_VERSION` | público | Versión del Graph API, ej. `v21.0`. |

> Estos solo hacen falta cuando construyas el módulo de Contenido/Anuncios. La app debe
> funcionar sin ellos (deshabilita el módulo si no están definidos).

---

## 7. Integraciones de calendario (opcional)

| Variable | Tipo | Descripción |
|---|---|---|
| `GOOGLE_CLIENT_ID` | **SECRETO** | OAuth client ID (si sincronizas la agenda de videollamadas con Google Calendar). |
| `GOOGLE_CLIENT_SECRET` | **SECRETO** | OAuth client secret. |
| `GOOGLE_REDIRECT_URI` | público | URL de callback OAuth, ej. `${APP_URL}/api/google/callback`. |

---

## 8. Flags de desarrollo (opcional)

| Variable | Tipo | Descripción |
|---|---|---|
| `NODE_ENV` | auto | `development` / `production` (lo gestiona Next.js/Vercel). |
| `DEV_BYPASS_AUTH` | dev | Si `true`, salta la autenticación en local para iterar rápido. **Nunca en producción.** |

---

## Plantilla `.env.example` (copia esto al repo)

```env
# ── Base de datos ──────────────────────────────────────────────
DATABASE_URL=
DIRECT_URL=

# ── Sesión / app ───────────────────────────────────────────────
SESSION_SECRET=
APP_URL=http://localhost:3000

# ── Stripe ─────────────────────────────────────────────────────
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# ── Vercel Blob ────────────────────────────────────────────────
BLOB_READ_WRITE_TOKEN=

# ── Resend (email) ─────────────────────────────────────────────
RESEND_API_KEY=
EMAIL_FROM=

# ── Meta (Instagram + Ads) — opcional ──────────────────────────
META_ACCESS_TOKEN=
META_IG_BUSINESS_ID=
META_AD_ACCOUNT_ID=
META_PAGE_ID=
META_API_VERSION=v21.0

# ── Google Calendar — opcional ─────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# ── Dev ────────────────────────────────────────────────────────
DEV_BYPASS_AUTH=false
```

---

### Orden recomendado de configuración

1. **Día 1 (cimientos):** `DATABASE_URL`, `SESSION_SECRET`, `APP_URL`.
2. **App del cliente con fotos:** `BLOB_READ_WRITE_TOKEN`.
3. **Emails (bienvenida/reset):** `RESEND_API_KEY`, `EMAIL_FROM`.
4. **Ventas:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (+ publishable si hace falta).
5. **Marketing (fase tardía):** variables de `META_*`.
6. **Agenda con Google (opcional):** variables de `GOOGLE_*`.

> En Vercel: **Project → Settings → Environment Variables**. Define cada variable para los
> entornos **Production**, **Preview** y **Development** según corresponda (las de TEST en
> Preview/Dev, las LIVE solo en Production).
