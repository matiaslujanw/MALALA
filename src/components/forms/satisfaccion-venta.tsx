"use client";

import { useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { useActionStateFeedback } from "@/components/feedback/action-feedback";
import { LoadingButton } from "./field";
import type { ActionResult } from "@/lib/data/_helpers";

type Estado = "ok" | "error" | "";

interface Props {
  ingresoId: string;
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
  const inicial: Estado =
    satisfecho === true ? "ok" : satisfecho === false ? "error" : "";
  const [estado, setEstado] = useState<Estado>(inicial);
  const [notaTxt, setNotaTxt] = useState(nota ?? "");

  const [state, formAction, pending] = useActionStateFeedback(action, {
    refreshOnSuccess: true,
    successMessage: "Satisfaccion guardada",
  });

  const error = state && !state.ok ? Object.values(state.errors).flat()[0] : null;

  if (!puedeEditar) {
    return (
      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Satisfaccion del cliente
        </h2>
        <SatisfaccionBadge satisfecho={satisfecho} />
        {satisfecho === false && nota && (
          <p className="text-sm text-muted-foreground">{nota}</p>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Satisfaccion del cliente
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

        {estado === "error" ? (
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Motivo (opcional)
            </label>
            <textarea
              name="satisfaccion_nota"
              value={notaTxt}
              onChange={(e) => setNotaTxt(e.target.value)}
              rows={2}
              placeholder="Ej. quedó disconforme con el color o hubo que repasar."
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        ) : (
          <input type="hidden" name="satisfaccion_nota" value="" />
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex items-center gap-3">
          <LoadingButton
            type="submit"
            disabled={estado === ""}
            pending={pending}
            pendingLabel="Guardando..."
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-sage-700"
          >
            Guardar
          </LoadingButton>
        </div>
      </form>
    </section>
  );
}

function SatisfaccionBadge({ satisfecho }: { satisfecho?: boolean }) {
  if (satisfecho === true) {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-sage-100 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-sage-800">
        <Check className="h-3.5 w-3.5 stroke-[1.5]" />
        Satisfecho
      </span>
    );
  }
  if (satisfecho === false) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium uppercase tracking-wider"
        style={{ backgroundColor: "rgb(201 169 97 / 0.18)", color: "var(--danger)" }}
      >
        <AlertTriangle className="h-3.5 w-3.5 stroke-[1.5]" />
        No satisfecho
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-stone-100 px-2 py-0.5 text-xs uppercase tracking-wider text-stone-500">
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
      ? "border-sage-700 bg-sage-700 text-white"
      : "border-[var(--danger)] bg-[var(--danger)] text-white";
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
