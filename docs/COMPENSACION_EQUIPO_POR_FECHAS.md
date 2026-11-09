# Al Fallo · Equipo · Cálculo de remuneraciones por intervalo

## Uso

En `Cuadro de mandos → Equipo` se puede escoger un intervalo de fechas desde/hasta, ambos días incluidos, en zona horaria **Europe/Madrid**. Se ofrecen atajos: **Este mes**, **Mes anterior** y **Últimos 30 días**. El intervalo máximo es de 2 años; si es inválido se muestra un aviso y el mes actual.

Los 4 KPIs, el conteo de altas y renovaciones, las compensaciones de cada profesional y los desgloses de reglas se recalculan con el mismo intervalo. No se editan registros al aplicar un filtro.

## Reglas de cálculo

- **% sobre ingresos / beneficio bruto:** se aplica a los movimientos registrados dentro del período seleccionado y mientras está vigente la regla.
- **€/alta / €/renovación:** se computa según `SubscriptionPeriod.decidedAt` de cada operación incluida, respetando la vigencia de la regla.
- **Fijo mensual:** para un mes natural completo se calcula una mensualidad; para intervalos parciales se prorratea por días naturales del mes (15 de 30 días = la mitad del importe); si abarca meses, se suman sus partes.
- **€/cliente activo:** se prorratea igual que un fijo mensual, usando los clientes activos **en el momento de la consulta**. Actualmente el sistema no conserva un histórico de clientes activos ni de asignaciones de nutricionista, de manera que este tipo de estimación no es un balance histórico exacto.
- **Tope y mínimo por regla:** se aplican a los tramos de cada mes; se prorratean cuando se selecciona una fracción de mes.
- **Activación/vigencia:** se usan las reglas actualmente activas y sus fechas de inicio/fin. Los cambios históricos en la configuración de reglas no se versionan; los informes son estimaciones con la configuración actual.

Los movimientos se filtran por fecha y hora real según el inicio/final de cada día en Madrid, incluidos los días de cambios de horario.

## Facturas

**Generar facturas** solo se ofrece al seleccionar **un mes natural completo**. El mes se guarda como `YYYY-MM` y el importe se calcula con la misma fórmula que el informe de Equipo. No se generan facturas al aplicar filtros ni se recalculan automáticamente las facturas ya creadas. Los intervalos parciales o multimensuales son de consulta exclusivamente.

## Seguridad

El panel y las server actions siguen restringidos al rol CEO. No se requieren migraciones ni cambios de datos. El GET de selección de fechas no modifica Neon.
