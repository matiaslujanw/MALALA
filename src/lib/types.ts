/**
 * Tipos de dominio MALALA. Espejados al schema Drizzle de Fase 1 (Â§6 del prompt inicial).
 * Cuando migremos a Drizzle, estos tipos se reemplazan por InferSelectModel sin cambiar la forma.
 */

export type ID = string;

export type Rol = "superadmin" | "admin" | "encargada" | "empleado";
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
  sucursal_ids_permitidas?: ID[];
  activo: boolean;
}

export interface Empleado {
  id: ID;
  nombre: string;
  activo: boolean;
  sucursal_principal_id: ID;
  tipo_comision: TipoComision;
  porcentaje_default: number; // 0-100
  sueldo_asegurado: number; // legacy, ya no se usa en el cálculo
  valor_hora: number;
  horas_por_dia: number;
  dias_trabajo: number[]; // 0=domingo … 6=sábado
  observacion?: string;
}

export interface Cliente {
  id: ID;
  nombre: string;
  telefono?: string;
  telefono_e164?: string;
  email?: string;
  observacion?: string;
  activo: boolean;
  saldo_cc: number;
  cuenta_corriente_habilitada: boolean;
  // Ficha técnica — perfil fijo (estilo historia clínica).
  tipo_cabello?: string;
  salud_cabello?: string;
  alergias?: string;
  color_actual?: string;
  observaciones_tecnicas?: string;
}

/** Registro fechado de la ficha técnica (fórmula de color, servicio, notas). */
export interface FichaRegistro {
  id: ID;
  cliente_id: ID;
  fecha: string; // ISO
  servicio_id?: ID;
  servicio_nombre?: string;
  formula?: string;
  notas?: string;
  empleado_id?: ID;
  empleado_nombre?: string;
  usuario_id: ID;
  creado_en: string; // ISO
}

export type TipoMovimientoCc = "cargo" | "pago";

export interface MovimientoCc {
  id: ID;
  cliente_id: ID;
  fecha: string; // ISO
  tipo: TipoMovimientoCc;
  monto: number; // siempre positivo; el tipo define el signo sobre el saldo
  sucursal_id?: ID;
  mp_id?: ID;
  ref_tipo?: string;
  ref_id?: ID;
  descripcion?: string;
  usuario_id: ID;
  creado_en: string; // ISO
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
  es_promo?: boolean;
  vence_el?: string; // YYYY-MM-DD, vencimiento opcional (solo promos)
  // Solo promos: nombres de los servicios que combina (para mostrar en la reserva).
  promo_componentes?: string[];
}

export interface PromocionComponente {
  servicio_id: ID;
  nombre: string;
  precio_lista: number;
  comision_default_pct: number;
  orden: number;
}

/** Una promo es un Servicio (es_promo=true) más sus servicios componentes. */
export interface Promocion extends Servicio {
  componentes: PromocionComponente[];
}

export interface HorarioSucursal {
  id: ID;
  sucursal_id: ID;
  dia_semana: number; // 0 domingo ... 6 sÃ¡bado
  apertura: string; // HH:mm
  cierre: string; // HH:mm
}

export interface ServicioHorario {
  id: ID;
  servicio_id: ID;
  dia_semana: number; // 0 domingo ... 6 sabado
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
  cliente_id: ID;
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_telefono_e164: string;
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
  token_acceso: string;
  token_expira_en: string;
  confirmacion_enviada_en?: string;
  recordatorio_2h_enviado_en?: string;
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
  vendible: boolean;
  precio_venta?: number;
}

export interface Receta {
  id: ID;
  servicio_id: ID;
  insumo_id: ID;
  cantidad: number;
}

export interface MedioPago {
  id: ID;
  sucursal_id: ID;
  codigo: string;
  nombre: string;
  activo: boolean;
  cuenta_id?: ID;
  recargo_pct: number; // 0-100, recargo automático al cobrar con este medio
}

export type TipoCuenta = "banco" | "efectivo";
export type TipoMovBancario =
  | "ingreso"
  | "egreso"
  | "transferencia_entrada"
  | "transferencia_salida"
  | "ajuste";

export interface CuentaBancaria {
  id: ID;
  sucursal_id: ID;
  nombre: string;
  tipo: TipoCuenta;
  activo: boolean;
  observacion?: string;
}

