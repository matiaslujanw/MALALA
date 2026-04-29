import type { AuditEvent, AuditEventType } from "./auditoria";

export interface AuditAggregates {
  total: number;
  porTipo: Record<AuditEventType, number>;
  porUsuario: Array<{ usuario: string; rol: string; cantidad: number }>;
}

export function aggregateAudit(events: AuditEvent[]): AuditAggregates {
  const porTipo: Record<AuditEventType, number> = {
    venta: 0,
    egreso: 0,
    cierre: 0,
    stock_compra: 0,
    stock_venta: 0,
    stock_ajuste: 0,
    stock_transferencia: 0,
  };
  const porUsuarioMap = new Map<
    string,
    { usuario: string; rol: string; cantidad: number }
  >();
  for (const e of events) {
    porTipo[e.tipo] = (porTipo[e.tipo] ?? 0) + 1;
    const key = e.usuario_id;
    const cur = porUsuarioMap.get(key) ?? {
      usuario: e.usuario_nombre,
      rol: e.usuario_rol,
      cantidad: 0,
    };
    cur.cantidad += 1;
    porUsuarioMap.set(key, cur);
  }
  return {
    total: events.length,
    porTipo,
    porUsuario: Array.from(porUsuarioMap.values()).sort(
      (a, b) => b.cantidad - a.cantidad,
    ),
  };
}

export const TIPO_LABELS: Record<AuditEventType, string> = {
  venta: "Ventas",
  egreso: "Egresos",
  cierre: "Cierres de caja",
  stock_compra: "Stock · compras",
  stock_venta: "Stock · consumo por venta",
  stock_ajuste: "Stock · ajustes",
  stock_transferencia: "Stock · transferencias",
};
