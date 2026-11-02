# GASOLINA — Lead magnet Al Fallo Nutrition

## Contexto

Campaña asociada al Reel 15 del dossier de diciembre de 2026 (27 de diciembre), «Lead Magnet: Guía para comer según tu WOD». Palabra clave a utilizar en el CTA: `GASOLINA`.

### Rutas
- Landing pública: `https://al-fallo-app.vercel.app/gasolina`
- Alias: `/guia-comer-segun-tu-wod`
- PDF listo para descargar: `/gasolina/guia-comer-segun-tu-wod.pdf`
- Privacidad: `/gasolina/privacidad`
- Panel interno: `Contenido → Lead magnets → GASOLINA`

## Flujo y copy

1. Landing: «DEJA DE IMPROVISAR TU COMIDA» + test gratuito.
2. Pregunta 1: cuándo entrena (mañana, mediodía, tarde, noche o variable).
3. Pregunta 2: sesión predominante (WOD duro, fuerza, cardio/HYROX, doble sesión, suave).
4. Pregunta 3: principal dificultad (pre-WOD, poca energía, hidratos, recuperación, hambre post-WOD, estructura semanal).
5. Nombre y correo obligatorios; teléfono e Instagram opcionales; consentimiento específico, no publicitario.
6. Resultado educativo: foco prioritario (energía previa, hidratos, recuperación o estructura) + sugerencias por horario y carga.
7. Guía PDF de 6 páginas descargable y opción para compartir por WhatsApp (no se envía un WhatsApp automático).
8. CTA a valoración solo cuando `/api/agenda/slots` confirma disponibilidad real.

## Registro y privacidad

- `POST /api/gasolina` crea una respuesta anónima `started` al comenzar. No guarda datos personales antes del consentimiento.
- `PATCH /api/gasolina` con `action: complete` exige consentimiento y guarda nombre, email y respuestas. El acceso a la operación se verifica mediante firma HMAC asociada a la sesión creada.
- `PATCH /api/gasolina` con `action: whatsapp` registra un clic por respuesta completada; **no significa que un mensaje haya sido enviado**.
- Se conservan `utm_source` y `utm_campaign` saneados para el análisis.
- Los datos y respuestas permanecen en las tablas **exclusivas de Al Fallo**, separados de FisioFit.
- No se crea un Lead de CRM porque el modelo de llamada requiere una reserva. Si más adelante se quiere convertir contactos del test en oportunidades comerciales, se debe definir expresamente su consentimiento y el modelo correspondiente.

## Administrador

- El panel del recurso muestra iniciados, completados, tasa de finalización, clics en WhatsApp y distribución por foco.
- Cada respuesta muestra el horario, tipo de sesión y principal dificultad. Hay filtros por fecha, campaña y contacto, y exportación CSV privada.

## Configuraciones finales para la campaña

- Confirmar el copy del reel, y configurar la automatización de comentarios/DM `GASOLINA` en ManyChat u otro sistema. **No se ha creado una automatización de DM**.
- Antes de invertir en anuncios o difundir masivamente, completar/revisar el aviso de privacidad con la razón social e información real de contacto del responsable, validar la política de conservación y confirmar los consentimientos aplicables.
- Si se desea enviar la guía automáticamente por email o WhatsApp, conectar explícitamente un proveedor y definir plantilla, canal y permisos. El flujo actual ofrece **descarga inmediata y enlace para compartir**, no envío automático.
- La agenda de Al Fallo no tiene por ahora Google Calendar conectado ni franjas configuradas. El CTA de reservar se muestra solo con disponibilidad confirmada.

## Guía

Fuente editable en `scripts/gasolina/guia-source.html`; regeneración local con `scripts/gasolina/build-guide.sh` (Google Chrome en macOS). El PDF resultante vive en `public/gasolina/guia-comer-segun-tu-wod.pdf`.

## Pruebas ya realizadas

- Seis páginas de PDF verificadas con PDFKit y revisadas visualmente en varias páginas.
- Inicio, consentimiento obligatorio, respuesta completada, clasificación, registro de clic y limpieza de datos QA sintéticos.
- Verificación de que el PDF y la landing responden públicamente en el entorno local.
- TypeScript y compilación de producción.
