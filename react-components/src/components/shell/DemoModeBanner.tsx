import { useAuth } from './AuthContext';

// Persistent banner while Demo Mode is active — a visible, one-tap way out,
// instead of having to dig into Settings. Exiting wipes the demo session
// (same as AuthContext.lock()'s existing Demo Mode behavior).
export function DemoModeBanner() {
  const { lock } = useAuth();

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium text-white"
      style={{ background: 'var(--destructive)' }}
    >
      <span>🧪 Demo Mode — nothing here is saved to a real account.</span>
      <button type="button" onClick={lock} className="rounded-lg bg-white/20 px-3 py-1 font-bold">
        Exit Demo Mode
      </button>
    </div>
  );
}
