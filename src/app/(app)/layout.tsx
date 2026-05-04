import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SucursalSwitcher } from "@/components/sucursal-switcher";
import { AdminChat } from "@/components/admin-chat/admin-chat";
import { getActiveSucursalForUser, getCurrentUser } from "@/lib/auth/session";
import { listSucursales } from "@/lib/data/sucursales";
import { buildAccessScope } from "@/lib/auth/access";
import type { AccessScope } from "@/lib/types";

interface NavDef {
  href: string;
  label: string;
  iconKey: string;
  visible: (scope: AccessScope) => boolean;
}

const NAV: NavDef[] = [
  { href: "/dashboard", label: "Dashboard", iconKey: "LayoutDashboard", visible: () => true },
  { href: "/ventas", label: "Ventas", iconKey: "ShoppingBag", visible: () => true },
  { href: "/turnos", label: "Turnos", iconKey: "CalendarDays", visible: () => true },
  { href: "/caja", label: "Caja", iconKey: "Wallet", visible: (s) => s.puedeVerCaja },
  { href: "/stock", label: "Stock", iconKey: "Package", visible: (s) => s.puedeVerStock },
  { href: "/egresos", label: "Egresos", iconKey: "Receipt", visible: (s) => s.rol !== "empleado" },
  { href: "/catalogos", label: "Catalogos", iconKey: "BookOpen", visible: (s) => s.puedeVerCatalogos },
  { href: "/reportes", label: "Reportes", iconKey: "BarChart3", visible: (s) => s.puedeVerReportes },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/dev/login");
  const sucursal = await getActiveSucursalForUser(user);
  if (!sucursal) redirect("/dev/login");
  const sucursales = await listSucursales({ soloActivas: true });

  const scope = buildAccessScope(user);
  const navItems = NAV
    .filter((n) => n.visible(scope))
    .map(({ href, label, iconKey }) => ({ href, label, iconKey }));

  return (
    <div className="flex flex-1 min-h-screen">
      <AppSidebar userName={user.nombre} userRol={user.rol} navItems={navItems} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card px-4 md:px-6 flex items-center justify-between gap-2">
          {/* Spacer for hamburger button on mobile */}
          <div className="w-10 lg:w-0 shrink-0" />
          <div className="text-xs uppercase tracking-widest text-muted-foreground hidden sm:block">
            Sistema MALALA
          </div>
          <SucursalSwitcher
            user={user}
            active={sucursal}
            sucursales={sucursales}
          />
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
      {user.rol === "admin" && <AdminChat />}
    </div>
  );
}
