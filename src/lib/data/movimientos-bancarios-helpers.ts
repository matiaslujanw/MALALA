import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client/postgres";
import {
  mediosPago as mediosPagoTable,
  movimientosBancarios as movimientosBancariosTable,
} from "@/lib/db/schema";

type DbOrTx = ReturnType<typeof getDb> | Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

function createId() {
  return crypto.randomUUID();
}

export interface EmitMovArgs {
  cuentaId: string;
  fecha: Date;
  monto: number; // signo según naturaleza
  tipo: "ingreso" | "egreso" | "ajuste";
  sucursalId?: string | null;
  refTipo: string;
  refId: string;
  descripcion?: string | null;
  usuarioId: string;
}

export async function emitMovimientoBancarioTx(tx: DbOrTx, args: EmitMovArgs) {
  await tx.insert(movimientosBancariosTable).values({
    id: createId(),
    cuentaId: args.cuentaId,
    fecha: args.fecha,
    tipo: args.tipo,
    monto: args.monto,
    sucursalId: args.sucursalId ?? null,
    refTipo: args.refTipo,
    refId: args.refId,
    descripcion: args.descripcion ?? null,
    usuarioId: args.usuarioId,
  });
}

export async function deleteMovimientosByRefTx(
  tx: DbOrTx,
  refTipo: string,
  refId: string,
) {
  await tx
    .delete(movimientosBancariosTable)
    .where(eq(movimientosBancariosTable.refId, refId));
}

export async function getCuentaIdForMpTx(
  tx: DbOrTx,
  mpId: string,
): Promise<string | null> {
  const [row] = await tx
    .select({ cuentaId: mediosPagoTable.cuentaId })
    .from(mediosPagoTable)
    .where(eq(mediosPagoTable.id, mpId))
    .limit(1);
  return row?.cuentaId ?? null;
}
