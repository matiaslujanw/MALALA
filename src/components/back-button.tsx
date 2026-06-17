"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Pantallas raíz (destinos del menú lateral): no mostramos "Atrás" porque se
// llega a ellas desde el sidebar y no tienen un "padre" natural al que volver.
const ROOT_PATHS = new Set<string>([
  "/dashboard",
  "/ventas",
  "/turnos",
  "/catalogos",
  "/catalogos/clientes",
  "/caja",
  "/bancos",
  "/liquidaciones",
  "/stock",
  "/egresos",
  "/reportes",
  "/configuracion/integraciones-whatsapp",
]);

export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (ROOT_PATHS.has(pathname)) return null;

  function handleBack() {
    // Si hay historial de navegación, volvemos a la pantalla anterior.
    // Si se entró directo por URL (sin historial), subimos un nivel en la ruta.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    const parent = pathname.split("/").slice(0, -1).join("/") || "/dashboard";
    router.push(parent);
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      title="Volver atrás"
      aria-label="Volver atrás"
      className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm text-muted-foreground hover:bg-cream hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-4 w-4 stroke-[1.5]" />
      <span className="hidden sm:inline">Atrás</span>
    </button>
  );
}
