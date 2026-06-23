# Checklist de testeo manual — Aislamiento entre sucursales y roles

> Objetivo: cazar fugas de datos entre las dos sucursales y errores de permisos.
> Marcá cada caso con ✅ (pasa), ❌ (falla → anotá qué pasó) o ⏭️ (no aplica).

## Setup

1. Corré el seed (recrea los datos de prueba):
   ```
   npm run db:seed
   ```
2. App en http://localhost:3000 — login en `/dev/login`.
3. **Cuentas de prueba** (password por defecto: `ChangeMe123!`, salvo que hayas seteado `MALALA_SEED_PASSWORD`):

   | Email | Rol | Sucursal default |
   |-------|-----|------------------|
   | `admin@malala.com` | admin | Malala Centro |
   | `admin.norte@malala.com` | admin | Malala Barrio Norte |
   | `encargada.centro@malala.com` | encargada | Malala Centro |
   | `anita@malala.com` | empleado | Malala Centro |
   | `encargada.norte@malala.com` | encargada | Malala Barrio Norte |
   | `eliana@malala.com` | empleado | Malala Barrio Norte |

   > Nota: cada `admin` está atado a SU sucursal (ve y gestiona solo la suya). El rol que ve **ambas** sucursales es `superadmin`, que no está en el seed. Por eso hay un admin por sucursal.

4. **Técnica clave — "ataque por URL directa":** la seguridad real está en el backend, no en que la UI esconda botones. Para probarla:
   - Logueado como **encargada.centro**, navegá normalmente y copiá de la barra de direcciones algún ID de Centro (ej. `/ventas/<id>`, `/caja/<id>`, `/egresos/<id>`).
   - Después, logueado como **encargada.norte**, pegá esa misma URL con el ID de Centro. **No deberías ver el dato de la otra sucursal.**
   - Para conseguir IDs de la otra sucursal: logueate primero en cada una y anotá un par de IDs de cada lado en una hoja.

> 💡 Recomendación: 3 navegadores/perfiles abiertos en paralelo (admin, encargada.centro, encargada.norte) para comparar qué ve cada uno.

---

## Bloque A — Aislamiento por sucursal (CRÍTICO)

| # | Caso | Pasos | Esperado | Resultado |
|---|------|-------|----------|-----------|
| A1 | Ventas cruzadas por URL | Como **encargada.norte**, abrí `/ventas/<id-de-Centro>` | "No encontrado" / redirige, **nunca** muestra la venta |✅|
| A2 | Caja cruzada por URL | Como **encargada.norte**, abrí `/caja/<id-cierre-de-Centro>` | No muestra el cierre ajeno |✅|
| A3 | Egreso cruzado por URL | Como **encargada.norte**, abrí `/egresos/<id-de-Centro>` (o su detalle) | No muestra el egreso ajeno |✅ |
| A4 | Listado de ventas | Comparar `/ventas` entre las 2 encargadas | Cada una ve SOLO ventas de su sucursal | ✅|
| A5 | Listado de caja | Comparar `/caja` entre las 2 encargadas | Cierres separados por sucursal |✅ |
| A6 | Stock | Comparar `/stock` entre las 2 encargadas | Cantidades independientes por sucursal | |
| A7 | Bancos / cuentas | Comparar `/bancos` y `/catalogos/cuentas-bancarias` | Cuentas y saldos no se cruzan | |
| A8 | Reportes | Comparar `/reportes/*` entre encargadas | Cifras solo de su sucursal | |
| A9 | Selector de sucursal (admin) | Como **admin**, abrí el selector de sucursal | **Ver nota ⚠️**: confirmá si aparecen las 2 sucursales o solo Centro | |
| A10 | Cookie forzada | Editá la cookie `malala_sucursal` poniéndole el ID de la sucursal ajena, recargá | Debe ignorarla y mantenerte en tu sucursal | |
| A11 | Compartidos vs separados | Verificá que clientes/servicios/insumos/proveedores SÍ se comparten, y stock/caja/ingresos/egresos/turnos NO | Coincide con la regla de negocio | |

> ⚠️ **A9 — Hallazgo a confirmar:** en el seed no hay usuario `superadmin`, y el código confina a `admin` a su sucursal default. El spec dice que admin ve ambas. Si el selector solo muestra Centro, es una divergencia con el spec (decidir si el rol "ve todo" debería ser admin o solo superadmin).

---

## Bloque B — Roles y permisos

