import { z } from "zod";

export const servicioSchema = z.object({
  rubro: z.string().min(1, "Rubro requerido").transform((s) => s.trim().toUpperCase()),
  nombre: z.string().min(1, "Nombre requerido").transform((s) => s.trim()),
  precio_lista: z.coerce.number().nonnegative("Debe ser ≥ 0"),
  precio_efectivo: z.coerce.number().nonnegative("Debe ser ≥ 0"),
  // Duración en minutos: define cuánto "tapa" el slot al reservar para que no
  // se superpongan turnos. Obligatoria para que el motor de slots sea correcto.
  duracion_min: z.coerce
    .number()
    .int("Debe ser un número entero de minutos")
    .min(5, "Mínimo 5 minutos")
    .max(600, "Máximo 600 minutos"),
  // La comisión la define el % del empleado; el servicio ya no la maneja.
  comision_default_pct: z.coerce.number().min(0).max(100).optional().default(0),
  activo: z.coerce.boolean().default(true),
});

export type ServicioInput = z.infer<typeof servicioSchema>;
