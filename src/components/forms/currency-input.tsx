"use client";

import { useEffect, useState } from "react";
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

function parseInput(s: string): number {
  const cleaned = s.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
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
  const [text, setText] = useState<string>(value ? formatARS(value) : "");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(value ? formatARS(value) : "");
  }, [value, editing]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      name={name}
      id={id}
      disabled={disabled}
      required={required}
      placeholder={placeholder ?? "$ 0"}
      onFocus={(e) => {
        setEditing(true);
        setText(value ? String(value) : "");
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        let n = parseInput(raw);
        if (typeof min === "number" && n < min) n = min;
        if (typeof max === "number" && n > max) n = max;
        onChange(n);
      }}
      onBlur={() => {
        setEditing(false);
        setText(value ? formatARS(value) : "");
      }}
      className={className}
    />
  );
}
