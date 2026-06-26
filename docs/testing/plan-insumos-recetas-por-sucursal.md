# Plan de testeo manual — Insumos y recetas por sucursal

Verifica dos cosas:
1. La **conexión receta ↔ insumo ↔ stock** al vender (lo del workflow inicial).
2. El **aislamiento por sucursal** de insumos y recetas (lo que cambiamos ahora).

## Preparación

- [ ] Correr la migración `drizzle/0020_insumos_recetas_por_sucursal.sql` en Supabase.
- [ ] Tener **dos sucursales** (ej. **Centro** y **Barrio Norte**) y un usuario **admin**.
- [ ] El cambio de sucursal activa se hace con el **selector de sucursal** del menú
      (Sucursal Switcher). Cada vez que el plan dice "parado en X", cambiá ahí.

> Nota: la migración conserva tus datos. Insumos que estaban en varias sucursales
> quedan en una sola; su stock en la otra queda colgado (no se borra, no se lista).

---

## Parte A — Insumo por sucursal (definición, precio y stock aislados)

- [ ] **A1.** Parado en **Centro**, Catálogos → Insumos → **Nuevo**: creá
      "Shampoo test", unidad **ml**, envase **1000**, precio envase **$10.000**.
      → Esperado: en la lista aparece y el **$ unit. = $10/ml**.
- [ ] **A2.** Cambiá a **Barrio Norte** → Catálogos → Insumos.
      → Esperado: **"Shampoo test" NO aparece** (es de Centro).
- [ ] **A3.** En **Barrio Norte** creá otro "Shampoo test" con envase **1000** y precio
      **$13.000**. → Esperado: aparece solo en Barrio Norte, **$ unit. = $13/ml**.
- [ ] **A4.** Volvé a **Centro** → Insumos. → Esperado: ves el de **$10/ml**, no el de $13.
- [ ] **A5.** Stock (en Centro) → **Ajuste manual**: cargá **1000 ml** del shampoo de Centro.
      Cambiá a Barrio Norte → Stock. → Esperado: el stock de Centro **no** se ve ahí; cada
      sucursal lista solo sus insumos.

## Parte B — Receta por sucursal (costo/margen distinto por sede)

- [ ] **B1.** Que exista un servicio ofrecido en **ambas** sucursales (ej. "Brushing").
- [ ] **B2.** Parado en **Centro**, Catálogos → Recetas → **Cargar** en Brushing →
      agregar "Shampoo test" con **30 ml**.
      → Esperado KPIs: Costo insumos = **$300** (30 × $10), y se ve Comisión y **Margen real**.
- [ ] **B3.** Cambiá a **Barrio Norte** → Recetas → Brushing.
      → Esperado: aparece como **"Cargar"** (sin receta), independiente de Centro.
- [ ] **B4.** En **Barrio Norte** cargá Brushing con el shampoo de allá **20 ml**.
      → Esperado: Costo insumos = **$260** (20 × $13). Distinto al de Centro.
- [ ] **B5.** Comparar el "Margen real" del mismo servicio en Centro vs Barrio Norte.
      → Esperado: **difieren** (distinto costo de insumo por sede).

## Parte C — Venta: descuento de stock y costeo (workflow original)

- [ ] **C1.** Parado en **Centro**, Ventas → Nueva: vendé un **Brushing**.
- [ ] **C2.** Volvé a Stock (Centro). → Esperado: el shampoo bajó **30 ml** (de 1000 a 970).
- [ ] **C3.** Stock → **Movimientos**. → Esperado: hay un movimiento tipo **venta** del
      shampoo, referenciado a esa venta.
- [ ] **C4.** Confirmá que el stock del shampoo de **Barrio Norte** **no** cambió
      (la venta fue en Centro). → Esperado: intacto.
- [ ] **C5.** **Stock negativo no bloquea**: vendé Brushing varias veces hasta pasar el
      stock disponible. → Esperado: la venta **se registra igual** y aparece un **aviso de
      stock negativo**.
- [ ] **C6.** Reportes → Ventas (y/o Servicios). → Esperado: el **costo de insumos** y el
      **neto** reflejan lo descontado, con el costo de **la sucursal de la venta**.

## Parte D — Transferencias eliminadas

- [ ] **D1.** Stock (como admin). → Esperado: ya **no** existe el botón **"Transferir"**
      (solo "Movimientos" y "Ajuste manual").
- [ ] **D2.** Entrar a mano a `/stock/transferencia`. → Esperado: **404 / no existe**.
- [ ] **D3.** Bancos → la transferencia **bancaria** sigue funcionando (es otra cosa, no se tocó).

## Parte E — Casos borde / regresiones

- [ ] **E1.** Aumento de precios por proveedor (Catálogos → Proveedores → aumentar precios)
      estando en **Centro**. → Esperado: solo cambian precios de insumos de **Centro**, no de
      Barrio Norte.
- [ ] **E2.** Producto **vendible**: marcá un insumo como vendible con precio de venta en
      Centro. En Ventas → Nueva, agregá ese producto. → Esperado: solo aparecen los
      vendibles de la **sucursal activa**, y al vender descuenta su stock.
- [ ] **E3.** Borrar un ítem de receta (Recetas → Editar → tacho) en una sucursal.
      → Esperado: se quita solo en esa sucursal; la otra queda igual.
- [ ] **E4.** Editar la cantidad de un insumo en la receta (↻). → Esperado: el costo/margen
      se recalcula al instante.

---

## Resultado esperado global

Cada sucursal maneja **sus propios** insumos (con su precio y stock) y **su propia**
receta por servicio. Vender en una sucursal nunca toca el stock ni el costo de la otra.
Esto vale igual con datos de prueba o en producción: el modelo ya no comparte nada entre
sucursales.
