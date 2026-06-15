import { notFound } from "next/navigation";
import { ClienteForm } from "@/components/forms/cliente-form";
import { CuentaCorrientePanel } from "@/components/cuenta-corriente-panel";
import {
  getCliente,
  toggleClienteActivo,
  updateCliente,
} from "@/lib/data/clientes";
import { listIngresos } from "@/lib/data/ingresos";
import { listMovimientosCc } from "@/lib/data/cuenta-corriente";
import { listMediosPago } from "@/lib/data/medios-pago";
import { listCuentas } from "@/lib/data/cuentas-bancarias";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";
import { formatARS } from "@/lib/utils";

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const cliente = await getCliente(id);
  if (!cliente) notFound();

  const puedeEditar = user.rol === "admin" || user.rol === "encargada";

  const sucursal = await getActiveSucursal();
  const [movimientosCc, mediosPago, cuentas] = await Promise.all([
    listMovimientosCc(id),
    sucursal
      ? listMediosPago({ sucursalId: sucursal.id, soloActivos: true })
      : Promise.resolve([]),
    sucursal
      ? listCuentas({ sucursalId: sucursal.id, soloActivas: true })
      : Promise.resolve([]),
  ]);
  const cuentasBanco = cuentas.filter((c) => c.tipo === "banco");

  const historial = await listIngresos({ clienteId: id });
  const totalServicios = historial.reduce(
    (acc, ing) => acc + ing.lineas.filter((l) => l.servicio).length,
    0,
  );
  const totalGastado = historial.reduce((acc, ing) => acc + ing.ingreso.total, 0);

  async function update(_prev: unknown, formData: FormData) {
    "use server";
    return await updateCliente(id, formData);
  }
  async function toggle() {
    "use server";
    await toggleClienteActivo(id);
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          {puedeEditar ? "Editar cliente" : "Cliente"}
        </h1>
        <p className="text-sm text-muted-foreground">{cliente.nombre}</p>
      </header>

      {puedeEditar ? (
        <ClienteForm cliente={cliente} action={update} submitLabel="Guardar" />
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-md border border-border bg-card p-5">
          <Dato label="Nombre" value={cliente.nombre} />
          <Dato label="Teléfono" value={cliente.telefono ?? "—"} />
          <Dato label="Email" value={cliente.email ?? "—"} />
          <Dato label="Saldo CC" value={formatARS(cliente.saldo_cc)} />
          <div className="sm:col-span-2">
            <Dato label="Observación" value={cliente.observacion ?? "—"} />
          </div>
        </dl>
      )}

      <CuentaCorrientePanel
        cliente={cliente}
        movimientos={movimientosCc}
        mediosPago={mediosPago}
        cuentasBanco={cuentasBanco}
        puedeGestionar={puedeEditar}
      />

      <section className="space-y-3 border-t border-border pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-xl tracking-[0.15em] uppercase">
            Ficha técnica
          </h2>
          {historial.length > 0 && (
            <p className="text-xs uppercase tracking-wider text-muted-foreground tabular-nums">
              {totalServicios} servicio{totalServicios !== 1 ? "s" : ""} ·{" "}
              {historial.length} visita{historial.length !== 1 ? "s" : ""} ·{" "}
              {formatARS(totalGastado)} total
            </p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Historial de servicios realizados al cliente.
        </p>

        {historial.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Todavía no hay servicios registrados para este cliente.
          </div>
        ) : (
          <ol className="space-y-3">
            {historial.map((ing) => (
              <li
                key={ing.ingreso.id}
                className="rounded-md border border-border bg-card p-4"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium tabular-nums">
                    {fmtFecha(ing.ingreso.fecha)}
                  </p>
                  <p className="text-sm font-medium tabular-nums">
                    {formatARS(ing.ingreso.total)}
                  </p>
                </div>
                <ul className="mt-2 divide-y divide-border">
                  {ing.lineas.map((linea) => (
                    <li
                      key={linea.id}
                      className="flex items-baseline justify-between gap-3 py-1.5 text-sm"
                    >
                      <span>
                        {linea.servicio?.nombre ??
                          linea.insumo?.nombre ??
                          "Ítem"}
                        {linea.cantidad > 1 && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ×{linea.cantidad}
                          </span>
                        )}
                        {linea.empleado && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            · {linea.empleado.nombre}
                          </span>
                        )}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatARS(linea.subtotal)}
                      </span>
                    </li>
                  ))}
                </ul>
                {ing.ingreso.observacion && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {ing.ingreso.observacion}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {puedeEditar && (
        <div className="border-t border-border pt-6">
          <form action={toggle}>
            <button
              type="submit"
              className="text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              {cliente.activo ? "Marcar inactivo" : "Reactivar"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}
