# 📚 Referencias del panel anterior (Al Fallo)

> **Qué es este documento:** Inventario de decisiones de producto y modelo de datos extraídas de un panel de Al Fallo previamente desarrollado por un externo en otro stack (Vite + Supabase + Lovable). **Ese código NO se reutiliza.** Lo que sí se reutiliza es el conocimiento de dominio: qué tablas existían, qué pantallas tenía, qué integraciones, qué decisiones de UX. Sirve como inspiración y mapa para construir la versión definitiva en Next.js 14 + Prisma + Neon descrita en `prompt-app-nutricion.md`.
>
> **Cómo usar este documento:** Cuando construyas un módulo nuevo, busca aquí la sección equivalente y úsala como referencia conceptual. Adapta los nombres y la estructura a las convenciones del prompt maestro (inglés en código, español en UI, naming consistente con el resto del schema Prisma).

---

## 1. Stack del panel anterior (referencia, NO replicar)

- Vite + React 18 + TypeScript
- shadcn/ui + Tailwind CSS
- Supabase (Postgres + Auth + Edge Functions + Storage)
- React Router v6 + TanStack Query
- Despliegue en Lovable (`nutrialfallo.lovable.app`)
- Integraciones externas:
  - **OneSignal** para push notifications
  - **n8n** como orquestador de workflows IA (webhooks para chat IA, estimación de macros, recetas)
  - **Google Calendar** vía OAuth para sincronizar citas
  - **Lovable AI gateway** para estimar macros desde texto

> En la versión definitiva con Next.js + Prisma + Neon, todo esto se sustituye por:
> auth propia con cookie + bcryptjs, push web nativas o Firebase, integraciones IA directas con OpenAI/Anthropic, Google Calendar también vía OAuth pero implementado en Next.js.

---

## 2. Pantallas del panel del nutricionista (mapa de funcionalidad)

El panel anterior tenía **14 páginas**. Esto te dice qué pantallas necesitas como mínimo en la nueva versión:

| Página | Propósito | Equivalente en prompt maestro |
|---|---|---|
| `LoginPage` | Login del nutricionista | Auth equipo (Fase 1) |
| `RegisterNutritionistPage` | Alta de nuevo nutricionista | Gestión Equipo (Fase 1 + módulo Equipo) |
| `Index` | Dashboard de inicio | Shell del panel (Fase 1) |
| `ClientsPage` | Lista de clientes | Clientes (Fase 2) |
| `ClientPage` | Ficha de cliente con pestañas | Clientes - ficha (Fase 2) |
| `NutritionalPlanPage` | Crear/editar plan nutricional del cliente | Planes nutricionales (Fase 3) |
| `AlimentosPage` | Biblioteca de alimentos y lista de compra | Biblioteca - alimentos (Fase 3) |
| `CheckinsPage` | Revisión de check-ins semanales | Seguimiento (Fase 5) |
| `InBodyPage` | Subida/revisión de informes InBody (composición corporal) | Seguimiento - métricas (Fase 5) |
| `CalendarPage` | Calendario de citas/videollamadas | CRM - agenda (Fase 6) |
| `CitasPage` | Lista de citas pendientes | CRM - agenda (Fase 6) |
| `ChatPage` | Chat 1-a-1 nutricionista ↔ cliente | App cliente + panel (transversal) |
| `ChatIAPage` | Chat del cliente con IA, supervisable por el nutricionista | Funcionalidad nueva, valorar para Fase 4 o posterior |
| `NotFound` | 404 | Sistema |

### Componentes destacados (decisiones de UX que merece la pena copiar)

- **`AppLayout` + `AppSidebar`**: shell con navegación lateral. Equivale al "shell del panel" de la Fase 1.
- **`MobileHeader`**: header diferenciado para móvil → confirma que el panel también se usa en móvil, no solo el cliente.
- **`Dashboard`**: tarjetas de resumen en la home.
- **`WeeklyCheckinsCard`**: tarjeta de check-ins pendientes de la semana → muy útil como widget del dashboard.
- **`CalendarView`** (FullCalendar): el panel anterior usa `@fullcalendar` para el calendario. En el nuevo stack, valora si quieres usarlo o algo más ligero.
- **`GoogleCalendarButton`**: botón de OAuth con Google Calendar para sincronizar citas.
- **`ProtectedRoute`**: middleware de rutas protegidas.
- **`ChangePasswordDialog`**, **`SettingsDialog`**: diálogos típicos de ajustes.

