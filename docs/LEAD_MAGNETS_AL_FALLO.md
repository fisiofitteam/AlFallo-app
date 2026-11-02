# Módulo Lead magnets — Al Fallo Nutrition

## Alcance de esta implementación

- Se implementa la pestaña `Contenido → Lead magnets` como panel independiente, siguiendo la organización de FisioFit, pero con identidad Al Fallo y **sin copiar tests de salud, pacientes, datos ni recursos**.
- Se prepara un índice de recursos, con contadores reales a 30 días (iniciados, completados y clics a WhatsApp) y acceso a un panel privado por recurso.
- El panel por recurso filtra respuestas por fechas, estado, campaña, WhatsApp y búsqueda de contacto, con CSV autorizado y protegido contra fórmulas maliciosas.
- Ningún lead magnet, campaña, lead, respuesta ni dato de demostración se crea con esta implementación.
- El catálogo que ya estaba en `Banco de recursos → Lead magnets` permanece disponible para futuras altas, ediciones y desactivaciones.

## Modelo de datos

`LeadMagnet` sigue siendo la ficha del recurso. `LeadMagnetResponse` es una tabla **nueva y vacía**, con un esquema flexible para recibir capturas de futuras landings o tests de Al Fallo. Se protegen las respuestas con una relación `ON DELETE RESTRICT` (sin borrado en cascada). No hay campos obligatorios de contacto para no exigir datos personales innecesarios en futuros formatos.

Aplicar únicamente el SQL aditivo de `scripts/schema-updates/2026-11-02-lead-magnet-responses.sql` si la tabla todavía no existe. No ejecutar `db push --accept-data-loss` ni migrar datos de FisioFit.

## Cuando se decida crear un lead magnet

1. Definir formato (autotest, guía, recurso descargable, clase), preguntas/contenido y resultado esperado.
2. Implementar **esa** landing pública y la lógica de consentimiento. No hay una captura pública genérica en este cambio.
3. Registrar el recurso en Al Fallo, nunca copiándolo desde FisioFit.
4. Conectar las interacciones con `LeadMagnetResponse` (iniciado, completado, clic CTA, procedencia/campaña) y decidir explícitamente si se vincula al CRM, respetando permisos y privacidad.
5. Verificar capturas, métricas, filtros y exportación con pruebas no reales antes de empezar una campaña.

## Permisos

Los paneles con respuestas y CSV son accesibles solo para CEO y Head Coach (roles de dirección), por contener datos de contacto. No existen endpoints públicos de captura ni generación de recursos en este módulo. La gestión anterior del catálogo mantiene los permisos existentes.

## Eliminación individual y múltiple de respuestas (CEO)

- Entrada desde `CRM → Llamadas → Respuestas lead magnets` o `Contenido → Lead magnets`.
- Abre un recurso, por ejemplo GASOLINA, y usa la papelera de cada fila para eliminar una respuesta o marca casillas para eliminar varias.
- «Seleccionar todas» afecta **solo a las respuestas visibles de la página actual** (hasta 50), nunca a todos los registros del recurso.
- Antes de borrar se solicita confirmación; la eliminación es definitiva y afecta tanto al contacto almacenado como a la clasificación de respuestas. No modifica el recurso, las piezas ni los leads del CRM comercial.
- La API `DELETE /api/content/lead-magnets/[id]/responses` exige rol `ceo`, valida el alcance por `leadMagnetId`, comprueba todos los IDs y acepta como máximo 50 por petición.
- Las métricas se recalculan al actualizar la página. Las demás respuestas y los otros lead magnets no se modifican.