export interface MovimientoBancario {
  id: ID;
  cuenta_id: ID;
  fecha: string; // ISO
  tipo: TipoMovBancario;
  monto: number;
  sucursal_id?: ID;
  ref_tipo?: string;
  ref_id?: ID;
  descripcion?: string;
  usuario_id: ID;
}

export interface RubroGasto {
  id: ID;
  rubro: string;
  subrubro?: string;
  activo: boolean;
}

export interface MotivoDescuento {
  id: ID;
  nombre: string;
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
  descuento_motivo_id?: ID;
  total: number;
  mp1_id: ID;
  valor1: number;
  mp1_cuenta_id?: ID;
  mp2_id?: ID;
  valor2?: number;
  mp2_cuenta_id?: ID;
  observacion?: string;
  usuario_id: ID;
  anulado: boolean;
  // Satisfacción del cliente, marcada por quien registra la venta.
  // undefined = sin dato, true = satisfecho, false = no satisfecho.
  cliente_satisfecho?: boolean;
  satisfaccion_nota?: string; // motivo (opcional, sobre todo si no satisfecho)
}

export interface IngresoLinea {
  id: ID;
  ingreso_id: ID;
  servicio_id?: ID;
  insumo_id?: ID;
  empleado_id?: ID;
  precio_efectivo: number;
  cantidad: number;
  subtotal: number;
  comision_pct: number;
  comision_monto: number;
  promo_servicio_id?: ID;
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
  mp1_cuenta_id?: ID;
  mp2_id?: ID;
  valor2?: number;
  mp2_cuenta_id?: ID;
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

export interface AperturaCaja {
  id: ID;
  sucursal_id: ID;
  fecha: string;
  abierto_por: ID;
  fecha_apertura: string;
  observacion?: string;
}

export interface AperturaCuentaLinea {
  id: ID;
  apertura_id: ID;
  cuenta_id: ID;
  saldo_esperado: number;
  saldo_declarado: number;
}

export interface CierreCuentaLinea {
  id: ID;
  cierre_id: ID;
  cuenta_id: ID;
  saldo_esperado: number;
  saldo_contado: number;
}

export type LiquidacionEstado = "pendiente" | "pagada" | "anulada";

export interface Liquidacion {
  id: ID;
  sucursal_id: ID;
  empleado_id: ID;
  periodo_desde: string; // YYYY-MM-DD
  periodo_hasta: string; // YYYY-MM-DD
  total_servicios: number;
  dias_trabajados: number;
  total_comision: number;
  horas_trabajadas: number;
  valor_hora: number; // snapshot del valor hora al liquidar
  sueldo_horas: number; // horas_trabajadas * valor_hora
  total_anticipos: number; // anticipos descontados
  total_pagar: number; // total_comision + sueldo_horas - total_anticipos
  estado: LiquidacionEstado;
  mp_id?: ID;
  fecha_pago?: string; // ISO
  observacion?: string;
  egreso_id?: ID;
  usuario_id: ID;
  creado_en: string; // ISO
}

export interface Anticipo {
  id: ID;
  empleado_id: ID;
  sucursal_id: ID;
  fecha: string; // ISO
  monto: number;
  mp_id?: ID;
  egreso_id?: ID;
  liquidacion_id?: ID; // null mientras está pendiente de descontar
  observacion?: string;
  usuario_id: ID;
  creado_en: string; // ISO
}

export interface LiquidacionLinea {
  id: ID;
  liquidacion_id: ID;
  ingreso_linea_id?: ID;
  ingreso_id?: ID;
  fecha: string; // YYYY-MM-DD
  servicio_nombre: string;
  precio: number;
  comision_pct: number;
  comision_monto: number;
}

export interface AccessScope {
  rol: Rol;
  sucursalIdsPermitidas: ID[];
  empleadoId?: ID;
  esAdmin: boolean;
  puedeVerGlobal: boolean;
  puedeAdministrarTurnos: boolean;
  puedeVerStock: boolean;
  puedeGestionarStock: boolean;
  puedeVerReportes: boolean;
  puedeVerCaja: boolean;
  puedeVerCatalogos: boolean;
}

