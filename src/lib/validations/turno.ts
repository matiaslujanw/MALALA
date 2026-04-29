import { z } from "zod";

export const turnoCreateSchema = z.object({
  sucursal_id: z.string().min(1, "Sucursal requerida"),
  servicio_id: z.string().min(1, "Servicio requerido"),
  profesional_id: z.string().min(1, "Profesional requerido"),
  fecha_turno: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha invalida"),
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Hora invalida"),
  cliente_nombre: z.string().min(3, "Nombre requerido"),
  cliente_telefono: z.string().min(8, "Telefono requerido"),
  cliente_email: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined)
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: "Email invalido",
    }),
  observacion: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || undefined),
  sin_preferencia: z.boolean().optional().default(false),
  canal: z.enum(["web", "recepcion"]).default("web"),
  origen: z.enum(["publico", "interno"]).default("publico"),
});

export const turnoEstadoSchema = z.object({
  turno_id: z.string().min(1),
  estado: z.enum([
    "pendiente",
    "confirmado",
    "en_curso",
    "completado",
    "cancelado",
    "ausente",
  ]),
});

export const turnoReprogramacionSchema = z.object({
  turno_id: z.string().min(1),
  fecha_turno: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^\d{2}:\d{2}$/),
  profesional_id: z.string().min(1),
});
