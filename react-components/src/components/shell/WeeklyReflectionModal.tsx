import { useMemo, useState } from 'react';
import {
  getGoals,
  healthAverages,
  markReflectionShown,
  reflectionShownThisWeek,
  getExcusedAreas,
  excuseArea,
} from '@/lib/health-data';
import { getLS } from '@/lib/storage';

interface Area {
  key: string;
  label: string;
  emoji: string;
  score: number; // 0-100, lower = needs more attention
  message: string;
}

function daysThisWeekTs(): number {
  const d = new Date();
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday.getTime();
}

const AREA_MESSAGES: Record<string, string> = {
  calories: "Your calorie tracking was lighter than usual this week. No judgment — just a gentle nudge to log a bit more consistently this coming week.",
  protein: "Protein's been running below your goal this week. Small swaps (an extra egg, a protein shake) can close the gap without much extra effort.",
  journal: "You wrote in your journal less than usual this week. Even two sentences at the end of a hard day counts — future you will be glad you did.",
  miracles: "You didn't capture many miracles this week. They're often there even on quiet days — try writing down one small thing before bed.",
};

export function WeeklyReflectionModal({ onClose }: { onClose: () => void }) {
  const excused = getExcusedAreas();
  const g = getGoals();
  const weekStart = daysThisWeekTs();

  const areas = useMemo<Area[]>(() => {
    const avgs = healthAverages(7);
    const journalCount = getLS<{ timestamp: number }[]>('journalEntries', []).filter((e) => e.timestamp >= weekStart).length;
    const miracleCount = getLS<{ timestamp: number }[]>('miracleEntries', []).filter((e) => e.timestamp >= weekStart).length;

    const list: Area[] = [];
    if (g?.calories && avgs.cal != null) {
      list.push({ key: 'calories', label: 'Calories', emoji: '🍽️', score: Math.min(100, (avgs.cal / g.calories) * 100), message: AREA_MESSAGES.calories });
    }
    if (g?.protein && avgs.prot != null) {
      list.push({ key: 'protein', label: 'Protein', emoji: '💪', score: Math.min(100, (avgs.prot / g.protein) * 100), message: AREA_MESSAGES.protein });
    }
    list.push({ key: 'journal', label: 'Journaling', emoji: '📓', score: Math.min(100, (journalCount / 7) * 100), message: AREA_MESSAGES.journal });
    list.push({ key: 'miracles', label: 'Miracles', emoji: '✨', score: Math.min(100, (miracleCount / 3) * 100), message: AREA_MESSAGES.miracles });

    return list.filter((a) => !excused.includes(a.key)).sort((a, b) => a.score - b.score);
  }, [excused, g, weekStart]);

  const [dismissed, setDismissed] = useState<string[]>([]);
  const remaining = areas.filter((a) => !dismissed.includes(a.key));
  const lowest = remaining[0];

  function handleExcuse() {
    if (!lowest) return;
    excuseArea(lowest.key);
    setDismissed((d) => [...d, lowest.key]);
  }
  function handleClose() {
    markReflectionShown();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleClose}>
      <div
        className="w-full max-w-[420px] rounded-2xl p-5"
        style={{ background: 'var(--card)', boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 font-heading text-lg font-semibold" style={{ color: 'var(--navy)' }}>Weekly Reflection</h3>
        <p className="mb-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>A quick look at how this week went.</p>

        {lowest ? (
          <div className="rounded-xl p-3.5" style={{ background: 'var(--secondary)' }}>
            <div className="mb-1 text-sm font-bold" style={{ color: 'var(--navy)' }}>{lowest.emoji} {lowest.label}</div>
            <p className="text-sm" style={{ color: 'var(--secondary-foreground)' }}>{lowest.message}</p>
          </div>
        ) : (
          <div className="rounded-xl p-3.5 text-sm" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
            You're tracking consistently across the board this week — keep it up!
          </div>
        )}

        <div className="mt-4 flex gap-2.5">
          {lowest && (
            <button
              type="button"
              onClick={handleExcuse}
              className="flex-1 rounded-xl py-3 text-sm font-medium"
              style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}
            >
              This doesn't apply
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-xl py-3 text-sm font-bold text-white"
            style={{ background: 'var(--primary)', boxShadow: '0 2px 0 var(--gold-dark)' }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export function shouldShowWeeklyReflection(): boolean {
  const g = getGoals();
  if (!g) return false;
  const day = getLS<number>('health_reflectionReminderDay', 0);
  const today = new Date().getDay();
  return today >= day && !reflectionShownThisWeek();
}
