// Helpers de fecha en horario de Argentina. El server (Vercel) corre en UTC,
// pero las fechas operativas (turnos, caja, egresos) se manejan en hora local
// de Argentina. Usar esto para calcular "hoy" en el servidor evita el desfasaje
// de 3 horas (p. ej. de noche, que "hoy" salte al día siguiente).

const TZ = "America/Argentina/Buenos_Aires";
// Argentina es UTC-3 fijo (no observa horario de verano). Offset literal para
// construir instantes a partir de fechas locales.
const AR_OFFSET = "-03:00";

/** Fecha de hoy como YYYY-MM-DD en horario de Argentina. */
export function hoyAr(): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Instante (ISO UTC) del inicio del día de Argentina para una fecha YMD. */
export function inicioDeDiaArISO(ymd: string = hoyAr()): string {
  return new Date(`${ymd}T00:00:00.000${AR_OFFSET}`).toISOString();
}

/** Instante (ISO UTC) del fin del día de Argentina para una fecha YMD. */
export function finDeDiaArISO(ymd: string = hoyAr()): string {
  return new Date(`${ymd}T23:59:59.999${AR_OFFSET}`).toISOString();
}

/** Instante (ISO UTC) del inicio del mes en curso en Argentina. */
export function inicioDeMesArISO(): string {
  return new Date(`${hoyAr().slice(0, 7)}-01T00:00:00.000${AR_OFFSET}`).toISOString();
}

/** Fecha (YMD) de hace `n` días respecto de hoy, en Argentina. */
export function hoyArMenosDias(n: number): string {
  const d = new Date(`${hoyAr()}T12:00:00.000${AR_OFFSET}`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Convierte un instante ISO a su fecha YMD en horario de Argentina. */
export function fechaArDeISO(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}
