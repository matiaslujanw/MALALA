"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearApertura } from "@/lib/data/apertura-caja";
import type { AperturaCuentaSugerida } from "@/lib/data/apertura-caja";
import { formatARS } from "@/lib/utils";
import { CurrencyInput } from "./currency-input";

interface Props {
  sucursalId: string;
  fecha: string;
  cuentas: AperturaCuentaSugerida[];
}

export function AperturaCajaForm({ sucursalId, fecha, cuentas }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [observacion, setObservacion] = useState("");

  // Declarado por cuenta, arranca en el esperado de cada una.
  const [declarado, setDeclarado] = useState<Record<string, number>>(() =>
    Object.fromEntries(cuentas.map((c) => [c.cuenta.id, c.esperado])),
  );

  const totales = useMemo(() => {
    let esperado = 0;
    let decl = 0;
    for (const c of cuentas) {
      esperado += c.esperado;
      decl += declarado[c.cuenta.id] ?? c.esperado;
    }
    return { esperado, declarado: decl, diferencia: decl - esperado };
  }, [cuentas, declarado]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("sucursal_id", sucursalId);
    fd.set("fecha", fecha);
    fd.set("observacion", observacion);
    for (const c of cuentas) {
      fd.set(
        `declarado_${c.cuenta.id}`,
        String(declarado[c.cuenta.id] ?? c.esperado),
      );
    }
    startTransition(async () => {
      const res = await crearApertura(null, fd);
      if (!res.ok) {
        setError(Object.values(res.errors).flat().join(", ") || "Error");
        return;
      }
      router.push("/caja");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 bg-card border border-border rounded-md p-5"
    >
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-cream/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Cuenta</th>
              <th className="px-4 py-3 text-right font-medium">Esperado</th>
              <th className="px-4 py-3 text-right font-medium">
                Lo que tenés
              </th>
              <th className="px-4 py-3 text-right font-medium">Diferencia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cuentas.map((c) => {
              const decl = declarado[c.cuenta.id] ?? c.esperado;
              const diff = decl - c.esperado;
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
                      value={decl}
                      min={0}
                      onChange={(v) =>
                        setDeclarado((prev) => ({ ...prev, [c.cuenta.id]: v }))
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
                {formatARS(totales.declarado)}
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

      <p className="text-xs text-muted-foreground">
        El <strong>esperado</strong> es lo que la app calcula que debería haber.
        Cargá en <strong>&ldquo;Lo que tenés&rdquo;</strong> la plata real con la
        que arrancás. Si hay diferencia, el saldo de la cuenta se ajusta a lo que
        cargues.
      </p>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Observación (opcional)
        </label>
        <textarea
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Notas de la apertura…"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground px-6 py-2.5 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 disabled:opacity-50 transition-colors"
        >
          {pending ? "Abriendo…" : "Abrir caja"}
        </button>
        <a
          href="/caja"
          className="px-4 py-2 rounded-md text-sm font-medium border border-border hover:bg-cream transition-colors"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}
