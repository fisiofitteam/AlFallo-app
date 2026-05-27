# 🥗 PROMPT MAESTRO — App de Nutrición para Atletas de CrossFit

> **Cómo usar este documento:** pega todo este contenido como **primer mensaje** a tu
> agente de desarrollo (Claude Code u otro). Es el "brief fundacional" del proyecto:
> describe la visión, el stack, el modelo de datos, los módulos y el orden de
> construcción. Está basado en una app de gestión de fisioterapia online ya en
> producción, adaptado al dominio de la nutrición deportiva. No hace falta construirlo
> todo de golpe: el agente debe seguir el **roadmap por fases** del final.

---

## 1. ROL Y MISIÓN DEL AGENTE

Eres un ingeniero de software senior full-stack. Vas a construir, desde cero y de forma
incremental, **una plataforma SaaS de gestión de un negocio de nutrición online para
atletas de CrossFit**. La plataforma tiene dos grandes caras:

1. **Panel del equipo** (nutricionistas, comercial, dirección): CRM de ventas,
   gestión de clientes, creación de planes nutricionales, seguimiento, finanzas,
   contenido de marketing y comunidad.
2. **App del cliente/atleta** (PWA móvil): su plan nutricional, registro diario,
   seguimiento de progreso, check-ins, comunidad y formación.

Trabaja como un compañero técnico de un fundador **no técnico**: explica decisiones en
lenguaje claro, propón valores por defecto sensatos, y prioriza que cada incremento
quede **desplegado y funcionando** antes de seguir.

---

## 2. VISIÓN DE PRODUCTO Y USUARIO OBJETIVO

- **Cliente final:** atleta de CrossFit (amateur o competidor) que contrata un servicio
  de **nutrición online personalizada** para mejorar composición corporal, rendimiento
  y energía. Entrena 3–7 días/semana, le importan los macros, el timing nutricional
  alrededor de los WODs y los picos de competición.
- **Negocio:** equipo pequeño (1 CEO + nutricionistas + comercial) que capta leads por
  redes/ADS, los cierra en videollamada, cobra por Stripe, y da servicio recurrente con
  planes, revisiones y una comunidad.
- **Propuesta de valor de la plataforma:** centralizar **venta → onboarding → plan →
  seguimiento → renovación** y dar al atleta una experiencia premium tipo app.

---

## 3. STACK TÉCNICO Y ARQUITECTURA

Usa **exactamente** este stack (probado en producción para este tipo de app):

| Capa | Tecnología |
|---|---|
| Framework | **Next.js 14 (App Router)** + React 18 + TypeScript |
| Estilos | **Tailwind CSS** (+ variables CSS para theming) |
| Iconos | **lucide-react** |
| Gráficas | **recharts** |
| ORM / BD | **Prisma** + **PostgreSQL** (Neon en producción) |
| Hosting | **Vercel** |
| Ficheros (fotos/vídeos) | **@vercel/blob** (subida directa cliente→Blob para archivos grandes) |
| Pagos | **Stripe** (Checkout + webhooks + payment links) |
| Email | **Resend** |
| Auth | Sesión propia por **cookie httpOnly** + **bcryptjs**; middleware de protección |
| Drag & drop | **@dnd-kit** (para ordenar planes/comidas/contenido) |
| Fechas | API nativa `Intl`/`toLocaleDateString("es-ES")` (sin librería pesada) |

### Decisiones de arquitectura (aprendidas, respétalas)

- **App Router con Server Components por defecto.** Haz `fetch`/Prisma en server
  components; añade `"use client"` solo donde haya interacción/estado.
- **Una sola fuente de datos Postgres** para dev y prod (usa una **rama de Neon** para
  desarrollo). ⚠️ *No* uses SQLite en local para evitar divergencias de schema (campos
  `Json`, etc.). Esto simplifica el flujo respecto a apps anteriores.
- **Roles y permisos centralizados** en un helper de sesión (`lib/session.ts`,
  `lib/auth.ts`). Cada página/server action revalida permisos; el middleware solo
  comprueba que existe cookie.
