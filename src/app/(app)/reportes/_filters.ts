/**
 * Helper compartido para parsear filtros de período y sucursal en /reportes/*.
 * Limita los valores al scope del usuario.
 */
import type { AccessScope } from "@/lib/types";
import { hoyAr } from "@/lib/fecha-ar";

export interface ReporteFiltrosInput {
  desde?: string;
  hasta?: string;
  sucursal?: string;
  empleado?: string;
}

export interface ReporteFiltros {
  desde: string; // YYYY-MM-DD
  hasta: string; // YYYY-MM-DD
  desdeIso: string; // ISO start of day
  hastaIso: string; // ISO end of day
  sucursalId?: string;
  empleadoId?: string;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDayIso(ymdStr: string): string {
  return `${ymdStr}T00:00:00.000`;
}

function endOfDayIso(ymdStr: string): string {
  return `${ymdStr}T23:59:59.999`;
}

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseReporteFiltros(
  input: ReporteFiltrosInput,
  scope: AccessScope,
): ReporteFiltros {
  const hoy = new Date(`${hoyAr()}T00:00:00`);
  const hace30 = new Date(hoy);
  hace30.setDate(hace30.getDate() - 29);

  const desde =
    input.desde && YMD_RE.test(input.desde) ? input.desde : ymd(hace30);
  const hasta =
    input.hasta && YMD_RE.test(input.hasta) ? input.hasta : ymd(hoy);

  const sucursalId =
    input.sucursal && scope.sucursalIdsPermitidas.includes(input.sucursal)
      ? input.sucursal
      : scope.sucursalIdsPermitidas.length === 1
        ? scope.sucursalIdsPermitidas[0]
        : undefined;

  // Empleados se filtran después contra la lista permitida (ya filtrada por scope en la query).
  const empleadoId =
    typeof input.empleado === "string" && input.empleado.length > 0
      ? input.empleado
      : undefined;

  return {
    desde,
    hasta,
    desdeIso: startOfDayIso(desde),
    hastaIso: endOfDayIso(hasta),
    sucursalId,
    empleadoId,
  };
}

export function rangoLabel(filtros: ReporteFiltros): string {
  return `${filtros.desde} → ${filtros.hasta}`;
}
