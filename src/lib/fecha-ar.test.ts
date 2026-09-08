import { describe, it, expect } from "vitest";
import { fechaArDeISO, finDeDiaArISO, inicioDeDiaArISO } from "./fecha-ar";

/**
 * El bug que estos tests fijan:
 *
 * El server corre en UTC y Argentina es UTC-3, así que a partir de las 21:00
 * hora argentina `new Date().toISOString().slice(0, 10)` devuelve la fecha del
 * DÍA SIGUIENTE. Como la apertura y el cierre de caja se guardan con la fecha
 * argentina, ese desfasaje hacía que a la noche la venta buscara la apertura de
 * mañana, no la encontrara, y tirara "Tenés que abrir la caja de hoy" con la
 * caja abierta — justo en el horario en que un salón cierra.
 *
 * Cada caso de abajo compara el helper contra la forma ingenua, para que quede
 * escrito cuál es la diferencia y no vuelva a colarse.
 */
const naive = (iso: string) => new Date(iso).toISOString().slice(0, 10);

describe("fechaArDeISO — el corte del día es a medianoche argentina", () => {
  it("a las 20:59 ART todavía es el mismo día para las dos formas", () => {
    const iso = "2026-09-08T20:59:00-03:00";
    expect(fechaArDeISO(iso)).toBe("2026-09-08");
    expect(naive(iso)).toBe("2026-09-08");
  });

  it("a las 21:00 ART la forma ingenua ya salta de día y el helper no", () => {
    const iso = "2026-09-08T21:00:00-03:00";
    expect(fechaArDeISO(iso)).toBe("2026-09-08");
    // Esto es exactamente lo que rompía la caja de noche.
    expect(naive(iso)).toBe("2026-09-09");
  });

  it("a las 23:59 ART sigue siendo el mismo día de negocio", () => {
    const iso = "2026-09-08T23:59:59-03:00";
    expect(fechaArDeISO(iso)).toBe("2026-09-08");
    expect(naive(iso)).toBe("2026-09-09");
  });

  it("a las 00:01 ART ya es el día siguiente", () => {
    expect(fechaArDeISO("2026-09-09T00:01:00-03:00")).toBe("2026-09-09");
  });

  it("cruza fin de mes y fin de año sin romperse", () => {
    expect(fechaArDeISO("2026-09-30T22:00:00-03:00")).toBe("2026-09-30");
    expect(fechaArDeISO("2026-12-31T23:00:00-03:00")).toBe("2026-12-31");
    expect(fechaArDeISO("2027-01-01T00:30:00-03:00")).toBe("2027-01-01");
  });
});

describe("límites del día argentino", () => {
  it("el inicio del día AR es 03:00 UTC del mismo día", () => {
    expect(inicioDeDiaArISO("2026-09-08")).toBe("2026-09-08T03:00:00.000Z");
  });

  it("el fin del día AR es 02:59 UTC del día siguiente", () => {
    expect(finDeDiaArISO("2026-09-08")).toBe("2026-09-09T02:59:59.999Z");
  });

  it("una venta de las 22:00 ART cae dentro del día que corresponde", () => {
    const venta = new Date("2026-09-08T22:00:00-03:00").toISOString();
    expect(venta >= inicioDeDiaArISO("2026-09-08")).toBe(true);
    expect(venta <= finDeDiaArISO("2026-09-08")).toBe(true);
    // Y NO cae en el día siguiente, que es donde la ponía el corte en UTC.
    expect(venta >= inicioDeDiaArISO("2026-09-09")).toBe(false);
  });
});
