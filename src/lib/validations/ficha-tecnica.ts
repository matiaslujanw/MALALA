import { z } from "zod";

const optionalText = z
  .string()
  .nullish()
  .transform((s) => (s ?? "").trim() || undefined);

export const fichaPerfilSchema = z.object({
  tipo_cabello: optionalText,
  salud_cabello: optionalText,
  alergias: optionalText,
  color_actual: optionalText,
  observaciones_tecnicas: optionalText,
});

export const fichaRegistroSchema = z
  .object({
    fecha: z
      .string()
      .min(1, "Fecha requerida")
      .refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s), { message: "Fecha inválida" }),
    servicio_id: optionalText,
    formula: optionalText,
    notas: optionalText,
    empleado_id: optionalText,
  })
  .refine((d) => d.formula || d.notas || d.servicio_id, {
    message: "Cargá al menos un servicio, una fórmula o una nota",
    path: ["formula"],
  });

export type FichaPerfilInput = z.infer<typeof fichaPerfilSchema>;
export type FichaRegistroInput = z.infer<typeof fichaRegistroSchema>;
