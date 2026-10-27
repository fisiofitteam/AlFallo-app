# Agenda comercial pública · Al Fallo Nutrition

## URLs
- Pública: `/agenda` (formulario, disponibilidad y reserva).
- Gracias: `/agenda/gracias` (confirmación y preparación previa).
- Administración (dirección): `/ajustes/agenda`.
- Edición del contenido comercial: `/biblioteca/landings`.

## Cómo habilitar reservas
1. En Vercel, configurar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` y `ENCRYPTION_KEY` (ya usado para cifrado de tokens). Nunca copiar secretos a Git.
2. En Google Cloud, autorizar como URI de redirección exacta `https://al-fallo-app.vercel.app/api/agenda/google/callback`, y usar ese valor en `GOOGLE_REDIRECT_URI`.
3. Acceder con dirección a `/ajustes/agenda` y autorizar la cuenta de Google Calendar que recibirá los eventos. El consentimiento Google requiere interacción del propietario de la cuenta.
4. Definir al menos una franja y el closer que la atenderá. Sin franjas no se ofrece disponibilidad.
5. Probar `/api/agenda/slots` y reservar una cita real desde `/agenda`. Confirmar en Google Calendar, correo invitación y CRM.

## Funcionamiento y garantías
- Las horas se generan con la zona horaria Europe/Madrid; el frontend las presenta en la zona del lead.
- Mínimo 24 h y máximo 20 días de antelación.
- Se respetan overrides semanales, bloqueos y ocupación de Google Calendar.
- La reserva se valida de nuevo contra la disponibilidad del servidor (no se confía en el slot del navegador).
- El evento de Google se crea con Meet e invitación de email; el lead se registra en CRM y se notifica a setters.
- Solo dirección puede administrar horarios y OAuth; el booking es público.

## Limitaciones
- No se publican citas sin calendario conectado y franjas definidas.
- No hay transacción distribuida entre Neon y Google Calendar: si una operación posterior a la creación del evento fallase, revisar manualmente el calendario y CRM.
- Para grandes volúmenes o closers simultáneos conviene separar calendarios por closer y añadir control transaccional de concurrencia.
