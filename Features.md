# Features — Sistema de Gestión Integral MALALA

Documento vivo. Acá anotamos:
- **Lo que pidió el cliente** (wishlist original).
- **Qué está implementado** y cómo funciona.
- **Qué falta** o quedó postergado, con notas para retomarlo.

Cada vez que cerramos un punto, lo movemos a "Implementado" y dejamos las notas técnicas mínimas para el día de mañana.

---

## Estado general

| # | Módulo | Estado |
|---|---|---|
| 1 | Caja y movimientos financieros | Parcial (caja diaria ✓, **bancos ✓**, conciliación ✗) |
| 2 | Facturación AFIP/ARCA | ✗ Pendiente |
| 3 | Stock e insumos | ✓ Base (capacidad operativa según stock ✗) |
| 4 | Servicios de peluquería y estética | ✓ Base (rentabilidad por servicio ✗) |
| 5 | Sistema de turnos | ✓ Base (inteligencia de disponibilidad ✗) |
| 6 | Base de clientes y CRM | ~ Base (CRM comercial ✗) |
| 7 | Cuentas corrientes | ~ Parcial (saldo, falta cuotas/vencimientos) |
| 8 | Empleadas, sueldos y comisiones | ✓ Base + liquidaciones |
| 9 | Autoconsumos | ✗ Pendiente |
| 10 | Influencers y Meta Ads | ✗ Pendiente |
| 11 | Tareas internas (tipo Trello) | ✗ Pendiente |
| 12 | Informes y control financiero | ~ Parcial (auditoría sí, reportes financieros ✗) |
| 13 | Estado de situación patrimonial | ✗ Pendiente |
| 14 | Estado de resultados | ✗ Pendiente |
| 15 | Estado de flujo de efectivo | ✗ Pendiente |
| 16 | Costos completos | ✗ Pendiente |
| 17 | Impuestos (IVA, IIBB) | ✗ Pendiente |
| 18 | Inventario de bienes de uso | ✗ Pendiente |
| 19 | Usuarios y permisos | ✓ Base (roles + auditoría) + aislamiento por sucursal en bancos/medios |

Leyenda: ✓ hecho · ~ parcial · ✗ falta

---

## Implementado

### Punto 19 (refuerzo) — Aislamiento por sucursal en bancos y medios de pago

**Qué se hizo**
- Modelo "una cuenta por sucursal": `cuentas_bancarias` y `medios_pago` ahora exigen `sucursal_id`.
- Cada admin de sucursal **solo ve sus propias cuentas, medios de pago, saldos y movimientos**. El de A no se entera de los de B y viceversa.
- Las queries (`listCuentas`, `listSaldos`, `listMovimientos`, `listMediosPago`) filtran automáticamente por las sucursales permitidas del usuario.
- Las mutaciones (crear cuenta, crear medio, toggle, transferencia) validan que la sucursal esté en el scope del usuario.
- Transferencias bloqueadas entre sucursales (origen y destino deben coincidir).
- Pantalla de venta y de egreso filtran el selector de medio de pago por la sucursal de la operación.
- Liquidaciones: al pagar, solo se ofrecen medios de la sucursal de la liquidación.
- El medio de pago solo puede apuntar a una cuenta de **su misma sucursal** (validado en backend).

**Cómo funciona en la práctica**
- El admin de Sucursal A entra y ve solo "Catálogos → Cuentas bancarias" y "Catálogos → Medios de pago" con sus registros.
- Al crear, el selector de sucursal viene preseleccionado en su sucursal (no puede elegir otra porque no aparece).
- Las páginas `/bancos` y el card del dashboard muestran solo cuentas y saldos de sucursal A.
- Si en algún momento un usuario tiene scope sobre varias sucursales (caso superadmin), la vista agrupa los saldos por sucursal automáticamente.

**Notas técnicas**
- Schema: columnas `cuentas_bancarias.sucursal_id` y `medios_pago.sucursal_id` NOT NULL FK a `sucursales`.
- Filtros via `buildAccessScope` + `isSucursalAllowed`.

---

### Mejoras de UX en login y switcher

**Qué se hizo**
- **`/dev/login` limpia**: se eliminó la columna izquierda con la lista de usuarios sembrados y la password de seed. Quedó un form mínimo (email + password + Entrar).
- **Switcher de sucursal contextual**: si el usuario tiene acceso a una sola sucursal (caso de los admins de cada sucursal), se muestra el nombre como texto, sin selector ni botón "Cambiar". Solo aparece el selector cuando el usuario tiene acceso a más de una sucursal (caso superadmin).
- Antes el switcher mostraba TODAS las sucursales aunque el usuario no tuviera acceso. Ahora siempre filtra por las sucursales permitidas del scope.

