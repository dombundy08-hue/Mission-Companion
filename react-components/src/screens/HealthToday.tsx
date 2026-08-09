import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getGoals,
  daysAgoTs,
  round1,
  weightTrend,
  weightCeilingNotice,
  waterTotal,
  electroTotal,
  addTap,
  todaysRow,
  saveDayRow,
  statusColor,
  calStatusColor,
  SYMPTOMS,
  symptomData,
  isoDate,
  isFasting,
  toggleFasting,
  getFastingIntention,
  setFastingIntention,
  healthAverages,
} from '@/lib/health-data';
import { getLS } from '@/lib/storage';
import { useSettingsChanged } from '@/lib/settings-bus';
import { notifySaved } from '@/lib/save-toast';
import { HealthSetup } from './HealthSetup';

const DEFAULT_VISIBLE = ['calories', 'protein', 'sleep', 'water', 'mood', 'energy', 'weight'];

interface FoodEntry { entryDate: string; timestamp: number; calories?: number; protein?: number }
interface DayEntry { entryDate: string; timestamp: number; hours?: number; score?: number; energy?: number }

function avgOf(arr: number[]): number | null {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

function StatusDot({ color }: { color: 'green' | 'gray' | 'red' | null }) {
  if (!color) return null;
  const bg = color === 'green' ? '#2CD758' : color === 'red' ? '#FF3B30' : '#9aa4bd';
  return <span className="ml-1 inline-block h-2 w-2 rounded-full" style={{ background: bg }} />;
}

export function HealthToday() {
  const navigate = useNavigate();
  const g = getGoals();
  const [range, setRange] = useState<'week' | 'month'>('week');
  const [symptom, setSymptom] = useState<string | null>(null);
  const [oz, setOz] = useState(() => waterTotal());
  const [el, setEl] = useState(() => electroTotal());
  const [mRow, setMRow] = useState(() => todaysRow('healthMood'));
  const today = isoDate();
  const [fastToday, setFastToday] = useState(() => isFasting(today));
  const [fastIntention, setFastIntentionState] = useState(() => getFastingIntention(today));
  const [editingIntention, setEditingIntention] = useState(() => !getFastingIntention(today).trim());
  const [visible, setVisible] = useState<string[]>(() => getLS('health_visibleMetrics', DEFAULT_VISIBLE));
  useSettingsChanged(() => setVisible(getLS('health_visibleMetrics', DEFAULT_VISIBLE)));

  if (!g) return <HealthSetup />;

  const days = range === 'month' ? 30 : 7;
  const avgs = healthAverages(days);
  const calAvg = avgs.cal;
  const protAvg = avgs.prot;
  const sleepAvg = avgOf(getLS<DayEntry[]>('healthSleep', []).filter((e) => e.timestamp >= daysAgoTs(days) && e.hours != null).map((e) => +(e.hours as number)));
  const waterDayMapLocal: Record<string, number> = {};
  getLS<{ entryDate: string; timestamp: number; oz?: number; cups?: number }[]>('healthWater', []).forEach((e) => {
    if (e.timestamp >= daysAgoTs(days)) {
      const v = e.oz != null ? e.oz : e.cups != null ? e.cups * 8 : 0;
      waterDayMapLocal[e.entryDate] = (waterDayMapLocal[e.entryDate] || 0) + v;
    }
  });
  const waterAvg = avgOf(Object.values(waterDayMapLocal));
  const moodAvg = avgOf(getLS<DayEntry[]>('healthMood', []).filter((e) => e.timestamp >= daysAgoTs(days) && e.score != null && e.score > 0).map((e) => +(e.score as number)));
  const energyAvg = avgOf(getLS<DayEntry[]>('healthMood', []).filter((e) => e.timestamp >= daysAgoTs(days) && e.energy != null && e.energy > 0).map((e) => +(e.energy as number)));
  const wt = weightTrend(days);
  const proteinGoal = g.protein != null ? g.protein : null;
  const ceilNote = weightCeilingNotice();
  const dash = '—';
  const mood = mRow?.score ? (mRow.score as number) : 0;
  const energy = mRow?.energy ? (mRow.energy as number) : 0;
  const sd = symptom ? symptomData(symptom) : null;

  function tapWater(delta: number) {
    if (delta < 0 && waterTotal() < 8) return;
    addTap('healthWater', 'oz', delta);
    setOz(waterTotal());
    notifySaved('Water saved.');
  }
  function tapElectrolyte(delta: number) {
    if (delta < 0 && electroTotal() < 1) return;
    addTap('healthWater', 'electrolytes', delta);
    setEl(electroTotal());
    notifySaved('Electrolytes saved.');
  }
  function tapMood(n: number) {
    saveDayRow('healthMood', 'score', n);
    setMRow(todaysRow('healthMood'));
    notifySaved('Mood saved.');
  }
  function tapEnergy(n: number) {
    saveDayRow('healthMood', 'energy', n);
    setMRow(todaysRow('healthMood'));
    notifySaved('Energy saved.');
  }
  function toggleFast() {
    toggleFasting(today);
    setFastToday(isFasting(today));
    setFastIntentionState(getFastingIntention(today));
    setEditingIntention(!getFastingIntention(today).trim());
  }
  function saveFastIntention(text: string) {
    setFastIntentionState(text);
    setFastingIntention(today, text);
  }
  function confirmFastIntention() {
    if (fastIntention.trim()) setEditingIntention(false);
  }

  return (
    <div>
      <h2 className="mb-3 text-[22px] font-bold" style={{ color: 'var(--foreground)' }}>🍎 Today</h2>

      <div className="mb-3 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--tint-1)' }}>
        <div className="mb-3 flex gap-2">
          <button type="button" onClick={() => setRange('week')} className="flex-1 rounded-lg py-2 text-sm font-bold" style={{ background: range === 'week' ? 'var(--navy)' : 'var(--secondary)', color: range === 'week' ? 'white' : 'var(--secondary-foreground)' }}>This Week</button>
          <button type="button" onClick={() => setRange('month')} className="flex-1 rounded-lg py-2 text-sm font-bold" style={{ background: range === 'month' ? 'var(--navy)' : 'var(--secondary)', color: range === 'month' ? 'white' : 'var(--secondary-foreground)' }}>This Month</button>
        </div>
        {[
          { key: 'calories', label: 'Calories', sub: 'avg/day', val: calAvg == null ? dash : Math.round(calAvg), goal: `goal ${g.calories}`, dot: calStatusColor(calAvg, g.calories) },
          { key: 'protein', label: 'Protein', sub: 'avg/day', val: protAvg == null ? dash : Math.round(protAvg) + 'g', goal: proteinGoal != null ? `goal ${proteinGoal}g` : '', dot: proteinGoal != null ? statusColor(protAvg, proteinGoal) : null },
          { key: 'sleep', label: 'Sleep', sub: 'avg', val: sleepAvg == null ? dash : round1(sleepAvg) + ' hrs', goal: `goal ${g.sleep}`, dot: statusColor(sleepAvg, g.sleep) },
          { key: 'water', label: 'Water', sub: 'avg', val: waterAvg == null ? dash : Math.round(waterAvg) + ' oz', goal: `goal ${g.water}`, dot: statusColor(waterAvg, g.water) },
          { key: 'mood', label: 'Mood', sub: 'avg', val: moodAvg == null ? dash : round1(moodAvg) + '/5', goal: '', dot: null },
          { key: 'energy', label: 'Energy', sub: 'avg', val: energyAvg == null ? dash : round1(energyAvg) + '/5', goal: '', dot: null },
        ].filter((row) => visible.includes(row.key)).map((row) => (
          <div key={row.label} className="flex items-center justify-between border-t py-2 text-sm first:border-t-0" style={{ borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--foreground)' }}>{row.label} <span style={{ color: 'var(--muted-foreground)' }}>{row.sub}</span></span>
            <span className="font-bold" style={{ color: 'var(--foreground)' }}>
              {row.val} {row.goal && <span className="font-normal" style={{ color: 'var(--muted-foreground)' }}>· {row.goal}</span>}
              <StatusDot color={row.dot as 'green' | 'gray' | 'red' | null} />
            </span>
          </div>
        ))}
        {visible.includes('weight') && (
          <div className="flex items-center justify-between border-t py-2 text-sm" style={{ borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--foreground)' }}>Weight</span>
            <span className="font-bold" style={{ color: 'var(--foreground)' }}>{wt.label}</span>
          </div>
        )}
      </div>

      <div className="mb-3 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--tint-2)' }}>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" checked={fastToday} onChange={toggleFast} className="h-5 w-5 flex-none" />
          <span className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>
            🕊️ I'm fasting today <span className="font-normal" style={{ color: 'var(--muted-foreground)' }}>(excluded from calorie/protein averages)</span>
          </span>
        </label>
        {fastToday && (
          <div className="mt-3">
            {editingIntention ? (
              <>
                <label className="mb-1.5 block text-xs font-semibold" style={{ color: 'var(--foreground)' }}>What are you fasting for?</label>
                <textarea
                  value={fastIntention}
                  onChange={(e) => saveFastIntention(e.target.value)}
                  onBlur={confirmFastIntention}
                  placeholder="e.g. a companion who's struggling, a Friend's family…"
                  className="min-h-[60px] w-full rounded-xl border p-2.5 text-sm"
                  style={{ borderColor: 'var(--border)', background: 'var(--background)', color: 'var(--foreground)' }}
                />
                {fastIntention.trim() && (
                  <button
                    type="button"
                    onClick={confirmFastIntention}
                    className="mt-2 rounded-lg px-3 py-1.5 text-xs font-bold text-white"
                    style={{ background: 'var(--primary)' }}
                  >
                    Save
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between gap-2 rounded-lg p-2.5 text-sm" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
                <span>🙏 Fasting today for: <b>{fastIntention}</b></span>
                <button
                  type="button"
                  onClick={() => setEditingIntention(true)}
                  className="flex-none text-xs font-bold underline"
                  style={{ color: 'var(--secondary-foreground)' }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {ceilNote && (
        <div className="mb-3 rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--muted-foreground)' }}>{ceilNote}</div>
      )}

      <div className="mb-3 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--tint-3)' }}>
        <div className="mb-1 text-sm font-bold" style={{ color: 'var(--foreground)' }}>💧 Water today</div>
        <div className="mb-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>Goal: {g.water} oz</div>
        <div className="flex items-center justify-center gap-6">
          <button type="button" onClick={() => tapWater(-8)} className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>−8</button>
          <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{oz}<span className="ml-1 text-sm font-normal" style={{ color: 'var(--muted-foreground)' }}>oz</span></div>
          <button type="button" onClick={() => tapWater(8)} className="flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: 'var(--primary)' }}>＋8</button>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--foreground)' }}>⚡ Electrolytes: <b>{el}</b></span>
          <div className="flex gap-2">
            {el > 0 && <button type="button" onClick={() => tapElectrolyte(-1)} className="rounded-lg px-3 py-1.5 text-sm" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>−1</button>}
            <button type="button" onClick={() => tapElectrolyte(1)} className="rounded-lg px-3 py-1.5 text-sm" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>＋ Electrolytes</button>
          </div>
        </div>
      </div>

      <div className="mb-3 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--tint-4)' }}>
        <div className="mb-2 text-sm font-bold" style={{ color: 'var(--foreground)' }}>🙂 Mood today</div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => tapMood(n)} className="flex-1 rounded-lg py-2.5 text-sm font-bold" style={{ background: mood === n ? 'var(--primary)' : 'var(--secondary)', color: mood === n ? 'white' : 'var(--secondary-foreground)' }}>{n}</button>
          ))}
        </div>
      </div>

      <div className="mb-3 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--tint-4)' }}>
        <div className="mb-2 text-sm font-bold" style={{ color: 'var(--foreground)' }}>⚡ Energy today</div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => tapEnergy(n)} className="flex-1 rounded-lg py-2.5 text-sm font-bold" style={{ background: energy === n ? 'var(--primary)' : 'var(--secondary)', color: energy === n ? 'white' : 'var(--secondary-foreground)' }}>{n}</button>
          ))}
        </div>
      </div>

      <div className="mb-4 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="mb-1 text-sm font-bold" style={{ color: 'var(--foreground)' }}>How are you feeling?</div>
        <div className="mb-2.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>Tap one to see your own recent numbers.</div>
        <div className="mb-2 flex flex-wrap gap-2">
          {SYMPTOMS.map((s) => (
            <button key={s.key} type="button" onClick={() => setSymptom(symptom === s.key ? null : s.key)} className="rounded-lg px-3 py-1.5 text-sm" style={{ background: symptom === s.key ? 'var(--primary)' : 'var(--secondary)', color: symptom === s.key ? 'white' : 'var(--secondary-foreground)' }}>{s.label}</button>
          ))}
        </div>
        {sd && (
          <div className="mt-3 rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
            {sd.lowSpot ? (
              <>
                <div className="mb-1 text-xs font-bold uppercase" style={{ color: 'var(--gold-dark)' }}>Likely low spot · last 3 days</div>
                <div className="mb-2 text-sm" style={{ color: 'var(--foreground)' }}>Furthest below your goal right now: <b>{sd.lowSpot.name}</b>.</div>
                {sd.factors.map((f) => (
                  <div key={f.name} className="flex justify-between border-t py-1 text-sm" style={{ borderColor: 'var(--border)' }}>
                    <span style={{ color: 'var(--foreground)', fontWeight: f.isLowest ? 700 : 400 }}>{f.name}</span>
                    <span style={{ color: 'var(--muted-foreground)' }}>{f.fmt} / {f.goalTxt} · {f.pct}%</span>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Log sleep, water and food for a few days and the likely low spot shows here.</div>
            )}
            {sd.detailRows.length > 0 && (
              <>
                <div className="mb-1 mt-3 text-xs font-bold uppercase" style={{ color: 'var(--gold-dark)' }}>{sd.detailTitle}</div>
                {sd.detailRows.map((r, i) => (
                  <div key={i} className="flex justify-between py-0.5 text-sm" style={{ color: 'var(--foreground)' }}>
                    <span>{r.label}</span><span>{r.value}</span>
                  </div>
                ))}
              </>
            )}
            <div className="mt-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              This just shows your own recent numbers — not medical advice. If something feels severe, sudden, or doesn't go away, please see a doctor or your mission nurse line.
            </div>
          </div>
        )}
      </div>

      <button type="button" onClick={() => navigate('/health/hsetup')} className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
        Edit health profile &amp; goals
      </button>
    </div>
  );
}
