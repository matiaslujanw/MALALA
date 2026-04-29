import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { CierreCajaForm } from "@/components/forms/cierre-caja-form";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";
import {
  createCierre,
  getCierreDeFecha,
  getResumenDelDia,
  getSugerenciasArrastre,
} from "@/lib/data/caja";

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

  const [resumen, arrastre] = await Promise.all([
    getResumenDelDia(sucursal.id, fecha),
    getSugerenciasArrastre(sucursal.id, fecha),
  ]);

  return (
    <div className="space-y-8 max-w-5xl">
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

      <CierreCajaForm
        sucursalId={sucursal.id}
        sucursalNombre={sucursal.nombre}
        fecha={fecha}
        resumen={resumen}
        arrastre={arrastre}
        action={createCierre}
      />
    </div>
  );
}
