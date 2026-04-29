/**
 * Helpers compartidos por la capa de datos.
 */
import { requireUser } from "@/lib/auth/session";
import type { Rol, Usuario } from "@/lib/types";

export type ActionResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string[]> };

export function fieldErrors(err: unknown): Record<string, string[]> {
  if (err && typeof err === "object" && "issues" in err) {
    const issues = (
      err as { issues: { path: (string | number)[]; message: string }[] }
    ).issues;
    const out: Record<string, string[]> = {};
    for (const i of issues) {
      const key = i.path.join(".") || "_";
      (out[key] ??= []).push(i.message);
    }
    return out;
  }
  return { _: ["Error desconocido"] };
}

export function failure(msg: string): ActionResult {
  return { ok: false, errors: { _: [msg] } };
}

export async function requireRole(roles: Rol[]): Promise<Usuario> {
  const user = await requireUser();
  if (!roles.includes(user.rol)) {
    throw new Error(`Permiso denegado. Se requiere: ${roles.join(", ")}`);
  }
  return user;
}

export function normPhone(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  // Convertir a E.164 si parece argentino sin código país (heurística simple)
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  // Si arranca con 0 o 15, asumir Argentina
  if (/^\d{8,}$/.test(digits)) return `+549${digits.replace(/^0|^15/, "")}`;
  return digits;
}

export function s(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const t = input.trim();
  return t || undefined;
}
