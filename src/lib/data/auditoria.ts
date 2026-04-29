"use server";

import { store } from "@/lib/mock/store";
import { requireRole } from "./_helpers";

export type AuditEventType =
  | "venta"
  | "egreso"
  | "cierre"
  | "stock_compra"
  | "stock_venta"
  | "stock_ajuste"
  | "stock_transferencia";

export interface AuditEvent {
  id: string;
  fecha: string; // ISO
  tipo: AuditEventType;
  usuario_id: string;
  usuario_nombre: string;
  usuario_rol: string;
  sucursal_id: string;
  sucursal_nombre: string;
  titulo: string;
  detalle: string;
  monto?: number;
  href?: string; // a dónde linkea (ticket, egreso, cierre, etc.)
  // Tags para filtrar y enriquecer
  meta?: Record<string, string | number>;
}

export interface AuditFiltros {
  desde?: string; // ISO
  hasta?: string; // ISO
  usuarioId?: string;
  sucursalId?: string;
  tipos?: AuditEventType[];
  search?: string;
  limit?: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  }).format(n);
}

export async function getAuditTimeline(
  filtros: AuditFiltros = {},
): Promise<AuditEvent[]> {
  await requireRole(["admin"]);

  const userMap = new Map(
    store.usuarios.map((u) => [u.id, { nombre: u.nombre, rol: u.rol }]),
  );
  const sucMap = new Map(store.sucursales.map((s) => [s.id, s.nombre]));
  const insumoMap = new Map(store.insumos.map((i) => [i.id, i.nombre]));
  const rubroMap = new Map(
    store.rubrosGasto.map((r) => [
      r.id,
      r.subrubro ? `${r.rubro} · ${r.subrubro}` : r.rubro,
    ]),
  );
  const proveedorMap = new Map(store.proveedores.map((p) => [p.id, p.nombre]));
  const clienteMap = new Map(store.clientes.map((c) => [c.id, c.nombre]));

  const events: AuditEvent[] = [];

  const addEvent = (e: Omit<AuditEvent, "usuario_nombre" | "usuario_rol" | "sucursal_nombre">) => {
    const u = userMap.get(e.usuario_id);
    events.push({
      ...e,
      usuario_nombre: u?.nombre ?? "—",
      usuario_rol: u?.rol ?? "—",
      sucursal_nombre: sucMap.get(e.sucursal_id) ?? "—",
    });
  };

  // Ventas
  for (const ing of store.ingresos) {
    const cliente = ing.cliente_id ? clienteMap.get(ing.cliente_id) : null;
    addEvent({
      id: `venta:${ing.id}`,
      fecha: ing.fecha,
      tipo: "venta",
      usuario_id: ing.usuario_id,
      sucursal_id: ing.sucursal_id,
      titulo: ing.anulado ? "Venta anulada" : "Venta",
      detalle: cliente ?? "Consumidor Final",
      monto: ing.total,
      href: `/ventas/${ing.id}`,
      meta: { anulado: ing.anulado ? 1 : 0 },
    });
  }

  // Egresos
  for (const eg of store.egresos) {
    const partes: string[] = [];
    const rubro = rubroMap.get(eg.rubro_id);
    if (rubro) partes.push(rubro);
    if (eg.insumo_id) {
      const ins = insumoMap.get(eg.insumo_id);
      if (ins) partes.push(`${ins}${eg.cantidad ? ` × ${eg.cantidad}` : ""}`);
    }
    if (eg.proveedor_id) {
      const p = proveedorMap.get(eg.proveedor_id);
      if (p) partes.push(p);
    }
    addEvent({
      id: `egreso:${eg.id}`,
      fecha: eg.fecha,
      tipo: "egreso",
      usuario_id: eg.usuario_id,
      sucursal_id: eg.sucursal_id,
      titulo: eg.pagado ? "Egreso (pagado)" : "Egreso (pendiente)",
      detalle: partes.join(" · ") || "—",
      monto: eg.valor,
      href: "/egresos",
      meta: { pagado: eg.pagado ? 1 : 0 },
    });
  }

  // Cierres de caja
  for (const c of store.cierresCaja) {
    const efectivoContado = Object.entries(c.billetes).reduce(
      (acc, [d, q]) => acc + Number(d) * (q || 0),
      0,
    );
    const esperado = c.saldo_inicial_ef + c.ingresos_ef - c.egresos_ef;
    const dif = efectivoContado - esperado;
    addEvent({
      id: `cierre:${c.id}`,
      fecha: c.fecha_cierre,
      tipo: "cierre",
      usuario_id: c.cerrado_por,
      sucursal_id: c.sucursal_id,
      titulo: "Cierre de caja",
      detalle: `Día ${c.fecha} · diferencia ${fmt(dif)}`,
      monto: efectivoContado,
      href: `/caja/${c.id}`,
      meta: { diferencia: dif },
    });
  }

  // Movimientos de stock
  for (const m of store.movimientosStock) {
    const ins = insumoMap.get(m.insumo_id) ?? "Insumo";
    let tipo: AuditEventType = "stock_ajuste";
    let titulo = "Ajuste manual de stock";
    if (m.tipo === "compra") {
      tipo = "stock_compra";
      titulo = "Compra (suma stock)";
    } else if (m.tipo === "venta") {
      tipo = "stock_venta";
      titulo = "Consumo por venta";
    } else if (
      m.tipo === "transferencia_entrada" ||
      m.tipo === "transferencia_salida"
    ) {
      tipo = "stock_transferencia";
      titulo =
        m.tipo === "transferencia_entrada"
          ? "Transferencia · entrada"
          : "Transferencia · salida";
    }
    addEvent({
      id: `stockmov:${m.id}`,
      fecha: m.fecha,
      tipo,
      usuario_id: m.usuario_id,
      sucursal_id: m.sucursal_id,
      titulo,
      detalle: `${ins} · ${m.cantidad > 0 ? "+" : ""}${m.cantidad}${m.motivo ? ` · ${m.motivo}` : ""}`,
      meta: { cantidad: m.cantidad },
    });
  }

  // Filtros
  let filtered = events;
  if (filtros.desde) filtered = filtered.filter((e) => e.fecha >= filtros.desde!);
  if (filtros.hasta) filtered = filtered.filter((e) => e.fecha <= filtros.hasta!);
  if (filtros.usuarioId)
    filtered = filtered.filter((e) => e.usuario_id === filtros.usuarioId);
  if (filtros.sucursalId)
    filtered = filtered.filter((e) => e.sucursal_id === filtros.sucursalId);
  if (filtros.tipos && filtros.tipos.length > 0) {
    const set = new Set(filtros.tipos);
    filtered = filtered.filter((e) => set.has(e.tipo));
  }
  if (filtros.search) {
    const q = filtros.search.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.titulo.toLowerCase().includes(q) ||
        e.detalle.toLowerCase().includes(q) ||
        e.usuario_nombre.toLowerCase().includes(q),
    );
  }

  filtered.sort((a, b) => b.fecha.localeCompare(a.fecha));
  if (filtros.limit) filtered = filtered.slice(0, filtros.limit);
  return filtered;
}

