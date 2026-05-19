import { getCurrentUser } from "./session";
import type { AccessScope, Rol, Usuario } from "@/lib/types";

export function esAdmin(rol: Rol): boolean {
  return rol === "admin" || rol === "superadmin";
}

export function buildAccessScope(user: Usuario): AccessScope {
  const sucursalIdsPermitidas =
    user.sucursal_ids_permitidas?.length
      ? user.sucursal_ids_permitidas
      : [user.sucursal_default_id];

  const admin = esAdmin(user.rol);
  const adminOEncargada = admin || user.rol === "encargada";

  return {
    rol: user.rol,
    sucursalIdsPermitidas,
    empleadoId: user.empleado_id,
    esAdmin: admin,
    puedeVerGlobal: user.rol === "superadmin",
    puedeAdministrarTurnos: adminOEncargada,
    puedeVerStock: adminOEncargada,
    puedeGestionarStock: adminOEncargada,
    puedeVerReportes: adminOEncargada,
    puedeVerCaja: adminOEncargada,
    puedeVerCatalogos: adminOEncargada,
  };
}

export async function getAccessScope(): Promise<AccessScope | null> {
  const user = await getCurrentUser();
  return user ? buildAccessScope(user) : null;
}

export function getAccessScopeForUser(user: Usuario): AccessScope {
  return buildAccessScope(user);
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
