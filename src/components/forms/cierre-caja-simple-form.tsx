"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [observacion, setObservacion] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Contado por cuenta, arranca en lo esperado de cada una.
  const [contado, setContado] = useState<Record<string, number>>(() =>
    Object.fromEntries(cuentas.map((c) => [c.cuenta.id, c.esperado])),
  );

  const totales = useMemo(() => {
    let esperado = 0;
    let cont = 0;
    for (const c of cuentas) {
      esperado += c.esperado;
      cont += contado[c.cuenta.id] ?? c.esperado;
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
    for (const c of cuentas) {
      fd.set(
        `contado_${c.cuenta.id}`,
        String(contado[c.cuenta.id] ?? c.esperado),
      );
    }
    startTransition(async () => {
      const res = await createCierre(null, fd);
      if (!res.ok) {
        setError(Object.values(res.errors).flat().join(", ") || "Error");
        return;
      }
      router.push(`/caja/${res.cierreId}`);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-card border border-border rounded-md p-5 space-y-5"
    >
      <div className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Arqueo por cuenta
        </h2>
        <p className="text-xs text-muted-foreground">
          <strong>Esperado</strong> es lo que la app calcula que debería haber.
          Cargá en <strong>&ldquo;Contado&rdquo;</strong> lo que realmente hay; si
          no lo tocás, se cierra con lo esperado. La diferencia queda registrada
          como faltante/sobrante (no modifica el saldo).
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
              {cuentas.map((c) => {
                const cont = contado[c.cuenta.id] ?? c.esperado;
                const diff = cont - c.esperado;
                return (
                  <tr key={c.cuenta.id}>
                    <td className="px-4 py-3 font-medium">
                      {c.cuenta.nombre}
                      <span className="ml-1 text-xs uppercase text-muted-foreground">
                        ({c.cuenta.tipo})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {formatARS(c.esperado)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <CurrencyInput
                        value={cont}
                        min={0}
                        onChange={(v) =>
                          setContado((prev) => ({ ...prev, [c.cuenta.id]: v }))
                        }
                        className="w-32 px-3 py-2 text-right tabular-nums border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
          Observación (opcional)
        </label>
        <textarea
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Notas del día…"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-primary-foreground px-6 py-2.5 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 disabled:opacity-50 transition-colors"
      >
        {pending ? "Cerrando…" : "Cerrar caja"}
      </button>
    </form>
  );
}
