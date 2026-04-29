// Re-exports para que la página índice consulte conteos sin tirar del proxy "use server"
// directamente con todas las dependencias.
export { listServicios } from "@/lib/data/servicios";
export { listInsumos } from "@/lib/data/insumos";
export { listClientes } from "@/lib/data/clientes";
export { listEmpleados } from "@/lib/data/empleados";
export { listProveedores } from "@/lib/data/proveedores";
export { listMediosPago } from "@/lib/data/medios-pago";
export { listRubrosGasto } from "@/lib/data/rubros-gasto";