- **PWA móvil para el cliente:** layout aparte (`/app/cliente/...`) con su propio shell,
  navegación inferior y branding. Theming por variables CSS (`--c-*`) con modo claro/oscuro.
- **Theming del panel** por una clase raíz (`.shell.dark`) que remapea colores en un
  único sitio del CSS global.
- **Exportar a PDF** mediante página imprimible + `@media print` + "Guardar como PDF"
  del navegador (fiable en Vercel, sin dependencias pesadas).
- **Integración Meta** (Instagram Graph + Marketing API) vía variables de entorno; los
  **tokens son secretos** y van solo en variables de entorno de Vercel, **nunca** en el
  repo ni en el chat.
- **Notificaciones**: tabla de notificaciones por persona + un registro central de tipos
  de notificación; preferencias activables por usuario.
- **Convenciones de commit:** mensajes en español tipo `feat(modulo): ...`. Despliegue
  continuo en Vercel al hacer push a `main`.

---

## 4. ROLES Y PERMISOS

Modelo de roles (string en el modelo `Professional`, más el `Client`/atleta aparte):

| Rol | Descripción | Acceso |
|---|---|---|
| `ceo` | Dirección/fundador. Superadmin. | Todo + finanzas + impersonación de cualquier miembro |
| `head_coach` | Responsable de éxito de cliente / coordinación nutricional | Todos los clientes + equipo |
| `nutricionista` | Nutricionista que lleva a sus clientes asignados | Solo SUS clientes |
| `setter` | Cualifica leads entrantes | CRM (su parte) |
| `closer` | Cierra ventas en videollamada | CRM ventas + follow-up |
| `cliente` (atleta) | Usuario final | Solo su propia app |

- **Managers** = `ceo` + `head_coach` (ven todo; ciertas métricas como dificultad/coste
  solo managers).
- **Superadmin/Impersonación:** el `ceo` puede "entrar como" cualquier miembro o cliente
  para ver su panel tal cual (con banner de impersonación).
- **Métricas sensibles** (sueldos, CAC, importes, márgenes) **solo visibles para el CEO**.

---

## 5. MODELO DE DATOS (núcleo, adaptado a nutrición)

Diseña el schema Prisma alrededor de estas entidades. (La app original tiene ~76
modelos; aquí va el núcleo conceptual — el agente irá ampliando por fases.)

### Identidad y equipo
- **Professional**: `id, fullName, email, passwordHash, role, isActive, ...`
- **Client** (atleta): datos personales + **ficha nutricional** (ver abajo) +
  estado de suscripción + onboarding + nutricionista asignado.
- **Session/LoginCode**: auth de equipo y de cliente.

### Ficha nutricional (en `Client` o tabla aparte `NutritionProfile`)
- Antropometría: `sex, birthDate, heightCm, weightKg, bodyFatPct, perímetros (cintura,
  cadera, brazo...)`.
- Deporte: `boxName, yearsTraining, weeklyFrequency, level (amateur/scaled/RX/competición),
  horario de entrenos`.
- Restricciones: `allergies, intolerances, dislikes, dietaryStyle (omnívoro/vegano/...),
  supplements, medicalConditions, medication`.
- Objetivo: `goal (pérdida grasa / recomposición / ganancia masa / rendimiento /
  definición pre-competición), targetWeight, timeframe`.

### Plan nutricional (análogo a "programa")
- **NutritionPlan** (`Program`): nombre, objetivo, fases, duración en semanas.
- **PlanPhase / PlanWeek / PlanDay** (`ProgramWeek/Day`): estructura del plan por fases
  y días.
- **Meal** (comida): nombre (desayuno, pre-WOD, post-WOD, comida, cena, snacks),
  alimentos, gramajes, y **macros calculados** (kcal, proteína, carbos, grasa).
