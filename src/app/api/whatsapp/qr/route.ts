/**
 * Proxy del QR de vinculación del worker de WhatsApp.
 *
 * Devuelve el QR (PNG data URL) para que la encargada vincule el número de su
 * sucursal escaneándolo. Gateado a admin/encargada con acceso a la sucursal: el
 * QR permite linkear una cuenta de WhatsApp al worker, no debe ser público.
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
      { ok: false, error: "Worker no configurado" },
      { status: 200 },
    );
  }

  try {
    const res = await fetch(
      `${base}/qr?sucursal=${encodeURIComponent(sucursalId)}`,
      { cache: "no-store" },
    );
    if (res.status === 204) {
      return NextResponse.json({ ok: true, connected: true }, { status: 200 });
    }
    const data = await res.json();
    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json(
      { ok: false, error: "No se pudo contactar el worker" },
      { status: 200 },
    );
  }
}
