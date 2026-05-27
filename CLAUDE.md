# Al Fallo Nutrition - App

## Contexto del proyecto

Este proyecto sigue el brief fundacional descrito en `docs/prompt-app-nutricion.md`.
Léelo siempre al arrancar una sesión nueva antes de hacer cualquier cosa.

Las variables de entorno necesarias están documentadas en `docs/env-example-app-nutricion.md`.

## Qué es Al Fallo Nutrition

Plataforma SaaS de gestión de un negocio de nutrición online para atletas de CrossFit/Hyrox.
Tiene dos caras: panel del equipo (nutricionistas, comercial, dirección) y app del cliente/atleta (PWA móvil).

Está basada en una app de fisioterapia ya en producción (FisioFitCross), adaptada al dominio de la nutrición deportiva. Ver anexo de equivalencias en el brief.

## Estado actual

Proyecto recién iniciado. Aún no hay código.
Próximo paso: Fase 1 del roadmap (cimientos + auth de equipo + shell del panel).

## Stack

- Next.js 14 (App Router) + React 18 + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL (Neon)
- Vercel (hosting)
- Stripe (pagos)
- Resend (email)
- Vercel Blob (ficheros)
- Auth propia por cookie httpOnly + bcryptjs

## Convenciones

- Commits en español: `feat(modulo): ...`, `fix(modulo): ...`
- TypeScript estricto
- Server Components por defecto; `"use client"` solo cuando haga falta
- Textos de UI en español de España; código y nombres en inglés
- Permisos revalidados en cada página/server action
- Secretos solo en variables de entorno, nunca en el repo

## Roadmap

Seguir el orden de fases definido en la sección 9 del brief.
Cada fase debe quedar desplegada y funcional antes de pasar a la siguiente.