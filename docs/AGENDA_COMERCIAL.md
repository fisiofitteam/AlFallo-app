# Agenda comercial Al Fallo — conexión Google Calendar

## Estado y alcance

- Landing pública `/agenda` y CRM comercial existentes.
- Franja horaria por día / closer editable desde `/ajustes/agenda`.
- Un **calendario primario de Google** compartido como fuente de disponibilidad. Google Meet, invitaciones al lead y al closer asignado al reservar.
- La autorización Google requiere consentimiento explícito del propietario de la cuenta.
- La lectura y generación de eventos se habilitan solo cuando haya cuenta OAuth y franjas configuradas.
- No se ha creado ningún evento, reserva ni franja ficticia durante esta implementación.

## Preparación en Google Cloud (responsable del calendario)

1. Crear o elegir un proyecto específico para Al Fallo Nutrition en [Google Cloud Console](https://console.cloud.google.com/).
2. Habilitar **Google Calendar API** (API Library).
3. Google Auth Platform → Branding/Audience/Data Access: configurar la aplicación Al Fallo y los permisos solicitados. Si la audiencia es externa y el estado es Testing, recordar que los refresh tokens para permisos Calendar expiran normalmente en **7 días**. Para producción estable se requiere la configuración y publicación apropiadas, y podría requerirse verificación de Google.
4. Google Auth Platform → Clients → Create Client → Web application. Añadir como **Authorized redirect URI** exactamente:

   `https://al-fallo-app.vercel.app/api/agenda/google/callback`

   Para **Authorized JavaScript origins**, si Google lo solicita o se utiliza la misma credencial en UI browser, puede registrarse `https://al-fallo-app.vercel.app`; este flujo usa autorización de servidor y no expone secrets al frontend.

5. Conservar en lugar seguro el Client ID y Client Secret de Google.

## Vercel — entorno Production

En el proyecto `al-fallo-app`, Settings → Environment Variables, crear:

| Variable | Valor |
| --- | --- |
| `GOOGLE_CLIENT_ID` | ID del cliente OAuth creado en Google Cloud |
| `GOOGLE_CLIENT_SECRET` | secreto de ese cliente, tratar como contraseña |
| `GOOGLE_REDIRECT_URI` | `https://al-fallo-app.vercel.app/api/agenda/google/callback` |
| `ENCRYPTION_KEY` | clave existente del proyecto. **Mantener su valor, no cambiarla al conectar Calendar.** |

Estas variables son del servidor; **nunca** usar `NEXT_PUBLIC_` para los secretos.
Después de guardar variables, **redeploy** del entorno Production. No se aplican a despliegues anteriores.

## Activación dentro de Al Fallo

1. CEO o Head Coach entra en `/ajustes/agenda`. La pantalla informa qué nombres de variables están configurados, sin mostrar sus valores.
2. Pulsa **Conectar Google Calendar**, elige la cuenta propietaria de la agenda y concede los permisos. El código OAuth no se pide por chat y el refresh token se guarda cifrado en Neon.
3. Pulsa **Comprobar conexión**. Hace una consulta read-only de eventos para verificar credenciales y acceso real. No crea, mueve ni borra citas.
4. Define los días, inicio, fin, duración (30/45/60 min) y closer asignado. La plantilla que crees determina qué horarios pueden seleccionar los leads.
5. Comprueba `/api/agenda/slots`. No debería devolver una lista vacía si hay horarios libres entre 24 horas y 20 días posteriores.
6. Haz una reserva de prueba controlada con un email tuyo, verifica la invitación, el Meet, el evento en Google y el lead en el CRM; después cancela la prueba en ambos sistemas si ya no la necesitas.
7. Solo entonces publica el enlace de agenda en Instagram o campañas.

## Garantías y límites

- El calendario consulta todas las páginas de eventos de Google (hasta un límite de seguridad; un error bloquea nuevas reservas en vez de asumir que hay disponibilidad).
- Bloquean los slots los eventos con hora y eventos de día completo. Los que están marcados «Disponible» (`transparent`) no bloquean.
- Se corrige el cálculo de días alrededor de cambios de hora Madrid (DST).
- Se invita al profesional asignado cuando es una cuenta diferente del titular de Calendar.
- La API `/api/agenda/google/test` solo puede leerla dirección y no devuelve detalles de citas ni tokens.
- Solo existe **una cuenta Google Calendar compartida** en esta implementación. Si se desean calendarios independientes por closer, habrá que extender el modelo y el OAuth de cada profesional.
- No se han cambiado calendarios externos ni creado horarios por defecto.
