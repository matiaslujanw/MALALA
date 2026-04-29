import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function formatARS(value: number): string {
  return ARS.format(value);
}

const DATE_FMT = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const WEEKDAY_FMT = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const TIME_FMT = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: string | Date): string {
  return DATE_FMT.format(typeof value === "string" ? new Date(value) : value);
}

export function formatLongDate(value: string | Date): string {
  return WEEKDAY_FMT.format(typeof value === "string" ? new Date(value) : value);
}

export function formatTime(value: string | Date): string {
  if (typeof value === "string" && /^\d{2}:\d{2}$/.test(value)) {
    return value;
  }
  return TIME_FMT.format(typeof value === "string" ? new Date(value) : value);
}
