"use server";

import { reabrirCierre as reabrirCierreImpl } from "./caja";

export async function reabrirCierre(
  cierreId: string,
): Promise<{ ok: true } | { ok: false; errors: Record<string, string[]> }> {
  return reabrirCierreImpl(cierreId);
}
