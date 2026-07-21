"use client";

import Image from "next/image";
import { useMemo } from "react";
import { TILES_SERVICIOS } from "@/components/booking/landing-config";
import type { Servicio } from "@/lib/types";

interface ServiciosShowcaseProps {
  servicios: Servicio[];
  onSelectRubro: (rubro: string | null) => void;
}

export function ServiciosShowcase({
  servicios,
  onSelectRubro,
}: ServiciosShowcaseProps) {
  // Cada tile se enlaza con el primer rubro real del catálogo que coincida, para
  // que el click abra la reserva ya filtrada. Si ninguno coincide, el tile sigue
  // siendo visible pero abre el catálogo completo.
  const tiles = useMemo(() => {
    const rubros = new Set(servicios.map((item) => item.rubro.toUpperCase()));
    return TILES_SERVICIOS.map((tile) => ({
      ...tile,
      rubro: tile.rubros.find((candidato) => rubros.has(candidato.toUpperCase())) ?? null,
    }));
  }, [servicios]);

  return (
    <section id="servicios" className="bg-background py-14 sm:py-16">
      <h2 className="text-center font-script text-5xl text-ink sm:text-6xl">
        Servicios
      </h2>

      <div className="mt-10 grid grid-cols-2 gap-px bg-sand sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => (
          <button
            key={tile.label}
            type="button"
            onClick={() => onSelectRubro(tile.rubro)}
            className="group flex flex-col bg-white text-left"
          >
            <div className="relative h-[190px] w-full overflow-hidden sm:h-[210px]">
              {tile.imagen ? (
                <Image
                  src={tile.imagen}
                  alt={tile.label}
                  fill
                  sizes="(max-width: 640px) 50vw, 20vw"
                  className="object-cover grayscale transition duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(160deg,var(--stone-100)_0%,var(--sand)_50%,var(--brown-100)_100%)]">
                  <span className="font-script text-3xl text-brown-500/60">
                    {tile.label}
                  </span>
                </div>
              )}
            </div>
            <span className="px-4 py-4 text-[0.68rem] uppercase tracking-[0.24em] text-ink transition group-hover:text-brown-500">
              {tile.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
