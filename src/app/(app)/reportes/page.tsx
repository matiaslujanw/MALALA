import Link from "next/link";
import {
  ClipboardList,
  Eye,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";

interface Card {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  disabled?: boolean;
}

export default async function ReportesPage() {
  const user = await requireUser();

  const cards: Card[] = [
    {
      href: "/reportes/auditoria",
      title: "Auditoría",
      description:
        "Timeline completo de movimientos: quién hizo qué, cuándo y dónde.",
      icon: <Eye className="h-5 w-5 stroke-[1.5]" />,
      adminOnly: true,
    },
    {
      href: "/reportes/ventas",
      title: "Ventas",
      description: "Evolución, top servicios y rendimiento por empleado.",
      icon: <TrendingUp className="h-5 w-5 stroke-[1.5]" />,
      disabled: true,
    },
    {
      href: "/reportes/comisiones",
      title: "Comisiones acumuladas",
      description: "Comisiones devengadas por empleado y período.",
      icon: <Users className="h-5 w-5 stroke-[1.5]" />,
      disabled: true,
    },
    {
      href: "/reportes/egresos",
      title: "Egresos",
      description: "Por rubro, proveedor y evolución mensual.",
      icon: <Receipt className="h-5 w-5 stroke-[1.5]" />,
      disabled: true,
    },
    {
      href: "/reportes/caja",
      title: "Caja",
      description: "Historial de cierres y diferencias acumuladas.",
      icon: <Wallet className="h-5 w-5 stroke-[1.5]" />,
      disabled: true,
    },
    {
      href: "/reportes/stock",
      title: "Stock",
      description: "Bajo umbral, valorizado y rotación.",
      icon: <ClipboardList className="h-5 w-5 stroke-[1.5]" />,
      disabled: true,
    },
  ];

  const visibles = cards.filter((c) => !c.adminOnly || user.rol === "admin");

  return (
    <div className="space-y-8 max-w-5xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Reportes
        </h1>
        <p className="text-sm text-muted-foreground">
          Análisis y trazabilidad. Más reportes próximamente.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibles.map((c) => {
          const inner = (
            <div
              className={`bg-card border border-border rounded-md p-5 h-full transition-colors ${
                c.disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:border-sage-300"
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span style={{ color: "var(--sage-700)" }}>{c.icon}</span>
                <h2 className="font-display text-lg tracking-wider uppercase">
                  {c.title}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground">{c.description}</p>
              {c.disabled && (
                <p className="text-xs text-muted-foreground mt-3 italic">
                  Próximamente
                </p>
              )}
            </div>
          );
          return c.disabled ? (
            <div key={c.href}>{inner}</div>
          ) : (
            <Link key={c.href} href={c.href}>
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
