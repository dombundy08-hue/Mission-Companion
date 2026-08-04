interface PlaceholderProps {
  label: string;
  icon: string;
}

// Shown for any tab not yet ported from the vanilla app. Matches the
// vanilla app's own renderPlaceholder() pattern (an honest "not built yet"
// state, not a fake/broken screen) — this is a visible, resumable checklist
// item, not something meant to look finished.
export function Placeholder({ label, icon }: PlaceholderProps) {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-2xl border p-10 text-center"
      style={{ borderStyle: 'dashed', borderColor: 'var(--border)', background: 'var(--card)' }}
    >
      <span className="text-4xl">{icon}</span>
      <h2 className="font-heading text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
        {label}
      </h2>
      <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
        Not yet ported from the vanilla app — coming in a follow-up pass.
      </p>
    </div>
  );
}
