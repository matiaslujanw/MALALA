/**
 * Carga de la sucursal Malala Centro (seed-000001) a partir de la info pública de
 * Calendico (https://calendico.com/malala-centro/malala-centro):
 *   - Datos de sucursal (dirección, rating, reviews)
 *   - Horarios de atención
 *   - Servicios con precio efectivo (contado, 20% off), precio lista (tarjeta) y duración
 *   - Empleadas (sin acceso: solo fila en `empleados`, sin profile/login)
 *
 * Idempotente para Centro: borra lo que hubiera cargado antes en Centro y recarga.
 * NO toca Yerba Buena ni los clientes.
 *
 * Corre dry-run salvo --commit.
 * Uso: npx tsx scripts/import-centro.ts [--commit]
 */
import "../envConfig";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";
import {
  sucursales,
  horariosSucursal,
  servicios as serviciosTable,
  servicioSucursal as servicioSucursalTable,
  empleados as empleadosTable,
} from "../src/lib/db/schema";

const CENTRO_ID = "seed-000001";

// ef = precio efectivo (contado). lista = precio tarjeta (si se omite, = ef). dur = minutos.
type Svc = { rubro: string; nombre: string; ef: number; lista?: number; dur: number };

const SERVICIOS: Svc[] = [
  // --- Belleza de manos y pies ---
  { rubro: "BELLEZA DE MANOS Y PIES", nombre: "Esmalte común - Manos", ef: 18000, lista: 22500, dur: 45 },
  { rubro: "BELLEZA DE MANOS Y PIES", nombre: "Esmaltado Semi (manos o pies)", ef: 20000, lista: 25000, dur: 45 },
  { rubro: "BELLEZA DE MANOS Y PIES", nombre: "Escúlpidas / softgel", ef: 25000, lista: 31250, dur: 75 },
  { rubro: "BELLEZA DE MANOS Y PIES", nombre: "Polygel", ef: 29000, lista: 36250, dur: 60 },
  { rubro: "BELLEZA DE MANOS Y PIES", nombre: "Kapping", ef: 24000, lista: 30000, dur: 60 },
  { rubro: "BELLEZA DE MANOS Y PIES", nombre: "Pack semipermanente (manos + pies)", ef: 38000, lista: 47500, dur: 90 },
  { rubro: "BELLEZA DE MANOS Y PIES", nombre: "Pack esmalte común (manos + pies)", ef: 35000, lista: 43750, dur: 90 },
  { rubro: "BELLEZA DE MANOS Y PIES", nombre: "Remoción Kapping", ef: 8750, dur: 30 },
  { rubro: "BELLEZA DE MANOS Y PIES", nombre: "Podoestética", ef: 25000, lista: 31250, dur: 70 },
  { rubro: "BELLEZA DE MANOS Y PIES", nombre: "Podo + semi o tradicional", ef: 37000, lista: 46250, dur: 90 },
  { rubro: "BELLEZA DE MANOS Y PIES", nombre: "Remoción semi", ef: 6000, lista: 7500, dur: 30 },
  { rubro: "BELLEZA DE MANOS Y PIES", nombre: "Remoción soft", ef: 8000, lista: 10000, dur: 30 },
  { rubro: "BELLEZA DE MANOS Y PIES", nombre: "Reconstrucción por uña", ef: 3500, lista: 4375, dur: 30 },
  // --- Cejas y Pestañas ---
  { rubro: "CEJAS Y PESTAÑAS", nombre: "Diseño y perfilado de cejas", ef: 15000, lista: 18750, dur: 20 },
  { rubro: "CEJAS Y PESTAÑAS", nombre: "Laminado", ef: 18000, lista: 22500, dur: 45 },
  { rubro: "CEJAS Y PESTAÑAS", nombre: "Lifting de pestañas", ef: 20000, lista: 25000, dur: 60 },
  { rubro: "CEJAS Y PESTAÑAS", nombre: "Extensión de pestañas clásicas", ef: 20000, lista: 25000, dur: 60 },
  { rubro: "CEJAS Y PESTAÑAS", nombre: "Extensión de pestañas híbridas", ef: 23000, lista: 28750, dur: 60 },
  { rubro: "CEJAS Y PESTAÑAS", nombre: "Laminado y perfilado de cejas", ef: 28000, lista: 35000, dur: 60 },
  { rubro: "CEJAS Y PESTAÑAS", nombre: "Volumen (pestañas)", ef: 26000, lista: 32500, dur: 60 },
  // --- Facial ---
  { rubro: "FACIAL", nombre: "Limpieza profunda / punta de diamante", ef: 26880, lista: 33600, dur: 60 },
  { rubro: "FACIAL", nombre: "Dermaplaning", ef: 24960, lista: 31200, dur: 60 },
  { rubro: "FACIAL", nombre: "Full Facial Limpieza Profunda + Dermaplaning", ef: 31680, lista: 39600, dur: 60 },
  { rubro: "FACIAL", nombre: "Maquillaje social", ef: 75000, dur: 30 },
  // --- Promo Hair ---
  { rubro: "PROMO HAIR", nombre: "Color raíz + Corte + Nutri + Brushing + Planchita", ef: 70000, lista: 87500, dur: 90 },
  { rubro: "PROMO HAIR", nombre: "Color raíz + nutrición + brushing + planchita", ef: 50000, lista: 62500, dur: 60 },
  { rubro: "PROMO HAIR", nombre: "Color raíz + corte + brushing + planchita", ef: 60000, lista: 75000, dur: 60 },
  { rubro: "PROMO HAIR", nombre: "Keraplex + corte", ef: 65000, lista: 81250, dur: 60 },
  { rubro: "PROMO HAIR", nombre: "Reflejos + corte + colágeno + brushing + planchita", ef: 130000, lista: 162500, dur: 60 },
  { rubro: "PROMO HAIR", nombre: "Balayage + gloss + Nutrición + Corte + Ondas", ef: 160000, lista: 200000, dur: 60 },
  { rubro: "PROMO HAIR", nombre: "Reflejos + color + nutri + brushing 1", ef: 100000, lista: 125000, dur: 60 },
  { rubro: "PROMO HAIR", nombre: "Nutri común + corte", ef: 40000, lista: 50000, dur: 60 },
  // --- Servicios de peluquería ---
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Corte", ef: 33000, lista: 41250, dur: 45 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Peinado para eventos", ef: 50000, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Lavado + brushing", ef: 25000, lista: 31250, dur: 45 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Nutrición Colágeno", ef: 35000, lista: 43750, dur: 50 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Nutrición", ef: 30000, lista: 37500, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Keraplex (tratamiento antifrizz)", ef: 48000, lista: 60000, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Alisado sin formol", ef: 75000, lista: 93750, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Olaplex completo", ef: 90000, lista: 112500, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Ionizado", ef: 50000, lista: 62500, dur: 45 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Nutrición intensa Wella Ultimate Repair", ef: 55000, lista: 68750, dur: 45 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Tratamiento Regenerativo Molecular Regen Force", ef: 75000, dur: 45 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Aplicación de color", ef: 33000, lista: 41250, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Nutrición intensa olaplex", ef: 90000, lista: 112500, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Color global sin amoníaco", ef: 65000, lista: 81250, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Color vincha", ef: 30000, lista: 37500, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Color raíces sin amoniaco", ef: 50000, lista: 62500, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Color en raíces (de raíz a puntas)", ef: 42000, lista: 52500, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Baño de luz (Gloss)", ef: 42000, lista: 52500, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Color Global", ef: 55000, lista: 68750, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Balayage - mechas papel (a consultar)", ef: 0, dur: 130 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Reflejos / Iluminación", ef: 95000, lista: 118750, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Mechas - Contorno (línea del flequillo)", ef: 50000, lista: 62500, dur: 90 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Mechas - Frontal (parte frontal de la cabeza)", ef: 65000, lista: 81250, dur: 90 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Decoloración raíz", ef: 70000, lista: 87500, dur: 30 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Corte y Lavado hombre", ef: 22500, dur: 30 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Decoloración raíz + color global + corte", ef: 120800, lista: 151000, dur: 70 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Colocación de plumitas", ef: 10000, dur: 5 },
];

