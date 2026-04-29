import { z } from "zod";

export const empleadoSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").transform((s) => s.trim()),
  sucursal_principal_id: z.string().min(1, "Sucursal requerida"),
  tipo_comision: z.enum(["porcentaje", "mixto", "sueldo_fijo"]),
  porcentaje_default: z.coerce.number().min(0).max(100),
  sueldo_asegurado: z.coerce.number().nonnegative(),
  observacion: z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim() || undefined),
  activo: z.coerce.boolean().default(true),
});

export type EmpleadoInput = z.infer<typeof empleadoSchema>;
