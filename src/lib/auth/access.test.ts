import { describe, it, expect } from "vitest";
import {
  buildAccessScope,
  clampSucursalId,
  esAdmin,
  isSucursalAllowed,
} from "./access";
import type { Usuario } from "@/lib/types";

const SUC_A = "suc-a";
const SUC_B = "suc-b";

function usuario(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: "u1",
    email: "u@malala.test",
    nombre: "U",
    rol: "encargada",
    sucursal_default_id: SUC_A,
    activo: true,
    ...overrides,
  };
}

describe("esAdmin", () => {
  it("trata admin y superadmin como admin", () => {
    expect(esAdmin("admin")).toBe(true);
    expect(esAdmin("superadmin")).toBe(true);
  });
  it("encargada y empleado NO son admin", () => {
    expect(esAdmin("encargada")).toBe(false);
    expect(esAdmin("empleado")).toBe(false);
  });
});

describe("buildAccessScope — aislamiento por sucursal", () => {
  it("encargada solo puede ver su sucursal default cuando no hay lista explícita", () => {
    const scope = buildAccessScope(usuario({ rol: "encargada" }));
    expect(scope.sucursalIdsPermitidas).toEqual([SUC_A]);
    expect(scope.sucursalIdsPermitidas).not.toContain(SUC_B);
  });

  it("empleado queda confinado a su sucursal y no ve caja/stock/reportes/catálogos", () => {
    const scope = buildAccessScope(usuario({ rol: "empleado", empleado_id: "e1" }));
    expect(scope.sucursalIdsPermitidas).toEqual([SUC_A]);
    expect(scope.esAdmin).toBe(false);
    expect(scope.puedeVerCaja).toBe(false);
    expect(scope.puedeVerStock).toBe(false);
    expect(scope.puedeGestionarStock).toBe(false);
    expect(scope.puedeVerReportes).toBe(false);
    expect(scope.puedeVerCatalogos).toBe(false);
    expect(scope.puedeAdministrarTurnos).toBe(false);
  });

  it("encargada SÍ accede a caja/stock/reportes/catálogos de su sucursal", () => {
    const scope = buildAccessScope(usuario({ rol: "encargada" }));
    expect(scope.puedeVerCaja).toBe(true);
    expect(scope.puedeVerStock).toBe(true);
    expect(scope.puedeGestionarStock).toBe(true);
    expect(scope.puedeVerReportes).toBe(true);
    expect(scope.puedeVerCatalogos).toBe(true);
    expect(scope.puedeVerGlobal).toBe(false);
  });

  it("admin es admin pero NO es superadmin global por defecto", () => {
    const scope = buildAccessScope(usuario({ rol: "admin" }));
    expect(scope.esAdmin).toBe(true);
    expect(scope.puedeVerGlobal).toBe(false);
  });

  it("superadmin puede ver global", () => {
    const scope = buildAccessScope(
      usuario({ rol: "superadmin", sucursal_ids_permitidas: [SUC_A, SUC_B] }),
    );
    expect(scope.esAdmin).toBe(true);
    expect(scope.puedeVerGlobal).toBe(true);
    expect(scope.sucursalIdsPermitidas).toEqual([SUC_A, SUC_B]);
  });

  it("respeta una lista explícita de sucursales permitidas", () => {
    const scope = buildAccessScope(
      usuario({ rol: "admin", sucursal_ids_permitidas: [SUC_A, SUC_B] }),
    );
    expect(scope.sucursalIdsPermitidas).toEqual([SUC_A, SUC_B]);
  });
});

describe("isSucursalAllowed", () => {
  const scope = buildAccessScope(usuario({ rol: "encargada" }));

  it("permite la sucursal propia", () => {
    expect(isSucursalAllowed(scope, SUC_A)).toBe(true);
  });
  it("rechaza la sucursal ajena (fuga de aislamiento)", () => {
    expect(isSucursalAllowed(scope, SUC_B)).toBe(false);
  });
  it("sin sucursal pedida no bloquea (no es un cruce)", () => {
    expect(isSucursalAllowed(scope, null)).toBe(true);
    expect(isSucursalAllowed(scope, undefined)).toBe(true);
  });
});

describe("clampSucursalId", () => {
  const scope = buildAccessScope(usuario({ rol: "encargada" }));

  it("devuelve la sucursal pedida si es válida", () => {
    expect(clampSucursalId(scope, SUC_A)).toBe(SUC_A);
  });
  it("cae a la primera permitida si piden una ajena (no se filtra a la otra sucursal)", () => {
    expect(clampSucursalId(scope, SUC_B)).toBe(SUC_A);
  });
  it("cae a la primera permitida si no piden nada", () => {
    expect(clampSucursalId(scope, undefined)).toBe(SUC_A);
  });
});
