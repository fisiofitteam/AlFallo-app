# GASOLINA v2 — Experiencia interactiva de Al Fallo Performance

## URLs y campaña

- Landing: `https://al-fallo-app.vercel.app/gasolina`
- Alias: `/guia-comer-segun-tu-wod`
- Marca: logo de Al Fallo Nutrition adaptado sin fondo blanco, vectorizado a partir del recurso proporcionado.
- Keyword para automatización externa de Instagram: `GASOLINA`. La automatización de ManyChat no está activada en este repositorio.
- Panel interno: `Contenido → Lead magnets → GASOLINA`.

## Flujo definitivo (v2)

1. Intro: «Deja de improvisar tu comida». Promesa: energía para entrenar, estrategia sostenible y resultado inmediato en web.
2. Pregunta 1: horario habitual de entrenamiento.
3. Pregunta 2: tipo de sesión predominante.
4. Pregunta 3: principal dificultad con la alimentación.
5. Pregunta 4: objetivo (marcas, composición corporal, energía, flexibilidad).
6. Pregunta 5: patrón real de la semana (poco combustible, mismas comidas, improvisación, hambre tardía).
7. Pregunta 6: obstáculo principal (organización, conocimiento, tiempo, constancia).
8. Nombre y apellidos **obligatorio**; Instagram **opcional**. Sin email, teléfono ni un checkbox publicitario.
9. Resultado en web: prioridad orientativa, tres acciones prácticas, ejemplo, error frecuente, sugerencias por horario/carga y guía completa de cuatro capítulos en pantalla.
10. CTA principal: WhatsApp directo de Al Fallo Nutrition con texto preescrito para solicitar información sobre **Al Fallo Performance**. Enlace oficial publicado en `alfallonutrition.com`: `wa.me/34865539963`, configurable por variable `NEXT_PUBLIC_AL_FALLO_WHATSAPP_NUMBER` si se utiliza otro número para Performance.

## Registro

`LeadMagnetResponse` conserva la sesión anónima al comenzar. Al finalizar se registra el nombre completo, Instagram opcional y las seis respuestas en `resultJson` con `guide=gasolina-v2`. No se añade al CRM, ni se envían emails o WhatsApps automáticamente. El clic en el CTA registra un clic, nunca una conversación enviada o una contratación.

La API utiliza una firma HMAC por intento, control básico por IP e identificación del recurso GASOLINA. En el panel privado se mantienen las respuestas antiguas `gasolina-v1` compatibles y se muestran los seis campos para nuevas respuestas.

## PDF anterior

El PDF de seis páginas se conserva en el repositorio por compatibilidad con enlaces existentes, pero **ya no se ofrece ni entrega como paso del funnel**. El contenido educativo ampliado se presenta íntegramente en la web tras completar las preguntas.

## Antes de promoción masiva

- Verificar que el número oficial publicado también sea el número preferido para consultas comerciales de Al Fallo Performance.
- Revisar jurídicamente el aviso de privacidad, incluidos el responsable, base de tratamiento, conservación y contacto.
- Configurar la automatización de comentarios/DM `GASOLINA` en ManyChat si se desea entrega automática por Instagram.
- Verificar la experiencia en móviles, distintas respuestas y la redirección a WhatsApp.
