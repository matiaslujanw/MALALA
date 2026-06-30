import { z } from "zod";
import { tryNormalizarTelefonoAR } from "@/lib/phone";

export const integracionManychatSchema = z.object({
  sucursal_id: z.string().min(1, "Sucursal requerida"),
  numero_whatsapp: z
    .string()
    .min(8, "Número requerido")
    .refine((v) => tryNormalizarTelefonoAR(v) !== null, {
      message: "Número argentino inválido",
    }),
  activo: z.coerce.boolean().default(true),
});

export type IntegracionManychatInput = z.infer<typeof integracionManychatSchema>;

export const pruebaManychatSchema = z.object({
  sucursal_id: z.string().min(1),
  telefono_destino: z
    .string()
    .min(8)
    .refine((v) => tryNormalizarTelefonoAR(v) !== null, {
      message: "Número argentino inválido",
    }),
  nombre_destino: z.string().min(1).default("Test"),
});