---

### Punto 1 (parcial) — Bancos y flujo de cobro

**Qué se hizo**
- **Cuentas bancarias** como módulo de catálogo: nombre + tipo (`banco` o `efectivo`) + activo/observación.
- **Medios de pago atados a una cuenta**: cada medio (Efectivo, Transferencia Galicia, POSNET, etc.) apunta a una cuenta destino fija.
- **Movimientos bancarios automáticos**:
  - Cada venta genera 1 o 2 movimientos (+) en la(s) cuenta(s) del medio de pago usado.
  - Cada egreso `pagado=true` genera movimiento (−).
  - Toggle de "pagado" en egreso emite o revierte el movimiento.
  - Todo en la misma transacción para que no haya saldos descalzados.
- **Página /bancos** (admin / encargada): totales (general / bancos / efectivo), cards por cuenta con saldo en tiempo real, formulario de transferencia entre cuentas, historial de movimientos.
- **Card de saldos** en el dashboard con link al detalle.

**Cómo usarlo**
1. Crear cuentas en `Catálogos → Cuentas bancarias` (Galicia, Macro, Caja Efectivo, etc.).
2. En `Catálogos → Medios de pago`, asignar a cada medio su cuenta destino.
3. A partir de ahí cada venta/egreso impacta automáticamente. Ver saldos en `/bancos` o en el dashboard.
4. Si hace falta arrancar limpio: `npx tsx scripts/reset-bancos.ts` (borra ingresos, egresos, cierres, liquidaciones y movimientos; mantiene catálogos).

**Notas técnicas**
- Schema: `cuentas_bancarias`, `movimientos_bancarios`, columna `medios_pago.cuenta_id`. Enums `tipo_cuenta` y `tipo_mov_bancario`.
- Helpers: `src/lib/data/movimientos-bancarios-helpers.ts` (`emitMovimientoBancarioTx`, `deleteMovimientosByRefTx`, `getCuentaIdForMpTx`).
- Data: `src/lib/data/cuentas-bancarias.ts` (CRUD, `listSaldos`, `listMovimientos`, `createTransferencia`).

**Qué quedó explícitamente fuera de esta tanda** (para retomar después)
- Payway / conciliación de tarjetas con CSV o API.
- Acreditaciones pendientes (tarjetas con T+N días).
- Costos financieros y retenciones.
- Rediseño del cierre de caja con múltiples cuentas bancarias (hoy `cierres_caja.saldoBanco` es un único número).

---

## Pendientes — pedido completo del cliente

Lista íntegra del wishlist. Lo que ya está cubierto está marcado al lado.

### 1. Caja y movimientos financieros
- **Caja diaria** — ✓ módulo `caja`
  - Apertura/cierre, ingresos/egresos, métodos de pago, control de diferencias, historial, arqueos.
- **Bancos y cuentas** — ✓ implementado en esta tanda
  - Galicia, Macro, Caja Efectivo. Discriminación automática por medio de pago.
- **Conciliaciones** — ✗ pendiente
  - Bancaria, semi-automática con Payway, costos financieros, retenciones, acreditaciones pendientes, diferencias entre ventas y acreditaciones reales.
- **Estado financiero en tiempo real** — ~ parcial
  - Hoy mostramos dinero en bancos y en caja. Faltan: acreditaciones pendientes, dinero a cobrar (CC), dinero comprometido.

### 2. Facturación AFIP / ARCA
- Emitir facturas electrónicas A/B, NC, recibos.
- Asociación automática con ventas, turnos, cuentas corrientes, clientas.
- Historial de comprobantes.
- *Nota del cliente: tienen otro sistema de donde se puede portar la integración, se hará más adelante.*

### 3. Stock e insumos
- **Control de stock** — ✓ base (productos, proveedores, movimientos, bajo stock).
- **Recetas de tratamientos** — ✓ base (consumo automático al hacer una venta).
- **Capacidad operativa según stock** — ✗ pendiente
  - Cuántos servicios entran con el stock actual, qué insumos limitan la capacidad, alertas de faltantes críticos.

### 4. Servicios de peluquería y estética
- Base completa de servicios con categorías, duración, precio, comisión — ✓.
- Receta técnica + costos asociados + rentabilidad por servicio — ✗ pendiente (rentabilidad).
- Rubros: peluquería, manos y pies, cejas y pestañas, faciales, masajes, productos, joyas, extras.

