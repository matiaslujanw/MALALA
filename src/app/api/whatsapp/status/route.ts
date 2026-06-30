/**
 * Proxy del estado de conexión del worker de WhatsApp.
 *
 * El navegador no puede pegarle directo al worker (CORS + no exponemos su URL),
 * así que la app hace de intermediaria. Gateado a admin/encargada con acceso a
 * la sucursal.
 */

import { NextResponse } from "next/server";
import { requireRole } from "@/lib/data/_helpers";
import { buildAccessScope, isSucursalAllowed } from "@/lib/auth/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  let user;
  try {
    user = await requireRole(["admin", "encargada"]);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const scope = buildAccessScope(user);

  const sucursalId = new URL(request.url).searchParams.get("sucursal");
  if (!sucursalId || !isSucursalAllowed(scope, sucursalId)) {
    return NextResponse.json({ error: "Sucursal inválida" }, { status: 403 });
  }

  const base = process.env.WHATSAPP_WORKER_URL?.replace(/\/$/, "");
  if (!base) {
    return NextResponse.json(
      { status: "closed", error: "Worker no configurado" },
      { status: 200 },
    );
  }

  try {
    const res = await fetch(
      `${base}/status?sucursal=${encodeURIComponent(sucursalId)}`,
      { cache: "no-store" },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json(
      { status: "closed", error: "No se pudo contactar el worker" },
      { status: 200 },
    );
  }
}
