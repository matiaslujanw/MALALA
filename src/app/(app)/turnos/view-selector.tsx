"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Clock, LayoutGrid, CalendarDays, CalendarRange } from "lucide-react";

const VIEWS = [
  { key: "diaria", label: "Diaria", icon: Clock },
  { key: "actual", label: "Clásica", icon: LayoutGrid },
  { key: "semanal", label: "Semanal", icon: CalendarDays },
  { key: "mensual", label: "Mensual", icon: CalendarRange },
] as const;

export type VistaAgenda = (typeof VIEWS)[number]["key"];

export function ViewSelector({ active }: { active: VistaAgenda }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(vista: VistaAgenda) {
    const params = new URLSearchParams(searchParams.toString());
    if (vista === "diaria") {
      params.delete("vista");
    } else {
      params.set("vista", vista);
    }
    router.push(`/turnos?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
      {VIEWS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => navigate(key)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
            active === key
              ? "bg-sage-900 text-white shadow-sm"
              : "text-muted-foreground hover:bg-stone-100 hover:text-foreground"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
