# Devoluciones — seguimiento

> Lista de devoluciones recibidas sobre el sistema y su estado de avance.
> Última actualización: 2026-06-12

## Leyenda de estado
- ⬜ Pendiente
- 🔍 En análisis
- 🚧 En progreso
- ✅ Hecho
- ⏸️ Bloqueado / requiere definición del usuario

---

## 1. CLIENTES

| # | Devolución | Estado | Notas |
|---|-----------|--------|-------|
| 1.1 | Agregar **Ficha Técnica** = **Historial de servicios** del cliente | ✅ | Sección en el detalle del cliente: visitas con fecha, servicios/insumos, profesional, montos y totales |
| 1.2 | Habilitar clientes para profesionales (que vean/carguen clientes) | ✅ | Nuevo ítem "Clientes" en el menú visible para todos los roles. Empleados pueden ver lista, ver ficha y crear. Editar/desactivar sigue admin/encargada (detalle en solo lectura para empleados) |

## 2. PROVEEDORES

| # | Devolución | Estado | Notas |
|---|-----------|--------|-------|
| 2.1 | Al cargar factura, relacionar el gasto con el **stock** (preguntar qué insumo y aumentar stock) | ✅ | Form de gasto con toggle "Es compra de insumo" → suma stock + actualiza precio. El backend ya lo soportaba; faltaba exponerlo |
| 2.2 | Indicar **qué tipo de insumo** es el gasto | ✅ | El nuevo selector de insumo en el form identifica exactamente qué insumo es la compra |
| 2.3 | Copiar el "paso a paso" de **Proveedores** del sistema actual | ✅ | Aclarado: es solo para el apartado Proveedores. El sistema actual permite "Agregar" una compra/egreso desde el detalle del proveedor (Related Egresos con insumo/cantidad). MALALA ya mostraba el histórico; se agregó el botón **"Registrar compra"** en el detalle → abre el gasto con proveedor preseleccionado, "Es compra de insumo" tildado e insumos filtrados por proveedor |

## 3. TURNOS

| # | Devolución | Estado | Notas |
|---|-----------|--------|-------|
| 3.1 | Igual que **Calendico** (referencia de UX) | ✅ | Vistas semanal y mensual rediseñadas estilo calendario (Calendico/Google Calendar) con bloques legibles |
| 3.2 | Vista por horario: **diaria / semanal / mensual**, en grande | ✅ | Mensual: celdas altas + chips con hora y cliente (antes solo puntitos). Semanal: texto más grande, más turnos visibles |
| 3.3 | Habilitar **servicio por rango de horarios y día** | ✅ (falta aplicar migración) | Disponibilidad por servicio: cada servicio se puede limitar a ciertos días y franjas; afecta la reserva online y la validación al crear/reprogramar turnos. **Requiere correr `drizzle/0003_servicios_horarios.sql` en la base.** Hasta entonces el código degrada a "sin restricción" (nada se rompe) |

## 4. CAJA

| # | Devolución | Estado | Notas |
|---|-----------|--------|-------|
| 4.1 | "No funciona" | ⏸️ | El cliente no precisó qué falla; según el usuario sí funcionaba. Pendiente: verificar el módulo y pedir detalle al cliente |

## 5. BANCOS

| # | Devolución | Estado | Notas |
|---|-----------|--------|-------|
| 5.1 | Contemplar gastos: impuestos, débito/crédito, ingresos brutos | ⬜ | |
| 5.2 | Cargar gastos bancarios para que el **saldo sea REAL** | ⬜ | |

---

## Bitácora de avance

