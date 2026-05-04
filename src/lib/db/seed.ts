import "../../../envConfig";
import { seed as buildMockSeed } from "../mock/seed";
import { getSqlClient, getDb } from "./client/postgres";
import { createSupabaseAdminClient } from "./client/supabase-admin";
import {
  cierresCaja,
  clientes,
  egresos,
  empleados,
  horariosSucursal,
  ingresoLineas,
  ingresos,
  insumos,
  mediosPago,
  movimientosStock,
  profesionalesAgenda,
  profiles,
  proveedores,
  recetas,
  rubrosGasto,
  servicios,
  stockSucursal,
  sucursales,
  turnoEventos,
  turnos,
} from "./schema";

const DEFAULT_SEED_PASSWORD = process.env.MALALA_SEED_PASSWORD ?? "ChangeMe123!";

async function ensureAuthUsers(
  emails: Array<{ email: string; nombre: string }>,
) {
  const supabase = createSupabaseAdminClient();
  const existing = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (existing.error) {
    throw existing.error;
  }

  const userMap = new Map(
    (existing.data.users ?? []).map((item) => [item.email?.toLowerCase(), item]),
  );

  const result = new Map<string, string>();

  for (const item of emails) {
    const key = item.email.toLowerCase();
    let authUser = userMap.get(key);

    if (!authUser) {
      const created = await supabase.auth.admin.createUser({
        email: item.email,
        password: DEFAULT_SEED_PASSWORD,
        email_confirm: true,
        user_metadata: { nombre: item.nombre },
      });

      if (created.error || !created.data.user) {
        throw created.error ?? new Error(`No se pudo crear ${item.email}`);
      }

      authUser = created.data.user;
      userMap.set(key, authUser);
    } else {
      const updated = await supabase.auth.admin.updateUserById(authUser.id, {
        password: DEFAULT_SEED_PASSWORD,
        email_confirm: true,
        user_metadata: {
          ...(authUser.user_metadata ?? {}),
          nombre: item.nombre,
        },
      });

      if (updated.error) {
        throw updated.error;
      }
    }

    result.set(item.email, authUser.id);
  }

  return result;
}

async function clearAppTables() {
  const db = getDb();

  await db.delete(turnoEventos);
  await db.delete(turnos);
  await db.delete(cierresCaja);
  await db.delete(ingresoLineas);
  await db.delete(ingresos);
  await db.delete(egresos);
  await db.delete(movimientosStock);
  await db.delete(stockSucursal);
  await db.delete(recetas);
  await db.delete(profesionalesAgenda);
  await db.delete(horariosSucursal);
  await db.delete(rubrosGasto);
  await db.delete(mediosPago);
  await db.delete(insumos);
  await db.delete(servicios);
  await db.delete(clientes);
  await db.delete(proveedores);
  await db.delete(profiles);
  await db.delete(empleados);
  await db.delete(sucursales);
}

