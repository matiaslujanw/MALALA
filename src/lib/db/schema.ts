import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const auth = pgSchema("auth");

export const authUsers = auth.table("users", {
  id: uuid("id").primaryKey(),
});

export const rolEnum = pgEnum("rol", ["admin", "encargada", "empleado"]);
export const tipoComisionEnum = pgEnum("tipo_comision", [
  "porcentaje",
  "mixto",
  "sueldo_fijo",
]);
export const unidadMedidaEnum = pgEnum("unidad_medida", ["ud", "ml", "g", "aplicacion"]);
export const turnoEstadoEnum = pgEnum("turno_estado", [
  "pendiente",
  "confirmado",
  "en_curso",
  "completado",
  "cancelado",
  "ausente",
]);
export const turnoCanalEnum = pgEnum("turno_canal", ["web", "recepcion"]);
export const turnoEventoTipoEnum = pgEnum("turno_evento_tipo", [
  "creado",
  "pendiente",
  "confirmado",
  "reprogramado",
  "cancelado",
  "ausente",
  "completado",
  "en_curso",
]);
export const tipoMovimientoStockEnum = pgEnum("tipo_movimiento_stock", [
  "compra",
  "venta",
  "ajuste_manual",
  "transferencia_entrada",
  "transferencia_salida",
]);
export const origenTurnoEnum = pgEnum("origen_turno", ["publico", "interno"]);

export const sucursales = pgTable("sucursales", {
  id: text("id").primaryKey(),
  nombre: text("nombre").notNull(),
  activo: boolean("activo").notNull().default(true),
  slug: text("slug"),
  direccion: text("direccion"),
  telefono: text("telefono"),
  horarioResumen: text("horario_resumen"),
  rating: doublePrecision("rating"),
  reviews: integer("reviews"),
  mapaUrl: text("mapa_url"),
  descripcionCorta: text("descripcion_corta"),
});

export const empleados = pgTable("empleados", {
  id: text("id").primaryKey(),
  nombre: text("nombre").notNull(),
  activo: boolean("activo").notNull().default(true),
  sucursalPrincipalId: text("sucursal_principal_id")
    .notNull()
    .references(() => sucursales.id),
  tipoComision: tipoComisionEnum("tipo_comision").notNull(),
  porcentajeDefault: doublePrecision("porcentaje_default").notNull(),
  sueldoAsegurado: doublePrecision("sueldo_asegurado").notNull(),
  observacion: text("observacion"),
});

export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    nombre: text("nombre").notNull(),
    rol: rolEnum("rol").notNull(),
    sucursalDefaultId: text("sucursal_default_id")
      .notNull()
      .references(() => sucursales.id),
    empleadoId: text("empleado_id").references(() => empleados.id),
    activo: boolean("activo").notNull().default(true),
  },
  (table) => ({
    emailIdx: index("profiles_email_idx").on(table.email),
  }),
);

export const clientes = pgTable("clientes", {
  id: text("id").primaryKey(),
  nombre: text("nombre").notNull(),
  telefono: text("telefono"),
  observacion: text("observacion"),
  activo: boolean("activo").notNull().default(true),
  saldoCc: doublePrecision("saldo_cc").notNull().default(0),
});

export const proveedores = pgTable("proveedores", {
  id: text("id").primaryKey(),
  nombre: text("nombre").notNull(),
  telefono: text("telefono"),
  cuit: text("cuit"),
  deudaPendiente: doublePrecision("deuda_pendiente").notNull().default(0),
});

export const servicios = pgTable("servicios", {
  id: text("id").primaryKey(),
  rubro: text("rubro").notNull(),
  nombre: text("nombre").notNull(),
  precioLista: doublePrecision("precio_lista").notNull(),
  precioEfectivo: doublePrecision("precio_efectivo").notNull(),
  comisionDefaultPct: doublePrecision("comision_default_pct").notNull(),
  activo: boolean("activo").notNull().default(true),
  duracionMin: integer("duracion_min"),
  descripcionCorta: text("descripcion_corta"),
  destacadoPct: integer("destacado_pct"),
});

export const horariosSucursal = pgTable("horarios_sucursal", {
  id: text("id").primaryKey(),
  sucursalId: text("sucursal_id")
    .notNull()
    .references(() => sucursales.id, { onDelete: "cascade" }),
  diaSemana: integer("dia_semana").notNull(),
  apertura: text("apertura").notNull(),
  cierre: text("cierre").notNull(),
});

