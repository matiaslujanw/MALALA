"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  cancelarTurnoPorTokenAction,
  reprogramarTurnoPorTokenAction,
  type PublicActionResult,
} from "@/lib/data/turnos-publico";
import type { SlotDisponible } from "@/lib/turnos-helpers";

interface Props {
  token: string;
  turnoId: string;
  sucursalId: string;
  servicioId: string;
  profesionalActualId: string;
  profesionalActualNombre: string;
}

type Modo = "menu" | "reprogramar" | "cancelar";

export function TurnoAcciones({
  token,
  profesionalActualId,
  profesionalActualNombre,
}: Props) {
  const [modo, setModo] = useState<Modo>("menu");
  const [cancelState, cancelAction, cancelPending] = useActionState<
    PublicActionResult | null,
    FormData
  >(cancelarTurnoPorTokenAction, null);
  const [reprogState, reprogAction, reprogPending] = useActionState<
    PublicActionResult | null,
    FormData
  >(reprogramarTurnoPorTokenAction, null);

  if (cancelState?.ok || reprogState?.ok) {
    const msg = cancelState?.ok
      ? cancelState.message
      : reprogState?.ok
        ? reprogState.message
        : "";
    return (
      <div className="mt-6 rounded-2xl border border-sage-200 bg-sage-50 p-5 text-sm text-sage-900">
        ✓ {msg}
      </div>
    );
  }

  if (modo === "menu") {
    return (
      <div className="mt-6 grid gap-3">
        <button
          type="button"
          onClick={() => setModo("reprogramar")}
          className="rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-ink hover:bg-muted"
        >
          Reprogramar
        </button>
        <button
          type="button"
          onClick={() => setModo("cancelar")}
          className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/15"
        >
          Cancelar turno
        </button>
      </div>
    );
  }

  if (modo === "cancelar") {
    return (
      <form action={cancelAction} className="mt-6 rounded-2xl border border-border bg-card p-5">
        <input type="hidden" name="token" value={token} />
        <p className="text-sm text-ink">
          ¿Querés cancelar este turno? Esta acción no se puede deshacer.
        </p>
        {cancelState && !cancelState.ok && (
          <p className="mt-2 text-sm text-destructive">
            {cancelState.errors._?.[0] ?? "No se pudo cancelar."}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setModo("menu")}
            className="flex-1 rounded-xl border border-border bg-card px-4 py-2 text-sm"
            disabled={cancelPending}
          >
            Volver
          </button>
          <button
            type="submit"
            disabled={cancelPending}
            className="flex-1 rounded-xl bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-60"
          >
            {cancelPending ? "Cancelando…" : "Sí, cancelar"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <ReprogramarForm
      token={token}
      profesionalActualId={profesionalActualId}
      profesionalActualNombre={profesionalActualNombre}
      onVolver={() => setModo("menu")}
      action={reprogAction}
      pending={reprogPending}
      state={reprogState}
    />
  );
}

interface ReprogramarFormProps {
  token: string;
  profesionalActualId: string;
  profesionalActualNombre: string;
  onVolver: () => void;
  action: (formData: FormData) => void;
  pending: boolean;
  state: PublicActionResult | null;
}

function ReprogramarForm({
  token,
  profesionalActualId,
  profesionalActualNombre,
  onVolver,
  action,
  pending,
  state,
}: ReprogramarFormProps) {
  const [fecha, setFecha] = useState("");
  const [slots, setSlots] = useState<SlotDisponible[]>([]);
  const [slotSeleccionado, setSlotSeleccionado] =
    useState<SlotDisponible | null>(null);
  const [loadingSlots, startTransition] = useTransition();
  const [errorSlots, setErrorSlots] = useState<string | null>(null);

  useEffect(() => {
    setSlotSeleccionado(null);
    if (!fecha) {
      setSlots([]);
      return;
    }
    setErrorSlots(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/turno-publico/slots?token=${encodeURIComponent(token)}&fecha=${fecha}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error("No se pudieron cargar los horarios");
        const data = (await res.json()) as { slots: SlotDisponible[] };
        setSlots(data.slots);
      } catch (err) {
        setErrorSlots(err instanceof Error ? err.message : "Error");
        setSlots([]);
      }
    });
  }, [fecha, token]);

  return (
    <form
      action={action}
      className="mt-6 rounded-2xl border border-border bg-card p-5"
    >
      <input type="hidden" name="token" value={token} />
      <input
        type="hidden"
        name="profesional_id"
        value={slotSeleccionado?.profesional_id ?? profesionalActualId}
      />
      <input
        type="hidden"
        name="hora"
        value={slotSeleccionado?.hora ?? ""}
      />
      <input type="hidden" name="fecha_turno" value={fecha} />

      <label className="block text-sm">
        <span className="font-medium text-ink">Nueva fecha</span>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          min={new Date().toISOString().slice(0, 10)}
          className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
          required
        />
      </label>

      <div className="mt-4">
        {loadingSlots ? (
          <p className="text-sm text-muted-foreground">Buscando horarios…</p>
        ) : errorSlots ? (
          <p className="text-sm text-destructive">{errorSlots}</p>
        ) : fecha && slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay horarios disponibles para esa fecha.
          </p>
        ) : slots.length > 0 ? (
          <div>
            <p className="mb-2 text-xs text-muted-foreground">
              Profesional actual: {profesionalActualNombre}
            </p>
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => {
                const isSel =
                  slotSeleccionado?.hora === slot.hora &&
                  slotSeleccionado?.profesional_id === slot.profesional_id;
                return (
                  <button
                    key={`${slot.hora}-${slot.profesional_id}`}
                    type="button"
                    onClick={() => setSlotSeleccionado(slot)}
                    className={`rounded-xl border px-3 py-2 text-sm transition ${
                      isSel
                        ? "border-ink bg-ink text-white"
                        : "border-border bg-card hover:bg-muted"
                    }`}
                    title={slot.profesional_nombre}
                  >
                    {slot.hora}
                    <span className="ml-1 text-xs opacity-70">
                      · {slot.profesional_nombre.split(" ")[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {state && !state.ok && (
        <p className="mt-3 text-sm text-destructive">
          {state.errors._?.[0] ??
            Object.values(state.errors).flat().join(", ") ??
            "No se pudo reprogramar."}
        </p>
      )}

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onVolver}
          className="flex-1 rounded-xl border border-border bg-card px-4 py-2 text-sm"
          disabled={pending}
        >
          Volver
        </button>
        <button
          type="submit"
          disabled={!slotSeleccionado || pending}
          className="flex-1 rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Confirmar"}
        </button>
      </div>
    </form>
  );
}
