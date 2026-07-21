/**
 * Datos editoriales de la landing que todavía no viven en la base.
 *
 * Cuando estén las fotos definitivas, se copian a `public/landing/…` y se
 * completan las rutas acá: es el único archivo que hay que tocar. Mientras el
 * campo quede vacío, la landing dibuja un placeholder monocromo en su lugar.
 */

/** Handles de Instagram por sucursal. La clave es el id de la sucursal. */
export const INSTAGRAM_POR_SUCURSAL: Record<string, string> = {
  "seed-000001": "malalaclubdebelleza",
  "seed-000002": "malala.yb",
};

/** Foto de portada por sucursal (id → ruta en /public). */
export const FOTO_POR_SUCURSAL: Record<string, string> = {
  // Centro: falta foto real → cae al placeholder monocromo.
  // "seed-000001": "/landing/sucursal-centro.jpg",
  "seed-000002": "/landing/sucursal-yerba-buena.jpg",
};

/**
 * Tiles de la sección Servicios. El orden define el orden en pantalla y
 * `rubros` es lo que enlaza el tile con los servicios reales del catálogo
 * (campo `rubro`), para que el botón abra la reserva ya filtrada.
 */
export interface TileServicio {
  label: string;
  rubros: string[];
  imagen?: string;
}

export const TILES_SERVICIOS: TileServicio[] = [
  { label: "Nails", rubros: ["MANOS", "PIES", "UÑAS", "NAILS"], imagen: "/landing/servicio-nails.jpg" },
  { label: "Faciales", rubros: ["FACIAL", "FACIALES", "COSMETOLOGIA", "COSMETOLOGÍA"], imagen: "/landing/servicio-faciales.jpg" },
  { label: "Cejas", rubros: ["CEJAS", "PESTAÑAS", "MIRADA"], imagen: "/landing/servicio-cejas.jpg" },
  { label: "Hair", rubros: ["PELUQUERIA", "PELUQUERÍA", "HAIR", "CABELLO", "COLOR"], imagen: "/landing/servicio-hair.jpg" },
  { label: "Masajes", rubros: ["MASAJES", "CORPORAL", "CORPORALES", "SPA"], imagen: "/landing/servicio-masajes.jpg" },
];

/** Bloque de promociones del mes. `lineas` se apila centrado sobre el marrón. */
export const PROMOCIONES = {
  titulo: "Promociones del mes",
  lineas: [
    "Todos los miércoles",
    "15% OFF + 3 cuotas sin interés",
    "Tarjetas de crédito",
    "Visa · Master",
  ],
};

/** Frase del hero y tienda online. */
export const HERO_TAGLINE = [
  "Tu momento de belleza,",
  "cuidado y bienestar.",
  "Todo en un solo lugar.",
];
