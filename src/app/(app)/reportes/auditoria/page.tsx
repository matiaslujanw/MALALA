import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import {
  getAuditTimeline,
  type AuditEventType,
} from "@/lib/data/auditoria";
import {
  aggregateAudit,
  TIPO_LABELS,
} from "@/lib/data/auditoria-helpers";
import { listSucursales } from "@/lib/data/sucursales";
import { store } from "@/lib/mock/store";
import { formatARS } from "@/lib/utils";

interface SearchParams {
  rango?: "hoy" | "semana" | "mes" | "todo";
  tipo?: string;
  usuario?: string;
  sucursal?: string;
  q?: string;
}

const RANGOS: Array<{ value: NonNullable<SearchParams["rango"]>; label: string }> = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Últimos 7 días" },
  { value: "mes", label: "Últimos 30 días" },
  { value: "todo", label: "Todo" },
];

function rangoToFechas(rango: NonNullable<SearchParams["rango"]>) {
  const now = new Date();
  const desde = new Date(now);
  if (rango === "hoy") desde.setHours(0, 0, 0, 0);
  else if (rango === "semana") desde.setDate(desde.getDate() - 7);
  else if (rango === "mes") desde.setDate(desde.getDate() - 30);
  else return { desde: undefined, hasta: undefined };
  return { desde: desde.toISOString(), hasta: now.toISOString() };
}

const ALL_TIPOS: AuditEventType[] = [
  "venta",
  "egreso",
  "cierre",
  "stock_compra",
  "stock_venta",
  "stock_ajuste",
  "stock_transferencia",
];

const TIPO_COLORS: Record<AuditEventType, string> = {
  venta: "var(--sage-700)",
  egreso: "var(--ink)",
  cierre: "var(--sage-700)",
  stock_compra: "var(--ink)",
  stock_venta: "var(--ink)",
  stock_ajuste: "var(--danger)",
  stock_transferencia: "var(--ink)",
};

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireUser();
  if (user.rol !== "admin") redirect("/reportes");

  const sp = await searchParams;
  const rango = sp.rango ?? "mes";
  const { desde, hasta } = rangoToFechas(rango);
  const tipos = sp.tipo
    ? [sp.tipo as AuditEventType].filter((t) => ALL_TIPOS.includes(t))
    : undefined;

  const events = await getAuditTimeline({
    desde,
    hasta,
    tipos,
    usuarioId: sp.usuario || undefined,
    sucursalId: sp.sucursal || undefined,
    search: sp.q || undefined,
    limit: 500,
  });

  const agg = aggregateAudit(events);
  const sucursales = await listSucursales();
  const usuarios = [...store.usuarios].sort((a, b) =>
    a.nombre.localeCompare(b.nombre),
  );

  return (
    <div className="space-y-8 max-w-6xl">
      <header className="space-y-2">
        <Link
          href="/reportes"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3 stroke-[1.5]" />
          Volver a reportes
        </Link>
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Auditoría
        </h1>
        <p className="text-sm text-muted-foreground">
          Timeline de movimientos · {agg.total} evento
          {agg.total !== 1 ? "s" : ""} ·{" "}
          {RANGOS.find((r) => r.value === rango)?.label.toLowerCase()}
        </p>
      </header>

      {/* KPIs por tipo */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {ALL_TIPOS.map((t) => (
          <div
            key={t}
            className="bg-card border border-border rounded-md p-3"
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">
              {TIPO_LABELS[t]}
            </p>
            <p
              className="font-display text-xl mt-1 tabular-nums"
              style={{ color: TIPO_COLORS[t] }}
            >
              {agg.porTipo[t]}
            </p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <form
        action="/reportes/auditoria"
        method="get"
        className="bg-card border border-border rounded-md p-4 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end"
      >
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Rango
          </label>
          <select
            name="rango"
            defaultValue={rango}
            className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
          >
            {RANGOS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Tipo
          </label>
          <select
            name="tipo"
            defaultValue={sp.tipo ?? ""}
            className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
          >
            <option value="">Todos</option>
            {ALL_TIPOS.map((t) => (
              <option key={t} value={t}>
                {TIPO_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Usuario
          </label>
          <select
            name="usuario"
            defaultValue={sp.usuario ?? ""}
            className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
          >
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} ({u.rol})
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Sucursal
          </label>
          <select
            name="sucursal"
            defaultValue={sp.sucursal ?? ""}
            className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
          >
            <option value="">Todas</option>
            {sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Búsqueda
          </label>
          <div className="flex gap-2">
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Cliente, insumo, motivo…"
              className="flex-1 px-3 py-2 border border-border rounded-md bg-card text-sm"
            />
            <button
              type="submit"
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 transition-colors"
            >
              Filtrar
            </button>
          </div>
        </div>
      </form>

      {/* Resumen por usuario (si filtro genérico) */}
      {agg.porUsuario.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            Actividad por usuario
          </h2>
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Usuario</th>
                  <th className="text-left font-medium px-4 py-3">Rol</th>
                  <th className="text-right font-medium px-4 py-3">
                    Eventos
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {agg.porUsuario.map((u) => (
                  <tr key={u.usuario}>
                    <td className="px-4 py-3 font-medium">{u.usuario}</td>
                    <td className="px-4 py-3 text-xs uppercase text-muted-foreground tracking-wider">
                      {u.rol}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {u.cantidad}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Timeline */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Timeline
        </h2>
        {events.length === 0 ? (
          <div className="bg-card border border-border rounded-md p-8 text-center text-sm text-muted-foreground">
            Sin eventos para los filtros aplicados.
          </div>
        ) : (
          <div className="bg-card border border-border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Fecha</th>
                  <th className="text-left font-medium px-4 py-3">Evento</th>
                  <th className="text-left font-medium px-4 py-3">Detalle</th>
                  <th className="text-left font-medium px-4 py-3">Usuario</th>
                  <th className="text-left font-medium px-4 py-3">Sucursal</th>
                  <th className="text-right font-medium px-4 py-3">Monto</th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-cream/30">
                    <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
                      {new Date(e.fecha).toLocaleString("es-AR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider"
                        style={{ color: TIPO_COLORS[e.tipo] }}
                      >
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: TIPO_COLORS[e.tipo] }}
                        />
                        {e.titulo}
                      </span>
                    </td>
                    <td className="px-4 py-3">{e.detalle}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{e.usuario_nombre}</span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ({e.usuario_rol})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {e.sucursal_nombre}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {e.monto != null ? formatARS(e.monto) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e.href && (
                        <Link
                          href={e.href}
                          className="text-xs uppercase tracking-wider text-sage-700 hover:text-sage-900"
                        >
                          Ver
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {events.length === 500 && (
          <p className="text-xs text-muted-foreground italic">
            Mostrando los primeros 500 eventos. Acotá el rango para ver más.
          </p>
        )}
      </section>
    </div>
  );
}
