/**
 * Store en memoria. Singleton via globalThis para sobrevivir al HMR de Next dev.
 * Cuando migremos a Supabase, este módulo desaparece y `lib/data/*` apunta a Drizzle.
 */
import type {
  CierreCaja,
  Cliente,
  Egreso,
  Empleado,
  Ingreso,
  IngresoLinea,
  Insumo,
  MedioPago,
  MovimientoStock,
  Proveedor,
  Receta,
  RubroGasto,
  Servicio,
  StockSucursal,
  Sucursal,
  Usuario,
} from "@/lib/types";
import { seed } from "./seed";

export interface Store {
  sucursales: Sucursal[];
  usuarios: Usuario[];
  empleados: Empleado[];
  clientes: Cliente[];
  proveedores: Proveedor[];
  servicios: Servicio[];
  insumos: Insumo[];
  recetas: Receta[];
  mediosPago: MedioPago[];
  rubrosGasto: RubroGasto[];
  stockSucursal: StockSucursal[];
  movimientosStock: MovimientoStock[];
  ingresos: Ingreso[];
  ingresoLineas: IngresoLinea[];
  egresos: Egreso[];
  cierresCaja: CierreCaja[];
}

declare global {
  // eslint-disable-next-line no-var
  var __malalaStore: Store | undefined;
}

function createStore(): Store {
  return seed();
}

export const store: Store = globalThis.__malalaStore ?? createStore();
if (!globalThis.__malalaStore) {
  globalThis.__malalaStore = store;
}

export function id(): string {
  return crypto.randomUUID();
}
