import { getCurrentUser } from "./session";
import { store } from "@/lib/mock/store";
import type { AccessScope, Usuario } from "@/lib/types";

export function buildAccessScope(user: Usuario): AccessScope {
  const sucursalIdsPermitidas =
    user.rol === "admin"
      ? store.sucursales.filter((s) => s.activo).map((s) => s.id)
      : [user.sucursal_default_id];

  return {
    rol: user.rol,
    sucursalIdsPermitidas,
    empleadoId: user.empleado_id,
    puedeVerGlobal: user.rol === "admin",
    puedeAdministrarTurnos: user.rol === "admin" || user.rol === "encargada",
    puedeVerStock: user.rol === "admin" || user.rol === "encargada",
    puedeGestionarStock: user.rol === "admin" || user.rol === "encargada",
    puedeVerReportes: user.rol === "admin" || user.rol === "encargada",
    puedeVerCaja: user.rol === "admin" || user.rol === "encargada",
    puedeVerCatalogos: user.rol === "admin" || user.rol === "encargada",
  };
}

export async function getAccessScope(): Promise<AccessScope | null> {
  const user = await getCurrentUser();
  return user ? buildAccessScope(user) : null;
}

export function isSucursalAllowed(scope: AccessScope, sucursalId?: string | null) {
  if (!sucursalId) return true;
  return scope.sucursalIdsPermitidas.includes(sucursalId);
}

export function clampSucursalId(
  scope: AccessScope,
  requestedSucursalId?: string | null,
) {
  if (requestedSucursalId && isSucursalAllowed(scope, requestedSucursalId)) {
    return requestedSucursalId;
  }
  return scope.sucursalIdsPermitidas[0] ?? null;
}