---

## 3. Modelo de datos del panel anterior (referencia para el schema Prisma)

> ⚠️ **Importante:** el schema anterior es **plano y simplista** (todo en `text`, macros como strings, sin separación clara entre plantilla y asignación). Tu schema en Prisma debe ser mejor: tipos correctos (`Int`/`Float` para macros, `Decimal` para gramos), entidades separadas para biblioteca vs plan asignado, y relaciones bien definidas. Usa esto como **inventario de qué guardar**, no como **cómo guardarlo**.

### Tablas detectadas (10 principales)

#### `nutricionista`
- `nutricionista_id` (uuid, PK)
- `auth_user_id` (uuid, FK a auth.users)
- `nombre` (text)
- `email` (text)
- `img_perfil` (text, opcional)
- `created_at` (timestamp)

> **Equivalente Prisma:** modelo `Professional` con `role = 'nutricionista'` (siguiendo el sistema de roles del prompt maestro).

#### `cliente`
- `id` (uuid, PK)
- `nombre` (text)
- `estado` (text, default `'pendiente_revision'`) → estados detectados en el panel
- `nutricionista_id` (uuid, FK)
- `telefono`, `email`, `fecha_nacimiento` (text)
- `img_perfil` (text)
- `pdf_training` (text) → URL al PDF de entrenamiento
- `created_at`

> **Equivalente Prisma:** modelo `Client` (atleta). En el prompt maestro la ficha nutricional se va a separar a una tabla `NutritionProfile` propia, mucho más rica que esto.

#### `formulario`
Cuestionario nutricional inicial. Campos detectados:
- `cliente_id` (FK)
- `nombre`, `genero`, `fecha_nacimiento`
- `peso_actual`, `peso_obj`, `altura` (text)
- `niveldeactividad`, `frecuencia_actividad`, `horas_entreno`, `actividad_deport` (boolean)
- `objetivos` (text)
- `num_comidas` (text)
- `alergia` (bool), `que_alergia` (text)
- `alimento_no` (text) → alimentos que no quiere
- `trastorno_hormonal` (bool), `farmacos` (bool)
- `supldeportivo` (bool), `suplalimentos` (bool)
- `nutri_antes` (bool), `como_conociste` (bool)

> **Equivalente Prisma:** parte del `NutritionProfile` o tabla separada `IntakeForm`. Mejor con tipos correctos: `weightKg Float`, `targetWeightKg Float`, `heightCm Int`, `trainingHoursPerWeek Int`, etc. Y la lista de alergias/restricciones como array (`String[]`) o tabla aparte.

#### `dieta`
Plan nutricional simplificado. Estructura plana:
- `cliente_id` (FK)
- `visible` (bool) → si el cliente puede verla ya
- `pdf_url` → backup en PDF
- Para cada comida (desayuno, almuerzo, comida, merienda, cena, entrenamiento):
  - `{comida}_texto` (text → descripción libre)
  - `{comida}_proteinas`, `{comida}_grasas`, `{comida}_carbohidratos`, `{comida}_kcal`
- Totales: `kcal_total`, `total_grasas`, `total_carbos`
- `informe_agente` (text) → notas del agente IA

> **Equivalente Prisma:** **NO copies esta estructura plana.** En el prompt maestro está bien diseñado: usa `NutritionPlan` → `PlanWeek` → `PlanDay` → `Meal` con tipos numéricos para macros. Pero **sí copia los conceptos**: tipos de comida (desayuno, almuerzo, comida, merienda, cena, pre/post-WOD), macros por comida, totales del día.

#### `dieta_items`
Items individuales de una comida (mejor estructurado que `dieta`):
- `dieta_id` (FK)
- `tipo` (text) → tipo de comida
- `orden` (int)
- `descripcion`, `proteinas`, `carbohidratos`, `grasas`, `kcal` (text)

