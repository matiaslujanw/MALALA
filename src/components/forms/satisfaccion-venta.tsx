"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertTriangle } from "lucide-react";
import type { ActionResult } from "@/lib/data/_helpers";

type Estado = "ok" | "error" | "";

interface Props {
  ingresoId: string;
  /** undefined = sin dato, true = satisfecho, false = no satisfecho. */
  satisfecho?: boolean;
  nota?: string;
  puedeEditar: boolean;
  action: (
    state: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
}

export function SatisfaccionVentaForm({
  ingresoId,
  satisfecho,
  nota,
  puedeEditar,
  action,
}: Props) {
  const router = useRouter();
  const inicial: Estado =
    satisfecho === true ? "ok" : satisfecho === false ? "error" : "";
  const [estado, setEstado] = useState<Estado>(inicial);
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

  if (!puedeEditar) {
    return (
      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Satisfacción del cliente
        </h2>
        <SatisfaccionBadge satisfecho={satisfecho} />
        {satisfecho === false && nota && (
          <p className="text-sm text-muted-foreground">{nota}</p>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-3 bg-card border border-border rounded-md p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Satisfacción del cliente
        </h2>
        <SatisfaccionBadge satisfecho={satisfecho} />
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="ingreso_id" value={ingresoId} />
        <input type="hidden" name="estado" value={estado} />

        <div className="flex flex-wrap gap-2">
          <Opcion
            activa={estado === "ok"}
            onClick={() => setEstado("ok")}
            tone="ok"
            icon={<Check className="h-4 w-4 stroke-[1.5]" />}
            label="Satisfecho"
          />
          <Opcion
            activa={estado === "error"}
            onClick={() => setEstado("error")}
            tone="error"
            icon={<AlertTriangle className="h-4 w-4 stroke-[1.5]" />}
            label="No satisfecho"
          />
        </div>

        {estado === "error" && (
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Motivo (opcional)
            </label>
            <textarea
              name="satisfaccion_nota"
              value={notaTxt}
              onChange={(e) => setNotaTxt(e.target.value)}
              rows={2}
              placeholder="Ej. quedó disconforme con el color; hubo que repasar y se usó más insumo…"
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        )}
        {estado !== "error" && (
          <input type="hidden" name="satisfaccion_nota" value="" />
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending || estado === ""}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 disabled:opacity-50 transition-colors"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
          {state?.ok && <span className="text-xs text-sage-700">Guardado.</span>}
        </div>
      </form>
    </section>
  );
}

function SatisfaccionBadge({ satisfecho }: { satisfecho?: boolean }) {
  if (satisfecho === true) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-sage-100 text-sage-800">
        <Check className="h-3.5 w-3.5 stroke-[1.5]" />
        Satisfecho
      </span>
    );
  }
  if (satisfecho === false) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider px-2 py-0.5 rounded"
        style={{ backgroundColor: "rgb(201 169 97 / 0.18)", color: "var(--danger)" }}
      >
        <AlertTriangle className="h-3.5 w-3.5 stroke-[1.5]" />
        No satisfecho
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs uppercase tracking-wider px-2 py-0.5 rounded bg-stone-100 text-stone-500">
      Sin dato
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
  tone: "ok" | "error";
  icon: React.ReactNode;
  label: string;
}) {
  const activeCls =
    tone === "ok"
      ? "bg-sage-700 text-white border-sage-700"
      : "bg-[var(--danger)] text-white border-[var(--danger)]";
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
