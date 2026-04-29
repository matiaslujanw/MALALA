# Sistema MALALA — Prompt Inicial · Fase 1 (MVP)

> Este documento es el contexto completo para iniciar el desarrollo. Pasalo a Claude Code (o equivalente) al arrancar el proyecto. Las fases 2 y 3 están al final como referencia, pero no se implementan ahora.

---

## 1. Contexto del negocio

**MALALA Hair and Nails** es un salón de belleza con 2 sucursales:
- **Yerba Buena** (Tucumán)
- **Barrio Norte** (Tucumán)

Volumen actual: ~450 tickets/mes por sucursal. Promedio 1,6 servicios por ticket (máx. observado: 8). Catálogo de ~230 servicios y ~750 insumos. Personal: peluqueros, manicuristas, encargada.

Hoy operan con un Excel sincronizado a AppSheet. Migran a un sistema propio para ganar:
- Control real de stock con descuento automático por recetas
- Comisiones calculadas por línea de venta
- Reportes confiables y multi-sucursal real

## 2. Stack técnico

- **Framework:** Next.js 15 (App Router) + TypeScript estricto
- **DB:** Postgres en Supabase
- **ORM:** Drizzle
- **Auth:** Supabase Auth (email + password)
- **UI:** shadcn/ui + Tailwind CSS
- **Forms:** React Hook Form + Zod
- **Tablas:** TanStack Table
- **Deploy:** Vercel
- **Idioma de la UI:** español (Argentina). Moneda: ARS.

## 3. Roles y permisos

- **admin**: acceso total a ambas sucursales. Gestiona catálogos, ve todos los reportes, edita recetas, gestiona usuarios.
- **encargada**: acceso a *su* sucursal. Gestiona stock, hace cierre de caja, registra ventas y egresos, ve reportes de su sucursal. No edita catálogos globales (servicios, recetas, empleados).
- **empleado**: registra ventas (solo en su sucursal), consulta sus propias comisiones acumuladas. No ve cifras totales del local ni comisiones de otros.

Cada usuario está asignado a una sucursal por defecto. Admin puede cambiar de sucursal en la UI con un selector.

## 4. Multi-sucursal — reglas de separación

**Por sucursal (separados):** stock de insumos, cierres de caja, ingresos, egresos, turnos.

**Compartidos:** catálogo de servicios, catálogo de insumos (definición), recetas, clientes, proveedores, medios de pago, rubros de gasto.

**Empleados:** tienen una sucursal principal pero pueden registrar ventas en cualquiera (los empleados rotan ocasionalmente). Las comisiones se calculan por venta, no por empleado-sucursal.

## 5. Alcance de la Fase 1 (este MVP)

### 5.1 Autenticación y usuarios
- Login con email/password (Supabase Auth)
- Tabla `usuarios` con rol y sucursal_default
- Middleware Next que valida sesión y redirige
- Layout con selector de sucursal (visible para admin)

### 5.2 Catálogos (CRUD completos, solo admin edita)
- **Sucursales** (seed: Yerba Buena, Barrio Norte)
- **Empleados**: nombre, activo, regla de comisión (ver §6), sucursal principal
- **Clientes**: nombre, teléfono, observación, activo
- **Servicios**: rubro, nombre, precio_lista, precio_efectivo, comisión default %
- **Insumos**: nombre, proveedor, presentación (ml/g/ud), tamaño envase, $/envase, $/unidad calculado, rinde opcional
- **Recetas**: por cada servicio, lista de insumos con cantidad usada
- **Proveedores**: nombre, teléfono, CUIT
- **Medios de pago** (seed: EF, TR, TC, TD, MP, etc.)
- **Rubros de gasto**

### 5.3 Stock por sucursal
- Tabla `stock_sucursal` (insumo + sucursal → cantidad actual)
- Tabla `movimientos_stock` (audit log: tipo, cantidad, motivo, ref_id, fecha, usuario)
- Tipos de movimiento: `compra`, `venta` (auto), `ajuste_manual`, `transferencia_entrada`, `transferencia_salida`
- Vista: stock actual por sucursal con filtro y alerta visual de stock bajo (umbral configurable por insumo)
- Acción "Ajuste manual" con motivo obligatorio
- Acción "Transferencia entre sucursales" (genera 2 movimientos atómicos)