> **Equivalente Prisma:** `MealItem` o `FoodEntry` dentro de un `Meal`. Tipos numéricos.

#### `lista_compra`, `alimentos_comprar`
- `nombre` (text)
- `supermercado` (text)
- `imagen` (text, URL)
- `nutricionista_id` (FK)

> **Equivalente Prisma:** biblioteca de alimentos con marca/supermercado e imagen. Útil para el módulo de **lista de la compra** que ya está bien pensado en el prompt maestro.

#### `inbody`
Mediciones de composición corporal (probablemente del aparato InBody):
- `cliente_id`, `nutricionista_id`
- `peso` (numeric)
- `masa_musculoesqueletica` (numeric)
- `porcentaje_grasa` (numeric)
- `pdf_url` (text)
- `objetivo` (text)
- `created_at`

> **Equivalente Prisma:** `BodyMeasurement` o entrada de `MetricEntry` con tipo `inbody`. **Buena noticia:** aquí ya usaban `numeric`, no `text`. Mantén tipos numéricos en Prisma.

#### `citas`
- `cliente_id` (FK, único → un cliente solo puede tener una cita activa)
- `fecha`, `fecha_fin` (timestamptz)
- `forma_cita` (text) → presencial, videollamada, etc.
- `estado` (text, default `'pendiente'`)
- `notificacion_leida` (bool)
- `reminder_sent` (bool) → si ya se mandó el recordatorio

> **Equivalente Prisma:** `Appointment` con FK a `Client` y opcionalmente a `Professional`. Tipos `DateTime` correctos, enum para estado.

#### `training`
- `cliente_id` (FK, único)
- `pdf_training` (text)

> Plan de entrenamiento subido como PDF (porque Al Fallo no diseña el plan de fuerza, lo da otro coach).
> **Equivalente Prisma:** `TrainingPlan` o campo `trainingPlanUrl` en `Client`.

#### `mensajes`
Chat 1-a-1 nutricionista ↔ cliente:
- `cliente_id`, `nutricionista_id`, `sender_id`
- `sender_role` (text)
- `contenido` (text)
- `leido` (bool)

> **Equivalente Prisma:** `Message` con FK a `Client` y `Professional`, campo `senderRole` enum, `read` bool.

#### `chat_ia`
Chat IA del cliente, supervisable:
- `user_id` (cliente)
- `role` (`'user' | 'assistant' | 'nutricionista'`)
- `content` (text)
- `leido` (bool)

> **Equivalente Prisma:** `AIChatMessage` con role enum. Concepto interesante: el rol `nutricionista` permite que el nutri intervenga en un chat IA del cliente. Valorar si se mantiene.

---

## 4. Storage / buckets (archivos que la app necesita guardar)

El panel anterior usaba 2 buckets de Supabase Storage:

- **`plan-pdfs`**: PDFs de planes nutricionales (público).
- **`img_alimentos`**: imágenes de alimentos para la biblioteca y lista de compra (público).

> **Equivalente en stack nuevo:** Vercel Blob con prefijos de carpeta. Crea como mínimo:
> - `plans/` para PDFs de planes
> - `foods/` para imágenes de alimentos
> - `progress-photos/` para fotos de progreso del cliente (no estaba en el panel anterior pero está en el prompt maestro)
> - `recipes/` para imágenes de recetas
> - `inbody/` para PDFs de InBody

---

## 5. Integraciones externas (qué automatizaciones tenía)

### OneSignal (push notifications)
Edge function `send-push-notification` con `ONESIGNAL_APP_ID` y `ONESIGNAL_REST_API_KEY`.
Y triggers:
- `notify-cita-added` → al añadir cita
- `notify-cita-cancelled` → al cancelar
- `notify-dieta-visible` → cuando se publica la dieta para el cliente
- `notify-mensaje` → al recibir mensaje
- `cita-reminder` → recordatorio antes de la cita (con `pg_cron`)

> **Para el nuevo stack:** en Next.js puedes usar Web Push API nativa (con `web-push` lib) o Firebase Cloud Messaging. Más simple: empezar con notificaciones por email vía Resend y añadir push después.

