import { z } from "zod";
import { tryNormalizarTelefonoAR } from "@/lib/phone";

export const clienteSchema = z
  .object({
    nombre: z.string().min(1, "Nombre requerido").transform((s) => s.trim()),
    telefono: z
      .string()
      .optional()
      .transform((s) => (s ?? "").trim() || undefined),
    email: z
      .string()
      .trim()
      .optional()
      .transform((value) => value || undefined)
      .refine((value) => !value || z.string().email().safeParse(value).success, {
        message: "Email inválido",
      }),
    observacion: z
      .string()
      .optional()
      .transform((s) => (s ?? "").trim() || undefined),
    activo: z.coerce.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.telefono && !tryNormalizarTelefonoAR(data.telefono)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["telefono"],
        message: "Teléfono argentino inválido",
      });
    }
  });

export type ClienteInput = z.infer<typeof clienteSchema>;
