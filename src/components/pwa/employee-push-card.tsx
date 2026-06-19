"use client";

import { Bell, BellOff, Smartphone } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { LoadingButton } from "@/components/forms/field";
import { useToast } from "@/components/feedback/toast-provider";
import {
  disableCurrentPushSubscription,
  getCurrentPushSubscription,
  isPushSupported,
  requestPushSubscription,
  syncPushSubscription,
} from "@/lib/pwa/client";

type PushStatus =
  | "loading"
  | "no-soportado"
  | "bloqueado"
  | "pendiente"
  | "activo";

export function EmployeePushCard({
  vapidPublicKey,
  configured,
}: {
  vapidPublicKey?: string;
  configured: boolean;
}) {
  const { notifySuccess, notifyError } = useToast();
  const [status, setStatus] = useState<PushStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!configured || !vapidPublicKey) {
        if (!cancelled) setStatus("no-soportado");
        return;
      }
      if (!isPushSupported()) {
        if (!cancelled) setStatus("no-soportado");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("bloqueado");
        return;
      }

      const subscription = await getCurrentPushSubscription();
      if (cancelled) return;

      if (subscription) {
        await syncPushSubscription(subscription).catch(() => {});
        setStatus("activo");
      } else {
        setStatus("pendiente");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [configured, vapidPublicKey]);

  function enable() {
    if (!vapidPublicKey) return;
    setError(null);
    startTransition(async () => {
      try {
        await requestPushSubscription(vapidPublicKey);
        setStatus("activo");
        notifySuccess("Notificaciones activadas en este dispositivo");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "No se pudo activar";
        setError(message);
        notifyError(message);
        setStatus(
          Notification.permission === "denied" ? "bloqueado" : "pendiente",
        );
      }
    });
  }

  function disable() {
    setError(null);
    startTransition(async () => {
      try {
        await disableCurrentPushSubscription();
        setStatus("pendiente");
        notifySuccess("Notificaciones desactivadas en este dispositivo");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "No se pudo desactivar";
        setError(message);
        notifyError(message);
      }
    });
  }

  const tone =
    status === "activo"
      ? "border-sage-700 bg-sage-50"
      : status === "bloqueado"
        ? "border-amber-300 bg-amber-50"
        : "border-border bg-card";

  return (
    <section className={`rounded-[1.5rem] border p-5 ${tone}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-xl bg-white/80 p-2">
          {status === "activo" ? (
            <Bell className="h-5 w-5 text-sage-700" />
          ) : (
            <BellOff className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
              Notificaciones
            </p>
            <h2 className="font-display text-xl tracking-[0.14em] uppercase">
              Avisos en este dispositivo
            </h2>
          </div>

          <p className="text-sm text-muted-foreground">
            Recibí avisos cuando te asignen un turno, se reprogramen o cancelen,
            y cuando te creen una liquidación.
          </p>

          <StatusLine status={status} configured={configured} />

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {status !== "activo" ? (
              <LoadingButton
                type="button"
                onClick={enable}
                pending={pending}
                pendingLabel="Activando..."
                disabled={status === "no-soportado"}
                className="inline-flex items-center gap-2 rounded-xl bg-sage-700 px-4 py-2 text-sm font-medium text-white hover:bg-sage-800"
              >
                <Smartphone className="h-4 w-4" />
                Activar notificaciones
              </LoadingButton>
            ) : (
              <LoadingButton
                type="button"
                onClick={disable}
                pending={pending}
                pendingLabel="Desactivando..."
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-white/70"
              >
                Desactivar en este dispositivo
              </LoadingButton>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {status === "bloqueado" && (
            <p className="text-xs text-muted-foreground">
              El navegador bloqueó el permiso. Rehabilitalo desde la configuración
              del sitio y luego volvé a intentar.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function StatusLine({
  status,
  configured,
}: {
  status: PushStatus;
  configured: boolean;
}) {
  if (!configured) {
    return (
      <p className="text-sm text-muted-foreground">
        Estado: no disponible en este entorno.
      </p>
    );
  }

  const label =
    status === "loading"
      ? "revisando..."
      : status === "no-soportado"
        ? "no soportado"
        : status === "bloqueado"
          ? "bloqueado"
          : status === "activo"
            ? "activo"
            : "pendiente de activar";

  return (
    <p className="text-sm">
      Estado: <span className="font-medium capitalize">{label}</span>
    </p>
  );
}
