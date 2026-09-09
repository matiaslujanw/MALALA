import { z } from "zod";

// nullish: tolera `null`, que es lo que devuelve FormData.get cuando el campo no
// existe.
const optStr = z
  .string()
  .nullish()
  .transform((s) => (s && s.trim() !== "" ? s.trim() : undefined));

export const viaticoSchema = z.object({
  empleado_id: z.string().min(1, "Elegí la empleada"),
  // YYYY-MM-DD. El día que le tocó el viático, que no siempre es hoy: se puede
  // cargar al otro día si en el momento no llegaron.
  fecha: z
    .string()
    .min(1, "Fecha requerida")
    .refine((s) => /^\d{4}-\d{2}-\d{2}$/.test(s), { message: "Fecha inválida" }),
  monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
  /**
   * La plata ya se le dio en el momento. Cuando es true se genera el egreso y el
   * viático NO se vuelve a pagar en la liquidación: aparece en el total que
   * cobró, pero descontado como ya entregado.
   */
  pagado: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.boolean()])
    .nullish()
    .transform((v) => v === true || v === "on" || v === "true"),
  /** Sólo hace falta si `pagado`: con qué se le dio la plata. */
  mp_id: optStr,
  observacion: optStr,
});

export type ViaticoInput = z.infer<typeof viaticoSchema>;
