/**
 * Auth stub. Guarda el id de usuario en una cookie httpOnly.
 * Cuando migremos a Supabase Auth, este módulo se reemplaza.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { store } from "@/lib/mock/store";
import type { Sucursal, Usuario } from "@/lib/types";

const COOKIE_USER = "malala_user";
const COOKIE_SUCURSAL = "malala_sucursal";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export async function getCurrentUser(): Promise<Usuario | null> {
  const c = await cookies();
  const userId = c.get(COOKIE_USER)?.value;
  if (!userId) return null;
  return store.usuarios.find((u) => u.id === userId) ?? null;
}

export async function requireUser(): Promise<Usuario> {
  const user = await getCurrentUser();
  if (!user) redirect("/dev/login");
  return user;
}

export async function getActiveSucursal(): Promise<Sucursal | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const c = await cookies();
  const overrideId = c.get(COOKIE_SUCURSAL)?.value;
  const targetId = overrideId ?? user.sucursal_default_id;
  return store.sucursales.find((s) => s.id === targetId) ?? null;
}

export async function setSession(userId: string) {
  const c = await cookies();
  c.set(COOKIE_USER, userId, COOKIE_OPTS);
  // Reset sucursal override al loguearse
  c.delete(COOKIE_SUCURSAL);
}

export async function clearSession() {
  const c = await cookies();
  c.delete(COOKIE_USER);
  c.delete(COOKIE_SUCURSAL);
}

export async function setActiveSucursal(sucursalId: string) {
  const c = await cookies();
  c.set(COOKIE_SUCURSAL, sucursalId, COOKIE_OPTS);
}
