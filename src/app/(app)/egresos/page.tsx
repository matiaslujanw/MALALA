import { redirect } from "next/navigation";
import { getAnalyticsSnapshot } from "@/lib/data/analytics";
import { getAccessScope } from "@/lib/auth/access";
import { formatARS } from "@/lib/utils";

export default async function EgresosPage() {
  const scope = await getAccessScope();
  if (!scope || scope.rol === "empleado") {
    redirect("/dashboard");
  }
  const analytics = await getAnalyticsSnapshot();

  return (
    <div className="space-y-8 max-w-4xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Egresos
        </h1>
        <p className="text-sm text-muted-foreground">
          Resumen operativo de gastos dentro del alcance permitido.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card label="Egresos del rango" value={formatARS(analytics.kpis.egresos)} />
        <Card label="Neto despues de egresos" value={formatARS(analytics.kpis.neto - analytics.kpis.egresos)} />
        <Card label="Cobertura sobre ingresos" value={analytics.kpis.ingresos > 0 ? `${Math.round((analytics.kpis.egresos / analytics.kpis.ingresos) * 100)}%` : "0%"} />
      </div>

      <div className="rounded-[1.75rem] border border-border bg-card p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          Nota
        </p>
        <p className="mt-2 text-sm text-stone-700">
          Esta pantalla usa la misma capa analitica compartida que dashboard y reportes.
          En la siguiente iteracion se puede profundizar con detalle por rubro, proveedor
          y forma de pago manteniendo el mismo alcance por rol.
        </p>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl tabular-nums">{value}</p>
    </div>
  );
}
