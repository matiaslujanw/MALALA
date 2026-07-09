"use client";

function urlBase64ToUint8Array(base64String: string) {
  const normalized = base64String.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const rawData = window.atob(padded);
  return Uint8Array.from(rawData, (char) => char.charCodeAt(0));
}

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function ensurePushServiceWorker() {
  if (!isPushSupported()) return null;
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

export async function getCurrentPushSubscription() {
  const registration = await ensurePushServiceWorker();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function syncPushSubscription(subscription: globalThis.PushSubscription) {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    throw new Error("Suscripción inválida");
  }

  const res = await fetch("/api/pwa/push-subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh,
      auth,
    }),
  });

  if (!res.ok) {
    throw new Error("No se pudo registrar la suscripción");
  }
}

export async function requestPushSubscription(publicKey: string) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Permiso bloqueado"
        : "Permiso no concedido",
    );
  }

  const registration = await ensurePushServiceWorker();
  if (!registration) {
    throw new Error("Push no soportado");
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await syncPushSubscription(subscription);
  registration.active?.postMessage({ type: "PWA_PUSH_SYNC" });
  return subscription;
}

export async function disableCurrentPushSubscription(opts?: {
  unsubscribe?: boolean;
}) {
  const subscription = await getCurrentPushSubscription();
  if (!subscription) return;

  const res = await fetch("/api/pwa/push-subscriptions", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });

  if (!res.ok) {
    console.error(`[push] DELETE suscripción falló (${res.status}) — no se desuscribe localmente`);
    return;
  }

  if (opts?.unsubscribe !== false) {
    await subscription.unsubscribe().catch(() => {});
  }
}
