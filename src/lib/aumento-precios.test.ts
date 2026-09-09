import { describe, it, expect } from "vitest";
import { aplicarAumento, pctValido, redondear100 } from "./aumento-precios";

describe("redondear100", () => {
  it("redondea al múltiplo de 100 más cercano", () => {
    expect(redondear100(103_500)).toBe(103_500);
    expect(redondear100(103_549)).toBe(103_500);
    expect(redondear100(103_551)).toBe(103_600);
    expect(redondear100(82_800)).toBe(82_800);
  });

  it("nunca deja un precio en cero por redondear para abajo", () => {
    // Un servicio de $120 con una baja del 50% da $60: sin el piso quedaría en
    // $100→0 y el servicio se regalaría sin que nadie lo note.
    expect(redondear100(60)).toBe(100);
    expect(redondear100(1)).toBe(100);
  });

  it("un precio en cero se queda en cero", () => {
    expect(redondear100(0)).toBe(0);
  });
});

describe("aplicarAumento — conserva la relación de cada servicio", () => {
  it("un servicio con 20% off mantiene el 20% off", () => {
    const r = aplicarAumento({ precioLista: 90_000, precioEfectivo: 72_000 }, 15);
    expect(r.lista).toBe(103_500);
    expect(r.efectivo).toBe(82_800);
    expect(r.efectivo / r.lista).toBeCloseTo(0.8, 4);
  });

  it("un servicio SIN descuento (efectivo = lista) sigue sin descuento", () => {
    // Son 6 en el catálogo. Si se recalculara el efectivo como lista × 0,8, a
    // estos se les inventaría un descuento que nunca tuvieron.
    const r = aplicarAumento({ precioLista: 40_000, precioEfectivo: 40_000 }, 25);
    expect(r.lista).toBe(50_000);
    expect(r.efectivo).toBe(50_000);
  });

  it("los dos precios quedan redondos a $100", () => {
    const r = aplicarAumento({ precioLista: 33_333, precioEfectivo: 26_666 }, 17);
    expect(r.lista % 100).toBe(0);
    expect(r.efectivo % 100).toBe(0);
  });

  it("sirve para bajar precios", () => {
    const r = aplicarAumento({ precioLista: 100_000, precioEfectivo: 80_000 }, -10);
    expect(r.lista).toBe(90_000);
    expect(r.efectivo).toBe(72_000);
  });

  it("el desvío por redondeo es chico frente al precio", () => {
    const antes = { precioLista: 47_350, precioEfectivo: 37_880 };
    const r = aplicarAumento(antes, 12);
    const ratioAntes = antes.precioEfectivo / antes.precioLista;
    const ratioDespues = r.efectivo / r.lista;
    expect(Math.abs(ratioDespues - ratioAntes)).toBeLessThan(0.005);
  });
});

describe("pctValido", () => {
  it("acepta subas y bajas razonables", () => {
    expect(pctValido(15)).toBe(true);
    expect(pctValido(-10)).toBe(true);
    expect(pctValido(0.5)).toBe(true);
  });
  it("rechaza el 0 y lo que está fuera de rango", () => {
    expect(pctValido(0)).toBe(false);
    expect(pctValido(-91)).toBe(false);
    expect(pctValido(1001)).toBe(false);
    expect(pctValido(NaN)).toBe(false);
  });
});
