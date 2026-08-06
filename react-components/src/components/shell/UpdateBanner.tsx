import { useEffect, useState } from 'react';
import { checkForUpdate } from '@/lib/update-check';

const CHECK_INTERVAL_MS = 10 * 60 * 1000;

export function UpdateBanner() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = () => checkForUpdate().then((v) => !cancelled && v && setAvailable(true));
    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!available) return null;

  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium text-white"
      style={{ background: 'var(--primary)' }}
    >
      <span>✨ A new version is ready.</span>
      <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-white/20 px-3 py-1 font-bold">
        Refresh
      </button>
    </div>
  );
}
