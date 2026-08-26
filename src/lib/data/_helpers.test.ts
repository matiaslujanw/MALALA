import { describe, it, expect } from "vitest";
import { esCodigoDuplicado } from "./_helpers";

/**
 * El error crudo de postgres-js: es el que tiene `code` y `constraint_name`.
 */
function postgresError(constraint: string, detail = "") {
  return Object.assign(new Error("duplicate key value violates unique constraint"), {
    code: "23505",
    constraint_name: constraint,
    detail,
  });
}

/**
 * Lo que realmente llega al catch: drizzle 0.45 envuelve el error de postgres en
 * un DrizzleQueryError y lo deja en `.cause`. Verificado contra la base.
 */
function drizzleWrapped(inner: Error) {
  return Object.assign(new Error("Failed query: insert into ..."), {
    query: "insert into ...",
    params: [],
    cause: inner,
  });
}

describe("esCodigoDuplicado", () => {
  it("detecta el error de postgres directo", () => {
    expect(esCodigoDuplicado(postgresError("insumos_sucursal_codigo_uq"))).toBe(true);
  });

  it("lo detecta cuando drizzle lo envuelve en cause — el caso real", () => {
    // Sin desenvolver el cause esto daba false y la función no servía para nada:
    // el usuario veía una excepción cruda en vez del error en el campo.
    expect(
      esCodigoDuplicado(drizzleWrapped(postgresError("gift_cards_sucursal_codigo_uq"))),
    ).toBe(true);
  });

  it("aguanta más de una capa de envoltura", () => {
    expect(
      esCodigoDuplicado(
        drizzleWrapped(drizzleWrapped(postgresError("servicios_codigo_uq"))),
      ),
    ).toBe(true);
  });

  it("lo detecta por el detail cuando el constraint no dice 'codigo'", () => {
    expect(
      esCodigoDuplicado(
        drizzleWrapped(
          postgresError("otra_cosa_uq", "Key (sucursal_id, upper(codigo))=(x, Y) already exists."),
        ),
      ),
    ).toBe(true);
  });

  it("NO se come otras violaciones de unicidad", () => {
    const otro = Object.assign(new Error("dup"), {
      code: "23505",
      constraint_name: "clientes_telefono_uq",
      detail: "Key (telefono)=(3815551234) already exists.",
    });
    expect(esCodigoDuplicado(drizzleWrapped(otro))).toBe(false);
  });

  it("NO se come otros códigos de error de postgres", () => {
    const check = Object.assign(new Error("check"), {
      code: "23514",
      constraint_name: "gift_cards_saldo_en_rango",
      detail: "",
    });
    expect(esCodigoDuplicado(drizzleWrapped(check))).toBe(false);
  });

  it("tolera basura sin explotar", () => {
    expect(esCodigoDuplicado(null)).toBe(false);
    expect(esCodigoDuplicado(undefined)).toBe(false);
    expect(esCodigoDuplicado("un string")).toBe(false);
    expect(esCodigoDuplicado(new Error("pelado"))).toBe(false);
    expect(esCodigoDuplicado({ cause: { cause: {} } })).toBe(false);
  });

  it("no se cuelga con una cadena de causes circular", () => {
    const a = { code: "1", cause: null as unknown };
    const b = { code: "2", cause: a };
    a.cause = b;
    expect(esCodigoDuplicado(a)).toBe(false);
  });
});
