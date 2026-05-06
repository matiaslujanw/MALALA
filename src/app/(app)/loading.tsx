export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-muted/60" />
      <div className="h-32 rounded-[1.5rem] bg-muted/40" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="h-28 rounded-[1.4rem] bg-muted/40" />
        <div className="h-28 rounded-[1.4rem] bg-muted/40" />
        <div className="h-28 rounded-[1.4rem] bg-muted/40" />
        <div className="h-28 rounded-[1.4rem] bg-muted/40" />
      </div>
      <div className="h-64 rounded-[1.75rem] bg-muted/30" />
    </div>
  );
}
