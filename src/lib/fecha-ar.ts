// Helpers de fecha en horario de Argentina. El server (Vercel) corre en UTC,
// pero las fechas operativas (turnos, caja, egresos) se manejan en hora local
// de Argentina. Usar esto para calcular "hoy" en el servidor evita el desfasaje
// de 3 horas (p. ej. de noche, que "hoy" salte al día siguiente).

const TZ = "America/Argentina/Buenos_Aires";

/** Fecha de hoy como YYYY-MM-DD en horario de Argentina. */
export function hoyAr(): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}