### 5.4 Ventas (corazón del sistema)
**Pantalla de nueva venta:**
- Seleccionar cliente (autocomplete con búsqueda + opción "+ nuevo cliente" inline)
- Agregar líneas: cada línea tiene servicio + empleado + precio efectivo (auto desde catálogo, editable) + comisión % (auto desde regla del empleado o servicio, editable)
- Descuento global (% o $)
- Medios de pago: hasta 2 (con monto cada uno, suma debe = total - descuento)
- Observación

**Al guardar la venta (transacción atómica):**
1. Insertar fila en `ingresos` (cabecera)
2. Insertar N filas en `ingreso_lineas` con comisión calculada
3. Por cada línea: leer la receta del servicio y descontar stock del insumo en la sucursal de la venta. Insertar movimientos en `movimientos_stock` tipo `venta`.
4. Si algún insumo no tiene stock suficiente: **NO bloquear la venta**, solo registrar el movimiento (stock puede quedar negativo) y mostrar warning. Es realista para el negocio: a veces venden antes de cargar la compra.

**Listado de ventas del día:** filtrable por sucursal, empleado, cliente. Editable solo por admin/encargada.

### 5.5 Comisiones por línea
Cada línea de ingreso guarda `comision_porcentaje` y `comision_monto` calculado al momento.

**Reglas observadas en el negocio (configurables por empleado):**
- **Manicuristas**: 30% sobre trabajos en efectivo, con sueldo asegurado mensual (ej. 500.000). Al cierre del mes se paga el mayor entre la suma de comisiones y el asegurado.
- **Peluqueros**: 30% sobre efectivo + 5% sobre venta de productos capilares, con asegurado (ej. 800.000).
- **Encargada**: sueldo fijo (ej. 1.150.000) + 10% sobre venta de accesorios.

En Fase 1: guardar el % y monto por línea + un campo `regla_comision` en empleado con tipo (`porcentaje`, `mixto`, `sueldo_fijo`), `porcentaje_default` y `sueldo_asegurado`. La liquidación efectiva se hace en Fase 2.

### 5.6 Cierre de caja (por sucursal, por día)
Replicar el modelo actual:
- Saldo inicial efectivo, saldo banco
- Desglose de billetes (20.000, 10.000, 2.000, 1.000, 500, 200, 100, 50)
- Ingresos efectivo, egresos efectivo, ingresos bancarios, egresos bancarios
- Cobros TC, TD, vouchers canjeados, gift cards canjeadas
- Autoconsumos, ingresos cheque, aportes socios, ingresos CC, anticipos
- Diferencia calculada (cuadre)
- Solo encargada/admin pueden cerrar caja
- Una vez cerrada, no editable (salvo admin con confirm)

### 5.7 Egresos
- Fecha, rubro, sub-rubro, insumo (opcional), proveedor (opcional), cantidad (opcional), valor, medio de pago, observación, pagado sí/no, sucursal
- Si el egreso está vinculado a un insumo y es tipo "compra": **sumar al stock automáticamente** generando un movimiento

### 5.8 Reportes mínimos (Fase 1)
- Ventas del día / mes por sucursal
- Top 10 servicios más vendidos
- Comisiones acumuladas por empleado en el mes
- Stock bajo (insumos por debajo del umbral)

## 6. Modelo de datos (esquema Drizzle)

> Schemas de referencia. Adaptar nombres y agregar índices según convenga.

