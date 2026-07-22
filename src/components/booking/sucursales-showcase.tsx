"use client";

import Image from "next/image";
import {
  FOTO_POR_SUCURSAL,
  INSTAGRAM_POR_SUCURSAL,
} from "@/components/booking/landing-config";
import { tryNormalizarTelefonoAR } from "@/lib/phone";
import type { Sucursal } from "@/lib/types";

/** Solo aceptamos embeds de Google Maps: el `mapa_url` es editable desde la app. */
export function isSafeMapUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      (u.hostname === "www.google.com" || u.hostname === "maps.google.com")
    );
  } catch {
    return false;
  }
}

interface SucursalesShowcaseProps {
  sucursales: Sucursal[];
  onReserve: (sucursalId: string) => void;
}

export function SucursalesShowcase({
  sucursales,
  onReserve,
}: SucursalesShowcaseProps) {
  if (sucursales.length === 0) return null;

  return (
    <section id="sucursales">
      <div className="bg-ink px-5 py-4 text-center">
        <h2 className="text-[0.6rem] font-medium uppercase tracking-[0.24em] text-white sm:text-[0.72rem] sm:tracking-[0.3em]">
          Elegí el espacio que te resulte más cómodo
        </h2>
      </div>

      {/* gap-px sobre stone-100 dibuja las hairlines entre columnas y tarjetas. */}
      <div className="grid gap-px bg-stone-100 md:grid-cols-2">
        {sucursales.map((sucursal) => (
          <SucursalCard
            key={sucursal.id}
            sucursal={sucursal}
            onReserve={() => onReserve(sucursal.id)}
          />
        ))}
      </div>
    </section>
  );
}

function SucursalCard({
  sucursal,
  onReserve,
}: {
  sucursal: Sucursal;
  onReserve: () => void;
}) {
  const foto = FOTO_POR_SUCURSAL[sucursal.id];
  const instagram = INSTAGRAM_POR_SUCURSAL[sucursal.id];
  const mapa = isSafeMapUrl(sucursal.mapa_url) ? sucursal.mapa_url : null;
  const e164 = tryNormalizarTelefonoAR(sucursal.telefono);
  const whatsappVisible = e164 ? e164.replace(/^\+54(9)?/, "") : null;
  const whatsappUrl = e164
    ? `https://api.whatsapp.com/send/?phone=${e164.slice(1)}&text&type=phone_number&app_absent=0`
    : null;
  // La dirección viene como texto plano con comas; una línea por tramo.
  const lineasDireccion = (sucursal.direccion ?? "")
    .split(",")
    .map((tramo) => tramo.trim())
    .filter(Boolean);

  return (
    <article className="flex flex-col bg-white">
      {/* Foto a lo ancho con el botón montado sobre su borde inferior. */}
      <div className="relative">
        <div className="h-56 w-full overflow-hidden sm:h-64 lg:h-72">
          {foto ? (
            <Image
              src={foto}
              alt={sucursal.nombre}
              width={1286}
              height={860}
              // La foto es vertical y lo bueno (sofá, mesa, sillas) está abajo;
              // bajamos el encuadre para no mostrar solo la pared/el techo.
              className="h-full w-full object-cover object-[center_75%] grayscale"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(150deg,var(--sand)_0%,var(--brown-100)_55%,var(--sage-100)_100%)]">
              <span className="font-script text-4xl text-brown-500/70">
                {sucursal.nombre}
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onReserve}
          className="absolute bottom-0 left-5 z-10 translate-y-1/2 rounded-lg bg-ink px-6 py-3 text-[0.6rem] font-medium uppercase tracking-[0.18em] text-white shadow-[0_10px_24px_rgba(43,34,26,0.25)] transition hover:bg-brown-500 sm:left-8 sm:text-[0.64rem]"
        >
          Reserva tu turno
        </button>
      </div>

      {/* Fila info | mapa. Apila en pantallas muy angostas. */}
      <div className="grid flex-1 gap-px bg-stone-100 min-[420px]:grid-cols-[1.12fr_0.88fr]">
        <div className="bg-sand px-5 pb-5 pt-8">
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-ink">
            {sucursal.nombre}
          </h3>
          {lineasDireccion.length > 0 ? (
            <div className="mt-2 space-y-0.5 text-xs leading-5 text-stone-700">
              {lineasDireccion.map((linea) => (
                <p key={linea}>{linea}</p>
              ))}
            </div>
          ) : null}
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-stone-700 transition hover:text-sage-500"
            >
              WhatsApp &gt; {whatsappVisible}
            </a>
          ) : null}
          {sucursal.horario_resumen ? (
            <p className="mt-3 text-xs leading-5 text-stone-500">
              {sucursal.horario_resumen}
            </p>
          ) : null}
        </div>

        <div className="min-h-[150px] w-full bg-sand">
          {mapa ? (
            <iframe
              src={mapa}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              title={`Mapa de ${sucursal.nombre}`}
              className="h-full min-h-[150px] w-full"
            />
          ) : null}
        </div>
      </div>

      {instagram ? (
        <a
          href={`https://instagram.com/${instagram}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-brown-500 px-5 py-3.5 text-center text-[0.6rem] uppercase tracking-[0.22em] text-sand transition hover:bg-brown-700 sm:text-[0.64rem]"
        >
          Instagram @{instagram}
        </a>
      ) : null}
    </article>
  );
}
