"use server";

import { store } from "@/lib/mock/store";
import type { Sucursal } from "@/lib/types";

export async function listSucursales(opts?: { soloActivas?: boolean }): Promise<Sucursal[]> {
  const arr = opts?.soloActivas
    ? store.sucursales.filter((s) => s.activo)
    : [...store.sucursales];
  return arr.sort((a, b) => a.nombre.localeCompare(b.nombre));
}
