import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { tomarPendientesPorEndpoint } from "@/lib/integraciones/push";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { endpoint?: string };
  if (!body.endpoint) {
    return NextResponse.json({ error: "Endpoint requerido" }, { status: 400 });
  }

  const notifications = await tomarPendientesPorEndpoint({
    endpoint: body.endpoint,
    userId: user.id,
  });

  return NextResponse.json({ notifications });
}
