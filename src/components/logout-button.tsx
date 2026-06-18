"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { disableCurrentPushSubscription } from "@/lib/pwa/client";

export function LogoutButton() {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="submit"
      title="Salir"
      aria-label="Salir"
      disabled={pending}
      onClick={(event) => {
        const form = event.currentTarget.form;
        if (!form || pending) return;
        event.preventDefault();
        setPending(true);
        void (async () => {
          await disableCurrentPushSubscription().catch(() => {});
          form.requestSubmit();
        })();
      }}
      className="flex items-center justify-center rounded-xl p-2 text-muted-foreground hover:bg-cream hover:text-foreground transition-colors disabled:opacity-50"
    >
      <LogOut className="h-4 w-4 stroke-[1.5]" />
    </button>
  );
}
