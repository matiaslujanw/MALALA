"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertTriangle, CircleDashed } from "lucide-react";
import type { RevisionVenta } from "@/lib/types";
import type { ActionResult } from "@/lib/data/_helpers";

type Estado = RevisionVenta | "";

interface Props {
  ingresoId: string;
  revision?: RevisionVenta;
  nota?: string;
  revisadoEn?: string;
  puedeEditar: boolean;
  action: (
    state: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
}

function fmt(iso?: string): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function RevisionVentaForm({
  ingresoId,
  revision,
  nota,
  revisadoEn,
  puedeEditar,
  action,
}: Props) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>(revision ?? "");
  const [notaTxt, setNotaTxt] = useState(nota ?? "");

  const [state, formAction, pending] = useActionState<
    ActionResult | null,
    FormData
  >(async (prev, fd) => {
    const r = await action(prev, fd);
    if (r.ok) router.refresh();
    return r;
  }, null);

  const error = state && !state.ok ? Object.values(state.errors).flat()[0] : null;
  const revisadoFecha = fmt(revisadoEn);

  // Vista de solo lectura para roles sin permiso de auditar.
  if (!puedeEditar) {
    return (
      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Revisión
        </h2>
        <RevisionBadge revision={revision} />
        {nota && <p className="text-sm text-muted-foreground">{nota}</p>}
      </section>
    );
  }

  return (
    <section className="space-y-3 bg-card border border-border rounded-md p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Revisión de la venta
        </h2>
        <RevisionBadge revision={revision} />
      </div>
      <p className="text-xs text-muted-foreground">
        Marcá si la venta se cargó correctamente o tuvo errores del empleado.
      </p>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="ingreso_id" value={ingresoId} />
        <input type="hidden" name="estado" value={estado} />

        <div className="flex flex-wrap gap-2">
          <Opcion
            activa={estado === "ok"}
            onClick={() => setEstado("ok")}
            tone="ok"
            icon={<Check className="h-4 w-4 stroke-[1.5]" />}
            label="Correcta"
          />
          <Opcion
            activa={estado === "error"}
            onClick={() => setEstado("error")}
            tone="error"
            icon={<AlertTriangle className="h-4 w-4 stroke-[1.5]" />}
            label="Con error"
          />
          <Opcion
            activa={estado === ""}
            onClick={() => setEstado("")}
            tone="muted"
            icon={<CircleDashed className="h-4 w-4 stroke-[1.5]" />}
            label="Sin revisar"
          />
        </div>

        {estado === "error" && (
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Detalle del error (opcional)
            </label>
            <textarea
              name="revision_nota"
              value={notaTxt}
              onChange={(e) => setNotaTxt(e.target.value)}
              rows={2}
              placeholder="Ej. cobró precio de lista en vez de efectivo, faltó cargar un servicio…"
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}
        {estado !== "error" && (
          <input type="hidden" name="revision_nota" value="" />
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 disabled:opacity-50 transition-colors"
          >
            {pending ? "Guardando…" : "Guardar revisión"}
          </button>
          {state?.ok && <span className="text-xs text-sage-700">Guardado.</span>}
          {revisadoFecha && (
            <span className="text-xs text-muted-foreground">
              Última revisión: {revisadoFecha}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}

function RevisionBadge({ revision }: { revision?: RevisionVenta }) {
  if (revision === "ok") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-sage-100 text-sage-800">
        <Check className="h-3.5 w-3.5 stroke-[1.5]" />
        Correcta
      </span>
    );
  }
  if (revision === "error") {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded"
        style={{ backgroundColor: "rgb(201 169 97 / 0.18)", color: "var(--danger)" }}
      >
        <AlertTriangle className="h-3.5 w-3.5 stroke-[1.5]" />
        Con error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs uppercase tracking-wider px-2 py-0.5 rounded bg-stone-100 text-stone-500">
      <CircleDashed className="h-3.5 w-3.5 stroke-[1.5]" />
      Sin revisar
    </span>
  );
}

function Opcion({
  activa,
  onClick,
  tone,
  icon,
  label,
}: {
  activa: boolean;
  onClick: () => void;
  tone: "ok" | "error" | "muted";
  icon: React.ReactNode;
  label: string;
}) {
  const activeCls =
    tone === "ok"
      ? "bg-sage-700 text-white border-sage-700"
      : tone === "error"
        ? "bg-[var(--danger)] text-white border-[var(--danger)]"
        : "bg-stone-200 text-stone-700 border-stone-300";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
        activa ? activeCls : "border-border bg-card hover:bg-cream"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
