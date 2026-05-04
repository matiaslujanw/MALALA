"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/db/client/supabase-server";
import { requireSupabaseRuntime } from "@/lib/db/env";
import { clearSession, setActiveSucursal } from "./session";

function buildLoginErrorUrl(message: string) {
  return `/dev/login?error=${encodeURIComponent(message)}`;
}

export async function loginWithPassword(formData: FormData) {
  try {
    requireSupabaseRuntime("El login interno solo funciona con Supabase Auth.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Supabase no esta configurado.";
    redirect(buildLoginErrorUrl(message));
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(buildLoginErrorUrl("Ingresa email y contrasena."));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(buildLoginErrorUrl(error.message));
  }

  redirect("/dashboard");
}

export async function logout() {
  await clearSession();
  redirect("/dev/login");
}

export async function switchSucursal(sucursalId: string) {
  await setActiveSucursal(sucursalId);
}
