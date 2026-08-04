import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ActivityCard, type Metric } from '@/components/ui/activity-card';
import { getGoals, healthAverages, weightTrend, todaysFoodTotals, waterTotal, todaysRow } from '@/lib/health-data';
import { getLS } from '@/lib/storage';
import { useSettingsChanged } from '@/lib/settings-bus';
import { HealthSetup } from './HealthSetup';

const DEFAULT_VISIBLE = ['calories', 'protein', 'sleep', 'water', 'mood', 'energy', 'weight'];

export function HealthStats() {
  const navigate = useNavigate();
  const g = getGoals();
  const [range, setRange] = useState<'week' | 'month'>('week');
  const [visible, setVisible] = useState<string[]>(() => getLS('health_visibleMetrics', DEFAULT_VISIBLE));
  useSettingsChanged(() => setVisible(getLS('health_visibleMetrics', DEFAULT_VISIBLE)));

  if (!g) return <HealthSetup />;

  const days = range === 'month' ? 30 : 7;
  const avgs = healthAverages(days);
  const wt = weightTrend(days);
  const today = todaysFoodTotals();
  const todayMood = todaysRow('healthMood');
  const todaySleep = todaysRow('healthSleep');
  const todayWaterOz = waterTotal();

  const defs: { key: string; label: string; unit?: Metric['unit']; avgValue: string; avgTrend: number; todayValue: string; todayTrend: number }[] = [
    {
      key: 'calories', label: 'Calories', unit: 'cal',
      avgValue: avgs.cal != null ? String(Math.round(avgs.cal)) : '—',
      avgTrend: avgs.cal && g.calories ? Math.min(100, Math.round((avgs.cal / g.calories) * 100)) : 0,
      todayValue: String(Math.round(today.calories)),
      todayTrend: g.calories ? Math.min(100, Math.round((today.calories / g.calories) * 100)) : 0,
    },
    {
      key: 'protein', label: 'Protein', unit: 'g' as Metric['unit'],
      avgValue: avgs.prot != null ? String(Math.round(avgs.prot)) : '—',
      avgTrend: avgs.prot && g.protein ? Math.min(100, Math.round((avgs.prot / g.protein) * 100)) : 0,
      todayValue: String(Math.round(today.protein)),
      todayTrend: g.protein ? Math.min(100, Math.round((today.protein / g.protein) * 100)) : 0,
    },
    {
      key: 'sleep', label: 'Sleep', unit: 'hrs',
      avgValue: avgs.sleep != null ? avgs.sleep.toFixed(1) : '—',
      avgTrend: avgs.sleep && g.sleep ? Math.min(100, Math.round((avgs.sleep / g.sleep) * 100)) : 0,
      todayValue: todaySleep?.hours != null ? Number(todaySleep.hours).toFixed(1) : '—',
      todayTrend: todaySleep?.hours != null && g.sleep ? Math.min(100, Math.round((Number(todaySleep.hours) / g.sleep) * 100)) : 0,
    },
    {
      key: 'water', label: 'Water', unit: 'oz' as Metric['unit'],
      avgValue: avgs.water != null ? String(Math.round(avgs.water)) : '—',
      avgTrend: avgs.water && g.water ? Math.min(100, Math.round((avgs.water / g.water) * 100)) : 0,
      todayValue: String(Math.round(todayWaterOz)),
      todayTrend: g.water ? Math.min(100, Math.round((todayWaterOz / g.water) * 100)) : 0,
    },
    {
      key: 'mood', label: 'Mood',
      avgValue: avgs.mood != null ? avgs.mood.toFixed(1) : '—',
      avgTrend: avgs.mood ? Math.min(100, Math.round((avgs.mood / 5) * 100)) : 0,
      todayValue: todayMood?.score != null ? String(todayMood.score) : '—',
      todayTrend: todayMood?.score != null ? Math.min(100, Math.round((Number(todayMood.score) / 5) * 100)) : 0,
    },
    {
      key: 'energy', label: 'Energy',
      avgValue: avgs.energy != null ? avgs.energy.toFixed(1) : '—',
      avgTrend: avgs.energy ? Math.min(100, Math.round((avgs.energy / 5) * 100)) : 0,
      todayValue: todayMood?.energy != null ? String(todayMood.energy) : '—',
      todayTrend: todayMood?.energy != null ? Math.min(100, Math.round((Number(todayMood.energy) / 5) * 100)) : 0,
    },
  ];

  const shown = defs.filter((d) => visible.includes(d.key));
  const metrics: Metric[] = shown.map((d) => ({ label: d.label, value: d.avgValue, trend: d.avgTrend, unit: d.unit }));
  const todayMetrics: Metric[] = shown.map((d) => ({ label: d.label, value: d.todayValue, trend: d.todayTrend, unit: d.unit }));
  const showWeight = visible.includes('weight');
  const usedMedian = avgs.calUsedMedian || avgs.protUsedMedian;

  return (
    <div>
      <h2 className="mb-3 text-[22px] font-bold" style={{ color: 'var(--foreground)' }}>📊 Stats</h2>

      {usedMedian && (
        <p className="mb-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          One week this period was unusually different, so the typical (median) week is shown instead of the average.
        </p>
      )}

      {todayMetrics.length > 0 && (
        <div className="mb-4">
          <ActivityCard category="So far" title="🔆 Today" metrics={todayMetrics} />
        </div>
      )}

      <div className="mb-4 flex gap-2">
        <button type="button" onClick={() => setRange('week')} className="flex-1 rounded-xl border py-2.5 text-sm font-bold" style={{ borderColor: 'var(--border)', background: range === 'week' ? 'var(--navy)' : 'var(--card)', color: range === 'week' ? 'white' : 'var(--foreground)' }}>This Week</button>
        <button type="button" onClick={() => setRange('month')} className="flex-1 rounded-xl border py-2.5 text-sm font-bold" style={{ borderColor: 'var(--border)', background: range === 'month' ? 'var(--navy)' : 'var(--card)', color: range === 'month' ? 'white' : 'var(--foreground)' }}>This Month</button>
      </div>

      {metrics.length > 0 && (
        <ActivityCard
          category={range === 'month' ? 'Last 30 days' : 'Last 7 days'}
          title="📊 Health Snapshot"
          metrics={metrics}
        />
      )}

      {showWeight && (
        <div className="mt-4 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <div className="mb-1 text-sm font-bold" style={{ color: 'var(--foreground)' }}>Weight</div>
          <div className="text-sm" style={{ color: 'var(--foreground)' }}>
            {wt.pts.length < 2 ? 'Not enough data yet' : wt.label.charAt(0).toUpperCase() + wt.label.slice(1)}
          </div>
        </div>
      )}

      <button type="button" onClick={() => navigate('/health/hsetup')} className="mt-4 text-sm font-medium" style={{ color: 'var(--primary)' }}>
        Edit health profile &amp; goals
      </button>
    </div>
  );
}
