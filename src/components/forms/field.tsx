"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CurrencyInput } from "./currency-input";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string[];
  hint?: string;
}

export function Field({
  label,
  error,
  hint,
  name,
  className,
  ...rest
}: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="block text-xs font-medium uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        {...rest}
        className={cn(
          "w-full rounded-md border border-border bg-card px-3 py-2 text-sm",
          "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring",
          className,
        )}
      />
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error.join(", ")}</p>}
    </div>
  );
}

interface CurrencyFieldProps {
  label: string;
  name: string;
  defaultValue?: number;
  value?: number;
  onChange?: (n: number) => void;
  error?: string[];
  hint?: string;
  required?: boolean;
  min?: number;
}

export function CurrencyField({
  label,
  name,
  defaultValue,
  value,
  onChange,
  error,
  hint,
  required,
  min = 0,
}: CurrencyFieldProps) {
  const controlled = onChange !== undefined;
  const [internal, setInternal] = useState<number>(defaultValue ?? 0);
  const current = controlled ? (value ?? 0) : internal;
  const set = (n: number) => {
    if (controlled) onChange(n);
    else setInternal(n);
  };

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="block text-xs font-medium uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </label>
      <CurrencyInput
        id={name}
        value={current}
        onChange={set}
        min={min}
        required={required}
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-right text-sm tabular-nums focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <input type="hidden" name={name} value={current} />
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error.join(", ")}</p>}
    </div>
  );
}

interface SelectFieldProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string[];
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function SelectField({
  label,
  error,
  options,
  placeholder,
  name,
  className,
  ...rest
}: SelectFieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="block text-xs font-medium uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </label>
      <select
        id={name}
        name={name}
        {...rest}
        className={cn(
          "w-full rounded-md border border-border bg-card px-3 py-2 text-sm",
          "focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring",
          className,
        )}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive">{error.join(", ")}</p>}
    </div>
  );
}

interface CheckboxFieldProps {
  label: string;
  name: string;
  defaultChecked?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

export function CheckboxField({
  label,
  name,
  defaultChecked,
  onChange,
}: CheckboxFieldProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        onChange={onChange}
        className="h-4 w-4 rounded border-border accent-sage-500"
      />
      <span>{label}</span>
    </label>
  );
}

interface FormButtonsProps {
  cancelHref: string;
  submitLabel: string;
  pending?: boolean;
  pendingLabel?: string;
}

export function FormButtons({
  cancelHref,
  submitLabel,
  pending,
  pendingLabel,
}: FormButtonsProps) {
  return (
    <div className="flex items-center gap-3 pt-4">
      <LoadingButton
        type="submit"
        pending={pending}
        pendingLabel={pendingLabel ?? "Guardando..."}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium uppercase tracking-wider text-primary-foreground transition-colors hover:bg-sage-700 disabled:opacity-50"
      >
        {submitLabel}
      </LoadingButton>
      <a
        href={cancelHref}
        className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-cream"
      >
        Cancelar
      </a>
    </div>
  );
}

export function GlobalError({ error }: { error?: string[] }) {
  if (!error || error.length === 0) return null;
  return <p className="text-sm text-destructive">{error.join(", ")}</p>;
}

interface LoadingButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pending?: boolean;
  pendingLabel?: string;
}

export function LoadingButton({
  pending,
  pendingLabel,
  children,
  className,
  disabled,
  ...rest
}: LoadingButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || pending}
      className={cn(
        "inline-flex items-center justify-center gap-2 disabled:opacity-50",
        className,
      )}
    >
      {pending ? (
        <>
          <LoaderCircle className="h-4 w-4 animate-spin" />
          <span>{pendingLabel ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

/**
 * Botón de submit para formularios que postean directo a un server action
 * (sin useActionState/useTransition). Lee el estado de envío del <form> padre
 * con useFormStatus, así muestra el spinner y se deshabilita mientras la acción
 * está en curso — evitando envíos duplicados. Debe renderizarse dentro del
 * <form> al que pertenece.
 */
export function SubmitButton({
  pendingLabel,
  children,
  ...rest
}: Omit<LoadingButtonProps, "pending" | "type">) {
  const { pending } = useFormStatus();
  return (
    <LoadingButton
      {...rest}
      type="submit"
      pending={pending}
      pendingLabel={pendingLabel}
    >
      {children}
    </LoadingButton>
  );
}
