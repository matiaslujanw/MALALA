"use client";

import { useMemo, useState } from "react";
import { useTransitionFeedback } from "@/components/feedback/action-feedback";
import { LoadingButton } from "./field";
import { createCierre } from "@/lib/data/caja";
import { formatARS } from "@/lib/utils";
import { CurrencyInput } from "./currency-input";
import type { CuentaBancaria } from "@/lib/types";

interface CuentaEsperada {
  cuenta: CuentaBancaria;
  esperado: number;
}

interface Props {
  sucursalId: string;
  fecha: string;
  cuentas: CuentaEsperada[];
}

export function CierreCajaSimpleForm({ sucursalId, fecha, cuentas }: Props) {
  const { pending, run } = useTransitionFeedback();
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [contado, setContado] = useState<Record<string, number>>(() =>
    Object.fromEntries(cuentas.map((c) => [c.cuenta.id, c.esperado])),
  );

  const totales = useMemo(() => {
    let esperado = 0;
    let cont = 0;
    for (const cuenta of cuentas) {
      esperado += cuenta.esperado;
      cont += contado[cuenta.cuenta.id] ?? cuenta.esperado;
    }
    return { esperado, contado: cont, diferencia: cont - esperado };
  }, [cuentas, contado]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("sucursal_id", sucursalId);
    fd.set("fecha", fecha);
    fd.set("observacion", observacion);
    for (const cuenta of cuentas) {
      fd.set(
        `contado_${cuenta.cuenta.id}`,
        String(contado[cuenta.cuenta.id] ?? cuenta.esperado),
      );
    }
    run(
      async () => {
        const res = await createCierre(null, fd);
        if (!res.ok) {
          setError(Object.values(res.errors).flat().join(", ") || "Error");
        }
        return res;
      },
      {
        redirectTo: (res) =>
          `/caja/${(res as unknown as { cierreId: string }).cierreId}`,
        successMessage: "Caja cerrada",
      },
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-md border border-border bg-card p-5"
    >
      <div className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Arqueo por cuenta
        </h2>
        <p className="text-xs text-muted-foreground">
          <strong>Esperado</strong> es lo que la app calcula que deberia haber.
          Carga en <strong>&ldquo;Contado&rdquo;</strong> lo que realmente hay; si
          no lo tocas, se cierra con lo esperado. La diferencia queda registrada
          como faltante o sobrante.
        </p>
      </div>

      {cuentas.length > 0 && (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Cuenta</th>
                <th className="px-4 py-3 text-right font-medium">Esperado</th>
                <th className="px-4 py-3 text-right font-medium">Contado</th>
                <th className="px-4 py-3 text-right font-medium">Diferencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cuentas.map((cuenta) => {
                const cont = contado[cuenta.cuenta.id] ?? cuenta.esperado;
                const diff = cont - cuenta.esperado;
                return (
                  <tr key={cuenta.cuenta.id}>
                    <td className="px-4 py-3 font-medium">
                      {cuenta.cuenta.nombre}
                      <span className="ml-1 text-xs uppercase text-muted-foreground">
                        ({cuenta.cuenta.tipo})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {formatARS(cuenta.esperado)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <CurrencyInput
                        value={cont}
                        min={0}
                        onChange={(value) =>
                          setContado((prev) => ({
                            ...prev,
                            [cuenta.cuenta.id]: value,
                          }))
                        }
                        className="w-32 rounded-md border border-border bg-card px-3 py-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </td>
                    <td
                      className="px-4 py-3 text-right tabular-nums"
                      style={{
                        color:
                          Math.abs(diff) < 0.005
                            ? "var(--muted-foreground)"
                            : diff > 0
                              ? "var(--sage-700)"
                              : "var(--danger)",
                      }}
                    >
                      {diff > 0 ? "+" : ""}
                      {formatARS(diff)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-cream/40 font-medium">
                <td className="px-4 py-3">Totales</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatARS(totales.esperado)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatARS(totales.contado)}
                </td>
                <td
                  className="px-4 py-3 text-right tabular-nums"
                  style={{
                    color:
                      Math.abs(totales.diferencia) < 0.005
                        ? "var(--ink)"
                        : totales.diferencia > 0
                          ? "var(--sage-700)"
                          : "var(--danger)",
                  }}
                >
                  {totales.diferencia > 0 ? "+" : ""}
                  {formatARS(totales.diferencia)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Observacion (opcional)
        </label>
        <textarea
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Notas del dia..."
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <LoadingButton
        type="submit"
        pending={pending}
        pendingLabel="Cerrando..."
        className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-brown-700"
      >
        Cerrar caja
      </LoadingButton>
    </form>
  );
}
