"use client";

import { useRef } from "react";
import { formatARS } from "@/lib/utils";

interface Props {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  name?: string;
  id?: string;
  min?: number;
  max?: number;
}

// Toma cualquier texto y devuelve el entero en pesos que representa.
// Solo dígitos: los montos en ARS se manejan sin centavos (formatARS usa 0 decimales).
function parseInput(s: string): number {
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

export function CurrencyInput({
  value,
  onChange,
  className,
  disabled,
  required,
  placeholder,
  name,
  id,
  min,
  max,
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  // El texto mostrado se deriva siempre del valor → "$ 150.000" en vivo, sin estado local.
  const display = value ? formatARS(value) : "";

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      value={display}
      name={name}
      id={id}
      disabled={disabled}
      required={required}
      placeholder={placeholder ?? "$ 0"}
      onFocus={(e) => {
        const el = e.currentTarget;
        requestAnimationFrame(() => el.select());
      }}
      onChange={(e) => {
        const el = e.currentTarget;
        let n = parseInput(e.target.value);
        if (typeof min === "number" && n < min) n = min;
        if (typeof max === "number" && n > max) n = max;
        onChange(n);
        // Mantener el cursor al final (campo alineado a la derecha).
        requestAnimationFrame(() => {
          const len = el.value.length;
          el.setSelectionRange(len, len);
        });
      }}
      className={className}
    />
  );
}
