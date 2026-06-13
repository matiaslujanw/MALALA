"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Plus, AlertTriangle } from "lucide-react";
import { CurrencyInput } from "@/components/forms/currency-input";
import { formatARS } from "@/lib/utils";
import { registrarAnticipo } from "@/lib/data/anticipos";
import type { Anticipo, MedioPago } from "@/lib/types";

interface Props {
  empleadoId: string;
  anticipos: Anticipo[];
  mediosPago: MedioPago[];
}

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function AnticiposPanel({ empleadoId, anticipos, mediosPago }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState(0);
  const [mpId, setMpId] = useState(mediosPago[0]?.id ?? "");
  const [observacion, setObservacion] = useState("");

  const pendientes = anticipos.filter((a) => !a.liquidacion_id);
  const totalPendiente = pendientes.reduce((s, a) => s + a.monto, 0);

  function reset() {
    setAbierto(false);
    setMonto(0);
    setObservacion("");
    setError(null);
  }

  function handleRegistrar() {
    setError(null);
    if (monto <= 0) {
      setError("El monto debe ser mayor a 0");
      return;
    }
    if (!mpId) {
      setError("Elegí un medio de pago");
      return;
    }
    const fd = new FormData();
    fd.set("empleado_id", empleadoId);
    fd.set("monto", String(monto));
    fd.set("mp_id", mpId);
    fd.set("observacion", observacion);
    startTransition(async () => {
      const res = await registrarAnticipo(fd);
      if (!res.ok) {
        setError(Object.values(res.errors).flat().join(", "));
        return;
      }
      reset();
      router.refresh();
    });
  }

  return (
    <section className="space-y-4 border-t border-border pt-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 stroke-[1.5]" style={{ color: "var(--sage-700)" }} />
          <h2 className="font-display text-xl tracking-[0.15em] uppercase">
            Anticipos
          </h2>
        </div>
        {!abierto && (
          <button
            type="button"
            onClick={() => {
              reset();
              setAbierto(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-sage-700 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-white hover:bg-sage-900 transition-colors"
          >
            <Plus className="h-3.5 w-3.5 stroke-[1.5]" />
            Registrar anticipo
          </button>
        )}
      </div>

      {/* Pendiente de descontar */}
      <div className="rounded-md border border-border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Pendiente de descontar
        </p>
        <p className="font-display text-2xl tabular-nums mt-1">
          {formatARS(totalPendiente)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Se descuenta automáticamente en la próxima liquidación del período.
        </p>
      </div>

      {/* Form registrar */}
      {abierto && (
        <div className="rounded-md border border-border bg-cream/40 p-4 space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Nuevo anticipo (sale de caja)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Monto
              </label>
              <CurrencyInput
                value={monto}
                onChange={setMonto}
                min={0}
                className="w-full px-3 py-2 text-right tabular-nums border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Medio de pago
              </label>
              <select
                value={mpId}
                onChange={(e) => setMpId(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm"
              >
                {mediosPago.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.codigo} — {m.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Observación (opcional)
            </label>
            <input
              type="text"
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Ej. Adelanto quincena"
            />
          </div>
          {error && (
            <p className="inline-flex items-center gap-1 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 stroke-[1.5]" />
              {error}
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleRegistrar}
              disabled={pending}
              className="rounded-md bg-primary px-4 py-2 text-xs font-medium uppercase tracking-wider text-primary-foreground hover:bg-sage-700 disabled:opacity-50 transition-colors"
            >
              {pending ? "Guardando…" : "Registrar anticipo"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-border px-4 py-2 text-xs font-medium uppercase tracking-wider hover:bg-cream transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && !abierto && (
        <p className="inline-flex items-center gap-1 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 stroke-[1.5]" />
          {error}
        </p>
      )}

      {/* Historial */}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Historial
        </p>
        {anticipos.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Todavía no hay anticipos registrados.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {anticipos.map((a) => {
              const descontado = !!a.liquidacion_id;
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          descontado
                            ? "bg-sage-100 text-sage-800"
                            : "bg-amber-50 text-amber-800"
                        }`}
                      >
                        {descontado ? "Descontado" : "Pendiente"}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {fmtFecha(a.fecha)}
                      </span>
                    </div>
                    {a.observacion && (
                      <p className="mt-0.5 truncate text-sm">{a.observacion}</p>
                    )}
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatARS(a.monto)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