### 2026-06-12
- Creado este documento de seguimiento.
- Relevamiento inicial del proyecto (Next.js 16 + Drizzle + Supabase).
- **PROVEEDORES → STOCK (2.1, 2.2) ✅**: el form de "Nuevo gasto" ahora tiene
  un toggle **"Es compra de insumo"**. Al tildarlo aparece selector de insumo
  (filtrado por proveedor) + cantidad de envases; se rutea a
  `registrarCompraInsumo`, que: suma stock, actualiza precio del insumo en el
  catálogo y carga deuda al proveedor si queda impago. Antes esto solo se podía
  desde el catálogo, insumo por insumo.
  - Archivos: `src/components/forms/egreso-form.tsx`,
    `src/app/(app)/egresos/nuevo/page.tsx`.
  - Verificación: `tsc --noEmit` y `eslint` limpios. No se pudo abrir preview
    (el dev server del usuario ya ocupa :3000 y Next bloquea segunda instancia).
- **CLIENTES · Ficha Técnica (1.1) ✅**: nueva sección "Ficha técnica" en el
  detalle del cliente (`/catalogos/clientes/[id]`) con el historial de servicios:
  cada visita con fecha, líneas de servicio/insumo, profesional que lo hizo,
  subtotales, total de la visita y observación. Encabezado con totales
  (servicios, visitas, gastado). Fuente: `listIngresos({ clienteId })`.
  - Archivo: `src/app/(app)/catalogos/clientes/[id]/page.tsx`.
  - Verificación: `tsc` y `eslint` limpios. Verificado en navegador: sección
    "Ficha técnica" renderiza en el detalle (estado vacío OK).
- **CLIENTES habilitados para profesionales (1.2) ✅**: nuevo ítem **"Clientes"**
  en el menú (grupo Operación) visible para todos los roles → `/catalogos/clientes`.
  El backend ya permitía a empleados ver (`listClientes`/`getCliente`) y crear
  (`createCliente` incluye rol `empleado`); solo faltaba el acceso de navegación.
  El detalle del cliente se muestra **solo lectura** para empleados (sin form de
  edición ni botón activar/desactivar, que siguen siendo admin/encargada) — la
  Ficha Técnica sí la ven. Sin cambios en permisos de escritura existentes.
  - Archivos: `src/app/(app)/layout.tsx`, `src/components/app-sidebar.tsx`
    (ícono `Users`), `src/app/(app)/catalogos/clientes/[id]/page.tsx`.
  - Verificación: `tsc` + `eslint` limpios. Verificado en navegador (logueada
    como encargada): el ítem "Clientes" aparece en el menú y la lista carga.
- **Relevamiento AppSheet (sistema actual)**: capturado el flujo de Proveedores
  para el ítem 2.3. Se accedió de solo lectura, sin guardar nada. El detalle de
  proveedor del sistema actual muestra "Related Egresos" (compras con insumo y
  cantidad) y un botón Agregar para cargar una compra desde el proveedor.
- **PROVEEDORES · Registrar compra desde el proveedor (2.3) ✅**: el detalle de
  proveedor ya mostraba el histórico completo (deuda, resumen, compras por
  insumo, histórico de egresos). Se agregó el botón **"Registrar compra"** que
  abre `/egresos/nuevo?proveedor=<id>&compra=1` con el form en modo compra de
  insumo, proveedor preseleccionado e insumos filtrados por ese proveedor.
  - Archivos: `src/app/(app)/catalogos/proveedores/[id]/page.tsx`,
    `src/app/(app)/egresos/nuevo/page.tsx`, `src/components/forms/egreso-form.tsx`.
  - Verificación: `tsc` + `eslint` limpios. Verificado en navegador: el botón
    abre el form con proveedor "Keraplus" preseleccionado, "Es compra de insumo"
    tildado y el dropdown de insumo filtrado a los insumos de Keraplus.
- **TURNOS · Vistas grandes (3.1, 3.2) ✅**: rediseño de las vistas semanal y
  mensual para que sean legibles tipo Calendico.
  - Mensual: celdas más altas (132px), encabezados y números de día más grandes,
    y cada turno ahora se muestra como un bloque legible (punto de color del
    profesional + hora + nombre del cliente) en vez de puntitos sin texto.
    Muestra hasta 4 por día + "+N más".
  - Semanal: texto más grande (text-xs en vez de 10px), celdas más altas
    (200px) y hasta 5 turnos visibles por día.
  - Archivos: `src/app/(app)/turnos/monthly-view.tsx`,
    `src/app/(app)/turnos/weekly-view.tsx`.
  - Verificación: `tsc` + `eslint` limpios. Verificado en navegador con datos
    reales (mayo 2026): mensual y semanal muestran los turnos con hora y cliente.
