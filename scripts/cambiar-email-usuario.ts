/**
 * Cambia el email (y opcionalmente el nombre) de un usuario del sistema.
 *
 * El email vive en cuatro lugares que tienen que quedar consistentes:
 *   - auth.users.email
 *   - auth.users.raw_user_meta_data (de ahí sale el nombre)
 *   - auth.identities.identity_data (el proveedor "email")
 *   - profiles.email / profiles.nombre
 *
 * Por eso el cambio va por la API admin de Supabase (que actualiza auth.users y
 * auth.identities juntos) y recién después se actualiza `profiles`. Tocar
 * auth.users con un UPDATE suelto deja la identity con el mail viejo y el login
 * empieza a fallar de formas raras.
 *
 * La contraseña NO cambia: la persona sigue entrando con la misma, pero con el
 * email nuevo.
 *
 * Dry-run salvo --commit.
 * Uso:
 *   npx tsx scripts/cambiar-email-usuario.ts <email-actual> [--email <nuevo>] [--nombre "Nombre Nuevo"] [--commit]
 */
import "../envConfig";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";
import { createSupabaseAdminClient } from "../src/lib/db/client/supabase-admin";
import { profiles as profilesTable } from "../src/lib/db/schema";

async function main() {
  const argv = process.argv.slice(2);
  const commit = argv.includes("--commit");
  const valor = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const emailNuevo = valor("--email");
  const nombreNuevo = valor("--nombre");
  const emailActual = argv.find(
    (a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"),
  );

  if (!emailActual || (!emailNuevo && !nombreNuevo)) {
    console.error(
      'Uso: npx tsx scripts/cambiar-email-usuario.ts <email-actual> [--email <nuevo>] [--nombre "Nombre"] [--commit]',
    );
    process.exit(1);
  }

  const db = getDb();
  const [perfil] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.email, emailActual))
    .limit(1);

  if (!perfil) {
    console.error(`No hay ningún perfil con el email ${emailActual}.`);
    await getSqlClient().end({ timeout: 5 });
    process.exit(1);
  }

  // El choque puede estar en `profiles` o en auth.users (una cuenta de auth sin
  // perfil sigue ocupando el email y la API admin devuelve un 500 opaco).
  if (emailNuevo) {
    const ocupado = (await db.execute(
      sql`select u.id, u.created_at,
                 (select count(*) from profiles p where p.user_id = u.id)::int perfiles
            from auth.users u where u.email = ${emailNuevo}`,
    )) as unknown as Array<{ id: string; created_at: string; perfiles: number }>;
    if (ocupado.length) {
      const o = ocupado[0];
      console.error(`\n⚠ El email ${emailNuevo} ya está tomado en auth.users:`);
      console.error(
        `    id ${o.id} · creado ${o.created_at} · ${o.perfiles} perfil/es en el sistema`,
      );
      console.error(
        o.perfiles === 0
          ? "  Es una cuenta huérfana (no puede entrar a la app porque no tiene perfil).\n  Hay que borrarla o liberar el email antes de reasignarlo."
          : "  Es una cuenta en uso: no se puede reasignar el email.",
      );
      await getSqlClient().end({ timeout: 5 });
      process.exit(1);
    }
  }

  console.log("=== CAMBIO DE USUARIO ===");
  console.log(`  user_id:  ${perfil.userId}`);
  console.log(`  email:    ${perfil.email}  →  ${emailNuevo ?? "(sin cambios)"}`);
  console.log(
    `  nombre:   ${perfil.nombre}  →  ${nombreNuevo ?? "(sin cambios)"}`,
  );
  console.log(`  rol:      ${perfil.rol} · sucursal ${perfil.sucursalDefaultId}`);
  console.log(`\n  Modo: ${commit ? "COMMIT" : "DRY-RUN"}`);

  if (!commit) {
    console.log("\nDRY-RUN: no se tocó nada. Corré con --commit.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(perfil.userId, {
    // Sin email_confirm Supabase deja el mail nuevo pendiente de confirmación y
    // el login sigue pidiendo el viejo.
    ...(emailNuevo ? { email: emailNuevo, email_confirm: true } : {}),
    ...(nombreNuevo ? { user_metadata: { nombre: nombreNuevo } } : {}),
  });
  if (error) {
    console.error(`Falló la API admin de Supabase: ${error.message}`);
    await getSqlClient().end({ timeout: 5 });
    process.exit(1);
  }

  await db
    .update(profilesTable)
    .set({
      ...(emailNuevo ? { email: emailNuevo } : {}),
      ...(nombreNuevo ? { nombre: nombreNuevo } : {}),
    })
    .where(eq(profilesTable.userId, perfil.userId));

  console.log(
    `\n✔ Actualizado. Entra con ${emailNuevo ?? perfil.email} y la MISMA contraseña de antes.`,
  );
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
