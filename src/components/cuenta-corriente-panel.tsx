"use client";

import { useState } from "react";
import { CreditCard, Plus, Minus, CheckCircle2, AlertTriangle } from "lucide-react";
import { useTransitionFeedback } from "@/components/feedback/action-feedback";
import { CurrencyInput } from "@/components/forms/currency-input";
import { LoadingButton } from "@/components/forms/field";
import { formatARS } from "@/lib/utils";
import {
  registrarCargoCc,
  registrarPagoCc,
  toggleCuentaCorriente,
} from "@/lib/data/cuenta-corriente";
import type {
  Cliente,
  CuentaBancaria,
  MedioPago,
  MovimientoCc,
} from "@/lib/types";

interface Props {
  cliente: Cliente;
  movimientos: MovimientoCc[];
  mediosPago: MedioPago[];
  cuentasBanco: CuentaBancaria[];
  puedeGestionar: boolean;
}

type Modo = null | "cargo" | "pago";

function usaCuentaBanco(mp: MedioPago | undefined): boolean {
  if (!mp) return false;
  const cod = mp.codigo.toUpperCase();
  return cod !== "EF" && cod !== "CC";
}

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
  cuentasBanco,
  puedeGestionar,
}: Props) {
  const { pending, run } = useTransitionFeedback();
  const [error, setError] = useState<string | null>(null);

  const [modo, setModo] = useState<Modo>(null);
  const [monto, setMonto] = useState(0);
  const [descripcion, setDescripcion] = useState("");
  const [mpId, setMpId] = useState(mediosPago[0]?.id ?? "");
  const [cuentaId, setCuentaId] = useState("");

  const mpSel = mediosPago.find((m) => m.id === mpId);
  const mostrarSelectorCuenta = usaCuentaBanco(mpSel);
  const cuentaIdEnvio = mostrarSelectorCuenta ? cuentaId : "";

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
    run(
      async () => {
        const res = await toggleCuentaCorriente(cliente.id);
        if (!res.ok) {
          setError(Object.values(res.errors).flat().join(", "));
        }
        return res;
      },
      {
        refreshOnSuccess: true,
        successMessage: cliente.cuenta_corriente_habilitada
          ? "Cuenta corriente deshabilitada"
          : "Cuenta corriente habilitada",
      },
    );
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
    run(
      async () => {
        const res = await registrarCargoCc(fd);
        if (!res.ok) {
          setError(Object.values(res.errors).flat().join(", "));
        }
        return res;
      },
      {
        refreshOnSuccess: true,
        successMessage: "Cargo registrado",
        onSuccess: () => resetForm(),
      },
    );
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
      setError("Elegi un medio de pago");
      return;
    }
    const fd = new FormData();
    fd.set("cliente_id", cliente.id);
    fd.set("monto", String(monto));
    fd.set("mp_id", mpId);
    fd.set("cuenta_id", cuentaIdEnvio);
    fd.set("descripcion", descripcion);
    run(
      async () => {
        const res = await registrarPagoCc(fd);
        if (!res.ok) {
          setError(Object.values(res.errors).flat().join(", "));
        }
        return res;
      },
      {
        refreshOnSuccess: true,
        successMessage: "Pago registrado",
        onSuccess: () => resetForm(),
      },
    );
  }

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
            <LoadingButton
              type="button"
              onClick={handleToggle}
              pending={pending}
              pendingLabel="Guardando..."
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-sage-700 px-4 py-2 text-xs font-medium uppercase tracking-wider text-white transition-colors hover:bg-sage-900"
            >
              <CreditCard className="h-4 w-4 stroke-[1.5]" />
              Habilitar cuenta corriente
            </LoadingButton>
          )}
          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        </div>
      </section>
    );
  }

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
          <LoadingButton
            type="button"
            onClick={handleToggle}
            pending={pending}
            pendingLabel="Guardando..."
            className="text-xs uppercase tracking-wider text-muted-foreground hover:text-destructive"
          >
            Deshabilitar
          </LoadingButton>
        )}
      </div>

      <div className="rounded-md border border-border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Deuda actual
        </p>
        <p
          className="mt-1 font-display text-3xl tabular-nums"
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

      {puedeGestionar && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              resetForm();
              setModo("cargo");
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-warning px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-warning transition-colors hover:bg-warning/10"
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
            className="inline-flex items-center gap-1.5 rounded-md border border-sage-700 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-sage-700 transition-colors hover:bg-sage-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus className="h-3.5 w-3.5 stroke-[1.5]" />
            Registrar pago
          </button>
        </div>
      )}

      {modo && (
        <div className="space-y-3 rounded-md border border-border bg-cream/40 p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {modo === "cargo" ? "Nuevo cargo (suma deuda)" : "Registrar pago (baja deuda)"}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Monto
              </label>
              <CurrencyInput
                value={monto}
                onChange={setMonto}
                min={0}
                max={modo === "pago" ? saldo : undefined}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
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
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                >
                  {mediosPago.map((medio) => (
                    <option key={medio.id} value={medio.id}>
                      {medio.codigo} - {medio.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {modo === "pago" && mostrarSelectorCuenta && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Cuenta de cobro
                </label>
                {cuentasBanco.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No hay cuentas bancarias cargadas. Cárgalas en Catálogos → Cuentas bancarias.
                  </p>
                ) : (
                  <select
                    value={cuentaId}
                    onChange={(e) => setCuentaId(e.target.value)}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                  >
                    <option value="">- Cuenta por defecto del medio -</option>
                    {cuentasBanco.map((cuenta) => (
                      <option key={cuenta.id} value={cuenta.id}>
                        {cuenta.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Descripcion (opcional)
            </label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
            <LoadingButton
              type="button"
              onClick={modo === "cargo" ? handleCargo : handlePago}
              pending={pending}
              pendingLabel="Guardando..."
              className="rounded-md bg-primary px-4 py-2 text-xs font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-brown-700"
            >
              {modo === "cargo" ? "Registrar cargo" : "Registrar pago"}
            </LoadingButton>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-border px-4 py-2 text-xs font-medium uppercase tracking-wider transition-colors hover:bg-cream"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && !modo && (
        <p className="inline-flex items-center gap-1 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 stroke-[1.5]" />
          {error}
        </p>
      )}

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Movimientos
        </p>
        {movimientos.length === 0 ? (
          <div className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Todavia no hay movimientos en la cuenta corriente.
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {movimientos.map((movimiento) => {
              const esCargo = movimiento.tipo === "cargo";
              return (
                <li
                  key={movimiento.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          esCargo
                            ? "bg-warning/10 text-brown-700"
                            : "bg-sage-100 text-sage-800"
                        }`}
                      >
                        {esCargo ? "Cargo" : "Pago"}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {fmtFechaHora(movimiento.fecha)}
                      </span>
                    </div>
                    {movimiento.descripcion && (
                      <p className="mt-0.5 truncate text-sm">{movimiento.descripcion}</p>
                    )}
                  </div>
                  <span
                    className="shrink-0 font-medium tabular-nums"
                    style={{ color: esCargo ? "var(--danger)" : "var(--sage-700)" }}
                  >
                    {esCargo ? "+" : "−"} {formatARS(movimiento.monto)}
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