// diaSemana: 0=domingo … 6=sábado
const HORARIOS: { dia: number; ap: string; ci: string }[] = [
  { dia: 1, ap: "14:00", ci: "21:00" }, // lunes
  { dia: 2, ap: "10:00", ci: "21:00" },
  { dia: 3, ap: "10:00", ci: "21:00" },
  { dia: 4, ap: "10:00", ci: "21:00" },
  { dia: 5, ap: "10:00", ci: "21:00" },
  { dia: 6, ap: "09:00", ci: "21:00" }, // sábado
];

const EMPLEADAS = ["Valentina", "Valeria", "Jessica", "Florencia", "Camila"];

async function main() {
  const commit = process.argv.includes("--commit");
  const db = getDb();

  console.log("=== A CARGAR EN MALALA CENTRO ===");
  console.log(`  Servicios: ${SERVICIOS.length}`);
  const rubros = [...new Set(SERVICIOS.map((s) => s.rubro))];
  console.log(`  Rubros: ${rubros.join(" | ")}`);
  console.log(`  Con precio 0 (a consultar): ${SERVICIOS.filter((s) => s.ef === 0).length}`);
  console.log(`  Horarios: ${HORARIOS.length} días`);
  console.log(`  Empleadas (sin login): ${EMPLEADAS.length}`);
  console.log(`  Modo: ${commit ? "COMMIT" : "DRY-RUN"}`);

  if (!commit) {
    console.log("\nDRY-RUN: no se tocó la base. Corré con --commit para aplicar.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }

  await db.transaction(async (tx) => {
    // 1) Datos de la sucursal.
    await tx
      .update(sucursales)
      .set({
        nombre: "Malala Centro",
        slug: "centro",
        direccion: "Corrientes 1677, San Miguel de Tucumán",
        rating: 4.9,
        reviews: 376,
      })
      .where(eq(sucursales.id, CENTRO_ID));

    // 2) Horarios (reemplazo).
    await tx.delete(horariosSucursal).where(eq(horariosSucursal.sucursalId, CENTRO_ID));
    await tx.insert(horariosSucursal).values(
      HORARIOS.map((h) => ({
        id: crypto.randomUUID(),
        sucursalId: CENTRO_ID,
        diaSemana: h.dia,
        apertura: h.ap,
        cierre: h.ci,
      })),
    );

    // 3) Servicios (reemplazo de los de Centro). Los servicios son por sucursal:
    //    borro los que estén asociados SOLO a Centro para no dejar huérfanos.
    const centroServ = await tx
      .select({ id: servicioSucursalTable.servicioId })
      .from(servicioSucursalTable)
      .where(eq(servicioSucursalTable.sucursalId, CENTRO_ID));
    const ids = centroServ.map((r) => r.id);
    if (ids.length) {
      await tx.delete(serviciosTable).where(inArray(serviciosTable.id, ids)); // cascada a servicio_sucursal
    }
    const nuevos = SERVICIOS.map((s) => ({
      id: crypto.randomUUID(),
      rubro: s.rubro,
      nombre: s.nombre,
      precioLista: s.lista ?? s.ef,
      precioEfectivo: s.ef,
      comisionDefaultPct: 0,
      duracionMin: s.dur,
      activo: true,
      esPromo: false,
    }));
    await tx.insert(serviciosTable).values(nuevos);
    await tx.insert(servicioSucursalTable).values(
      nuevos.map((n) => ({ id: crypto.randomUUID(), servicioId: n.id, sucursalId: CENTRO_ID })),
    );

    // 4) Empleadas de Centro sin acceso (solo fila en empleados, sin profile).
    await tx
      .delete(empleadosTable)
      .where(and(eq(empleadosTable.sucursalPrincipalId, CENTRO_ID)));
    await tx.insert(empleadosTable).values(
      EMPLEADAS.map((nombre) => ({
        id: crypto.randomUUID(),
        nombre,
        activo: true,
        sucursalPrincipalId: CENTRO_ID,
        tipoComision: "porcentaje" as const,
        porcentajeDefault: 0, // configurar comisión real desde la app
      })),
    );
  });

  console.log("\n✔ Centro cargado en una transacción.");
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