| # | Caso | Pasos | Esperado | Resultado |
|---|------|-------|----------|-----------|
| B1 | Empleado sin caja | Como **anita** (empleado), abrí `/caja` | Bloqueado / sin acceso | |
| B2 | Empleado sin reportes | Como **anita**, abrí `/reportes` | Bloqueado | |
| B3 | Empleado sin catálogos | Como **anita**, abrí `/catalogos/servicios` | Bloqueado o solo lectura | |
| B4 | Empleado: solo sus comisiones | Como **anita**, mirá ventas/comisiones | Solo ve las propias, no totales del local | |
| B5 | Encargada no edita catálogos globales | Como **encargada.centro**, intentá editar un servicio | Sin permiso de edición global | |
| B6 | Empleado registra venta | Como **anita**, registrá una venta en Centro | Permitido (solo en su sucursal) | |

> ⚠️ **B4 — Hallazgo a confirmar:** los empleados del seed tienen `empleado_id` sin asignar. Verificá si "ver solo mis comisiones" funciona o si el filtro queda vacío/roto al no estar linkeado a un registro de empleado.

---

## Bloque C — Transacción de venta (corazón del sistema)

| # | Caso | Pasos | Esperado | Resultado |
|---|------|-------|----------|-----------|
| C1 | Stock baja al vender | Vendé un servicio con receta, mirá el stock del insumo antes/después | Baja según la receta | |
| C2 | Stock negativo permitido | Vendé un servicio cuyo insumo está en 0 | Permite la venta + **warning** de stock negativo | |
| C3 | Atomicidad | Forzá un error (ej. vender un producto recién desactivado) | NO queda venta a medias ni stock descontado | |
| C4 | Comisión sobre lista (sin descuento absorbido) | Línea con `soporta_descuento = false` y descuento global | Comisión sobre el **precio de lista**, ignora el descuento | |
| C5 | Comisión sobre precio final | Línea con `soporta_descuento = true` y descuento global | Comisión sobre el precio con descuento prorrateado | |
| C6 | Recargo de tarjeta | Pagá con un medio que tenga recargo % | El total sube por el recargo; suma de pagos = total | |
| C7 | Cuenta corriente (CC) | Pagá con medio "CC" | Exige cliente, exige CC habilitada, suma al saldo del cliente | |
| C8 | Venta con caja cerrada | Cerrá la caja del día y luego intentá vender | Rechaza: "la caja ya está cerrada" | |
| C9 | Descuento exige motivo | Cargá un descuento sin elegir motivo | No deja guardar | |
| C10 | Suma de pagos | Poné 2 medios cuya suma ≠ total | No deja guardar | |

---

## Bloque D — Caja e integridad

| # | Caso | Pasos | Esperado | Resultado |
|---|------|-------|----------|-----------|
| D1 | Cierre inmutable | Cerrá una caja y tratá de editarla como encargada | No editable | |
| D2 | Reabrir solo admin | Intentá reabrir un cierre como encargada vs admin | Solo admin reabre | |
| D3 | Cuadre / diferencia | Cargá el desglose de billetes y verificá la diferencia | Cálculo correcto | |
| D4 | Transferencia de stock | Transferí stock entre sucursales | Genera 2 movimientos atómicos (salida + entrada) | |
| D5 | Transferencia de cuentas misma sucursal | Transferí entre cuentas | Rechaza si las cuentas son de sucursales distintas | |

---

## Bloque E — Chatbot (aislamiento por sucursal activa)

| # | Caso | Pasos | Esperado | Resultado |
|---|------|-------|----------|-----------|
| E1 | Anticipos por sucursal | Como **encargada.centro**, pedile al bot los anticipos de un empleado | Solo anticipos de Centro (no de Barrio Norte) | |
| E2 | El bot no conoce otras sucursales | Preguntale por datos/sucursales | Solo responde sobre la sucursal activa | |
| E3 | Escritura confinada | Pedile cambiar el estado de un turno de la otra sucursal | "El turno no pertenece a tu sucursal activa" | |

---

## Bloque F — Bordes y datos

| # | Caso | Pasos | Esperado | Resultado |
|---|------|-------|----------|-----------|
| F1 | Concurrencia de stock | Dos ventas casi simultáneas del mismo insumo | Stock final coherente (sin "perder" descuentos) | |
| F2 | Montos límite | Probá 0, negativos, montos enormes | Validado, sin NaN ni totales raros | |
| F3 | Redondeo ARS | Descuentos % que dan decimales | Redondeo consistente, suma de pagos cuadra | |
| F4 | Catálogo desactivado | Vendé un servicio/insumo recién desactivado | Comportamiento esperado (rechazo claro) | |

---

## Regresión de los fixes ya aplicados (deberían pasar ✅)

| # | Caso | Esperado |
|---|------|----------|
| R1 | `setSatisfaccionVenta` cruzada | Marcar satisfacción de una venta de la otra sucursal → "No tenés acceso a esa venta" |
| R2 | `getCierreCuentas` cruzado | Arqueo de un cierre de la otra sucursal → vacío / sin datos |
| R3 | `listAnticipos` en el chatbot | Anticipos de un empleado → solo los de la sucursal activa (ver E1) |
