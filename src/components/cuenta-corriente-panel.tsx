"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Plus, Minus, CheckCircle2, AlertTriangle } from "lucide-react";
import { CurrencyInput } from "@/components/forms/currency-input";
import { formatARS } from "@/lib/utils";
import {
  registrarCargoCc,
  registrarPagoCc,
  saldarTodoCc,
  toggleCuentaCorriente,
} from "@/lib/data/cuenta-corriente";
import type { Cliente, MedioPago, MovimientoCc } from "@/lib/types";

interface Props {
  cliente: Cliente;
  movimientos: MovimientoCc[];
  mediosPago: MedioPago[];
  puedeGestionar: boolean;
}

type Modo = null | "cargo" | "pago";

function fmtFechaHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CuentaCorrientePanel({
  cliente,
  movimientos,
  mediosPago,
  puedeGestionar,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [modo, setModo] = useState<Modo>(null);
  const [monto, setMonto] = useState(0);
  const [descripcion, setDescripcion] = useState("");
  const [mpId, setMpId] = useState(mediosPago[0]?.id ?? "");

  const saldo = cliente.saldo_cc;
  const tieneDeuda = saldo > 0.01;

  function resetForm() {
    setModo(null);
    setMonto(0);
    setDescripcion("");
    setError(null);
  }

  function handleToggle() {
    setError(null);
    startTransition(async () => {
      const res = await toggleCuentaCorriente(cliente.id);
      if (!res.ok) {
        setError(Object.values(res.errors).flat().join(", "));
        return;
      }
      router.refresh();
    });
  }

  function handleCargo() {
    setError(null);
    if (monto <= 0) {
      setError("El monto debe ser mayor a 0");
      return;
    }
    const fd = new FormData();
    fd.set("cliente_id", cliente.id);
    fd.set("monto", String(monto));
    fd.set("descripcion", descripcion);
    startTransition(async () => {
      const res = await registrarCargoCc(fd);
      if (!res.ok) {
        setError(Object.values(res.errors).flat().join(", "));
        return;
      }
      resetForm();
      router.refresh();
    });
  }

  function handlePago() {
    setError(null);
    if (monto <= 0) {
      setError("El monto debe ser mayor a 0");
      return;
    }
    if (monto > saldo + 0.01) {
      setError(`El pago no puede superar la deuda (${formatARS(saldo)})`);
      return;
    }
    if (!mpId) {
      setError("Elegí un medio de pago");
      return;
    }
    const fd = new FormData();
    fd.set("cliente_id", cliente.id);
    fd.set("monto", String(monto));
    fd.set("mp_id", mpId);
    fd.set("descripcion", descripcion);
    startTransition(async () => {
      const res = await registrarPagoCc(fd);
      if (!res.ok) {
        setError(Object.values(res.errors).flat().join(", "));
        return;
      }
      resetForm();
      router.refresh();
    });
  }

  function handleSaldarTodo() {
    setError(null);
    if (!mpId) {
      setError("Elegí un medio de pago para saldar la deuda");
      return;
    }
    const fd = new FormData();
    fd.set("cliente_id", cliente.id);
    fd.set("mp_id", mpId);
    fd.set("descripcion", "Saldo total de cuenta corriente");
    startTransition(async () => {
      const res = await saldarTodoCc(fd);
      if (!res.ok) {
        setError(Object.values(res.errors).flat().join(", "));
        return;
      }
      resetForm();
      router.refresh();
    });
  }

  // ----- Cliente sin CC habilitada -----
  if (!cliente.cuenta_corriente_habilitada) {
    return (
      <section className="space-y-3 border-t border-border pt-6">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 stroke-[1.5] text-muted-foreground" />
          <h2 className="font-display text-xl tracking-[0.15em] uppercase">
            Cuenta corriente
          </h2>
        </div>
        <div className="rounded-md border border-border bg-card p-5 text-sm text-muted-foreground">
          <p>
            Este cliente no tiene cuenta corriente habilitada. Al habilitarla
            vas a poder registrar cargos (fiado) y pagos.
          </p>
          {puedeGestionar && (
            <button
              type="button"
              onClick={handleToggle}
              disabled={pending}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-sage-700 px-4 py-2 text-xs font-medium uppercase tracking-wider text-white hover:bg-sage-900 disabled:opacity-50 transition-colors"
            >
              <CreditCard className="h-4 w-4 stroke-[1.5]" />
              Habilitar cuenta corriente
            </button>
          )}
          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        </div>
      </section>
    );
  }

  // ----- Cliente con CC habilitada -----
  return (
    <section className="space-y-4 border-t border-border pt-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 stroke-[1.5]" style={{ color: "var(--sage-700)" }} />
          <h2 className="font-display text-xl tracking-[0.15em] uppercase">
            Cuenta corriente
          </h2>
        </div>
        {puedeGestionar && !tieneDeuda && (
          <button
            type="button"
            onClick={handleToggle}
            disabled={pending}
            className="text-xs uppercase tracking-wider text-muted-foreground hover:text-destructive disabled:opacity-50"
          >
            Deshabilitar
          </button>
        )}
      </div>

      {/* Saldo */}
      <div className="rounded-md border border-border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Deuda actual
        </p>
        <p
          className="font-display text-3xl tabular-nums mt-1"
          style={{ color: tieneDeuda ? "var(--danger)" : "var(--ink)" }}
        >
          {formatARS(saldo)}
        </p>
        {!tieneDeuda && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 stroke-[1.5]" />
            Sin deuda pendiente
          </p>
        )}
      </div>

      {/* Acciones */}
      {puedeGestionar && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              resetForm();
              setModo("cargo");
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-amber-700 hover:bg-amber-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5 stroke-[1.5]" />
            Registrar cargo
          </button>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setMonto(saldo);
              setModo("pago");
            }}
            disabled={!tieneDeuda}
            className="inline-flex items-center gap-1.5 rounded-md border border-sage-700 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-sage-700 hover:bg-sage-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Minus className="h-3.5 w-3.5 stroke-[1.5]" />
            Registrar pago
          </button>
          <button
            type="button"
            onClick={handleSaldarTodo}
            disabled={!tieneDeuda || pending || !mpId}
            title={!mpId ? "No hay medios de pago disponibles" : undefined}
            className="inline-flex items-center gap-1.5 rounded-md bg-sage-700 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-white hover:bg-sage-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="h-3.5 w-3.5 stroke-[1.5]" />
            Saldar todo
          </button>
        </div>
      )}

      {/* Form inline cargo/pago */}
      {modo && (
        <div className="rounded-md border border-border bg-cream/40 p-4 space-y-3">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {modo === "cargo" ? "Nuevo cargo (suma deuda)" : "Registrar pago (baja deuda)"}
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
                max={modo === "pago" ? saldo : undefined}
                className="w-full px-3 py-2 text-right tabular-nums border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {modo === "pago" && (
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
            )}
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Descripción (opcional)
            </label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={modo === "cargo" ? "Ej. Producto fiado" : "Ej. Pago parcial"}
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
              onClick={modo === "cargo" ? handleCargo : handlePago}
              disabled={pending}
              className="rounded-md bg-primary px-4 py-2 text-xs font-medium uppercase tracking-wider text-primary-foreground hover:bg-sage-700 disabled:opacity-50 transition-colors"
            >
              {pending ? "Guardando…" : modo === "cargo" ? "Registrar cargo" : "Registrar pago"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-border px-4 py-2 text-xs font-medium uppercase tracking-wider hover:bg-cream transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Error fuera del form (toggle / saldar) */}
      {error && !modo && (
        <p className="inline-flex items-center gap-1 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 stroke-[1.5]" />
          {error}
        </p>
      )}

      {/* Historial */}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Movimientos
        </p>
        {movimientos.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Todavía no hay movimientos en la cuenta corriente.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {movimientos.map((m) => {
              const esCargo = m.tipo === "cargo";
              return (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          esCargo
                            ? "bg-amber-50 text-amber-800"
                            : "bg-sage-100 text-sage-800"
                        }`}
                      >
                        {esCargo ? "Cargo" : "Pago"}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {fmtFechaHora(m.fecha)}
                      </span>
                    </div>
                    {m.descripcion && (
                      <p className="mt-0.5 truncate text-sm">{m.descripcion}</p>
                    )}
                  </div>
                  <span
                    className="shrink-0 font-medium tabular-nums"
                    style={{ color: esCargo ? "var(--danger)" : "var(--sage-700)" }}
                  >
                    {esCargo ? "+" : "−"} {formatARS(m.monto)}
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
