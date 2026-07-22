"use client";

import { Printer } from "lucide-react";

/**
 * Dispara el diálogo de impresión del navegador para "Guardar como PDF".
 * Se oculta al imprimir (clase no-print).
 */
export function PrintButton({ label = "Exportar PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-brown-700"
    >
      <Printer className="h-4 w-4 stroke-[1.5]" />
      {label}
    </button>
  );
}
