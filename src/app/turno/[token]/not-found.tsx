export default function NotFound() {
  return (
    <main className="min-h-full bg-background px-4 py-16">
      <div className="mx-auto max-w-md text-center">
        <p className="font-display text-xs tracking-[0.3em] text-muted-foreground">
          MALALA
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">
          Link no encontrado
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          El link que abriste no corresponde a ningún turno. Si lo recibiste por
          WhatsApp, verificá que sea el más reciente o contactá a la sucursal.
        </p>
      </div>
    </main>
  );
}
