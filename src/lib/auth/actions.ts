"use server";

import { redirect } from "next/navigation";
import {
  clearSession,
  setActiveSucursal,
  setSession,
} from "./session";

export async function loginAs(userId: string) {
  await setSession(userId);
  redirect("/dashboard");
}

export async function logout() {
  await clearSession();
  redirect("/dev/login");
}

export async function switchSucursal(sucursalId: string) {
  await setActiveSucursal(sucursalId);
}
