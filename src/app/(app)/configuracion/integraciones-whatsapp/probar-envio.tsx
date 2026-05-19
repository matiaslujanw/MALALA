"use client";

import { useActionState } from "react";
import {
  enviarMensajePruebaAction,
  type PruebaResult,
} from "@/lib/data/integraciones-manychat";

export function ProbarEnvioForm({ sucursalId }: { sucursalId: string }) {
  const [state, action, pending] = useActionState<PruebaResult | null, FormData>(
    enviarMensajePruebaAction,
    null,
  );

  return (
    <form
      action={action}
      className="space-y-3 rounded-xl border border-border bg-muted/40 p-4"
    >
      <input type="hidden" name="sucursal_id" value={sucursalId} />

      <h3 className="text-sm font-medium text-ink">Mandar mensaje de prueba</h3>

      <label className="block text-sm">
        <span className="text-xs text-muted-foreground">Tu teléfono</span>
        <input
          name="telefono_destino"
          placeholder="+5493815557777"
          required
          className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="text-xs text-muted-foreground">Nombre</span>
        <input
          name="nombre_destino"
          defaultValue="Prueba"
          className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
        />
      </label>

      {state && !state.ok && (
        <p className="text-xs text-rose-600">
          {state.errors._?.[0] ??
            Object.values(state.errors).flat()[0] ??
            "Error al enviar"}
        </p>
      )}
      {state?.ok && (
        <p className="text-xs text-emerald-700">
          Enviado ✓ (subscriber {state.subscriberId})
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-ink disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Enviar prueba"}
      </button>
    </form>
  );
}
