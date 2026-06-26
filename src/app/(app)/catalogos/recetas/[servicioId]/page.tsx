import { Trash2 } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AgregarInsumoReceta } from "@/components/forms/agregar-insumo-receta";
import {
  getRecetaItems,
  removeRecetaItem,
  upsertRecetaItem,
} from "@/lib/data/recetas";
import { getServicio } from "@/lib/data/servicios";
import { listInsumos } from "@/lib/data/insumos";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";
import { formatARS } from "@/lib/utils";

const UNIDAD_LABEL: Record<string, string> = {
  ud: "ud",
  ml: "ml",
  g: "g",
  aplicacion: "apl.",
};

export default async function EditarRecetaPage({
  params,
}: {
  params: Promise<{ servicioId: string }>;
}) {
  const user = await requireUser();
  const { servicioId } = await params;

  // La receta y los insumos disponibles son los de la sucursal activa.
  const sucursal = await getActiveSucursal();
  if (!sucursal) redirect("/catalogos/recetas");

  const [servicio, items, insumos] = await Promise.all([
    getServicio(servicioId),
    getRecetaItems(servicioId, sucursal.id),
    listInsumos({ sucursalId: sucursal.id }),
  ]);
  if (!servicio) notFound();

  const isAdmin = user.rol === "admin";

  // Insumos disponibles para agregar (los que no están ya en la receta)
  const insumosUsados = new Set(items.map((i) => i.insumo.id));
  const insumosDisponibles = insumos.filter((i) => !insumosUsados.has(i.id));

  const costoTotal = items.reduce((acc, i) => acc + i.costo, 0);
  // Comisión estimada de la empleada: % del precio efectivo (precio pleno).
  const comision =
    servicio.precio_efectivo * (servicio.comision_default_pct / 100);
  // Margen de contribución: lo que queda después de insumos Y comisión.
  const margen = servicio.precio_efectivo - costoTotal - comision;
  const margenPct =
    servicio.precio_efectivo > 0
      ? (margen / servicio.precio_efectivo) * 100
      : 0;

  async function add(formData: FormData) {
    "use server";
    if (!isAdmin) redirect(`/catalogos/recetas/${servicioId}`);
    formData.set("servicio_id", servicioId);
    await upsertRecetaItem(formData);
  }

  async function update(formData: FormData) {
    "use server";
    if (!isAdmin) redirect(`/catalogos/recetas/${servicioId}`);
    formData.set("servicio_id", servicioId);
    await upsertRecetaItem(formData);
  }

  async function remove(formData: FormData) {
    "use server";
    if (!isAdmin) redirect(`/catalogos/recetas/${servicioId}`);
    const id = formData.get("receta_id");
    if (typeof id === "string") await removeRecetaItem(id);
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <header className="space-y-2">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Receta
        </h1>
        <p className="text-sm text-muted-foreground">
          {servicio.rubro} · <span className="font-medium text-foreground">{servicio.nombre}</span>
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-md p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Precio efectivo
          </p>
          <p className="font-display text-2xl mt-2 tabular-nums">
            {formatARS(servicio.precio_efectivo)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-md p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Costo insumos
          </p>
          <p className="font-display text-2xl mt-2 tabular-nums">
            −{formatARS(costoTotal)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-md p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Comisión ({servicio.comision_default_pct}%)
          </p>
          <p className="font-display text-2xl mt-2 tabular-nums">
            −{formatARS(comision)}
          </p>
        </div>
        <div className="bg-card border border-border rounded-md p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Margen real
          </p>
          <p
            className="font-display text-2xl mt-2 tabular-nums"
            style={{
              color: margen >= 0 ? "var(--sage-700)" : "var(--danger)",
            }}
          >
            {formatARS(margen)}
          </p>
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
            {margenPct.toFixed(0)}% · después de insumos y comisión
          </p>
        </div>
      </div>

      {/* Lista de insumos en la receta */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Insumos de la receta
        </h2>
        <div className="bg-card border border-border rounded-md overflow-hidden">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Sin insumos cargados todavía.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Insumo</th>
                  <th className="text-right font-medium px-4 py-3 w-40">
                    Cantidad
                  </th>
                  <th className="text-right font-medium px-4 py-3">$ unit.</th>
                  <th className="text-right font-medium px-4 py-3">Costo</th>
                  {isAdmin && <th className="px-4 py-3 w-20"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map(({ receta, insumo, costo }) => (
                  <tr key={receta.id} className="hover:bg-cream/30">
                    <td className="px-4 py-3 font-medium">{insumo.nombre}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {isAdmin ? (
                        <form action={update} className="flex items-center gap-1 justify-end">
                          <input
                            type="hidden"
                            name="insumo_id"
                            value={insumo.id}
                          />
                          <input
                            type="number"
                            name="cantidad"
                            step="0.01"
                            min="0.01"
                            defaultValue={receta.cantidad}
                            className="w-20 px-2 py-1 text-right border border-border rounded-md text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                          <span className="text-xs text-muted-foreground">
                            {UNIDAD_LABEL[insumo.unidad_medida]}
                          </span>
                          <button
                            type="submit"
                            className="text-xs uppercase tracking-wider text-sage-700 hover:text-sage-900 ml-1"
                          >
                            ↻
                          </button>
                        </form>
                      ) : (
                        <>
                          {receta.cantidad}{" "}
                          <span className="text-xs text-muted-foreground">
                            {UNIDAD_LABEL[insumo.unidad_medida]}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {insumo.precio_unitario != null
                        ? formatARS(insumo.precio_unitario)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatARS(costo)}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <form action={remove}>
                          <input
                            type="hidden"
                            name="receta_id"
                            value={receta.id}
                          />
                          <button
                            type="submit"
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            title="Quitar"
                          >
                            <Trash2 className="h-4 w-4 stroke-[1.5]" />
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Form para agregar */}
      {isAdmin && insumosDisponibles.length > 0 && (
        <section className="bg-card border border-border rounded-md p-5 space-y-4">
          <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
            Agregar insumo
          </h2>
          <p className="text-xs text-muted-foreground">
            La cantidad es lo que consume <strong>un</strong> servicio, en la
            unidad de cada insumo (ml, g o ud) — no en envases.
          </p>
          <AgregarInsumoReceta insumosDisponibles={insumosDisponibles} action={add} />
        </section>
      )}

      {isAdmin && insumosDisponibles.length === 0 && items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Todos los insumos disponibles ya están en la receta.
        </p>
      )}
    </div>
  );
}
