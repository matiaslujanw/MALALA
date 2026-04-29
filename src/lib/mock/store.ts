/**
 * Store en memoria. Singleton via globalThis para sobrevivir al HMR de Next dev.
 * Cuando migremos a Supabase, este módulo desaparece y `lib/data/*` apunta a Drizzle.
 */
import type {
  CierreCaja,
  Cliente,
  Egreso,
  Empleado,
  HorarioSucursal,
  Ingreso,
  IngresoLinea,
  Insumo,
  MedioPago,
  MovimientoStock,
  ProfesionalAgenda,
  Proveedor,
  Receta,
  RubroGasto,
  Servicio,
  StockSucursal,
  Sucursal,
  Turno,
  TurnoEvento,
  Usuario,
} from "@/lib/types";
import { seed } from "./seed";

export interface Store {
  sucursales: Sucursal[];
  horariosSucursal: HorarioSucursal[];
  usuarios: Usuario[];
  empleados: Empleado[];
  profesionalesAgenda: ProfesionalAgenda[];
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
  turnos: Turno[];
  turnoEventos: TurnoEvento[];
  egresos: Egreso[];
  cierresCaja: CierreCaja[];
}

declare global {
  var __malalaStore: Store | undefined;
}

function createStore(): Store {
  return seed();
}

function normalizeStore(existing: Store | undefined): Store {
  const fresh = createStore();
  if (!existing) return fresh;

  return {
    ...fresh,
    ...existing,
    horariosSucursal: existing.horariosSucursal ?? fresh.horariosSucursal,
    profesionalesAgenda:
      existing.profesionalesAgenda ?? fresh.profesionalesAgenda,
    turnos: existing.turnos ?? fresh.turnos,
    turnoEventos: existing.turnoEventos ?? fresh.turnoEventos,
  };
}

export const store: Store = normalizeStore(globalThis.__malalaStore);
globalThis.__malalaStore = store;

export function id(): string {
  return crypto.randomUUID();
}
