import { useState } from 'react';
import { ActivityCard, type Metric } from '@/components/ui/activity-card';
import { fmtClock, type WorkoutLogEntry } from '@/lib/exercise-data';
import { getLS, setLS } from '@/lib/storage';
import { cloudDeleteRow } from '@/lib/supabase-sync';

type Range = 'day' | 'week' | 'month';

export function WorkoutLog() {
  const [log, setLog] = useState<WorkoutLogEntry[]>(() => getLS<WorkoutLogEntry[]>('workoutLog', []).slice().sort((a, b) => b.timestamp - a.timestamp));
  const [range, setRange] = useState<Range>('day');

  const rangeMs = (range === 'day' ? 1 : range === 'month' ? 30 : 7) * 24 * 60 * 60 * 1000;
  const since = Date.now() - rangeMs;
  const inRange = log.filter((e) => e.timestamp >= since);
  const rangeCount = inRange.length;
  const rangeMin = Math.round(inRange.reduce((s, e) => s + (e.durationSec || 0), 0) / 60);
  const totalMin = Math.round(log.reduce((s, e) => s + (e.durationSec || 0), 0) / 60);
  const categoryLabel = range === 'day' ? 'Today' : range === 'month' ? 'Last 30 days' : 'Last 7 days';

  function deleteEntry(id: string) {
    if (!confirm('Delete this log entry?')) return;
    const e = getLS<WorkoutLogEntry[]>('workoutLog', []).find((x) => x.id === id);
    if (e) cloudDeleteRow('workout_log', e);
    const next = getLS<WorkoutLogEntry[]>('workoutLog', []).filter((x) => x.id !== id);
    setLS('workoutLog', next);
    setLog(next.slice().sort((a, b) => b.timestamp - a.timestamp));
  }

  const metrics: Metric[] = [
    { label: 'Workouts', value: String(rangeCount), trend: Math.min(100, rangeCount * 20) },
    { label: 'Minutes', value: String(rangeMin), trend: Math.min(100, rangeMin), unit: 'min' },
    { label: 'All time', value: String(totalMin), trend: 100, unit: 'min' },
  ];

  return (
    <div>
      <h2 className="mb-3 text-[22px] font-bold" style={{ color: 'var(--foreground)' }}>📈 Log</h2>

      <div className="mb-3 flex gap-2">
        <button type="button" onClick={() => setRange('day')} className="flex-1 rounded-xl border py-2.5 text-sm font-bold" style={{ borderColor: 'var(--border)', background: range === 'day' ? 'var(--navy)' : 'var(--card)', color: range === 'day' ? 'white' : 'var(--foreground)' }}>Today</button>
        <button type="button" onClick={() => setRange('week')} className="flex-1 rounded-xl border py-2.5 text-sm font-bold" style={{ borderColor: 'var(--border)', background: range === 'week' ? 'var(--navy)' : 'var(--card)', color: range === 'week' ? 'white' : 'var(--foreground)' }}>This Week</button>
        <button type="button" onClick={() => setRange('month')} className="flex-1 rounded-xl border py-2.5 text-sm font-bold" style={{ borderColor: 'var(--border)', background: range === 'month' ? 'var(--navy)' : 'var(--card)', color: range === 'month' ? 'white' : 'var(--foreground)' }}>This Month</button>
      </div>

      <ActivityCard category={categoryLabel} title="📊 Workout Log" metrics={metrics} className="mb-4" style={{ background: 'var(--tint-1)' }} />

      {!log.length ? (
        <div className="rounded-[14px] border p-6 text-center text-sm" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--muted-foreground)' }}>
          No workouts logged yet. Finish one and it lands here.
        </div>
      ) : (
        <div className="space-y-2.5">
          {log.map((e) => (
            <div key={e.id} className="rounded-[14px] border p-3.5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              <div className="mb-1 font-bold" style={{ color: 'var(--foreground)' }}>{e.routineName || 'Workout'}</div>
              <div className="mb-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>{e.date || ''}</div>
              <div className="mb-2.5 text-sm" style={{ color: 'var(--foreground)' }}>{fmtClock(e.durationSec || 0)} · {e.stepsCompleted || 0} steps</div>
              <button type="button" onClick={() => deleteEntry(e.id)} className="rounded-xl px-4 py-2 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
