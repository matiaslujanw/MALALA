import { NextResponse } from "next/server";
import { getSlotsDisponiblesPorToken } from "@/lib/data/turnos-publico";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const fecha = url.searchParams.get("fecha");

  if (!token || !fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ slots: [] }, { status: 400 });
  }

  const slots = await getSlotsDisponiblesPorToken({ token, fecha });
  return NextResponse.json({ slots });
}
