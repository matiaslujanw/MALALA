import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client/postgres";
import { pushSubscriptions as pushSubscriptionsTable } from "@/lib/db/schema";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!user.empleado_id) {
    return NextResponse.json({ error: "Perfil sin empleado" }, { status: 403 });
  }

  const body = (await request.json()) as {
    endpoint?: string;
    p256dh?: string;
    auth?: string;
  };

  if (!body.endpoint || !body.p256dh || !body.auth) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const db = getDb();
  const now = new Date();
  const [existing] = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, body.endpoint))
    .limit(1);

  if (existing) {
    await db
      .update(pushSubscriptionsTable)
      .set({
        userId: user.id,
        empleadoId: user.empleado_id,
        p256dh: body.p256dh,
        auth: body.auth,
        userAgent: request.headers.get("user-agent"),
        activo: true,
        updatedAt: now,
        lastSeenAt: now,
      })
      .where(eq(pushSubscriptionsTable.id, existing.id));
  } else {
    await db.insert(pushSubscriptionsTable).values({
      id: crypto.randomUUID(),
      userId: user.id,
      empleadoId: user.empleado_id,
      endpoint: body.endpoint,
      p256dh: body.p256dh,
      auth: body.auth,
      userAgent: request.headers.get("user-agent"),
      activo: true,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => ({}))) as { endpoint?: string };
  if (!body.endpoint) {
    return NextResponse.json({ error: "Endpoint requerido" }, { status: 400 });
  }

  const db = getDb();
  await db
    .update(pushSubscriptionsTable)
    .set({
      activo: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(pushSubscriptionsTable.userId, user.id),
        eq(pushSubscriptionsTable.endpoint, body.endpoint),
      ),
    );

  return NextResponse.json({ ok: true });
}
