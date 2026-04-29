/**
 * Tipos de dominio MALALA. Espejados al schema Drizzle de Fase 1 (§6 del prompt inicial).
 * Cuando migremos a Drizzle, estos tipos se reemplazan por InferSelectModel sin cambiar la forma.
 */

export type ID = string;

export type Rol = "admin" | "encargada" | "empleado";
export type TipoComision = "porcentaje" | "mixto" | "sueldo_fijo";
export type UnidadMedida = "ud" | "ml" | "g" | "aplicacion";
export type TurnoEstado =
  | "pendiente"
  | "confirmado"
  | "en_curso"
  | "completado"
  | "cancelado"
  | "ausente";
export type TurnoCanal = "web" | "recepcion";
export type TurnoEventoTipo =
  | "creado"
  | "pendiente"
  | "confirmado"
  | "reprogramado"
  | "cancelado"
  | "ausente"
  | "completado"
  | "en_curso";
export type TipoMovimientoStock =
  | "compra"
  | "venta"
  | "ajuste_manual"
  | "transferencia_entrada"
  | "transferencia_salida";

export interface Sucursal {
  id: ID;
  nombre: string;
  activo: boolean;
  slug?: string;
  direccion?: string;
  telefono?: string;
  horario_resumen?: string;
  rating?: number;
  reviews?: number;
  mapa_url?: string;
  descripcion_corta?: string;
}

export interface Usuario {
  id: ID;
  email: string;
  nombre: string;
  rol: Rol;
  sucursal_default_id: ID;
  empleado_id?: ID;
  activo: boolean;
}

export interface Empleado {
  id: ID;
  nombre: string;
  activo: boolean;
  sucursal_principal_id: ID;
  tipo_comision: TipoComision;
  porcentaje_default: number; // 0-100
  sueldo_asegurado: number;
  observacion?: string;
}

export interface Cliente {
  id: ID;
  nombre: string;
  telefono?: string;
  observacion?: string;
  activo: boolean;
  saldo_cc: number;
}

export interface Proveedor {
  id: ID;
  nombre: string;
  telefono?: string;
  cuit?: string;
  deuda_pendiente: number;
}

export interface Servicio {
  id: ID;
  rubro: string;
  nombre: string;
  precio_lista: number;
  precio_efectivo: number;
  comision_default_pct: number; // 0-100
  activo: boolean;
  duracion_min?: number;
  descripcion_corta?: string;
  destacado_pct?: number;
}

export interface HorarioSucursal {
  id: ID;
  sucursal_id: ID;
  dia_semana: number; // 0 domingo ... 6 sábado
  apertura: string; // HH:mm
  cierre: string; // HH:mm
}

export interface ProfesionalAgenda {
  id: ID;
  empleado_id: ID;
  sucursal_id: ID;
  especialidad: string;
  avatar_url: string;
  color: string;
  bio?: string;
  prioridad: number;
  activo_publico: boolean;
}

export interface Turno {
  id: ID;
  sucursal_id: ID;
  servicio_id: ID;
  profesional_id: ID;
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_email?: string;
  fecha_turno: string; // YYYY-MM-DD
  hora: string; // HH:mm
  duracion_min: number;
  estado: TurnoEstado;
  canal: TurnoCanal;
  observacion?: string;
  creado_en: string; // ISO
  creado_por_usuario_id?: ID;
  actualizado_en?: string;
  actualizado_por_usuario_id?: ID;
  origen: "publico" | "interno";
  sin_preferencia: boolean;
}

export interface TurnoEvento {
  id: ID;
  turno_id: ID;
  tipo: TurnoEventoTipo;
  actor_usuario_id?: ID;
  fecha: string; // ISO
  detalle?: string;
}

export interface Insumo {
  id: ID;
  nombre: string;
  proveedor_id?: ID;
  unidad_medida: UnidadMedida;
  tamano_envase: number;
  precio_envase: number;
  precio_unitario: number | null; // null si no se pudo calcular
  rinde?: number;
  umbral_stock_bajo: number;
  activo: boolean;
}

export interface Receta {
  id: ID;
  servicio_id: ID;
  insumo_id: ID;
  cantidad: number;
}

export interface MedioPago {
  id: ID;
  codigo: string;
  nombre: string;
  activo: boolean;
}

export interface RubroGasto {
  id: ID;
  rubro: string;
  subrubro?: string;
  activo: boolean;
}

export interface StockSucursal {
  id: ID;
  insumo_id: ID;
  sucursal_id: ID;
  cantidad: number;
}

export interface MovimientoStock {
  id: ID;
  insumo_id: ID;
  sucursal_id: ID;
  tipo: TipoMovimientoStock;
  cantidad: number; // positivo entrada, negativo salida
  motivo?: string;
  ref_tipo?: string;
  ref_id?: ID;
  usuario_id: ID;
  fecha: string; // ISO
}

export interface Ingreso {
  id: ID;
  fecha: string; // ISO
  sucursal_id: ID;
  cliente_id?: ID;
  subtotal: number;
  descuento_pct: number;
  descuento_monto: number;
  total: number;
  mp1_id: ID;
  valor1: number;
  mp2_id?: ID;
  valor2?: number;
  observacion?: string;
  usuario_id: ID;
  anulado: boolean;
}

export interface IngresoLinea {
  id: ID;
  ingreso_id: ID;
  servicio_id: ID;
  empleado_id?: ID;
  precio_efectivo: number;
  cantidad: number;
  subtotal: number;
  comision_pct: number;
  comision_monto: number;
}

export interface Egreso {
  id: ID;
  fecha: string;
  sucursal_id: ID;
  rubro_id: ID;
  insumo_id?: ID;
  proveedor_id?: ID;
  cantidad?: number;
  valor: number;
  mp_id: ID;
  observacion?: string;
  pagado: boolean;
  usuario_id: ID;
}

export interface CierreCaja {
  id: ID;
  sucursal_id: ID;
  fecha: string;
  saldo_inicial_ef: number;
  saldo_banco: number;
  billetes: Record<string, number>;
  ingresos_ef: number;
  egresos_ef: number;
  ingresos_banc: number;
  egresos_banc: number;
  cobros_tc: number;
  cobros_td: number;
  vouchers: number;
  giftcards: number;
  autoconsumos: number;
  cheques: number;
  aportes: number;
  ingresos_cc: number;
  anticipos: number;
  observacion?: string;
  cerrado_por: ID;
  fecha_cierre: string;
}

export interface AccessScope {
  rol: Rol;
  sucursalIdsPermitidas: ID[];
  empleadoId?: ID;
  puedeVerGlobal: boolean;
  puedeAdministrarTurnos: boolean;
  puedeVerStock: boolean;
  puedeGestionarStock: boolean;
  puedeVerReportes: boolean;
  puedeVerCaja: boolean;
  puedeVerCatalogos: boolean;
}
