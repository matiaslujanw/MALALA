import { NextResponse } from "next/server";
import { getActiveSucursal, requireUser } from "@/lib/auth/session";
import { buildAccessScope } from "@/lib/auth/access";
import { getToolEntry, roleAllowed } from "@/lib/admin-chat/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExecuteBody {
  tool: string;
  args: Record<string, unknown>;
}

/**
 * Ejecuta una acción de escritura previamente confirmada por el usuario.
 * Segunda fase del flujo de confirmación: el front llama acá sólo después
 * de que el usuario apretó "Confirmar". La action subyacente vuelve a
 * validar rol + sucursal, así que es defensa en profundidad.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  const scope = buildAccessScope(user);

  const body = (await req.json().catch(() => null)) as ExecuteBody | null;
  if (!body?.tool) {
    return NextResponse.json({ error: "tool requerido" }, { status: 400 });
  }

  const entry = getToolEntry(body.tool);
  if (!entry || entry.mode !== "write") {
    return NextResponse.json(
      { error: "Acción no válida" },
      { status: 400 },
    );
  }
  if (!roleAllowed(entry.roles, scope.rol)) {
    return NextResponse.json(
      { error: "No tenés permiso para esta acción" },
      { status: 403 },
    );
  }

  // Confinamiento por sucursal activa: la tool fuerza la sucursal y, para
  // acciones por turno_id, valida que pertenezca a esta sucursal.
  const sucursalActiva = await getActiveSucursal();
  if (!sucursalActiva) {
    return NextResponse.json(
      { error: "No hay una sucursal activa en la sesión" },
      { status: 400 },
    );
  }

  try {
    const result = await entry.execute(body.args ?? {}, {
      sucursalId: sucursalActiva.id,
    });
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