async function main() {
  const snapshot = buildMockSeed();
  const db = getDb();

  const authUsersByEmail = await ensureAuthUsers(
    snapshot.usuarios.map((item) => ({
      email: item.email,
      nombre: item.nombre,
    })),
  );

  const userIdByLegacyId = new Map<string, string>();
  for (const item of snapshot.usuarios) {
    const authUserId = authUsersByEmail.get(item.email);
    if (!authUserId) {
      throw new Error(`No se encontro auth.users para ${item.email}`);
    }
    userIdByLegacyId.set(item.id, authUserId);
  }

  await clearAppTables();

  await db.insert(sucursales).values(
    snapshot.sucursales.map((item) => ({
      id: item.id,
      nombre: item.nombre,
      activo: item.activo,
      slug: item.slug ?? null,
      direccion: item.direccion ?? null,
      telefono: item.telefono ?? null,
      horarioResumen: item.horario_resumen ?? null,
      rating: item.rating ?? null,
      reviews: item.reviews ?? null,
      mapaUrl: item.mapa_url ?? null,
      descripcionCorta: item.descripcion_corta ?? null,
    })),
  );

  await db.insert(empleados).values(
    snapshot.empleados.map((item) => ({
      id: item.id,
      nombre: item.nombre,
      activo: item.activo,
      sucursalPrincipalId: item.sucursal_principal_id,
      tipoComision: item.tipo_comision,
      porcentajeDefault: item.porcentaje_default,
      sueldoAsegurado: item.sueldo_asegurado,
      observacion: item.observacion ?? null,
    })),
  );

  await db.insert(profiles).values(
    snapshot.usuarios.map((item) => ({
      userId: userIdByLegacyId.get(item.id)!,
      email: item.email,
      nombre: item.nombre,
      rol: item.rol,
      sucursalDefaultId: item.sucursal_default_id,
      empleadoId: item.empleado_id ?? null,
      activo: item.activo,
    })),
  );

  await db.insert(clientes).values(
    snapshot.clientes.map((item) => ({
      id: item.id,
      nombre: item.nombre,
      telefono: item.telefono ?? null,
      observacion: item.observacion ?? null,
      activo: item.activo,
      saldoCc: item.saldo_cc,
    })),
  );

  await db.insert(proveedores).values(
    snapshot.proveedores.map((item) => ({
      id: item.id,
      nombre: item.nombre,
      telefono: item.telefono ?? null,
      cuit: item.cuit ?? null,
      deudaPendiente: item.deuda_pendiente,
    })),
  );

  await db.insert(servicios).values(
    snapshot.servicios.map((item) => ({
      id: item.id,
      rubro: item.rubro,
      nombre: item.nombre,
      precioLista: item.precio_lista,
      precioEfectivo: item.precio_efectivo,
      comisionDefaultPct: item.comision_default_pct,
      activo: item.activo,
      duracionMin: item.duracion_min ?? null,
      descripcionCorta: item.descripcion_corta ?? null,
      destacadoPct: item.destacado_pct ?? null,
    })),
  );

  await db.insert(horariosSucursal).values(
    snapshot.horariosSucursal.map((item) => ({
      id: item.id,
      sucursalId: item.sucursal_id,
      diaSemana: item.dia_semana,
      apertura: item.apertura,
      cierre: item.cierre,
    })),
  );

  await db.insert(profesionalesAgenda).values(
    snapshot.profesionalesAgenda.map((item) => ({
      id: item.id,
      empleadoId: item.empleado_id,
      sucursalId: item.sucursal_id,
      especialidad: item.especialidad,
      avatarUrl: item.avatar_url,
      color: item.color,
      bio: item.bio ?? null,
      prioridad: item.prioridad,
      activoPublico: item.activo_publico,
    })),
  );

  await db.insert(insumos).values(
    snapshot.insumos.map((item) => ({
      id: item.id,
      nombre: item.nombre,
      proveedorId: item.proveedor_id ?? null,
      unidadMedida: item.unidad_medida,
      tamanoEnvase: item.tamano_envase,
      precioEnvase: item.precio_envase,
      precioUnitario: item.precio_unitario,
      rinde: item.rinde ?? null,
      umbralStockBajo: item.umbral_stock_bajo,
      activo: item.activo,
    })),
  );

  await db.insert(recetas).values(
    snapshot.recetas.map((item) => ({
      id: item.id,
      servicioId: item.servicio_id,
      insumoId: item.insumo_id,
      cantidad: item.cantidad,
    })),
  );

  await db.insert(mediosPago).values(
    snapshot.mediosPago.map((item) => ({
      id: item.id,
      codigo: item.codigo,
      nombre: item.nombre,
      activo: item.activo,
    })),
  );

  await db.insert(rubrosGasto).values(
    snapshot.rubrosGasto.map((item) => ({
      id: item.id,
      rubro: item.rubro,
      subrubro: item.subrubro ?? null,
      activo: item.activo,
    })),
  );

  await db.insert(stockSucursal).values(
    snapshot.stockSucursal.map((item) => ({
      id: item.id,
      insumoId: item.insumo_id,
      sucursalId: item.sucursal_id,
      cantidad: item.cantidad,
    })),
  );

  if (snapshot.movimientosStock.length) {
    await db.insert(movimientosStock).values(
      snapshot.movimientosStock.map((item) => ({
        id: item.id,
        insumoId: item.insumo_id,
        sucursalId: item.sucursal_id,
        tipo: item.tipo,
        cantidad: item.cantidad,
        motivo: item.motivo ?? null,
        refTipo: item.ref_tipo ?? null,
        refId: item.ref_id ?? null,
        usuarioId: userIdByLegacyId.get(item.usuario_id)!,
        fecha: new Date(item.fecha),
      })),
    );
  }

  await db.insert(ingresos).values(
    snapshot.ingresos.map((item) => ({
      id: item.id,
      fecha: new Date(item.fecha),
      sucursalId: item.sucursal_id,
      clienteId: item.cliente_id ?? null,
      subtotal: item.subtotal,
      descuentoPct: item.descuento_pct,
      descuentoMonto: item.descuento_monto,
      total: item.total,
      mp1Id: item.mp1_id,
      valor1: item.valor1,
      mp2Id: item.mp2_id ?? null,
      valor2: item.valor2 ?? null,
      observacion: item.observacion ?? null,
      usuarioId: userIdByLegacyId.get(item.usuario_id)!,
      anulado: item.anulado,
    })),
  );

  await db.insert(ingresoLineas).values(
    snapshot.ingresoLineas.map((item) => ({
      id: item.id,
      ingresoId: item.ingreso_id,
      servicioId: item.servicio_id,
      empleadoId: item.empleado_id ?? null,
      precioEfectivo: item.precio_efectivo,
      cantidad: item.cantidad,
      subtotal: item.subtotal,
      comisionPct: item.comision_pct,
      comisionMonto: item.comision_monto,
    })),
  );

  await db.insert(egresos).values(
    snapshot.egresos.map((item) => ({
      id: item.id,
      fecha: new Date(item.fecha),
      sucursalId: item.sucursal_id,
      rubroId: item.rubro_id,
      insumoId: item.insumo_id ?? null,
      proveedorId: item.proveedor_id ?? null,
      cantidad: item.cantidad ?? null,
      valor: item.valor,
      mpId: item.mp_id,
      observacion: item.observacion ?? null,
      pagado: item.pagado,
      usuarioId: userIdByLegacyId.get(item.usuario_id)!,
    })),
  );

  if (snapshot.cierresCaja.length) {
    await db.insert(cierresCaja).values(
      snapshot.cierresCaja.map((item) => ({
        id: item.id,
        sucursalId: item.sucursal_id,
        fecha: item.fecha,
        saldoInicialEf: item.saldo_inicial_ef,
        saldoBanco: item.saldo_banco,
        billetes: item.billetes,
        ingresosEf: item.ingresos_ef,
        egresosEf: item.egresos_ef,
        ingresosBanc: item.ingresos_banc,
        egresosBanc: item.egresos_banc,
        cobrosTc: item.cobros_tc,
        cobrosTd: item.cobros_td,
        vouchers: item.vouchers,
        giftcards: item.giftcards,
        autoconsumos: item.autoconsumos,
        cheques: item.cheques,
        aportes: item.aportes,
        ingresosCc: item.ingresos_cc,
        anticipos: item.anticipos,
        observacion: item.observacion ?? null,
        cerradoPor: userIdByLegacyId.get(item.cerrado_por)!,
        fechaCierre: new Date(item.fecha_cierre),
      })),
    );
  }

  await db.insert(turnos).values(
    snapshot.turnos.map((item) => ({
      id: item.id,
      sucursalId: item.sucursal_id,
      servicioId: item.servicio_id,
      profesionalId: item.profesional_id,
      clienteNombre: item.cliente_nombre,
      clienteTelefono: item.cliente_telefono,
      clienteEmail: item.cliente_email ?? null,
      fechaTurno: item.fecha_turno,
      hora: item.hora,
      duracionMin: item.duracion_min,
      estado: item.estado,
      canal: item.canal,
      observacion: item.observacion ?? null,
      creadoEn: new Date(item.creado_en),
      creadoPorUsuarioId: item.creado_por_usuario_id
        ? userIdByLegacyId.get(item.creado_por_usuario_id) ?? null
        : null,
      actualizadoEn: item.actualizado_en ? new Date(item.actualizado_en) : null,
      actualizadoPorUsuarioId: item.actualizado_por_usuario_id
        ? userIdByLegacyId.get(item.actualizado_por_usuario_id) ?? null
        : null,
      origen: item.origen,
      sinPreferencia: item.sin_preferencia,
    })),
  );

  await db.insert(turnoEventos).values(
    snapshot.turnoEventos.map((item) => ({
      id: item.id,
      turnoId: item.turno_id,
      tipo: item.tipo,
      actorUsuarioId: item.actor_usuario_id
        ? userIdByLegacyId.get(item.actor_usuario_id) ?? null
        : null,
      fecha: new Date(item.fecha),
      detalle: item.detalle ?? null,
    })),
  );

  console.log(
    `Seed completado: ${snapshot.sucursales.length} sucursales, ${snapshot.usuarios.length} usuarios, ${snapshot.turnos.length} turnos.`,
  );
}

main()
  .catch((error) => {
    console.error("Fallo el seed de Supabase/Drizzle:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getSqlClient().end({ timeout: 5 });
  });
