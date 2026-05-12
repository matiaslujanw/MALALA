import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";
import {
  getCierreDeFecha,
  getResumenDelDia,
} from "@/lib/data/caja";
import { formatARS } from "@/lib/utils";
import { CierreCajaSimpleForm } from "@/components/forms/cierre-caja-simple-form";

function todayYMD(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function NuevoCierrePage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const user = await requireUser();
  if (user.rol !== "admin" && user.rol !== "encargada") redirect("/caja");

  const sucursal = await getActiveSucursal();
  if (!sucursal) redirect("/dev/login");

  const sp = await searchParams;
  const fecha = sp.fecha ?? todayYMD();

  const existente = await getCierreDeFecha(sucursal.id, fecha);
  if (existente) redirect(`/caja/${existente.id}`);

  const resumen = await getResumenDelDia(sucursal.id, fecha);

  return (
    <div className="space-y-8 max-w-3xl">
      <header className="space-y-2">
        <Link
          href="/caja"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3 stroke-[1.5]" />
          Volver a caja
        </Link>
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Cerrar caja
        </h1>
        <p className="text-sm text-muted-foreground tabular-nums">
          {sucursal.nombre} · {fecha}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Resumen esperado del día
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Efectivo (neto)" value={formatARS(resumen.ef.neto)} />
          <Kpi label="Transferencia" value={formatARS(resumen.tr.neto)} />
          <Kpi label="Tarjeta crédito" value={formatARS(resumen.tc.ingresos)} />
          <Kpi label="Tarjeta débito" value={formatARS(resumen.td.ingresos)} />
        </div>
        <p className="text-xs text-muted-foreground">
          Al cerrar se guarda esta foto del día. Las comisiones a pagar a empleados
          se gestionan desde{" "}
          <Link href="/liquidaciones" className="underline">
            Liquidaciones
          </Link>
          .
        </p>
      </section>

      <CierreCajaSimpleForm sucursalId={sucursal.id} fecha={fecha} />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-display text-xl tabular-nums">{value}</p>
    </div>
  );
}
