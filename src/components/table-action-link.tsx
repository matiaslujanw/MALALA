import Link from "next/link";
import { Eye, Pencil } from "lucide-react";

interface Props {
  href: string;
  /** "view" muestra ícono de ojo (default), "edit" muestra lápiz. */
  variant?: "view" | "edit";
  /** Texto del botón. Default: "Ver" / "Editar" según variant. */
  label?: string;
}

/**
 * Botón de acción para filas de tablas (Ver / Editar). Verde distintivo,
 * se llena al pasar el mouse para que se note que es clickeable.
 */
export function TableActionLink({ href, variant = "view", label }: Props) {
  const Icon = variant === "edit" ? Pencil : Eye;
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-md bg-sage-50 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-sage-700 ring-1 ring-inset ring-sage-700/30 transition-colors hover:bg-sage-700 hover:text-white hover:ring-sage-700"
    >
      <Icon className="h-3.5 w-3.5 stroke-[1.5]" />
      {label ?? (variant === "edit" ? "Editar" : "Ver")}
    </Link>
  );
}
