/**
 * Styleguide: validar tipografía, paleta y tokens del brand.
 * Esta página es solo para desarrollo. Eliminar/proteger antes de deploy.
 */

const swatches: { name: string; cls: string; hex: string }[] = [
  { name: "background", cls: "bg-background", hex: "#FAFAF9" },
  { name: "card", cls: "bg-card", hex: "#FFFFFF" },
  { name: "cream", cls: "bg-cream", hex: "#F5F4F0" },
  { name: "stone-100", cls: "bg-stone-100", hex: "#E7E5E0" },
  { name: "stone-300", cls: "bg-stone-300", hex: "#C4C2BC" },
  { name: "stone-500", cls: "bg-stone-500", hex: "#78766F" },
  { name: "stone-700", cls: "bg-stone-700", hex: "#3F3D38" },
  { name: "ink (foreground)", cls: "bg-ink", hex: "#1A1A1A" },
  { name: "sage-50", cls: "bg-sage-50", hex: "#F2F5F0" },
  { name: "sage-100", cls: "bg-sage-100", hex: "#DDE5D6" },
  { name: "sage-300", cls: "bg-sage-300", hex: "#A8B89A" },
  { name: "sage-500 (primary)", cls: "bg-sage-500", hex: "#6E8060" },
  { name: "sage-700", cls: "bg-sage-700", hex: "#4A5840" },
  { name: "sage-900", cls: "bg-sage-900", hex: "#2C3525" },
  { name: "warning", cls: "bg-warning", hex: "#C9A961" },
  { name: "danger (destructive)", cls: "bg-danger", hex: "#A84A3D" },
];

export default function StyleguidePage() {
  return (
    <div className="min-h-screen p-8 md:p-12 max-w-5xl mx-auto space-y-12">
      {/* Header */}
      <header className="space-y-2 border-b border-border pb-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Brand · Dev only
        </p>
        <h1 className="font-display text-4xl tracking-[0.2em] uppercase">
          Styleguide
        </h1>
        <p className="text-sm text-muted-foreground">
          Validación de tokens, tipografías y paleta MALALA.
        </p>
      </header>

      {/* Tipografía */}
      <section className="space-y-6">
        <h2 className="font-sans text-xl font-medium tracking-wide">
          Tipografía
        </h2>

        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Logo / Display — Cinzel
            </p>
            <p className="font-display text-2xl tracking-[0.3em] uppercase">
              MALALA
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              H1 página — font-display 3xl tracking-[0.2em]
            </p>
            <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
              Ventas
            </h1>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              H2 sección — font-sans xl medium
            </p>
            <h2 className="font-sans text-xl font-medium tracking-wide">
              Movimientos del día
            </h2>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              H3 sub — font-sans base semibold
            </p>
            <h3 className="font-sans text-base font-semibold">
              Detalle del ticket
            </h3>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Body — font-sans sm
            </p>
            <p className="text-sm">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. La venta
              se registra al cierre del ticket y descuenta stock automáticamente
              según la receta.
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Tablas — tabular-nums
            </p>
            <p className="font-sans text-sm tabular-nums">
              $ 1.245.000,00 · $ 320.500,75 · $ 12.300,00
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Label form
            </p>
            <p className="font-sans text-xs font-medium uppercase tracking-wider">
              Cliente
            </p>
          </div>
        </div>
      </section>

      {/* Paleta */}
      <section className="space-y-6">
        <h2 className="font-sans text-xl font-medium tracking-wide">Paleta</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {swatches.map((s) => (
            <div
              key={s.name}
              className="rounded-md border border-border overflow-hidden"
            >
              <div className={`${s.cls} h-16 w-full`} />
              <div className="p-3 bg-card">
                <p className="text-xs font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {s.hex}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Componentes base */}
      <section className="space-y-6">
        <h2 className="font-sans text-xl font-medium tracking-wide">
          Componentes (preview pre-shadcn)
        </h2>

        <div className="space-y-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Botones
          </p>
          <div className="flex flex-wrap gap-3">
            <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 transition-colors">
              Guardar venta
            </button>
            <button className="border border-border px-4 py-2 rounded-md text-sm font-medium hover:bg-cream transition-colors">
              Cancelar
            </button>
            <button className="bg-destructive text-destructive-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider">
              Anular
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Badges de stock
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="bg-sage-100 text-sage-900 px-2.5 py-1 rounded text-xs font-medium">
              Stock OK
            </span>
            <span
              className="px-2.5 py-1 rounded text-xs font-medium"
              style={{
                backgroundColor: "rgb(201 169 97 / 0.15)",
                color: "var(--warning)",
              }}
            >
              Stock bajo
            </span>
            <span
              className="px-2.5 py-1 rounded text-xs font-medium"
              style={{
                backgroundColor: "rgb(168 74 61 / 0.12)",
                color: "var(--danger)",
              }}
            >
              Stock negativo
            </span>
            <span className="bg-stone-100 text-stone-500 px-2.5 py-1 rounded text-xs font-medium">
              Inactivo
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Card de KPI
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-md p-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Ventas del día
              </p>
              <p className="font-display text-3xl mt-2 tabular-nums">
                $ 1.245.000
              </p>
              <p className="text-xs text-sage-700 mt-1">+12% vs ayer</p>
            </div>
            <div className="bg-card border border-border rounded-md p-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Tickets
              </p>
              <p className="font-display text-3xl mt-2 tabular-nums">23</p>
              <p className="text-xs text-muted-foreground mt-1">Yerba Buena</p>
            </div>
            <div className="bg-card border border-border rounded-md p-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Stock bajo
              </p>
              <p className="font-display text-3xl mt-2 tabular-nums">7</p>
              <p
                className="text-xs mt-1"
                style={{ color: "var(--warning)" }}
              >
                Insumos por debajo del umbral
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
