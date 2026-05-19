import { z } from "zod";

export const cuentaBancariaSchema = z.object({
  sucursal_id: z.string().min(1, "Sucursal requerida"),
  nombre: z.string().min(1, "Nombre requerido").transform((s) => s.trim()),
  tipo: z.enum(["banco", "efectivo"]),
  observacion: z.string().optional().transform((s) => s?.trim() || undefined),
});

export type CuentaBancariaInput = z.infer<typeof cuentaBancariaSchema>;

export const transferenciaSchema = z
  .object({
    cuenta_origen_id: z.string().min(1, "Cuenta origen requerida"),
    cuenta_destino_id: z.string().min(1, "Cuenta destino requerida"),
    monto: z.coerce.number().positive("Monto debe ser mayor a 0"),
    descripcion: z.string().optional().transform((s) => s?.trim() || undefined),
  })
  .refine((d) => d.cuenta_origen_id !== d.cuenta_destino_id, {
    message: "La cuenta origen y destino deben ser distintas",
    path: ["cuenta_destino_id"],
  });

export type TransferenciaInput = z.infer<typeof transferenciaSchema>;