- **PlanAssignment** (`ProgramAssignment`): plan asignado a un cliente, fechas, activo.
- **MacroTargets**: objetivos diarios de kcal/macros del cliente (pueden variar por día
  de entreno vs descanso).
- **FoodLibrary / RecipeLibrary** (`ExerciseLibrary`): banco de alimentos y recetas con
  macros por 100g/ración (reutilizable al montar planes). Categorías de alimentos
  (`MovementCategory` → `FoodGroup`).
- **NutritionProfileTemplate** (`ClinicalProfile/Level`): perfiles/objetivos tipo con
  reglas (ej. rangos de macros por objetivo y peso) que pre-rellenan un plan.

### Seguimiento del cliente
- **DailyLog** (`WodLog`): registro diario del atleta — comidas realizadas, adherencia,
  peso del día, energía, hambre, sueño, digestión, rendimiento percibido. **Lo que el
  atleta escribe libremente** se guarda íntegro (no solo notas resumidas).
- **CheckIn** (`ProgramSession` con formulario): check-in semanal — peso, fotos de
  progreso, perímetros, adherencia %, notas; el nutricionista lo **revisa** y responde.
- **ClientMetric + MetricEntry** (`PatientMetric/MetricEntry`): métricas de evolución
  (peso, % grasa, perímetros, fuerza, benchmarks tipo "Fran", energía, etc.) con
  histórico para graficar.
- **FoodRestriction** (`PatientAdaptation`): alérgenos/intolerancias/alimentos vetados
  que el sistema respeta al generar/adaptar el plan.
- **ConsultationCase** (`ClinicalSessionCase`): casos/consultas en seguimiento
  (situación, propuestas, solución consensuada).

### Onboarding y legal
- **OnboardingConfig**: cuestionario nutricional inicial **editable** por pasos +
  texto de contrato editable y versionado.
- En `Client`: `anamnesisData (JSON), anamnesisCompletedAt, contractSignedAt,
  contractDNI, contractVersion, contractTextSnapshot (evidencia legal), onboardingTasks`.
- Gate de acceso a la app del cliente = cuestionario + contrato firmados.

### Ventas / CRM (idéntico al original)
- **Lead, ScheduledCall, Sale, SubscriptionRenewal, RenewalCheckout**: lead → llamada →
  cierre → pago Stripe → cliente → renovaciones por enlace.
- Estados de llamada incluyen **follow-up** como resultado (con fechas de re-contacto
  personalizables: 24h, 48-72h, 30d, 90d) y campo "situación/objeciones".

### Negocio / finanzas
- **Transaction** (ingresos/gastos con etiquetas), **Compensation/PayrollPayment**
  (sueldos del equipo), **BusinessMonthlyInput/QuarterlyGoal** (cuadro de mandos),
  **AdCampaignTag** + métricas Meta (seguidores, ADS, posts).

### Contenido y comunidad
- **ContentWeek/ContentPiece** (planificación de contenido de Instagram), **ScriptTemplate,
  WeeklyTemplate, WinningHook, ContentIdea**.
- **CommunityFeedPost/Comment/Reaction** (muro estilo Twitter con foto/vídeo, insignia de
  verificación para el equipo) + **CommunityModule/Section/Lesson/Progress** (cursos /
  "Clases").

### Notificaciones
- **TeamNotification / ClientNotification** + preferencias por persona.

---

## 6. MÓDULOS Y FUNCIONALIDADES

### A. Panel del equipo (`/app/equipo` o `/panel`)

1. **CRM de ventas**
   - Bandeja de leads (origen: landing pública, ADS, manual).
   - Agenda de videollamadas; vista por closer; el CEO ve todos.
   - Resultado de llamada: vendida / perdida (con razón) / cancelada / no acude /
     **follow-up**. Los leads en follow-up salen de "agendadas" y aparecen en su vista,
     con fechas de re-contacto personalizables y situación/objeciones.
   - Cierre → genera **link de pago Stripe** → al pagar se crea el `Client`.
   - **Renovaciones** por enlace y seguimiento de altas/bajas.

