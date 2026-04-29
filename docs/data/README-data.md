# Datos fuente — Documentación

> Guía de las planillas Excel que sirven como fuente para la migración inicial. Leer **antes** de escribir el script de migración.

---

## Archivos en `/docs/data`

### 1. `DataBase_Yerba_Buena_Mercato.xlsx`
Base operativa actual de la sucursal Yerba Buena (sincronizada con AppSheet). Contiene transacciones reales desde diciembre 2025 hasta abril 2026.

### 2. `PLANILLA_COSTOS_MALALA_YB.xlsx`
Planilla de costeo: define los **insumos**, sus **precios/proveedores**, y las **recetas** (qué insumo y cuánta cantidad lleva cada servicio). Esta es la **fuente de verdad para recetas**, que en la otra base no existen.

---

## Estrategia de uso

Para Fase 1, dos fuentes complementarias:

| Concepto | Fuente | Hoja |
|---|---|---|
| Servicios | `DataBase` | `Servicios` |
| Insumos | `PLANILLA_COSTOS` | `precios insumos` |
| Recetas (servicio→insumo) | `PLANILLA_COSTOS` | `costos insumos` |
| Empleados | `DataBase` | `Empleados` |
| Clientes | `DataBase` | `Clientes` |
| Proveedores | `DataBase` | `Proveedores` |
| Medios de pago | `DataBase` | `MediosPago` |
| Rubros de gasto | `DataBase` | `RubrosGasto` |
| Histórico ventas (ola 2) | `DataBase` | `Ingresos` + `Detalle_Ingresos` |
| Histórico egresos (ola 2) | `DataBase` | `Egresos` |
| Histórico cierres (ola 2) | `DataBase` | `CierreCaja` |

**Hojas a IGNORAR** (vistas calculadas o legacy):
- `Base vieja de Clientes` (legacy duplicado)
- `Base_Ventas` (vista calculada)
- `Base_Egresos` (vista calculada)
- `KPIs` (vista calculada)
- `Productos` (incompleta, solo 2 filas)
- `analisis`, `sistema`, `cash flow myb` de la planilla de costos (vistas internas, no datos fuente)

---

## Detalle por hoja

### Servicios (de `DataBase`)
**Estructura:** `ServicioID | Rubro | Servicio | Precio Lista`
- 209 servicios con precio cargado, 1 sin precio (revisar manualmente)
- 18 rubros distintos. Algunos están duplicados con diferente capitalización (`facial` vs `FACIAL`, `peluqueria` vs `SERVICIOS DE PELUQUERIA`). **Normalizar a mayúsculas en la migración.**
- Rubros que existen: SERVICIOS DE PELUQUERIA, SERVICIOS NAILS, FACIAL, CEJAS & PESTAÑAS, PROMOS, depilacion, maquillaje social, Servicio de Masajes, gift card, servicios voucher, venta de productos capilares, venta de joyas, inversion YB, comision chini
- Algunos "rubros" no son servicios reales (`inversion YB`, `comision chini`, `gift card`). **Filtrar antes de importar** o asignar a categorías especiales.
- `ServicioID` es numérico secuencial → mapear a UUID en el destino, mantener un campo `legacy_id` para trazabilidad.

### Insumos (`precios insumos` de `PLANILLA_COSTOS`)
**Estructura:** `insumos peluqueria | proveedor | $ / frasco | um | medida del frasco | $ unitario | rinde | observacion`
- ~97 insumos cargados (las 753 filas tienen muchas vacías y secciones)
- **Hay 4 filas con `#DIV/0!` en la columna $ unitario** → el insumo existe pero falta la "medida del frasco". Importar con `precio_unitario = NULL` y marcar para revisión manual.
- `um` (unidad de medida): valores observados → `ud`, `ml`, `grs`, `aplicaciones`. Normalizar a `ud`/`ml`/`g`/`aplicacion`.
- La planilla tiene **secciones por categoría** (insumos peluquería, insumos manicura, etc) separadas por filas vacías o headers grises. El script tiene que detectar headers de sección para asignar categoría.
- Proveedores van como string libre acá (`vlinda`, `super`, `question`, `distrilook`, `keraplus`). **Cruzar con la hoja `Proveedores` de la otra planilla** para deduplicar.

### Recetas (`costos insumos` de `PLANILLA_COSTOS`)
**Estructura:** Tabla ancha con hasta **8 insumos por servicio**. Por cada insumo: `nombre | $ unitario | cantidad | total`.
- Headers en filas 1 y 2 (combinadas). El script tiene que parsear ambas.
- Match con servicios: por `Cod_Servicio` (PEL100, NAI200, etc).
- Match con insumos: por **nombre** (no hay ID de insumo en la receta). **Riesgo:** si el nombre del insumo en la receta no coincide exacto con el de la lista de insumos, falla. Usar matching fuzzy + log de errores.
- Algunas recetas están vacías o incompletas → importar las que tengan datos completos, loguear el resto.

