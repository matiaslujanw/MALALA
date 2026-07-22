import { PROMOCIONES } from "@/components/booking/landing-config";

export function PromocionesBand() {
  return (
    <section id="promociones">
      <div className="bg-sand px-5 py-4 text-center">
        <h2 className="text-[0.6rem] font-medium uppercase tracking-[0.24em] text-ink sm:text-[0.72rem] sm:tracking-[0.3em]">
          {PROMOCIONES.titulo}
        </h2>
      </div>

      <div className="bg-brown-500 px-5 py-12 sm:py-16">
        {/* 3 columnas con hairlines; apila en una sola columna en mobile. */}
        <div className="mx-auto grid max-w-4xl gap-y-8 divide-y divide-sand/25 sm:grid-cols-3 sm:gap-y-0 sm:divide-x sm:divide-y-0">
          {PROMOCIONES.columnas.map((lineas, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-1.5 px-4 pt-8 text-center first:pt-0 sm:pt-0"
            >
              {lineas.map((linea) => (
                <p
                  key={linea}
                  className="text-[0.68rem] uppercase leading-5 tracking-[0.18em] text-sand/90 sm:text-xs sm:tracking-[0.2em]"
                >
                  {linea}
                </p>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
