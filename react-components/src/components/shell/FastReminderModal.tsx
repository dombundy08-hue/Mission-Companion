import { useEffect } from 'react';
import { markFastReminderShown } from '@/lib/health-data';

// First pop-up of the day on an active Fast Sunday — reminds you what you
// said you were fasting for, so it doesn't get lost once the day is busy.
export function FastReminderModal({ intention, onClose }: { intention: string; onClose: () => void }) {
  useEffect(() => {
    markFastReminderShown();
  }, []);

  function handleClose() {
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleClose}>
      <div
        className="w-full max-w-[420px] rounded-2xl p-5"
        style={{ background: 'var(--card)', boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 font-heading text-lg font-semibold" style={{ color: 'var(--foreground)' }}>🕊️ Fast Sunday</h3>
        <p className="mb-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>A reminder of what you're fasting for today.</p>

        <div className="rounded-xl p-3.5 text-sm" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
          🙏 <b>{intention}</b>
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="mt-4 w-full rounded-xl py-3 text-sm font-bold text-white"
          style={{ background: 'var(--primary)', boxShadow: '0 2px 0 var(--gold-dark)' }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
