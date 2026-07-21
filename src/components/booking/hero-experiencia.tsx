"use client";

import { useEffect, useRef } from "react";
import { HERO_TAGLINE } from "@/components/booking/landing-config";

interface HeroExperienciaProps {
  onReserve: () => void;
  whatsappUrl: string;
  totalServicios: number;
}

const VIDEO_SRC = "/hero-malala-scroll.mp4";

const BOTON =
  "inline-flex min-w-[11rem] items-center justify-center bg-white/95 px-6 py-3 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-ink transition hover:bg-white";

export function HeroExperiencia({
  onReserve,
  whatsappUrl,
  totalServicios,
}: HeroExperienciaProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const ensurePlayback = () => {
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 0;
      video.loop = true;
      void video.play().catch(() => {});
    };

    video.addEventListener("loadedmetadata", ensurePlayback);
    if (video.readyState >= 1) ensurePlayback();

    return () => {
      video.removeEventListener("loadedmetadata", ensurePlayback);
    };
  }, []);

  return (
    <section className="relative min-h-[78svh] overflow-hidden lg:min-h-[86vh]">
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        muted
        playsInline
        preload="auto"
        loop
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Velo marrón de marca: unifica cualquier material de video en un mismo tono. */}
      <div className="absolute inset-0 bg-brown-500/55" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(43,34,26,0.42)_0%,rgba(43,34,26,0.12)_45%,rgba(43,34,26,0.55)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[78svh] w-full max-w-6xl flex-col justify-between px-5 py-12 sm:px-8 lg:min-h-[86vh] lg:py-16">
        <div className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
          <h1 className="font-display text-3xl uppercase leading-[1.2] tracking-[0.22em] text-white drop-shadow-[0_8px_28px_rgba(43,34,26,0.45)] sm:text-5xl lg:text-6xl">
            Experiencia
            <br />
            Malala
          </h1>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <button type="button" onClick={onReserve} className={BOTON}>
              Reserva tu turno
            </button>
            <a href={whatsappUrl} target="_blank" rel="noreferrer" className={BOTON}>
              Escribinos
            </a>
            <a href="#promociones" className={BOTON}>
              Beneficios
            </a>
          </div>
        </div>

        <div className="space-y-5">
          <div className="h-px w-full bg-white/35" />
          <div className="flex flex-wrap items-end justify-between gap-4">
            <p className="text-[0.7rem] uppercase leading-6 tracking-[0.2em] text-white/90">
              {HERO_TAGLINE.map((linea) => (
                <span key={linea} className="block">
                  {linea}
                </span>
              ))}
            </p>
            {totalServicios > 0 ? (
              <p className="text-[0.7rem] uppercase tracking-[0.2em] text-white/90">
                +{totalServicios} servicios
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
