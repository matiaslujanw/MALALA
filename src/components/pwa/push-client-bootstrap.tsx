"use client";

import { useEffect } from "react";
import { ensurePushServiceWorker } from "@/lib/pwa/client";

export function PushClientBootstrap() {
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const registration = await ensurePushServiceWorker();
      if (!registration || cancelled) return;
      registration.active?.postMessage({ type: "PWA_PUSH_SYNC" });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
