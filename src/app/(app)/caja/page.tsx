import { redirect } from "next/navigation";
import { getAnalyticsSnapshot } from "@/lib/data/analytics";
import { getAccessScope } from "@/lib/auth/access";
import { formatARS } from "@/lib/utils";

export default async function CajaPage() {
  const scope = await getAccessScope();
  if (!scope?.puedeVerCaja) {
    redirect("/dashboard");
  }

  const analytics = await getAnalyticsSnapshot();

  return (
    <div className="space-y-8 max-w-5xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Caja
        </h1>
        <p className="text-sm text-muted-foreground">
          Control financiero por alcance de rol. Base lista para cierre diario real.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <MiniCard label="Ingresos" value={formatARS(analytics.kpis.ingresos)} />
        <MiniCard label="Egresos" value={formatARS(analytics.kpis.egresos)} />
        <MiniCard label="Neto" value={formatARS(analytics.kpis.neto)} />
        <MiniCard label="Cancelaciones" value={`${analytics.kpis.cancelacionesPct}%`} />
      </div>

      <div className="rounded-[1.75rem] border border-border bg-card p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
          Gobernanza aplicada
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {analytics.governance.metricas.slice(0, 3).map((item) => (
            <div key={item.nombre} className="rounded-2xl border border-stone-100 bg-cream/60 p-4">
              <p className="text-sm font-semibold text-ink">{item.nombre}</p>
              <p className="mt-1 text-sm text-stone-700">{item.definicion}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl tabular-nums">{value}</p>
    </div>
  );
}