### Empleados (de `DataBase`)
**Estructura:** `EmpleadoID | Nombre | Activo | Comisiones`
- 10 empleados activos:
  - Anita Juarez, Camila Moreno, Eliana Monroy, Katy Herrera, Priscila Leiva, Celeste Acuna, Carolina Rodriguez, Angela Barrionuevo, Jo Viscido Vaca
  - "Prueba" → es un empleado de testing, **NO migrar**
- La columna `Comisiones` es un acumulado actual, no migrar como dato (se recalcula).
- **Las reglas de comisión NO están acá**, están en la hoja `empleados` de la planilla de costos en formato libre. Cargarlas manualmente con admin después del seed (ver doc principal §5.5).

### Clientes (de `DataBase`)
**Estructura:** `ClienteID | Nombre | Telefono | Observacion | Activo | Saldo`
- 1240 clientes con datos (las 2096 filas incluyen vacías).
- `ClienteID` es numérico → mapear a UUID con `legacy_id`.
- `Telefono` viene mezclado: a veces float, a veces int, a veces string con código país. **Normalizar a string E.164** (ej. `+5493816432893`).
- Hay registros con observaciones que aclaran roles (`(empleada)`, `(socia)`) → respetar.
- `Saldo` es la cuenta corriente actual. Se migra en **ola 2** (no en go-live).

### Proveedores (de `DataBase`)
**Estructura:** `Proveedor ID | Nombre | Teléfono | Dirección | CUIT | Deuda Pendiente`
- Mezcla de IDs numéricos y hash. Tratar como string.
- `Deuda Pendiente` se migra en **ola 2**.

### MediosPago (de `DataBase`)
**Estructura:** `MPID | Medio | Activo`
- Códigos cortos (EF, TR, TC, TD, MP, etc). Usar el `MPID` como código en la nueva tabla.

### RubrosGasto (de `DataBase`)
**Estructura:** `GastoID | Rubro | Subrubro | Activo`
- Algunos `GastoID` son hash, otros son strings tipo "Productos". Tratar como string.

### Ingresos + Detalle_Ingresos (ola 2)

**Ingresos** (cabecera): `IngresoID | Fecha | Cliente | Lista de Precios | Valor1 | MP1 | Valor2 | MP2 | Descuento % | Descuento $ | Observacion | ...`
- 2008 registros desde 2025-12-09 hasta 2026-04-28
- Distribución mensual: dic 266, ene 374, feb 437, mar 495, abr 436

**Detalle_Ingresos** (líneas): `DetalleID | IngresoID | Rubro | ServicioID | Precio Efectivo | Precio Lista | Cantidad | Subtotal | Comisión | Empleado | Codigo GC | Nombre Empleado`
- 3199 líneas (1.6 promedio por ticket; máx 8)
- **237 líneas sin empleado asignado** (~7%) → migrar igual con `empleado_id = NULL`, marcar para revisión.
- La columna `Comisión` es el monto ya calculado, no el porcentaje. Guardarlo tal cual + intentar derivar el % dividiendo por subtotal.
- En la migración del histórico **NO disparar descuentos de stock** (son datos pasados, el stock se setea con conteo físico actual).

### CierreCaja (ola 2)
- 54 cierres con fecha. Estructura completa con desglose de billetes y rubros (ver doc principal §5.6).
- Hay columnas raras al final (`'TC'`, `'EF'` solos) → ignorar, son artefactos.

### Egresos (ola 2)
**Estructura:** `EgresoID | Fecha | Gasto | ConceptoGasto | Insumo | Proveedor | Cantidad | Valor1 | MP1 | Valor2 | MP2 | Observacion | Total | Pagado?`
- 1717 registros.
- `Pagado?` boolean → si está en `False`, mantener como cuenta a pagar al proveedor.

---

## Problemas conocidos a manejar

| Problema | Solución |
|---|---|
| IDs mezclados (numéricos + hash) | Mapear todo a UUID nuevo, guardar `legacy_id` |
| Rubros duplicados por capitalización | Normalizar a mayúsculas en migración |
| Teléfonos en distintos formatos | Normalizar a E.164 |
| Insumos con `#DIV/0!` | Importar con `precio_unitario = NULL` |
| Recetas con nombres no matcheados | Log de errores, importar el resto |
| 237 líneas de detalle sin empleado | Importar con `empleado_id = NULL` |
| Empleado "Prueba" | Filtrar en migración |
| Histórico de stock | NO existe — conteo físico el día del go-live |
| Datos solo de YB | Barrio Norte arranca con stock cero y catálogo compartido |

---

## Orden de ejecución del script de migración

```
1. Sucursales (seed manual: YB, BN)
2. MediosPago
3. RubrosGasto
4. Proveedores
5. Insumos  → si proveedor no existe en hoja Proveedores, crearlo on-the-fly
6. Servicios
7. Recetas  → requiere insumos y servicios ya cargados
8. Empleados (filtrar "Prueba")
9. Clientes
10. Stock inicial → desde CSV de conteo físico (no del Excel)
```

**Después del go-live (ola 2):**

```
11. Ingresos + Detalle_Ingresos (sin disparar movimientos de stock)
12. Egresos
13. CierresCaja
14. Saldos CC clientes y proveedores
```