export const profesionalesAgenda = pgTable("profesionales_agenda", {
  id: text("id").primaryKey(),
  empleadoId: text("empleado_id")
    .notNull()
    .references(() => empleados.id, { onDelete: "cascade" }),
  sucursalId: text("sucursal_id")
    .notNull()
    .references(() => sucursales.id, { onDelete: "cascade" }),
  especialidad: text("especialidad").notNull(),
  avatarUrl: text("avatar_url").notNull(),
  color: text("color").notNull(),
  bio: text("bio"),
  prioridad: integer("prioridad").notNull().default(0),
  activoPublico: boolean("activo_publico").notNull().default(true),
});

export const insumos = pgTable("insumos", {
  id: text("id").primaryKey(),
  nombre: text("nombre").notNull(),
  proveedorId: text("proveedor_id").references(() => proveedores.id),
  unidadMedida: unidadMedidaEnum("unidad_medida").notNull(),
  tamanoEnvase: doublePrecision("tamano_envase").notNull(),
  precioEnvase: doublePrecision("precio_envase").notNull(),
  precioUnitario: doublePrecision("precio_unitario"),
  rinde: doublePrecision("rinde"),
  umbralStockBajo: doublePrecision("umbral_stock_bajo").notNull(),
  activo: boolean("activo").notNull().default(true),
});

export const recetas = pgTable("recetas", {
  id: text("id").primaryKey(),
  servicioId: text("servicio_id")
    .notNull()
    .references(() => servicios.id, { onDelete: "cascade" }),
  insumoId: text("insumo_id")
    .notNull()
    .references(() => insumos.id, { onDelete: "cascade" }),
  cantidad: doublePrecision("cantidad").notNull(),
});

export const mediosPago = pgTable("medios_pago", {
  id: text("id").primaryKey(),
  codigo: text("codigo").notNull(),
  nombre: text("nombre").notNull(),
  activo: boolean("activo").notNull().default(true),
});

export const rubrosGasto = pgTable("rubros_gasto", {
  id: text("id").primaryKey(),
  rubro: text("rubro").notNull(),
  subrubro: text("subrubro"),
  activo: boolean("activo").notNull().default(true),
});

export const stockSucursal = pgTable(
  "stock_sucursal",
  {
    id: text("id").primaryKey(),
    insumoId: text("insumo_id")
      .notNull()
      .references(() => insumos.id, { onDelete: "cascade" }),
    sucursalId: text("sucursal_id")
      .notNull()
      .references(() => sucursales.id, { onDelete: "cascade" }),
    cantidad: doublePrecision("cantidad").notNull(),
  },
  (table) => ({
    uniqueStock: index("stock_sucursal_unique_idx").on(table.insumoId, table.sucursalId),
  }),
);

export const movimientosStock = pgTable("movimientos_stock", {
  id: text("id").primaryKey(),
  insumoId: text("insumo_id")
    .notNull()
    .references(() => insumos.id),
  sucursalId: text("sucursal_id")
    .notNull()
    .references(() => sucursales.id),
  tipo: tipoMovimientoStockEnum("tipo").notNull(),
  cantidad: doublePrecision("cantidad").notNull(),
  motivo: text("motivo"),
  refTipo: text("ref_tipo"),
  refId: text("ref_id"),
  usuarioId: uuid("usuario_id")
    .notNull()
    .references(() => profiles.userId),
  fecha: timestamp("fecha", { withTimezone: true }).notNull(),
});

export const ingresos = pgTable("ingresos", {
  id: text("id").primaryKey(),
  fecha: timestamp("fecha", { withTimezone: true }).notNull(),
  sucursalId: text("sucursal_id")
    .notNull()
    .references(() => sucursales.id),
  clienteId: text("cliente_id").references(() => clientes.id),
  subtotal: doublePrecision("subtotal").notNull(),
  descuentoPct: doublePrecision("descuento_pct").notNull().default(0),
  descuentoMonto: doublePrecision("descuento_monto").notNull().default(0),
  total: doublePrecision("total").notNull(),
  mp1Id: text("mp1_id")
    .notNull()
    .references(() => mediosPago.id),
  valor1: doublePrecision("valor1").notNull(),
  mp2Id: text("mp2_id").references(() => mediosPago.id),
  valor2: doublePrecision("valor2"),
  observacion: text("observacion"),
  usuarioId: uuid("usuario_id")
    .notNull()
    .references(() => profiles.userId),
  anulado: boolean("anulado").notNull().default(false),
});

export const ingresoLineas = pgTable("ingreso_lineas", {
  id: text("id").primaryKey(),
  ingresoId: text("ingreso_id")
    .notNull()
    .references(() => ingresos.id, { onDelete: "cascade" }),
  servicioId: text("servicio_id")
    .notNull()
    .references(() => servicios.id),
  empleadoId: text("empleado_id").references(() => empleados.id),
  precioEfectivo: doublePrecision("precio_efectivo").notNull(),
  cantidad: doublePrecision("cantidad").notNull(),
  subtotal: doublePrecision("subtotal").notNull(),
  comisionPct: doublePrecision("comision_pct").notNull(),
  comisionMonto: doublePrecision("comision_monto").notNull(),
});

