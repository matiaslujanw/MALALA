import { Construction } from "lucide-react";

interface Props {
  title: string;
  description?: string;
}

export function StubPage({ title, description }: Props) {
  return (
    <div className="space-y-8 max-w-3xl">
      <header className="space-y-1">
        <h1 className="font-display text-3xl tracking-[0.2em] uppercase">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </header>

      <div className="bg-card border border-border rounded-md p-8 flex items-start gap-4">
        <div className="rounded-md bg-cream p-3">
          <Construction className="h-6 w-6 stroke-[1.5] text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold">Próximamente</p>
          <p className="text-sm text-muted-foreground">
            Esta sección se implementa en los próximos bloques. Mientras tanto,
            podés volver al{" "}
            <a
              href="/dashboard"
              className="text-sage-700 underline underline-offset-4"
            >
              dashboard
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
