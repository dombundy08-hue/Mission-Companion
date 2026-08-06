import { useState } from 'react';
import { getGoals, todaysRow, saveDayRow, weightTrend, fmtEntryDate, type WeightPoint } from '@/lib/health-data';
import { getLS, setLS } from '@/lib/storage';
import { cloudDeleteRow } from '@/lib/supabase-sync';
import { notifySaved } from '@/lib/save-toast';

function Sparkline({ pts }: { pts: WeightPoint[] }) {
  if (pts.length < 2) return null;
  const w = 300, h = 70, pad = 8;
  const xs = pts.map((p) => p.timestamp);
  const ys = pts.map((p) => p.weight);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx = (t: number) => pad + (maxX === minX ? 0 : ((t - minX) / (maxX - minX)) * (w - 2 * pad));
  const sy = (v: number) => h - pad - (maxY === minY ? (h - 2 * pad) / 2 : ((v - minY) / (maxY - minY)) * (h - 2 * pad));
  const d = pts.map((p, i) => (i ? 'L' : 'M') + sx(p.timestamp).toFixed(1) + ' ' + sy(p.weight).toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      <path d={d} fill="none" stroke="#1C6FB0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={sx(last.timestamp).toFixed(1)} cy={sy(last.weight).toFixed(1)} r="3.5" fill="#163C64" />
    </svg>
  );
}

interface WeightEntry {
  id: string;
  cloudId?: string;
  entryDate: string;
  timestamp: number;
  weight?: number;
}

export function HealthBody() {
  const g = getGoals();
  const unit = g?.profile?.units === 'metric' ? 'kg' : 'lb';
  const [wRow, setWRow] = useState(() => todaysRow('healthWeight'));
  const [sRow, setSRow] = useState(() => todaysRow('healthSleep'));
  const [weightInput, setWeightInput] = useState(String(wRow?.weight ?? ''));
  const [sleepInput, setSleepInput] = useState(String(sRow?.hours ?? ''));
  const [listOpen, setListOpen] = useState(false);
  const [weights, setWeights] = useState<WeightEntry[]>(() =>
    getLS<WeightEntry[]>('healthWeight', []).slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  );
  const wt = weightTrend();

  function saveWeight() {
    const v = parseFloat(weightInput);
    if (isNaN(v)) {
      alert('Enter your weight.');
      return;
    }
    saveDayRow('healthWeight', 'weight', v);
    setWRow(todaysRow('healthWeight'));
    setWeights(getLS<WeightEntry[]>('healthWeight', []).slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    notifySaved('Weight saved.');
  }

  function saveSleep() {
    const v = parseFloat(sleepInput);
    if (isNaN(v)) {
      alert('Enter hours of sleep.');
      return;
    }
    saveDayRow('healthSleep', 'hours', v);
    setSRow(todaysRow('healthSleep'));
    notifySaved('Sleep saved.');
  }

  function deleteWeight(id: string) {
    const e = getLS<WeightEntry[]>('healthWeight', []).find((x) => x.id === id);
    if (!confirm('Delete this weight entry?')) return;
    if (e) cloudDeleteRow('health_weight_log', e);
    const next = getLS<WeightEntry[]>('healthWeight', []).filter((x) => x.id !== id);
    setLS('healthWeight', next);
    setWeights(next.slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
    setWRow(todaysRow('healthWeight'));
  }

  return (
    <div>
      <h2 className="mb-3 text-[22px] font-bold" style={{ color: 'var(--foreground)' }}>⚖️ Body</h2>

      <div className="mb-3 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="mb-2 text-sm font-bold" style={{ color: 'var(--foreground)' }}>Weight today ({unit})</div>
        <div className="mb-3 flex gap-2">
          <input type="number" min={40} max={600} step={0.1} value={weightInput} onChange={(e) => setWeightInput(e.target.value)} className="h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} />
          <button type="button" onClick={saveWeight} className="min-w-[96px] rounded-xl px-4 text-sm font-bold text-white" style={{ background: 'var(--primary)' }}>Save</button>
        </div>
        {wt.pts.length >= 2 ? (
          <div>
            <Sparkline pts={wt.pts} />
            <div className="mt-1 text-sm" style={{ color: 'var(--foreground)' }}>Weight is <b>{wt.label}</b>.</div>
          </div>
        ) : (
          <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Log your weight on a few different days to see a 30-day trend.</div>
        )}
        <hr className="my-3.5" style={{ border: 'none', height: 1, background: 'var(--border)' }} />
        <button type="button" onClick={() => setListOpen(!listOpen)} className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
          {listOpen ? '▾' : '▸'} View all entries ({weights.length})
        </button>
        {listOpen && (
          <div className="mt-2 space-y-1.5">
            {weights.length === 0 ? (
              <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No weight entries yet.</div>
            ) : (
              weights.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg px-2 py-1.5" style={{ background: 'var(--secondary)' }}>
                  <span className="text-sm" style={{ color: 'var(--foreground)' }}>{fmtEntryDate(e.entryDate)}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{e.weight} {unit}</span>
                  <button type="button" onClick={() => deleteWeight(e.id)} className="ml-2 text-sm" style={{ color: 'var(--destructive)' }}>✕</button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="mb-1 text-sm font-bold" style={{ color: 'var(--foreground)' }}>Sleep last night</div>
        <div className="mb-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>Goal: {g ? g.sleep : 7.5} hours</div>
        <div className="flex gap-2">
          <input type="number" min={0} max={16} step={0.5} placeholder="hours" value={sleepInput} onChange={(e) => setSleepInput(e.target.value)} className="h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} />
          <button type="button" onClick={saveSleep} className="min-w-[96px] rounded-xl px-4 text-sm font-bold text-white" style={{ background: 'var(--primary)' }}>Save</button>
        </div>
      </div>
    </div>
  );
}