export const egresos = pgTable("egresos", {
  id: text("id").primaryKey(),
  fecha: timestamp("fecha", { withTimezone: true }).notNull(),
  sucursalId: text("sucursal_id")
    .notNull()
    .references(() => sucursales.id),
  rubroId: text("rubro_id")
    .notNull()
    .references(() => rubrosGasto.id),
  insumoId: text("insumo_id").references(() => insumos.id),
  proveedorId: text("proveedor_id").references(() => proveedores.id),
  cantidad: doublePrecision("cantidad"),
  valor: doublePrecision("valor").notNull(),
  mpId: text("mp_id")
    .notNull()
    .references(() => mediosPago.id),
  observacion: text("observacion"),
  pagado: boolean("pagado").notNull().default(false),
  usuarioId: uuid("usuario_id")
    .notNull()
    .references(() => profiles.userId),
});

export const cierresCaja = pgTable("cierres_caja", {
  id: text("id").primaryKey(),
  sucursalId: text("sucursal_id")
    .notNull()
    .references(() => sucursales.id),
  fecha: text("fecha").notNull(),
  saldoInicialEf: doublePrecision("saldo_inicial_ef").notNull(),
  saldoBanco: doublePrecision("saldo_banco").notNull(),
  billetes: jsonb("billetes").$type<Record<string, number>>().notNull(),
  ingresosEf: doublePrecision("ingresos_ef").notNull(),
  egresosEf: doublePrecision("egresos_ef").notNull(),
  ingresosBanc: doublePrecision("ingresos_banc").notNull(),
  egresosBanc: doublePrecision("egresos_banc").notNull(),
  cobrosTc: doublePrecision("cobros_tc").notNull(),
  cobrosTd: doublePrecision("cobros_td").notNull(),
  vouchers: doublePrecision("vouchers").notNull(),
  giftcards: doublePrecision("giftcards").notNull(),
  autoconsumos: doublePrecision("autoconsumos").notNull(),
  cheques: doublePrecision("cheques").notNull(),
  aportes: doublePrecision("aportes").notNull(),
  ingresosCc: doublePrecision("ingresos_cc").notNull(),
  anticipos: doublePrecision("anticipos").notNull(),
  observacion: text("observacion"),
  cerradoPor: uuid("cerrado_por")
    .notNull()
    .references(() => profiles.userId),
  fechaCierre: timestamp("fecha_cierre", { withTimezone: true }).notNull(),
});

export const turnos = pgTable("turnos", {
  id: text("id").primaryKey(),
  sucursalId: text("sucursal_id")
    .notNull()
    .references(() => sucursales.id),
  servicioId: text("servicio_id")
    .notNull()
    .references(() => servicios.id),
  profesionalId: text("profesional_id")
    .notNull()
    .references(() => empleados.id),
  clienteNombre: text("cliente_nombre").notNull(),
  clienteTelefono: text("cliente_telefono").notNull(),
  clienteEmail: text("cliente_email"),
  fechaTurno: text("fecha_turno").notNull(),
  hora: text("hora").notNull(),
  duracionMin: integer("duracion_min").notNull(),
  estado: turnoEstadoEnum("estado").notNull(),
  canal: turnoCanalEnum("canal").notNull(),
  observacion: text("observacion"),
  creadoEn: timestamp("creado_en", { withTimezone: true }).notNull(),
  creadoPorUsuarioId: uuid("creado_por_usuario_id").references(() => profiles.userId),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }),
  actualizadoPorUsuarioId: uuid("actualizado_por_usuario_id").references(() => profiles.userId),
  origen: origenTurnoEnum("origen").notNull(),
  sinPreferencia: boolean("sin_preferencia").notNull().default(false),
});

export const turnoEventos = pgTable("turno_eventos", {
  id: text("id").primaryKey(),
  turnoId: text("turno_id")
    .notNull()
    .references(() => turnos.id, { onDelete: "cascade" }),
  tipo: turnoEventoTipoEnum("tipo").notNull(),
  actorUsuarioId: uuid("actor_usuario_id").references(() => profiles.userId),
  fecha: timestamp("fecha", { withTimezone: true }).notNull(),
  detalle: text("detalle"),
});

export const schema = {
  authUsers,
  profiles,
  sucursales,
  empleados,
  clientes,
  proveedores,
  servicios,
  horariosSucursal,
  profesionalesAgenda,
  insumos,
  recetas,
  mediosPago,
  rubrosGasto,
  stockSucursal,
  movimientosStock,
  ingresos,
  ingresoLineas,
  egresos,
  cierresCaja,
  turnos,
  turnoEventos,
};
