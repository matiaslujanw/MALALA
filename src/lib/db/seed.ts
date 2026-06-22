import "../../../envConfig";
import { seed as buildMockSeed } from "../mock/seed";
import { getSqlClient, getDb } from "./client/postgres";
import { createSupabaseAdminClient } from "./client/supabase-admin";
import { profiles, sucursales } from "./schema";

const DEFAULT_SEED_PASSWORD = process.env.MALALA_SEED_PASSWORD ?? "ChangeMe123!";

async function ensureAuthUsers(
  emails: Array<{ email: string; nombre: string }>,
) {
  const supabase = createSupabaseAdminClient();
  const existing = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (existing.error) {
    throw existing.error;
  }

  const userMap = new Map(
    (existing.data.users ?? []).map((item) => [item.email?.toLowerCase(), item]),
  );

  const result = new Map<string, string>();

  for (const item of emails) {
    const key = item.email.toLowerCase();
    let authUser = userMap.get(key);

    if (!authUser) {
      const created = await supabase.auth.admin.createUser({
        email: item.email,
        password: DEFAULT_SEED_PASSWORD,
        email_confirm: true,
        user_metadata: { nombre: item.nombre },
      });

      if (created.error || !created.data.user) {
        throw created.error ?? new Error(`No se pudo crear ${item.email}`);
      }

      authUser = created.data.user;
      userMap.set(key, authUser);
    } else {
      const updated = await supabase.auth.admin.updateUserById(authUser.id, {
        password: DEFAULT_SEED_PASSWORD,
        email_confirm: true,
        user_metadata: {
          ...(authUser.user_metadata ?? {}),
          nombre: item.nombre,
        },
      });

      if (updated.error) {
        throw updated.error;
      }
    }

    result.set(item.email, authUser.id);
  }

  return result;
}

// Todas las tablas de la app (schema public) que el seed limpia. Se vacían con
// un único TRUNCATE ... CASCADE: el CASCADE resuelve el orden de las FKs y, si
// alguna tabla nueva no estuviera listada, igual queda vacía por la dependencia.
// No toca auth.users (lo gestiona ensureAuthUsers).
const APP_TABLES = [
  "turno_eventos",
  "turnos",
  "anticipos",
  "liquidacion_lineas",
  "liquidaciones",
  "movimientos_cc",
  "movimientos_bancarios",
  "cierre_caja_cuentas",
  "apertura_caja_cuentas",
  "aperturas_caja",
  "cierres_caja",
  "ingreso_lineas",
  "ingresos",
  "egresos",
  "movimientos_stock",
  "stock_sucursal",
  "recetas",
  "promocion_items",
  "profesionales_servicios",
  "profesionales_horarios",
  "profesionales_agenda",
  "servicios_horarios",
  "horarios_sucursal",
  "cuentas_bancarias",
  "motivos_descuento",
  "rubros_gasto",
  "medios_pago",
  "insumos",
  "servicios",
  "cliente_ficha_registros",
  "clientes",
  "proveedores",
  "whatsapp_envios",
  "integraciones_manychat",
  "push_notification_queue",
  "push_subscriptions",
  "profiles",
  "empleados",
  "sucursales",
] as const;

async function clearAppTables() {
  const sql = getSqlClient();
  const tableList = APP_TABLES.map((name) => `"${name}"`).join(", ");
  await sql.unsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
}

// Seed mínimo: deja la base limpia con SOLO los usuarios y las 2 sucursales que
// esos usuarios necesitan (sucursal_default_id). El resto de los datos
// (empleados, servicios, insumos, medios de pago, rubros, clientes, etc.) se
// cargan a mano desde la app para testear los flujos reales.
async function main() {
  const snapshot = buildMockSeed();
  const db = getDb();

  const authUsersByEmail = await ensureAuthUsers(
    snapshot.usuarios.map((item) => ({
      email: item.email,
      nombre: item.nombre,
    })),
  );

  const userIdByLegacyId = new Map<string, string>();
  for (const item of snapshot.usuarios) {
    const authUserId = authUsersByEmail.get(item.email);
    if (!authUserId) {
      throw new Error(`No se encontro auth.users para ${item.email}`);
    }
    userIdByLegacyId.set(item.id, authUserId);
  }

  await clearAppTables();

  await db.insert(sucursales).values(
    snapshot.sucursales.map((item) => ({
      id: item.id,
      nombre: item.nombre,
      activo: item.activo,
      slug: item.slug ?? null,
      direccion: item.direccion ?? null,
      telefono: item.telefono ?? null,
      horarioResumen: item.horario_resumen ?? null,
      rating: item.rating ?? null,
      reviews: item.reviews ?? null,
      mapaUrl: item.mapa_url ?? null,
      descripcionCorta: item.descripcion_corta ?? null,
    })),
  );

  await db.insert(profiles).values(
    snapshot.usuarios.map((item) => ({
      userId: userIdByLegacyId.get(item.id)!,
      email: item.email,
      nombre: item.nombre,
      rol: item.rol,
      sucursalDefaultId: item.sucursal_default_id,
      empleadoId: null,
      activo: item.activo,
    })),
  );

  console.log(
    `Seed minimo completado: ${snapshot.sucursales.length} sucursales y ${snapshot.usuarios.length} usuarios. Sin datos operativos: cargalos a mano desde la app.`,
  );
}

main()
  .catch((error) => {
    console.error("Fallo el seed de Supabase/Drizzle:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getSqlClient().end({ timeout: 5 });
  });
