"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import type { VistaAgenda } from "./view-selector";

export function DateSelector({ fecha, vista = "diaria" }: { fecha: string; vista?: VistaAgenda }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const isToday = fecha === new Date().toISOString().slice(0, 10);

  function buildHref(overrides: { fecha: string }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("fecha", overrides.fecha);
    return `/turnos?${params.toString()}`;
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.value) {
      router.push(buildHref({ fecha: e.target.value }));
    }
  }

  // Calculate prev/next based on vista
  let previousDate: string;
  let nextDate: string;
  let label: string;

  if (vista === "semanal") {
    previousDate = addDays(fecha, -7);
    nextDate = addDays(fecha, 7);
    const endOfWeek = addDays(fecha, 6);
    label = formatWeekRange(fecha, endOfWeek);
  } else if (vista === "mensual") {
    const d = new Date(`${fecha}T12:00:00`);
    const prevMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    previousDate = prevMonth.toISOString().slice(0, 10);
    nextDate = nextMonth.toISOString().slice(0, 10);
    label = formatMonth(fecha);
  } else {
    previousDate = addDays(fecha, -1);
    nextDate = addDays(fecha, 1);
    label = formatShortDate(fecha);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={buildHref({ fecha: previousDate })}
        className="rounded-full border border-border px-3 py-2 text-sm text-muted-foreground transition hover:border-sage-200 hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>

      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="date"
          value={fecha}
          onChange={handleDateChange}
          className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
          tabIndex={-1}
        />
        <button
          type="button"
          onClick={() => {
            try {
              inputRef.current?.showPicker?.();
            } catch (err) {
              console.error(err);
            }
          }}
          className={`flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm transition font-medium ${
            isToday && (vista === "diaria" || vista === "actual")
              ? "border-sage-200 bg-sage-50 text-sage-900"
              : "hover:border-sage-200 hover:bg-stone-50 text-ink"
          }`}
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span className="capitalize">{label}</span>
        </button>
      </div>

      <Link
        href={buildHref({ fecha: nextDate })}
        className="rounded-full border border-border px-3 py-2 text-sm text-muted-foreground transition hover:border-sage-200 hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function addDays(isoDate: string, amount: number) {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

function formatShortDate(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(date);
}

function formatWeekRange(startIso: string, endIso: string) {
  const s = new Date(`${startIso}T12:00:00`);
  const e = new Date(`${endIso}T12:00:00`);
  const fmt = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });
  return `${fmt.format(s)} – ${fmt.format(e)}`;
}

function formatMonth(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(date);
}