- **TURNOS · Disponibilidad por servicio (3.3) ✅ (pendiente migración)**:
  cada servicio puede limitarse a ciertos días y rangos horarios para la reserva
  online.
  - Schema: tabla nueva `servicios_horarios` (servicio_id, dia_semana,
    apertura, cierre). Migración aditiva a mano:
    `drizzle/0003_servicios_horarios.sql` (no la apliqué — la base es Supabase
    remota; la corre el usuario).
  - Motor de slots (`buildAvailableSlots`): intersecta las ventanas de la
    sucursal con las del servicio. **Default compatible**: servicio sin franjas
    cargadas = disponible en todo el horario de la sucursal (los servicios
    existentes no cambian).
  - Enforcement en todos los puntos: reserva pública (`booking-experience`,
    snapshot), validación al crear y reprogramar turnos (`turnos-actions`),
    reserva/reprogramación por token (`turnos-publico`).
  - UI: sección **"Disponibilidad"** en el detalle del servicio (admin) para
    agregar/quitar franjas por día y rango.
  - **Seguridad "no romper nada"**: la migración auto-generada por drizzle
    incluía cambios ya aplicados a mano (motivos_descuento, insumos.vendible…)
    porque el journal estaba desactualizado → la descarté y escribí una
    migración aditiva limpia. Además, las lecturas degradan a "sin restricción"
    (código 42P01) si la tabla aún no existe, así que la agenda y la reserva
    siguen funcionando antes de aplicar la migración.
  - Archivos: `src/lib/db/schema.ts`, `src/lib/types.ts`,
    `src/lib/data/servicios-horarios.ts`, `src/lib/turnos-helpers.ts`,
    `src/lib/data/turnos.ts`, `src/lib/data/turnos-actions.ts`,
    `src/lib/data/turnos-publico.ts`, `src/components/booking/booking-experience.tsx`,
    `src/app/(app)/catalogos/servicios/[id]/page.tsx`,
    `drizzle/0003_servicios_horarios.sql`.
  - Verificación: `tsc` + `eslint` limpios. Verificado en navegador que Turnos
    sigue funcionando con el fallback (tabla aún no migrada). La UI de
    Disponibilidad es admin-only (no verificada en navegador por falta de sesión
    admin); type-checked.
- **PROVEEDORES · Aumento masivo de precios (extra) ✅**: a raíz de la consulta
  sobre cómo se actualiza el costo de reposición cuando un proveedor aumenta.
  - Cómo funciona hoy el costo: al registrar una compra, el sistema sobrescribe
    `precio_envase` y `precio_unitario` del insumo con el último precio pagado
    (`insumos.ts` registrarCompraInsumo). Ese `precio_unitario` alimenta el costo
    de insumos por servicio (vía receta) y por ende el margen/neto.
  - Nuevo: acción `aumentarPreciosProveedor` + sección **"Aumento masivo de
    precios"** en el detalle del proveedor (admin/encargada). Aplica un % (o baja,
    con valor negativo) al **costo** de todos los insumos del proveedor de una
    vez, con confirmación previa. No toca el precio de venta. Antes había que
    hacerlo insumo por insumo.
  - Archivos: `src/lib/data/insumos.ts`,
    `src/components/forms/aumento-precios-proveedor.tsx`,
    `src/app/(app)/catalogos/proveedores/[id]/page.tsx`.
  - Verificación: `tsc` + `eslint` limpios. (No se ejecutó contra la base real
    para no modificar precios de producción; el diálogo de confirmación protege
    al usuario).
