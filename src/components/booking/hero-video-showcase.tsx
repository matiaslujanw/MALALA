"use client";

import { ArrowRight, MessageCircle, ShoppingBag, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

interface HeroVideoShowcaseProps {
  onReserve: () => void;
  whatsappUrl: string;
  storeUrl: string;
  heroStats: Array<{ value: string; label: string }>;
}

const VIDEO_SRC = "/hero-malala-scroll.mp4";

export function HeroVideoShowcase({
  onReserve,
  whatsappUrl,
  storeUrl,
  heroStats,
}: HeroVideoShowcaseProps) {
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
    <section className="relative">
      <div>
        <div className="relative min-h-[72svh] overflow-hidden rounded-[2.5rem] border border-white/70 shadow-[0_26px_80px_rgba(44,53,37,0.12)] lg:min-h-[82vh]">
          <div className="absolute inset-0">
            <video
              ref={videoRef}
              src={VIDEO_SRC}
              muted
              playsInline
              preload="auto"
              loop
              autoPlay
              className="h-full w-full object-cover"
            />
          </div>

          <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(244,238,230,0.92)_0%,rgba(244,238,230,0.82)_30%,rgba(63,77,66,0.52)_62%,rgba(28,35,30,0.72)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.28)_0%,transparent_26%),radial-gradient(circle_at_bottom_right,rgba(212,179,153,0.28)_0%,transparent_24%)]" />
          <div className="absolute left-5 top-5 h-2 w-20 bg-sage-900/70" />
          <div className="absolute right-8 top-8 h-2 w-14 bg-[#d1b194]/80" />
          <div className="absolute bottom-10 left-10 h-16 w-16 rounded-full border border-white/35" />

          <div className="relative z-10 flex min-h-[72svh] flex-col justify-between px-6 py-7 sm:px-8 sm:py-8 lg:min-h-[82vh] lg:px-10 lg:py-10">
            <div className="max-w-3xl space-y-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-black/20 px-4 py-2 text-xs uppercase tracking-[0.28em] text-white shadow-[0_10px_24px_rgba(0,0,0,0.16)] backdrop-blur-md">
                <Sparkles className="h-4 w-4" />
                Tu momento en MALALA
              </span>

              <div className="space-y-4">
                <h1 className="max-w-4xl font-display text-5xl uppercase leading-[0.95] tracking-[0.12em] text-white drop-shadow-[0_10px_28px_rgba(0,0,0,0.34)] sm:text-6xl lg:text-7xl">
                  Belleza, cuidado
                  <br />
                  y tiempo para vos
                </h1>
                <p className="max-w-2xl text-base leading-7 text-white/95 drop-shadow-[0_8px_24px_rgba(0,0,0,0.28)] sm:text-lg">
                  En MALALA creamos experiencias de belleza para que disfrutes tu
                  tiempo, te sientas bien y encuentres un espacio pensado para vos.
                  Reserva tu turno, conoce nuestras sucursales y descubre una
                  propuesta que combina detalle, estilo y calidez.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onReserve}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-sage-900 transition hover:bg-sage-50"
                >
                  Reserva tu turno
                  <ArrowRight className="h-4 w-4" />
                </button>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/18 px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.12)] backdrop-blur-md transition hover:bg-white/28"
                  >
                    Escribinos
                    <MessageCircle className="h-4 w-4" />
                  </a>
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/45 bg-black/18 px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.12)] backdrop-blur-md transition hover:bg-black/24"
                  >
                    Tienda online
                    <ShoppingBag className="h-4 w-4" />
                  </a>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
              <div className="grid gap-3 sm:grid-cols-3">
                {heroStats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[1.4rem] border border-white/40 bg-black/18 px-4 py-4 text-white shadow-[0_16px_30px_rgba(0,0,0,0.12)] backdrop-blur-md"
                  >
                    <p className="font-display text-3xl drop-shadow-[0_8px_20px_rgba(0,0,0,0.24)]">{item.value}</p>
                    <p className="mt-1 text-sm text-white/90">{item.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.4rem] border border-white/35 bg-white/18 px-5 py-4 text-white backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/70">
                    Ritual de belleza
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    Un entorno calido, moderno y pensado para que te sientas bien.
                  </p>
                </div>
                <div className="rounded-[1.4rem] border border-white/35 bg-black/22 px-5 py-4 text-white backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/70">
                    Tu experiencia MALALA
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    Cuidado, estilo y una atmosfera pensada para que tu visita se disfrute desde el primer momento.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
