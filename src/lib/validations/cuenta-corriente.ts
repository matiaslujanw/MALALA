import { z } from "zod";

export const cargoCcSchema = z.object({
  cliente_id: z.string().min(1, "Cliente requerido"),
  monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
  descripcion: z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim() || undefined),
});

export const pagoCcSchema = z.object({
  cliente_id: z.string().min(1, "Cliente requerido"),
  monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
  mp_id: z.string().min(1, "Medio de pago requerido"),
  descripcion: z
    .string()
    .optional()
    .transform((s) => (s ?? "").trim() || undefined),
});

export type CargoCcInput = z.infer<typeof cargoCcSchema>;
export type PagoCcInput = z.infer<typeof pagoCcSchema>;
