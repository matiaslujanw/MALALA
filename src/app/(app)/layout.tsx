import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SucursalSwitcher } from "@/components/sucursal-switcher";
import { getActiveSucursal, getCurrentUser } from "@/lib/auth/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/dev/login");
  const sucursal = await getActiveSucursal();
  if (!sucursal) redirect("/dev/login");

  return (
    <div className="flex flex-1 min-h-screen">
      <AppSidebar user={user} />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-border bg-card px-6 flex items-center justify-between">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Sistema MALALA
          </div>
          <SucursalSwitcher user={user} active={sucursal} />
        </header>
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