2. **Clientes** (lista + ficha por cliente con pestañas):
   - **Plan actual** (calendario/estructura del plan nutricional asignado).
   - **Restricciones** (alérgenos/intolerancias/vetos que adaptan el plan).
   - **Evolución** (gráficas de peso, % grasa, perímetros, rendimiento, fotos).
   - **Ficha nutricional** (antropometría, deporte, objetivo, hábitos).
   - **Suscripción** (inicio, periodos, renovaciones, pausas; importes **solo CEO**).
   - **Formularios / Check-ins** (valoración inicial + check-ins semanales, plegables).
   - **Consultas** (casos en seguimiento).
   - **Botón "Ir a otro cliente"** (buscador siempre visible dentro de un cliente).
   - **Exportar PDF**: informe completo del cliente (ficha, restricciones, evolución,
     planes, check-ins, valoración, contrato). Las **finanzas solo para el CEO**; métricas
     de manager solo para managers.

3. **Biblioteca** (recursos reutilizables, solo equipo): banco de **alimentos y recetas**
   con macros, **plantillas de plan**, **perfiles nutricionales** (objetivos con reglas de
   macros), **métricas**, **formularios/check-ins**, **onboarding** (cuestionario + contrato
   editables), **landings**, **mensajes/plantillas**, **vídeos**.

4. **Contenido** (marketing en Instagram): planificación semanal de piezas (reel/carrusel/
   story), guiones y plantillas, banco de ideas, "para grabar", **métricas conectadas con
   Meta** (alcance, guardados, etc.) y vinculación pieza↔post.

5. **Finanzas / Cuadro de mandos** (CEO): ingresos/gastos con etiquetas, **CAC** (incluye
   sueldo del comercial), **LTV**, vista por meses, objetivos trimestrales, y **panel de
   Anuncios** (integración Meta: seguidores, inversión, resultados).

6. **Comunidad** (gestión), **Equipo** (altas/roles/sueldos), **Tareas**, **Reuniones**,
   **Ajustes** (perfil, integraciones, **notificaciones** activables por persona, theming).

### B. App del cliente/atleta (PWA, `/app/cliente/[id]`)

1. **Inicio**: resumen del día (macros objetivo vs registrado), accesos rápidos,
   botón de WhatsApp de su nutricionista.
2. **Mi plan**: plan nutricional por días/comidas con macros; pre/post-WOD destacados.
3. **Registro diario** (análogo al "diario de WOD"): el atleta registra comidas,
   adherencia, peso, energía, hambre, sueño; ve sus macros del día.
4. **Mi progreso**: gráficas de peso/composición/rendimiento + galería de fotos.
5. **Check-in semanal**: formulario guiado (peso, fotos, perímetros, adherencia, notas)
   que el nutricionista revisa.
6. **Comunidad / Clases**: muro estilo Twitter (foto/vídeo, insignia para el equipo) +
   cursos de nutrición/hábitos.
7. **Onboarding** (gate): cuestionario nutricional + firma de contrato.

### C. Públicas
- **Landing de captación** + **agenda pública** de videollamadas.
- **Flujo de pago** (`/pagar`, gracias) y **renovación** (`/renovar`).
- **Login** equipo y cliente; recuperación de contraseña.

---

## 7. BRANDING Y UX

- Estética **premium y deportiva**, mobile-first para el cliente. Tarjetas redondeadas,
  buen contraste, microinteracciones discretas.
- **Theming claro/oscuro** configurable; la app del cliente con branding propio.
- Copys en **español de España**, cercanos pero profesionales.
- Datos de salud → tratar conforme a **RGPD**; avisos legales donde corresponda.

---

## 8. CONVENCIONES DE DESARROLLO

- TypeScript estricto; componentes pequeños y legibles; nombres en inglés en código,
  textos de UI en español.
- Server Components por defecto; `"use client"` solo cuando haga falta.
- Permisos revalidados en cada página/acción de servidor.
- Migraciones con `prisma db push` (dev en rama Neon) y despliegue automático en Vercel
  al hacer push a `main`.
