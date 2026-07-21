import { PROMOCIONES } from "@/components/booking/landing-config";

export function PromocionesBand() {
  return (
    <section id="promociones">
      <div className="bg-sand px-5 py-4 text-center">
        <h2 className="text-[0.7rem] font-medium uppercase tracking-[0.28em] text-ink">
          {PROMOCIONES.titulo}
        </h2>
      </div>

      <div className="bg-brown-500 px-5 py-14 text-center sm:py-16">
        <div className="space-y-3">
          {PROMOCIONES.lineas.map((linea) => (
            <p
              key={linea}
              className="text-sm uppercase tracking-[0.24em] text-white/95 sm:text-lg"
            >
              {linea}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
