/**
 * Carga de servicios/empleadas/horarios de Malala Yerba Buena (seed-000002) desde
 * la info pública de Calendico (https://calendico.com/malala-yerba-buena/...).
 *
 * En YB el precio mostrado en Calendico = precio LISTA (tarjeta) y hay 20% off
 * pagando en efectivo/transferencia => precio_efectivo = round(lista * 0.8).
 *
 * NO toca los clientes de YB. Idempotente para los servicios/empleadas/horarios
 * de YB. Corre dry-run salvo --commit.
 * Uso: npx tsx scripts/import-yb-calendico.ts [--commit]
 */
import "../envConfig";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, getSqlClient } from "../src/lib/db/client/postgres";
import {
  sucursales,
  horariosSucursal,
  servicios as serviciosTable,
  servicioSucursal as servicioSucursalTable,
  empleados as empleadosTable,
} from "../src/lib/db/schema";

const YB_ID = "seed-000002";
const OFF = 0.2; // 20% off efectivo/transferencia

// lista = precio tarjeta (lo que muestra Calendico). dur = minutos. lista 0 = "a consultar".
type Svc = { rubro: string; nombre: string; lista: number; dur: number };

const SERVICIOS: Svc[] = [
  // --- Cejas y Pestañas ---
  { rubro: "CEJAS Y PESTAÑAS", nombre: "Laminado de cejas", lista: 23375, dur: 60 },
  { rubro: "CEJAS Y PESTAÑAS", nombre: "Diseño y perfilado de cejas", lista: 17875, dur: 60 },
  { rubro: "CEJAS Y PESTAÑAS", nombre: "Lifting de Pestañas", lista: 27500, dur: 60 },
  { rubro: "CEJAS Y PESTAÑAS", nombre: "Promo Laminado y Perfilado Cejas", lista: 38500, dur: 60 },
  { rubro: "CEJAS Y PESTAÑAS", nombre: "Lifting Coreano", lista: 41250, dur: 30 },
  // --- Color y Mechas ---
  { rubro: "COLOR Y MECHAS", nombre: "Gloss", lista: 60500, dur: 60 },
  { rubro: "COLOR Y MECHAS", nombre: "Aplicación color", lista: 50875, dur: 60 },
  { rubro: "COLOR Y MECHAS", nombre: "Color raíz", lista: 60500, dur: 60 },
  { rubro: "COLOR Y MECHAS", nombre: "Color global", lista: 78375, dur: 60 },
  { rubro: "COLOR Y MECHAS", nombre: "Color Global (s/amoníaco)", lista: 90750, dur: 60 },
  { rubro: "COLOR Y MECHAS", nombre: "Color vincha", lista: 55000, dur: 60 },
  { rubro: "COLOR Y MECHAS", nombre: "Reflejo/Iluminación", lista: 136126, dur: 90 },
  { rubro: "COLOR Y MECHAS", nombre: "Balayage/mechas con papel", lista: 181500, dur: 90 },
  { rubro: "COLOR Y MECHAS", nombre: "Lavado especial (Wella)", lista: 60500, dur: 60 },
  { rubro: "COLOR Y MECHAS", nombre: "Color Raíz (s/amoniaco)", lista: 68750, dur: 60 },
  // --- Depilación con cera ---
  { rubro: "DEPILACIÓN CON CERA", nombre: "Depilación de bozo (labio superior)", lista: 17875, dur: 30 },
  { rubro: "DEPILACIÓN CON CERA", nombre: "Depilación de mentón", lista: 17875, dur: 30 },
  // --- Estética ---
  { rubro: "ESTÉTICA", nombre: "Toxina Botulínica (arrugas dinámicas: frente, entrecejo, patas de gallo)", lista: 312500, dur: 60 },
  { rubro: "ESTÉTICA", nombre: "Rinofiller - Modelado Nasal no quirúrgico (Ácido Hialurónico)", lista: 312500, dur: 60 },
  { rubro: "ESTÉTICA", nombre: "Relleno de Labios (Ácido Hialurónico)", lista: 312500, dur: 60 },
  { rubro: "ESTÉTICA", nombre: "Relleno Facial (Ácido Hialurónico) - a consultar", lista: 0, dur: 60 },
  { rubro: "ESTÉTICA", nombre: "Plasma Rico en Plaquetas - Facial", lista: 62500, dur: 60 },
  { rubro: "ESTÉTICA", nombre: "Plasma Rico en Plaquetas - Capilar", lista: 62500, dur: 60 },
  { rubro: "ESTÉTICA", nombre: "Microneedling", lista: 62500, dur: 60 },
  { rubro: "ESTÉTICA", nombre: "Retoque Toxina Botulínica - a consultar", lista: 0, dur: 30 },
  // --- Masajes ---
  { rubro: "MASAJES", nombre: "Masajes Relajantes 30 min", lista: 23375, dur: 30 },
  { rubro: "MASAJES", nombre: "Masajes Relajantes 1 h", lista: 42625, dur: 60 },
  { rubro: "MASAJES", nombre: "Masajes Descontracturantes 30 min", lista: 23375, dur: 30 },
  { rubro: "MASAJES", nombre: "Masajes Descontracturantes 1 h", lista: 42625, dur: 60 },
  { rubro: "MASAJES", nombre: "Masajes Deportivos 30 min", lista: 23375, dur: 30 },
  { rubro: "MASAJES", nombre: "Masajes Deportivos 1 h", lista: 42625, dur: 60 },
  // --- Promos Hair ---
  { rubro: "PROMOS HAIR", nombre: "Nutri + Corte", lista: 60500, dur: 60 },
  { rubro: "PROMOS HAIR", nombre: "Color raíz + Corte + Nutri + Brushing + Planchita", lista: 90750, dur: 60 },
  { rubro: "PROMOS HAIR", nombre: "Keraplex + Corte", lista: 90750, dur: 60 },
  { rubro: "PROMOS HAIR", nombre: "Reflejos + Corte + Nutrición reparadora + Brushing + Planchita", lista: 199375, dur: 90 },
  { rubro: "PROMOS HAIR", nombre: "Balayage + Nutrición reparadora + Corte + Gloss + Ondas", lista: 247500, dur: 90 },
  // --- Promos Nails ---
  { rubro: "PROMOS NAILS", nombre: "Podo + esmaltado tradicional", lista: 38500, dur: 60 },
  { rubro: "PROMOS NAILS", nombre: "Promo semi manos + pies", lista: 55000, dur: 90 },
  { rubro: "PROMOS NAILS", nombre: "Promo manos y pies tradicional", lista: 44000, dur: 90 },
  // --- Servicio de Peluquería ---
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Lavado + Brushing + planchita", lista: 38750, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Corte", lista: 53625, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Peinado", lista: 56250, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Nutrición Intensa Wella", lista: 90750, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Keraplex (Tratamiento Antifrizz)", lista: 66000, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Lumino Liss (Alisado sin formol)", lista: 121000, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Nutrición Colágeno", lista: 55000, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Nutrición Intensa Olaplex", lista: 144375, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Lavado especial (L'Oréal)", lista: 48125, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Lavado + Brushing", lista: 38500, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Mechas contorno", lista: 90750, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Mechas frontal", lista: 83875, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Tono sobre tono - a consultar", lista: 0, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Tratamiento Wella Fusion", lista: 78375, dur: 45 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Células Madre ALFAPARF", lista: 85250, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Nutrición Two Bonacure Schwarzkopf (reparación y sellado)", lista: 72600, dur: 45 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Nutrición FibreClinix (Reparación Profunda Schwarzkopf)", lista: 82500, dur: 45 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Tratamiento L'Oréal Absolute Molecular", lista: 103125, dur: 30 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Corte Flequillo", lista: 15125, dur: 15 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Gloss L'Oréal", lista: 68750, dur: 60 },
  { rubro: "SERVICIOS DE PELUQUERÍA", nombre: "Corte Kids", lista: 20625, dur: 60 },
  // --- Servicios Nails ---
  { rubro: "SERVICIOS NAILS", nombre: "Esmaltado Tradicional (manos)", lista: 23375, dur: 60 },
  { rubro: "SERVICIOS NAILS", nombre: "Esmaltado Semi (manos)", lista: 27500, dur: 60 },
  { rubro: "SERVICIOS NAILS", nombre: "Esculpidas - Soft Gel", lista: 38500, dur: 90 },
  { rubro: "SERVICIOS NAILS", nombre: "Kapping", lista: 33000, dur: 60 },
  { rubro: "SERVICIOS NAILS", nombre: "Remoción semi", lista: 9625, dur: 30 },
  { rubro: "SERVICIOS NAILS", nombre: "Remoción soft", lista: 12375, dur: 30 },
  { rubro: "SERVICIOS NAILS", nombre: "Esmaltado Tradicional (pies)", lista: 22500, dur: 60 },
  { rubro: "SERVICIOS NAILS", nombre: "Esmaltado Semi (pies)", lista: 23375, dur: 60 },
  { rubro: "SERVICIOS NAILS", nombre: "Podo + esmaltado semi pies", lista: 53625, dur: 60 },
];

// Horarios según Calendico (verificar): lun-sáb 09-21, domingo cerrado.
const HORARIOS = [1, 2, 3, 4, 5, 6].map((dia) => ({ dia, ap: "09:00", ci: "21:00" }));

const EMPLEADAS = ["Celeste", "Anita", "Priscila", "Carolina", "Camila", "Dra. Angela", "Fatyma"];

async function main() {
  const commit = process.argv.includes("--commit");
  const db = getDb();

  console.log("=== A CARGAR EN MALALA YERBA BUENA ===");
  console.log(`  Servicios: ${SERVICIOS.length}`);
  console.log(`  Rubros: ${[...new Set(SERVICIOS.map((s) => s.rubro))].length}`);
  console.log(`  A consultar (precio 0): ${SERVICIOS.filter((s) => s.lista === 0).length}`);
  console.log(`  Horarios: ${HORARIOS.length} días | Empleadas: ${EMPLEADAS.length}`);
  console.log(`  Modo: ${commit ? "COMMIT" : "DRY-RUN"}`);
  if (!commit) {
    console.log("\nDRY-RUN: no se tocó la base. Corré con --commit.");
    await getSqlClient().end({ timeout: 5 });
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(sucursales)
      .set({ rating: 4.8, reviews: 434 })
      .where(eq(sucursales.id, YB_ID));

    await tx.delete(horariosSucursal).where(eq(horariosSucursal.sucursalId, YB_ID));
    await tx.insert(horariosSucursal).values(
      HORARIOS.map((h) => ({
        id: crypto.randomUUID(),
        sucursalId: YB_ID,
        diaSemana: h.dia,
        apertura: h.ap,
        cierre: h.ci,
      })),
    );

    // Servicios (reemplazo de los de YB).
    const ybServ = await tx
      .select({ id: servicioSucursalTable.servicioId })
      .from(servicioSucursalTable)
      .where(eq(servicioSucursalTable.sucursalId, YB_ID));
    const ids = ybServ.map((r) => r.id);
    if (ids.length) await tx.delete(serviciosTable).where(inArray(serviciosTable.id, ids));

    const nuevos = SERVICIOS.map((s) => ({
      id: crypto.randomUUID(),
      rubro: s.rubro,
      nombre: s.nombre,
      precioLista: s.lista,
      precioEfectivo: s.lista === 0 ? 0 : Math.round(s.lista * (1 - OFF)),
      comisionDefaultPct: 0,
      duracionMin: s.dur,
      activo: true,
      esPromo: false,
    }));
    await tx.insert(serviciosTable).values(nuevos);
    await tx.insert(servicioSucursalTable).values(
      nuevos.map((n) => ({ id: crypto.randomUUID(), servicioId: n.id, sucursalId: YB_ID })),
    );

    // Empleadas de YB sin acceso.
    await tx.delete(empleadosTable).where(and(eq(empleadosTable.sucursalPrincipalId, YB_ID)));
    await tx.insert(empleadosTable).values(
      EMPLEADAS.map((nombre) => ({
        id: crypto.randomUUID(),
        nombre,
        activo: true,
        sucursalPrincipalId: YB_ID,
        tipoComision: "porcentaje" as const,
        porcentajeDefault: 0,
      })),
    );
  });

  console.log("\n✔ Yerba Buena cargada en una transacción (clientes intactos).");
  await getSqlClient().end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
