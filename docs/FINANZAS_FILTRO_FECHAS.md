# Al Fallo · Finanzas: consultas por fechas

## Qué se ha añadido

En **Cuadro de mandos → Finanzas** hay un filtro **Desde / Hasta** (ambos días incluidos) con accesos rápidos a **Este mes**, **Mes anterior**, **Últimos 30 días** y **Trimestre actual**. La consulta permite hasta dos años y conserva las fechas cuando se cambia a la pestaña Equipo.

- **Resumen económico izquierdo:** ingresos, gastos, beneficio, margen y estimaciones fiscales calculados exclusivamente con las transacciones registradas entre esas fechas.
- **Trimestre fiscal derecho:** presenta el trimestre natural que contiene el último día seleccionado. Se muestra su período propio y el cálculo orientativo del modelo 130, aunque el filtro abarque solo algunos días o varios trimestres. No se debe confundir con una liquidación del rango personalizado.
- **Movimientos:** solo operaciones cuya `Transaction.date` esté dentro del filtro; lista paginada de 100 registros con recuento total y navegación que conserva las fechas. Fechas mostradas en horario Europe/Madrid.
- **Facturas del equipo:** se muestran los documentos cuyo mes de facturación (`PayrollPayment.period`, `YYYY-MM`) esté entre el primer y el último mes elegido. Se informa de que una factura mensual es indivisible, aunque el rango contenga solo parte de ese mes.
- **Gastos fijos mensuales:** la plantilla de gastos recurrentes es una **configuración global**, no se filtra. Solo sus transacciones materializadas aparecen dentro de Movimientos si sus fechas están incluidas.

## Precisión y seguridad

El filtro utiliza `FinanceRange` de `compensation-range.ts` (Europe/Madrid, límites inclusivos y día siguiente exclusivo para Prisma). Las estimaciones usan `estimateTaxes` y los parámetros fiscales actuales; no reconstruyen el histórico real de obligaciones y no sustituyen a la asesoría fiscal.

Aplicar el filtro es una operación de lectura; no edita transacciones, facturas ni reglas. Se conserva el comportamiento previo de creación idempotente de gastos recurrentes del **mes en curso** al entrar en Finanzas, independientemente de la vista consultada; **no se generan movimientos de meses anteriores al usar el filtro**.

No hay migraciones de base de datos. El panel permanece restringido a dirección (rol CEO).

## Validación

- Contraste de períodos completos y cruzados con las sumas reales de Neon, sin insertar ni modificar registros.
- Pruebas SSR de meses completos, intervalo entre meses, páginas sin movimientos y fechas inválidas.
- Verificación visual en escritorio y comprobación TypeScript/compilación de producción.
