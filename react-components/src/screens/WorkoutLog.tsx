import { useState } from 'react';
import { ActivityCard, type Metric } from '@/components/ui/activity-card';
import { fmtClock, type WorkoutLogEntry } from '@/lib/exercise-data';
import { getLS, setLS } from '@/lib/storage';
import { cloudDeleteRow } from '@/lib/supabase-sync';

export function WorkoutLog() {
  const [log, setLog] = useState<WorkoutLogEntry[]>(() => getLS<WorkoutLogEntry[]>('workoutLog', []).slice().sort((a, b) => b.timestamp - a.timestamp));

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const thisWeek = log.filter((e) => e.timestamp >= weekAgo).length;
  const totalMin = Math.round(log.reduce((s, e) => s + (e.durationSec || 0), 0) / 60);
  const weekMin = Math.round(log.filter((e) => e.timestamp >= weekAgo).reduce((s, e) => s + (e.durationSec || 0), 0) / 60);

  function deleteEntry(id: string) {
    if (!confirm('Delete this log entry?')) return;
    const e = getLS<WorkoutLogEntry[]>('workoutLog', []).find((x) => x.id === id);
    if (e) cloudDeleteRow('workout_log', e);
    const next = getLS<WorkoutLogEntry[]>('workoutLog', []).filter((x) => x.id !== id);
    setLS('workoutLog', next);
    setLog(next.slice().sort((a, b) => b.timestamp - a.timestamp));
  }

  const metrics: Metric[] = [
    { label: 'Workouts', value: String(thisWeek), trend: Math.min(100, thisWeek * 20) },
    { label: 'Minutes', value: String(weekMin), trend: Math.min(100, weekMin), unit: 'min' },
    { label: 'All time', value: String(totalMin), trend: 100, unit: 'min' },
  ];

  return (
    <div>
      <h2 className="mb-3 text-[22px] font-bold" style={{ color: 'var(--navy)' }}>📈 Log</h2>

      <ActivityCard category="This week" title="📊 Workout Log" metrics={metrics} className="mb-4" />

      {!log.length ? (
        <div className="rounded-[14px] border p-6 text-center text-sm" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--muted-foreground)' }}>
          No workouts logged yet. Finish one and it lands here.
        </div>
      ) : (
        <div className="space-y-2.5">
          {log.map((e) => (
            <div key={e.id} className="rounded-[14px] border p-3.5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              <div className="mb-1 font-bold" style={{ color: 'var(--navy)' }}>{e.routineName || 'Workout'}</div>
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
