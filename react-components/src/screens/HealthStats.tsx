import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActivityCard, type Metric } from '@/components/ui/activity-card';
import { getGoals, healthAverages, weightTrend } from '@/lib/health-data';
import { HealthSetup } from './HealthSetup';

export function HealthStats() {
  const navigate = useNavigate();
  const g = getGoals();
  const [range, setRange] = useState<'week' | 'month'>('week');

  if (!g) return <HealthSetup />;

  const days = range === 'month' ? 30 : 7;
  const avgs = healthAverages(days);
  const wt = weightTrend(days);

  const metrics: Metric[] = [
    { label: 'Calories', value: avgs.cal != null ? String(Math.round(avgs.cal)) : '—', trend: avgs.cal && g.calories ? Math.min(100, Math.round((avgs.cal / g.calories) * 100)) : 0, unit: 'cal' },
    { label: 'Protein', value: avgs.prot != null ? String(Math.round(avgs.prot)) : '—', trend: avgs.prot && g.protein ? Math.min(100, Math.round((avgs.prot / g.protein) * 100)) : 0, unit: 'g' as Metric['unit'] },
    { label: 'Sleep', value: avgs.sleep != null ? avgs.sleep.toFixed(1) : '—', trend: avgs.sleep && g.sleep ? Math.min(100, Math.round((avgs.sleep / g.sleep) * 100)) : 0, unit: 'hrs' },
    { label: 'Water', value: avgs.water != null ? String(Math.round(avgs.water)) : '—', trend: avgs.water && g.water ? Math.min(100, Math.round((avgs.water / g.water) * 100)) : 0, unit: 'oz' as Metric['unit'] },
    { label: 'Mood', value: avgs.mood != null ? avgs.mood.toFixed(1) : '—', trend: avgs.mood ? Math.min(100, Math.round((avgs.mood / 5) * 100)) : 0 },
    { label: 'Energy', value: avgs.energy != null ? avgs.energy.toFixed(1) : '—', trend: avgs.energy ? Math.min(100, Math.round((avgs.energy / 5) * 100)) : 0 },
  ];

  return (
    <div>
      <h2 className="mb-3 text-[22px] font-bold" style={{ color: 'var(--navy)' }}>📊 Stats</h2>

      <div className="mb-4 flex gap-2">
        <button type="button" onClick={() => setRange('week')} className="flex-1 rounded-xl border py-2.5 text-sm font-bold" style={{ borderColor: 'var(--border)', background: range === 'week' ? 'var(--navy)' : 'var(--card)', color: range === 'week' ? 'white' : 'var(--navy)' }}>This Week</button>
        <button type="button" onClick={() => setRange('month')} className="flex-1 rounded-xl border py-2.5 text-sm font-bold" style={{ borderColor: 'var(--border)', background: range === 'month' ? 'var(--navy)' : 'var(--card)', color: range === 'month' ? 'white' : 'var(--navy)' }}>This Month</button>
      </div>

      <ActivityCard
        category={range === 'month' ? 'Last 30 days' : 'Last 7 days'}
        title="📊 Health Snapshot"
        metrics={metrics}
      />

      <div className="mt-4 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="mb-1 text-sm font-bold" style={{ color: 'var(--navy)' }}>Weight</div>
        <div className="text-sm" style={{ color: 'var(--foreground)' }}>
          {wt.pts.length < 2 ? 'Not enough data yet' : wt.label.charAt(0).toUpperCase() + wt.label.slice(1)}
        </div>
      </div>

      <button type="button" onClick={() => navigate('/health/hsetup')} className="mt-4 text-sm font-medium" style={{ color: 'var(--primary)' }}>
        Edit health profile &amp; goals
      </button>
    </div>
  );
}
