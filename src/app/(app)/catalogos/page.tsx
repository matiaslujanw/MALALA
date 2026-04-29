import Link from "next/link";
import {
  BookOpen,
  Users,
  UserCog,
  Truck,
  FlaskConical,
  CreditCard,
  Receipt,
  NotebookText,
} from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import {
  listClientes,
  listEmpleados,
  listInsumos,
  listMediosPago,
  listProveedores,
  listRubrosGasto,
  listServicios,
} from "./_counts";
import { listRecetasResumen } from "@/lib/data/recetas";

const items = [
  {
    href: "/catalogos/servicios",
    label: "Servicios",
    Icon: BookOpen,
    desc: "Catálogo de servicios prestados",
  },
  {
    href: "/catalogos/insumos",
    label: "Insumos",
    Icon: FlaskConical,
    desc: "Productos consumibles",
  },
  {
    href: "/catalogos/recetas",
    label: "Recetas",
    Icon: NotebookText,
    desc: "Insumos por servicio",
  },
  {
    href: "/catalogos/clientes",
    label: "Clientes",
    Icon: Users,
    desc: "Base de clientes",
  },
  {
    href: "/catalogos/empleados",
    label: "Empleados",
    Icon: UserCog,
    desc: "Equipo y reglas de comisión",
  },
  {
    href: "/catalogos/proveedores",
    label: "Proveedores",
    Icon: Truck,
    desc: "Proveedores de insumos",
  },
  {
    href: "/catalogos/medios-pago",
    label: "Medios de pago",
    Icon: CreditCard,
    desc: "EF, TR, TC, TD, MP",
  },
  {
    href: "/catalogos/rubros-gasto",
    label: "Rubros de gasto",
    Icon: Receipt,
    desc: "Categorías para egresos",
  },
];

export default async function CatalogosPage() {
  await requireUser();

  const [
    servicios,
    insumos,
    recetas,
    clientes,
    empleados,
    proveedores,
    mediosPago,
    rubrosGasto,
  ] = await Promise.all([
    listServicios(),
    listInsumos(),
    listRecetasResumen(),
    listClientes(),
    listEmpleados(),
    listProveedores(),
    listMediosPago(),
    listRubrosGasto(),
  ]);

  const recetasCargadas = recetas.filter((r) => r.cantidadInsumos > 0).length;

  const counts: Record<string, number> = {
    "/catalogos/servicios": servicios.length,
    "/catalogos/insumos": insumos.length,
    "/catalogos/recetas": recetasCargadas,
    "/catalogos/clientes": clientes.length,
    "/catalogos/empleados": empleados.length,
    "/catalogos/proveedores": proveedores.length,
    "/catalogos/medios-pago": mediosPago.length,
    "/catalogos/rubros-gasto": rubrosGasto.length,
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          Catálogos
        </h1>
        <p className="text-sm text-muted-foreground">
          Datos compartidos entre sucursales
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(({ href, label, Icon, desc }) => (
          <Link
            key={href}
            href={href}
            className="bg-card border border-border rounded-md p-5 hover:bg-cream/40 transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-sage-50 p-2">
                <Icon className="h-5 w-5 stroke-[1.5] text-sage-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                  {counts[href] ?? 0} registros
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
