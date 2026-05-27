# Al Fallo Nutrition

Plataforma SaaS de gestión de nutrición deportiva para atletas de CrossFit/Hyrox.
Panel del equipo (Next.js) + futura PWA del cliente. Ver brief en `docs/prompt-app-nutricion.md`.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Prisma + PostgreSQL (Neon) · auth propia (cookie httpOnly + bcryptjs) · Vercel.

## Estado: Fase 1 (cimientos)

- Auth del equipo (login/logout por cookie httpOnly + sesión opaca en BD).
- Roles (`ceo`, `head_coach`, `nutricionista`, `setter`, `closer`) y navegación por rol.
- Middleware de protección + helper `lib/session.ts` (`getActiveProfessional`, `requireRole`…).
- Shell del panel responsive (sidebar + cabecera móvil + tema claro/oscuro).
- Seed de un usuario CEO.

## Puesta en marcha (local)

1. Copia las variables: `cp .env.example .env.local` y rellena al menos:
   - `DATABASE_URL` — connection string de tu rama de Neon (con `?sslmode=require`).
   - `SESSION_SECRET` — genera con `openssl rand -base64 32`.
   - `SEED_CEO_PASSWORD` — contraseña inicial del CEO (opcional; si la omites, el seed genera una temporal).
2. Instala dependencias: `npm install`.
3. Crea el esquema en la BD: `npm run db:push`.
4. Crea el CEO: `npm run db:seed`.
5. Arranca: `npm run dev` → http://localhost:3000 (redirige a `/login`).

## Scripts

| Script | Acción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | `prisma generate` + build de producción |
| `npm run db:push` | Aplica el schema a la BD (sin migraciones) |
| `npm run db:seed` | Crea/verifica el CEO inicial |
| `npm run db:studio` | Prisma Studio |

## Despliegue en Vercel

1. Sube el repo a GitHub e importa el proyecto en Vercel.
2. En **Settings → Environment Variables** define `DATABASE_URL`, `DIRECT_URL` (opcional), `SESSION_SECRET` y `APP_URL` (tu dominio de producción).
3. Vercel ejecuta `npm run build` (incluye `prisma generate`). Tras el primer deploy, ejecuta una vez `npm run db:push` y `npm run db:seed` apuntando a la BD de producción.
4. Push a `main` = despliegue automático.