```ts
// Tablas core (Fase 1)
sucursales(id, nombre, activo)
usuarios(id, email, nombre, rol, sucursal_default_id, activo)
empleados(id, nombre, activo, sucursal_principal_id, tipo_comision, porcentaje_default, sueldo_asegurado, observacion)
clientes(id, nombre, telefono, observacion, activo, saldo_cc)
proveedores(id, nombre, telefono, cuit, deuda_pendiente)
servicios(id, rubro, nombre, precio_lista, precio_efectivo, comision_default_pct, activo)
insumos(id, nombre, proveedor_id, unidad_medida, tamano_envase, precio_envase, precio_unitario, rinde, umbral_stock_bajo, activo)
recetas(id, servicio_id, insumo_id, cantidad)  // unique(servicio_id, insumo_id)
medios_pago(id, codigo, nombre, activo)
rubros_gasto(id, rubro, subrubro, activo)

// Stock
stock_sucursal(id, insumo_id, sucursal_id, cantidad)  // unique(insumo_id, sucursal_id)
movimientos_stock(id, insumo_id, sucursal_id, tipo, cantidad, motivo, ref_tipo, ref_id, usuario_id, fecha)

// Ventas
ingresos(id, fecha, sucursal_id, cliente_id, subtotal, descuento_pct, descuento_monto, total, mp1_id, valor1, mp2_id, valor2, observacion, usuario_id, anulado)
ingreso_lineas(id, ingreso_id, servicio_id, empleado_id, precio_efectivo, cantidad, subtotal, comision_pct, comision_monto)

// Egresos
egresos(id, fecha, sucursal_id, rubro_id, insumo_id, proveedor_id, cantidad, valor, mp_id, observacion, pagado, usuario_id)

// Caja
cierres_caja(id, sucursal_id, fecha, saldo_inicial_ef, saldo_banco, billetes_jsonb, ingresos_ef, egresos_ef, ingresos_banc, egresos_banc, cobros_tc, cobros_td, vouchers, giftcards, autoconsumos, cheques, aportes, ingresos_cc, anticipos, observacion, cerrado_por, fecha_cierre)
```

## 7. Estructura de carpetas

```
/app
  /(auth)/login
  /(app)
    /layout.tsx                # Layout con sidebar + selector sucursal
    /dashboard
    /ventas
      /nueva
      /[id]
    /caja
    /stock
    /egresos
    /catalogos
      /servicios
      /insumos
      /recetas
      /clientes
      /empleados
      /proveedores
    /reportes
/lib
  /db                          # schema drizzle, conexión
  /auth                        # helpers de sesión
  /actions                     # server actions
  /validations                 # schemas zod
/components
  /ui                          # shadcn
  /forms
  /tables
/scripts
  /migrate-from-excel.ts       # importador (ola 1 y 2)
```

## 8. Plan de migración de datos

**Antes del go-live (ola 1):**
1. Script `migrate-catalogos.ts`: leer Excel original, importar servicios, insumos, recetas, clientes, proveedores, empleados, medios de pago, rubros de gasto.
2. Conteo físico de stock el día del arranque y carga manual o por CSV.

**Después del go-live (ola 2, en background):**
3. Script `migrate-historico.ts`: importar ~2000 ingresos + 3200 detalles + egresos desde diciembre 2025. No dispara descuentos de stock (datos pasados).
4. Saldos de cuenta corriente de clientes y proveedores.

## 9. Criterios de "listo" para Fase 1

- Login funciona con los 3 roles
- Admin puede crear sucursales, empleados, servicios, insumos, recetas
- Encargada puede registrar una venta con 3 servicios asignados a 3 empleados distintos
- Al guardar esa venta, el stock de los insumos correspondientes baja automáticamente
- Stock negativo permitido pero con warning visual
- Comisiones se ven correctas en el detalle de la venta y acumuladas en reporte mensual
- Cierre de caja se puede hacer y queda inmutable
- Stock bajo aparece resaltado en la vista de stock
- Multi-sucursal funciona: cambiar de sucursal cambia ventas, caja, stock
- Migración ola 1 corrida con datos reales

## 10. Fases siguientes (no implementar ahora)

**Fase 2:** Cuenta corriente clientes y proveedores · Pagos de comisiones (liquidación mensual con regla del mayor) · Reportes avanzados (margen por servicio, productividad por empleado) · Ajustes masivos de stock · Alertas push de stock bajo · Migración del histórico (ola 2).

**Fase 3:** Agenda de turnos con asignación a múltiples empleados · Integración con WhatsApp para confirmaciones · Sincronización con Google Calendar.

---

## Indicaciones para iniciar

1. Inicializá el repo con `npx create-next-app@latest` (TS, App Router, Tailwind, ESLint).
2. Configurá Supabase (proyecto nuevo, copiá las env vars).
3. Instalá Drizzle + drizzle-kit + postgres-js. Generá el schema completo de §6.
4. Corré la primera migración. Seedeá sucursales y medios de pago.
5. Implementá auth + layout antes que cualquier feature.
6. Después: catálogos → stock → ventas → caja → reportes, en ese orden.

Trabajemos iterativo: feature completa con su test manual antes de pasar a la próxima.
