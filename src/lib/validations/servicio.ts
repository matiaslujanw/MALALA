import { z } from "zod";

export const servicioSchema = z.object({
  rubro: z.string().min(1, "Rubro requerido").transform((s) => s.trim().toUpperCase()),
  nombre: z.string().min(1, "Nombre requerido").transform((s) => s.trim()),
  precio_lista: z.coerce.number().nonnegative("Debe ser ≥ 0"),
  precio_efectivo: z.coerce.number().nonnegative("Debe ser ≥ 0"),
  // La comisión la define el % del empleado; el servicio ya no la maneja.
  comision_default_pct: z.coerce.number().min(0).max(100).optional().default(0),
  activo: z.coerce.boolean().default(true),
});

export type ServicioInput = z.infer<typeof servicioSchema>;
