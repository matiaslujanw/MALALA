"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "connecting" | "qr" | "connected" | "closed";

interface StatusResp {
  status?: Status;
  numero?: string | null;
  error?: string;
}

const LABEL: Record<Status, string> = {
  connected: "Conectado",
  qr: "Escaneá el QR",
  connecting: "Conectando…",
  closed: "Desconectado",
};

const COLOR: Record<Status, string> = {
  connected: "bg-emerald-100 text-emerald-800",
  qr: "bg-amber-100 text-amber-800",
  connecting: "bg-sky-100 text-sky-800",
  closed: "bg-muted text-muted-foreground",
};

// El QR de WhatsApp rota cada ~20s; lo refrescamos con margen para que el que
// se ve en pantalla siempre sea válido.
const STATUS_POLL_MS = 4000;
const QR_REFRESH_MS = 18000;

export function ConexionWhatsapp({ sucursalId }: { sucursalId: string }) {
  const [status, setStatus] = useState<Status>("closed");
  const [numero, setNumero] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const statusRef = useRef<Status>("closed");
  const fetchingQr = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/whatsapp/status?sucursal=${encodeURIComponent(sucursalId)}`,
        { cache: "no-store" },
      );
      const data: StatusResp = await res.json();
      const next = data.status ?? "closed";
      statusRef.current = next;
      setStatus(next);
      setNumero(data.numero ?? null);
      if (next === "connected") setQr(null);
    } catch {
      statusRef.current = "closed";
      setStatus("closed");
    }
  }, [sucursalId]);

  const fetchQr = useCallback(async () => {
    if (fetchingQr.current) return;
    fetchingQr.current = true;
    try {
      const res = await fetch(
        `/api/whatsapp/qr?sucursal=${encodeURIComponent(sucursalId)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (data.connected) {
        statusRef.current = "connected";
        setStatus("connected");
        setQr(null);
      } else if (data.qr) {
        setQr(data.qr);
        setErr(null);
      } else if (!qr) {
        setErr(data.error ?? "Generando QR…");
      }
    } catch {
      if (!qr) setErr("No se pudo contactar el worker de WhatsApp");
    } finally {
      fetchingQr.current = false;
    }
  }, [sucursalId, qr]);

  // Polling de estado: arranca al montar y corre siempre.
  useEffect(() => {
    const kick = setTimeout(fetchStatus, 0);
    const id = setInterval(fetchStatus, STATUS_POLL_MS);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, [fetchStatus]);

  // Auto-QR: mientras NO esté conectado, traemos el QR y lo refrescamos solo.
  useEffect(() => {
    if (status === "connected") return;
    const kick = setTimeout(fetchQr, 200);
    const id = setInterval(fetchQr, QR_REFRESH_MS);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, [status, fetchQr]);

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-ink">Conexión WhatsApp</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${COLOR[status]}`}
        >
          {LABEL[status]}
        </span>
      </div>

      {status === "connected" ? (
        <p className="mt-2 text-xs text-emerald-700">
          {numero
            ? `Vinculado al número ${numero}.`
            : "Vinculado."}{" "}
          Las notificaciones salen desde este WhatsApp.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Escaneá este código desde el teléfono del local: WhatsApp →
            Dispositivos vinculados → Vincular un dispositivo. El código se
            actualiza solo.
          </p>

          {qr ? (
            <div className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr}
                alt="QR para vincular WhatsApp"
                className="h-56 w-56 rounded-lg border border-border bg-white p-2"
              />
              <button
                type="button"
                onClick={fetchQr}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-ink"
              >
                Refrescar QR ahora
              </button>
            </div>
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-lg border border-dashed border-border bg-card text-xs text-muted-foreground">
              {err ?? "Generando QR…"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