### n8n (workflows IA)
Edge functions proxy:
- `proxy-n8n-chat-ia` → webhook de n8n para el chat IA del cliente
- `proxy-n8n-macros` → estimación de macros desde texto
- `proxy-n8n-recetas` → ¿generación o lookup de recetas?

> **Para el nuevo stack:** puedes seguir usando n8n si Jess ya lo tiene montado, o llamar directamente a OpenAI/Anthropic desde Server Actions de Next.js. Lo segundo es más simple si no necesitas workflows complejos.

### Lovable AI gateway
Edge function `estimate-macros` que usaba el gateway IA de Lovable.

> Sustitúyelo por llamadas directas a un modelo (OpenAI, Anthropic) desde Server Action.

### Google Calendar OAuth
Edge functions:
- `google-calendar-oauth` → flujo de autorización
- `google-calendar-webhook` → recibe cambios desde Google
- `google-calendar-authorize-bridge`
- `cita-to-calendar` → sync de citas hacia Calendar

> **Para el nuevo stack:** OAuth con `googleapis` lib, Server Actions para el callback, webhook endpoint en `/api/google/webhook`. El prompt maestro ya contempla las variables `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.

---

## 6. Lecciones aprendidas (problemas del panel anterior)

- **Macros como `text` en vez de números:** dificulta cálculos automáticos (totales del día, ajustes proporcionales). En Prisma → usar `Float` o `Decimal`.
- **Antropometría (peso, altura) como `text`:** mismo problema. En Prisma → tipos numéricos.
- **No hay separación entre biblioteca de alimentos y plan asignado:** todo va plano en `dieta` y `dieta_items`. El prompt maestro lo resuelve con `FoodLibrary` / `RecipeLibrary` reutilizables.
- **RLS muy permisivas:** `Authenticated can read/insert/update/delete` para todo, sin filtrar por nutricionista en muchas tablas (excepto `mensajes`, `inbody`, `chat_ia`). En tu stack con auth propia, **revalida permisos en cada server action** según el helper `lib/session.ts` del prompt maestro.
- **Dos clientes Supabase conviviendo accidentalmente:** problema específico de Lovable, no aplica.
- **Cita única por cliente** (`citas_cliente_id_unique`): decisión cuestionable, un cliente puede tener varias citas. En el nuevo modelo, valorar si quitar esta unicidad o reemplazarla por "una cita activa simultáneamente".
- **Estructura plana de comidas en `dieta`** (un campo por cada `{comida}_proteinas` etc.): no escala si quieres plan por día o por semana. La estructura `NutritionPlan → PlanWeek → PlanDay → Meal` del prompt maestro es mucho más limpia.

---

## 7. Qué NO había en el panel anterior (y sí en el prompt maestro)

Cosas que tendrás que diseñar desde cero, sin referencia:

- **CRM de ventas completo** (leads, agenda pública, closers/setters, follow-ups)
- **Stripe** y flujo de pago/renovación
- **Comunidad** (muro tipo Twitter)
- **Clases / Cursos**
- **Finanzas / CAC / LTV**
- **Módulo de Contenido + integración Meta** (Instagram + Ads)
- **Impersonación del CEO**
- **Roles diferenciados** (`ceo`, `head_coach`, `nutricionista`, `setter`, `closer`)
- **Onboarding con contrato firmado**
- **PWA del cliente como tal** (el panel anterior era solo web del nutricionista; el chat con cliente sí existía pero no había app cliente completa)

> Para todo esto, sigue el prompt maestro como única referencia.

---

## 8. Resumen ejecutivo

**Lo que esto te ahorra:**
- Saber qué entidades necesita la app de nutrición (10 tablas base ya identificadas)
- Saber qué pantallas tiene el panel del nutricionista (14 páginas mapeadas)
- Saber qué integraciones externas tienen sentido (OneSignal, n8n, Google Calendar, IA)
- Saber qué errores evitar (tipos `text` en datos numéricos, RLS demasiado abiertas, estructura plana)

**Lo que NO te ahorra:**
- Diseñar el modelo Prisma definitivo (lo haces desde cero pero con un mapa muy claro)
- Construir el código (todo desde cero en Next.js)
- Diseñar el CRM, finanzas, comunidad, contenido, etc. (no existían)
