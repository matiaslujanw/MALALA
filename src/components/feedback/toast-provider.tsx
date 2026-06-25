"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { CheckCircle2, CircleAlert, X } from "lucide-react";

type ToastType = "success" | "error";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastPayload {
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  notify: (payload: ToastPayload) => void;
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
}

const FLASH_TOAST_KEY = "malala:flash-toast";
const AUTO_CLOSE_MS = 3200;

const ToastContext = createContext<ToastContextValue | null>(null);

function createId() {
  return crypto.randomUUID();
}

export function persistFlashToast(payload: ToastPayload) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(FLASH_TOAST_KEY, JSON.stringify(payload));
}

export function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const remove = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    (payload: ToastPayload) => {
      const id = createId();
      setItems((current) => [...current, { id, ...payload }]);
      const timer = window.setTimeout(() => remove(id), AUTO_CLOSE_MS);
      timersRef.current.set(id, timer);
    },
    [remove],
  );

  const notifySuccess = useCallback(
    (message: string) => notify({ type: "success", message }),
    [notify],
  );

  const notifyError = useCallback(
    (message: string) => notify({ type: "error", message }),
    [notify],
  );

  // El provider vive en el layout y NO se vuelve a montar en las navegaciones
  // "soft" (router.push). Por eso releemos el flash toast en cada cambio de
  // ruta: así el toast persistido antes de un redirect (p. ej. tras crear) se
  // muestra al llegar a la pantalla destino, sin depender de un F5.
  const pathname = usePathname();
  useEffect(() => {
    const raw = window.sessionStorage.getItem(FLASH_TOAST_KEY);
    if (!raw) return;
    window.sessionStorage.removeItem(FLASH_TOAST_KEY);
    try {
      const payload = JSON.parse(raw) as ToastPayload;
      if (payload?.message && (payload.type === "success" || payload.type === "error")) {
        window.setTimeout(() => notify(payload), 0);
      }
    } catch {
      // Ignorar payloads inválidos.
    }
  }, [notify, pathname]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ notify, notifySuccess, notifyError }),
    [notify, notifyError, notifySuccess],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3">
        {items.map((item) => (
          <ToastCard key={item.id} item={item} onClose={() => remove(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  item,
  onClose,
}: {
  item: ToastItem;
  onClose: () => void;
}) {
  const icon =
    item.type === "success" ? (
      <CheckCircle2 className="h-5 w-5 shrink-0 text-sage-700" />
    ) : (
      <CircleAlert className="h-5 w-5 shrink-0 text-destructive" />
    );

  return (
    <div className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-[0_12px_32px_rgba(25,28,24,0.14)]">
      {icon}
      <p className="min-w-0 flex-1 text-sm leading-5 text-foreground">
        {item.message}
      </p>
      <button
        type="button"
        onClick={onClose}
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-cream hover:text-foreground"
        aria-label="Cerrar notificación"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast debe usarse dentro de ToastProvider");
  }
  return context;
}
