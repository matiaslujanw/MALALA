import Link from "next/link";
import type { ComponentType } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Package,
  Receipt,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { logout } from "@/lib/auth/actions";
import { buildAccessScope } from "@/lib/auth/access";
import type { AccessScope, Usuario } from "@/lib/types";

const ROL_LABEL: Record<string, string> = {
  admin: "Admin",
  encargada: "Encargada",
  empleado: "Empleado",
};

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  visible: (scope: AccessScope) => boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, visible: () => true },
  { href: "/ventas", label: "Ventas", icon: ShoppingBag, visible: () => true },
  { href: "/turnos", label: "Turnos", icon: CalendarDays, visible: () => true },
  { href: "/caja", label: "Caja", icon: Wallet, visible: (scope) => scope.puedeVerCaja },
  { href: "/stock", label: "Stock", icon: Package, visible: (scope) => scope.puedeVerStock },
  { href: "/egresos", label: "Egresos", icon: Receipt, visible: (scope) => scope.rol !== "empleado" },
  { href: "/catalogos", label: "Catalogos", icon: BookOpen, visible: (scope) => scope.puedeVerCatalogos },
  { href: "/reportes", label: "Reportes", icon: BarChart3, visible: (scope) => scope.puedeVerReportes },
];

export function AppSidebar({ user }: { user: Usuario }) {
  const scope = buildAccessScope(user);
  const items = NAV.filter((item) => item.visible(scope));

  return (
    <aside className="w-60 shrink-0 border-r border-border bg-card flex flex-col sticky top-0 h-screen self-start">
      <Link href="/dashboard" className="block p-6 border-b border-border hover:bg-cream/40 transition-colors">
        <h1 className="font-display text-xl tracking-[0.3em] uppercase">
          MALALA
        </h1>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
          Hair and Nails
        </p>
      </Link>

      <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-cream transition-colors"
            >
              <Icon className="h-4 w-4 stroke-[1.5]" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border space-y-2">
        <div className="px-3 py-2">
          <p className="text-sm font-medium truncate">{user.nombre}</p>
          <p className="text-xs text-muted-foreground">{ROL_LABEL[user.rol]}</p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-cream hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4 stroke-[1.5]" />
            <span>Salir</span>
          </button>
        </form>
      </div>
    </aside>
  );
}
