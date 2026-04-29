"use client";

import { cn } from "@/lib/utils";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string[];
  hint?: string;
}

export function Field({ label, error, hint, name, className, ...rest }: FieldProps) {
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
          "w-full px-3 py-2 border border-border rounded-md bg-card text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
          className,
        )}
      />
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
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
          "w-full px-3 py-2 border border-border rounded-md bg-card text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
          className,
        )}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
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
}

export function CheckboxField({
  label,
  name,
  defaultChecked,
}: CheckboxFieldProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
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
}

export function FormButtons({
  cancelHref,
  submitLabel,
  pending,
}: FormButtonsProps) {
  return (
    <div className="flex items-center gap-3 pt-4">
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:bg-sage-700 disabled:opacity-50 transition-colors"
      >
        {pending ? "Guardando…" : submitLabel}
      </button>
      <a
        href={cancelHref}
        className="px-4 py-2 rounded-md text-sm font-medium border border-border hover:bg-cream transition-colors"
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
