import Link from "next/link";
import {
  CalendarClock,
  Landmark,
  Plus,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { requireUser, getActiveSucursal } from "@/lib/auth/session";
import { buildAccessScope } from "@/lib/auth/access";
import { listIngresos } from "@/lib/data/ingresos";
import { listSucursales } from "@/lib/data/sucursales";
import { listSaldos } from "@/lib/data/cuentas-bancarias";
import { listTurnos } from "@/lib/data/turnos";
import { aggregate, comisionesPorEmpleado } from "@/lib/data/ingresos-helpers";
import { formatARS } from "@/lib/utils";

export const dynamic = "force-dynamic";

function todayYMD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtFechaLarga(d: Date): string {
  return d.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function hhmmActual(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const ESTADO_COLOR: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-900",
  confirmado: "bg-sage-100 text-sage-900",
  en_curso: "bg-blue-100 text-blue-900",
  completado: "bg-stone-100 text-stone-600",
  cancelado: "bg-rose-100 text-rose-900",
  ausente: "bg-rose-100 text-rose-900",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const scope = buildAccessScope(user);
  const activa = await getActiveSucursal();
  const isEmployee = scope.rol === "empleado";

  const hoy = todayYMD();
  const desdeIso = `${hoy}T00:00:00.000`;
  const hastaIso = `${hoy}T23:59:59.999`;
  const horaActual = hhmmActual();

  const [ingresosHoy, saldos, turnosHoy, sucursalesAll] = await Promise.all([
    listIngresos({
      desde: desdeIso,
      hasta: hastaIso,
      empleadoId: isEmployee ? scope.empleadoId : undefined,
    }),
    scope.puedeVerCaja ? listSaldos() : Promise.resolve([]),
    listTurnos({ fecha: hoy }),
    listSucursales({ soloActivas: true }),
  ]);
  const sucursales = sucursalesAll.filter((s) =>
    scope.sucursalIdsPermitidas.includes(s.id),
  );

  const totales = aggregate(ingresosHoy);
  const totalSaldos = saldos.reduce((acc, s) => acc + s.saldo, 0);
  const topEmpleadasHoy = comisionesPorEmpleado(ingresosHoy).slice(0, 3);

  // Próximos turnos: futuros (hora >= ahora), no cancelados/completados
  const proximos = turnosHoy
    .filter(
      (t) =>
        t.hora >= horaActual &&
        t.estado !== "cancelado" &&
        t.estado !== "completado" &&
        t.estado !== "ausente",
    )
    .slice(0, 10);

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          Hoy
        </p>
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          {fmtFechaLarga(new Date())}
        </h1>
        <p className="text-sm text-muted-foreground">
          Hola {user.nombre}
          {activa ? ` · ${activa.nombre}` : ""}
        </p>
      </header>

      {/* Accesos rápidos */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickAction
          href="/ventas/nueva"
          label="Nueva venta"
          Icon={Plus}
          highlight
        />
        <QuickAction href="/turnos" label="Agenda" Icon={CalendarClock} />
        {scope.puedeVerCaja && (
          <QuickAction href="/caja" label="Caja" Icon={Wallet} />
        )}
        {scope.puedeVerReportes && (
          <QuickAction href="/reportes" label="Reportes" Icon={Receipt} />
        )}
      </section>

      {/* Ventas de hoy */}
      <section className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_14px_40px_rgba(44,53,37,0.04)]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-sage-700" />
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
              Ventas de hoy
            </p>
          </div>
          {scope.puedeVerReportes && (
            <Link
              href={`/reportes/ventas?desde=${hoy}&hasta=${hoy}`}
              className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              Ver detalle →
            </Link>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Tickets" value={String(totales.cantidad)} />
          <Stat
            label={isEmployee ? "Mi facturado" : "Facturado"}
            value={formatARS(totales.total)}
            accent="sage"
          />
          <Stat
            label="Comisiones"
            value={formatARS(totales.comisiones)}
            hint="al equipo"
          />
          <Stat
            label="Neto"
            value={formatARS(totales.neto)}
            accent={totales.neto >= 0 ? "sage" : "danger"}
          />
        </div>
        {topEmpleadasHoy.length > 0 && !isEmployee && (
          <div className="mt-5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
              Top empleadas hoy
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {topEmpleadasHoy.map((emp) => (
                <div
                  key={emp.empleado.id}
                  className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {emp.empleado.nombre}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {emp.lineas} servicio{emp.lineas !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <p className="text-sm tabular-nums text-sage-700 font-medium">
                    {formatARS(emp.total)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Saldos en cuentas */}
      {scope.puedeVerCaja && saldos.length > 0 && (
        <SaldosCard
          saldos={saldos}
          sucursales={sucursales}
          total={totalSaldos}
        />
      )}

      {/* Próximos turnos */}
      <section className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_14px_40px_rgba(44,53,37,0.04)]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-sage-700" />
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
              Próximos turnos
            </p>
          </div>
          <Link
            href="/turnos"
            className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Ver agenda completa →
          </Link>
        </div>
        {proximos.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No hay más turnos pendientes para hoy.
          </p>
        ) : (
          <div className="mt-4 divide-y divide-border">
            {proximos.map((t) => {
              const empleado = t as unknown as { profesional_nombre?: string };
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 py-2.5"
                >
                  <div className="w-14 font-display text-lg tabular-nums text-sage-700">
                    {t.hora}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {t.cliente_nombre}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {(t as unknown as { servicio_nombre?: string })
                        .servicio_nombre ?? "Servicio"}
                      {empleado.profesional_nombre
                        ? ` · ${empleado.profesional_nombre}`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded ${
                      ESTADO_COLOR[t.estado] ?? "bg-stone-100 text-stone-600"
                    }`}
                  >
                    {t.estado}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "sage" | "danger";
}) {
  const color =
    accent === "sage"
      ? "text-sage-700"
      : accent === "danger"
        ? "text-rose-600"
        : "";
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`font-display text-xl mt-1 tabular-nums ${color}`}>{value}</p>
      {hint && (
        <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>
      )}
    </div>
  );
}

function QuickAction({
  href,
  label,
  Icon,
  highlight,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  const base =
    "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors";
  const cls = highlight
    ? `${base} border-sage-700 bg-sage-50 text-sage-900 hover:bg-sage-100`
    : `${base} border-border bg-card hover:bg-cream/40`;
  return (
    <Link href={href} className={cls}>
      <Icon className="h-5 w-5 stroke-[1.5]" />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
}

function SaldosCard({
  saldos,
  sucursales,
  total,
}: {
  saldos: Array<{
    cuenta: {
      id: string;
      sucursal_id: string;
      nombre: string;
      tipo: string;
    };
    saldo: number;
  }>;
  sucursales: Array<{ id: string; nombre: string }>;
  total: number;
}) {
  const sucursalNombreById = new Map(sucursales.map((s) => [s.id, s.nombre]));
  const grupos = new Map<string, { total: number; items: typeof saldos }>();
  for (const s of saldos) {
    const entry = grupos.get(s.cuenta.sucursal_id) ?? { total: 0, items: [] };
    entry.total += s.saldo;
    entry.items.push(s);
    grupos.set(s.cuenta.sucursal_id, entry);
  }
  const multipleSucursales = grupos.size > 1;
  return (
    <section className="rounded-[1.5rem] border border-border bg-card p-5 shadow-[0_14px_40px_rgba(44,53,37,0.04)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-sage-700" />
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
            Saldos en cuentas
          </p>
        </div>
        <Link
          href="/bancos"
          className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Ver detalle →
        </Link>
      </div>
      <p className="mt-2 font-display text-3xl tabular-nums">
        {formatARS(total)}
      </p>
      <div className="mt-4 space-y-3">
        {Array.from(grupos.entries()).map(([sucId, entry]) => (
          <div key={sucId}>
            {multipleSucursales && (
              <div className="flex items-baseline justify-between mb-1.5">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {sucursalNombreById.get(sucId) ?? sucId}
                </p>
                <p className="text-xs tabular-nums font-medium">
                  {formatARS(entry.total)}
                </p>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {entry.items.map((s) => (
                <div
                  key={s.cuenta.id}
                  className="flex items-baseline justify-between rounded-xl border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{s.cuenta.nombre}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {s.cuenta.tipo}
                    </p>
                  </div>
                  <p className="text-sm tabular-nums font-medium">
                    {formatARS(s.saldo)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
