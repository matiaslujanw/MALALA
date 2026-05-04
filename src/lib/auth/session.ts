import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/client/supabase-server";
import { getDb } from "@/lib/db/client/postgres";
import { requireSupabaseRuntime } from "@/lib/db/env";
import { profiles, sucursales } from "@/lib/db/schema";
import type { Sucursal, Usuario } from "@/lib/types";
import { cache } from "react";

const COOKIE_SUCURSAL = "malala_sucursal";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

const getSupabaseCurrentUser = cache(async (): Promise<Usuario | null> => {
  const cookieStore = await cookies();
  const hasSupabaseSessionCookie = cookieStore
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-"));

  if (!hasSupabaseSessionCookie) {
    return null;
  }

  requireSupabaseRuntime("La sesion interna requiere credenciales de Supabase.");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const db = getDb();
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1);

  if (!profile || !profile.activo) return null;

  const sucursalIdsPermitidas =
    profile.rol === "admin"
      ? (
          await db
            .select({ id: sucursales.id })
            .from(sucursales)
            .where(eq(sucursales.activo, true))
        ).map((item) => item.id)
      : [profile.sucursalDefaultId];

  return {
    id: profile.userId,
    email: profile.email,
    nombre: profile.nombre,
    rol: profile.rol,
    sucursal_default_id: profile.sucursalDefaultId,
    empleado_id: profile.empleadoId ?? undefined,
    sucursal_ids_permitidas: sucursalIdsPermitidas,
    activo: profile.activo,
  };
});

export async function getCurrentUser(): Promise<Usuario | null> {
  return getSupabaseCurrentUser();
}

export async function requireUser(): Promise<Usuario> {
  const user = await getCurrentUser();
  if (!user) redirect("/dev/login");
  return user;
}

const getSupabaseActiveSucursal = cache(async (user: Usuario): Promise<Sucursal | null> => {
  const c = await cookies();
  const overrideId = c.get(COOKIE_SUCURSAL)?.value;
  const permitidas =
    user.sucursal_ids_permitidas?.length
      ? user.sucursal_ids_permitidas
      : [user.sucursal_default_id];
  const targetId =
    overrideId && permitidas.includes(overrideId)
      ? overrideId
      : user.sucursal_default_id;

  const db = getDb();
  const [sucursal] = await db
    .select()
    .from(sucursales)
    .where(eq(sucursales.id, targetId))
    .limit(1);

  if (!sucursal) return null;

  return {
    id: sucursal.id,
    nombre: sucursal.nombre,
    activo: sucursal.activo,
    slug: sucursal.slug ?? undefined,
    direccion: sucursal.direccion ?? undefined,
    telefono: sucursal.telefono ?? undefined,
    horario_resumen: sucursal.horarioResumen ?? undefined,
    rating: sucursal.rating ?? undefined,
    reviews: sucursal.reviews ?? undefined,
    mapa_url: sucursal.mapaUrl ?? undefined,
    descripcion_corta: sucursal.descripcionCorta ?? undefined,
  };
});

export async function getActiveSucursalForUser(
  user: Usuario,
): Promise<Sucursal | null> {
  return getSupabaseActiveSucursal(user);
}

export async function getActiveSucursal(): Promise<Sucursal | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return getActiveSucursalForUser(user);
}

export async function clearSession() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const c = await cookies();
  c.delete(COOKIE_SUCURSAL);
}

export async function setActiveSucursal(sucursalId: string) {
  const c = await cookies();
  c.set(COOKIE_SUCURSAL, sucursalId, COOKIE_OPTS);
}