### 5. Sistema de turnos (estilo Calendico)
- Calendario por profesional, gestión de disponibilidad, reserva/cancelación, confirmación, reprogramaciones, historial — ✓ base.
- Estados: reservado, confirmado, realizado, cancelado, ausente — ✓.
- Integración automática con cobro, servicio, comisión, clienta, consumo de stock — ✓ parcial.
- **Inteligencia operativa sobre disponibilidad** — ✗ pendiente
  - Qué horarios libres / qué profesionales tienen disponibilidad / qué turnos faltan llenar para acciones comerciales en redes.

### 6. Base de datos de clientes y CRM
- **Base de clientes** — ✓ base (nombre, contacto, observaciones, saldo CC).
- Falta: historial de servicios/compras/pagos enriquecido, preferencias, frecuencia de visitas.
- **CRM comercial** — ✗ pendiente
  - Seguimiento, segmentación, detección de inactivas, promociones, seguimiento de influencers.

### 7. Cuentas corrientes
- Saldo pendiente — ✓ campo en clientes.
- Falta: historial de pagos detallado, vencimientos, cuotas pagadas/pendientes, alertas de mora, pagos parciales.

### 8. Empleadas, sueldos y comisiones
- **Gestión de empleadas** — ✓ base (servicios, comisiones, sueldo asegurado).
- Falta: asistencias, ausencias, tareas asignadas, puntaje/calificación.
- **Comisiones** — ✓ base + liquidaciones por período.
- Falta: distinción explícita "cobra sólo asegurado / supera asegurado / costo a empresa / autofinanciada".
- **Sueldos / liquidaciones** — ✓ módulo `liquidaciones`.
- Falta: horas extras, planilla de asistencia.

### 9. Autoconsumos — ✗ pendiente
- Productos usados internamente, servicios sin cobro, impacto en stock/costos/resultados.
- (Hay un campo `autoconsumos` en `cierres_caja` pero no hay módulo dedicado.)

### 10. Influencers y marketing — ✗ pendiente
- Registro de acciones, canjes, resultados, campañas.
- Integración Meta Ads (inversión vs retorno).

### 11. Tareas internas (tipo Trello) — ✗ pendiente
- Asignación, prioridades, fechas límite, estados (pendiente / en proceso / terminado).

### 12. Informes y control financiero
- Reportes diarios/semanales/mensuales/anuales en tiempo real.
- Operativos: ventas, ingresos, egresos, rentabilidad, top servicios, rendimiento por empleada, stock valorizado, CC, flujo de caja.
- Hoy hay auditoría en `/reportes`. Faltan los reportes financieros propiamente dichos.

### 13. Estado de situación patrimonial — ✗ pendiente
- Activos (caja, bancos, CC, stock, bienes de uso), pasivos (deudas, préstamos), patrimonio neto.
- Dashboards y gráficos.

### 14. Estado de resultados — ✗ pendiente
- Ingresos, costos directos/indirectos, gastos administrativos/comerciales/financieros, resultado operativo y neto.

### 15. Estado de flujo de efectivo — ✗ pendiente
- Efectivo al inicio/cierre, variaciones, flujo operativo/financiero/inversión.

### 16. Costos completos — ✗ pendiente
- Directos/indirectos/por servicio, fijos/variables, extraordinarios, mantenimiento, mano de obra, margen, rentabilidad real.

### 17. Impuestos — ✗ pendiente
- IVA, IIBB, cargas fiscales, saldos a favor, proyecciones impositivas.

### 18. Bienes de uso — ✗ pendiente
- Muebles, herramientas, máquinas, equipamiento. Fecha de compra, valor, depreciación.

### 19. Usuarios y permisos — ✓ base
- Roles: superadmin, admin, encargada, empleado.
- Auditoría con usuario/fecha/hora/modificación.
- Falta nivel "consulta" explícito si lo quieren.

### 20. Objetivo general
- Visualización en tiempo real del estado financiero/económico/patrimonial/caja/stock, turnos disponibles, comisiones, sueldos, deudas, rentabilidad, flujo de fondos.

---

## Orden de ataque sugerido (queda como referencia)

1. ~~Bancos + métodos de pago enriquecidos~~ ✓
2. Reportes operativos + rentabilidad por servicio (**próximo**).
3. CRM + inteligencia de turnos.
4. Facturación AFIP/ARCA (cuando confirmen el sistema de origen).
5. Cuentas corrientes completas (cuotas/vencimientos/mora).
6. Estados contables + impuestos + bienes de uso.
7. Conciliación bancaria + Payway + acreditaciones pendientes.
8. Autoconsumos.
9. Tareas tipo Trello + influencers + Meta Ads.