- Commits `feat(...)/fix(...)` en español. Cada feature: **build verde + desplegado**.
- Secretos (Stripe, Meta, Blob, Resend) **solo** en variables de entorno.

---

## 9. ROADMAP POR FASES (orden de construcción)

Construye en este orden, dejando cada fase **desplegada y usable** antes de seguir:

1. **Cimientos**: proyecto Next.js + Tailwind + Prisma + Neon + Vercel. Auth de equipo
   (login, sesión por cookie, roles, middleware). Layout/shell del panel con navegación
   por rol. Modelo `Professional` + seed de un CEO.
2. **Clientes (núcleo)**: modelo `Client` + ficha nutricional + lista + ficha con pestañas
   vacías. Asignación de nutricionista.
3. **Planes nutricionales**: biblioteca de alimentos/recetas con macros, creación de planes
   (fases/días/comidas) con cálculo de macros, asignación a cliente.
4. **App del cliente (PWA)**: login cliente, onboarding (cuestionario + contrato), "Mi plan",
   registro diario, "Mi progreso".
5. **Seguimiento**: check-ins semanales + revisión por el nutricionista; métricas de
   evolución con gráficas; restricciones que adaptan el plan.
6. **CRM de ventas**: leads, agenda de llamadas, cierre, **Stripe** (pago + webhook),
   conversión a cliente, follow-up, renovaciones.
7. **Comunidad y Clases**: muro + cursos.
8. **Finanzas / Cuadro de mandos**: transacciones, CAC/LTV, objetivos.
9. **Contenido + Meta**: planificación de Instagram + integración de métricas/ADS.
10. **Pulido**: notificaciones, exportación a PDF, impersonación del CEO, theming,
    preferencias, optimización móvil.

---

## 10. PRIMER ENTREGABLE CONCRETO

Empieza por la **Fase 1**:

1. Inicializa el repo Next.js 14 (App Router, TS, Tailwind), configura Prisma con Postgres
   (Neon) y prepara el deploy en Vercel.
2. Crea el modelo `Professional` (con `role`) y `Session`/auth por cookie + `bcryptjs`.
3. Implementa login del equipo, middleware de protección y un helper `lib/session.ts` con
   `getActiveProfessional()` y comprobación de roles.
4. Crea el **shell del panel** con navegación lateral que cambia según el rol y una página
   de inicio simple.
5. Añade un script de **seed** que cree un usuario CEO inicial.
6. Deja todo **desplegado en Vercel** y dame las instrucciones para entrar.

Antes de escribir código, **resume tu plan de la Fase 1** y enumérame las decisiones que
vas a tomar (nombres de modelos, estructura de carpetas, variables de entorno necesarias).
Pregúntame solo lo imprescindible; para lo demás, elige valores por defecto sensatos y
sigue adelante.

---

### Anexo — Mapa de equivalencias (fisioterapia → nutrición)

| App original (fisio) | App de nutrición |
|---|---|
| Paciente | Cliente / Atleta |
| Fisioterapeuta | Nutricionista |
| Ficha clínica | Ficha nutricional (antropometría, objetivo, hábitos) |
| Programa / sesiones | Plan nutricional / comidas por día |
| Movimientos + adaptaciones | Alimentos/recetas + restricciones (alérgenos/intolerancias) |
| WOD adapter (diario de WOD) | Registro diario de comidas + macros |
| Métricas de evolución (dolor, RPE) | Peso, % grasa, perímetros, rendimiento, fotos |
| Anamnesis | Cuestionario nutricional inicial |
| Formularios de sesión | Check-ins semanales |
| Perfiles clínicos / niveles | Perfiles de objetivo + reglas de macros |
| Biblioteca de ejercicios | Banco de alimentos y recetas |
| Comunidad + Classroom | Comunidad + Clases (cursos de nutrición) |
| CRM, finanzas, contenido, Meta | (idénticos) |
