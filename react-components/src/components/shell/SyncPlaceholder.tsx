// Wordless — per the KineticLoader fix this session, nothing in this app
// says "loading" anywhere, including a brief route/section sync gap.
export function SyncPlaceholder() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-2 w-2 animate-pulse rounded-full" style={{ background: 'var(--muted-foreground)' }} />
    </div>
  );
}
