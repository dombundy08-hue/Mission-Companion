import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGoals, computeCalorieGoal, cloudSaveSetting, type HealthGoals } from '@/lib/health-data';
import { setLS } from '@/lib/storage';

function parseGoalWeight(s: string): number | null {
  s = String(s == null ? '' : s).trim();
  if (!s) return null;
  const m = s.match(/(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)/);
  if (m) return (parseFloat(m[1]) + parseFloat(m[2])) / 2;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}
function bodyWeightLb(p: NonNullable<HealthGoals['profile']>): number | null {
  const w = parseFloat(p.weight || '');
  if (!w) return null;
  return p.units === 'metric' ? w * 2.20462 : w;
}

export function HealthSetup() {
  const navigate = useNavigate();
  const g = getGoals();
  const p = g?.profile || {};
  const [units, setUnits] = useState(p.units || 'imperial');
  const [age, setAge] = useState(p.age || '');
  const [sex, setSex] = useState(p.sex || 'male');
  const [heightFt, setHeightFt] = useState(p.heightFt || '');
  const [heightIn, setHeightIn] = useState(p.heightIn || '');
  const [heightCm, setHeightCm] = useState(p.heightCm || '');
  const [weight, setWeight] = useState(p.weight || '');
  const [goalWeight, setGoalWeight] = useState(p.goalWeight || '');
  const [activity, setActivity] = useState(p.activity || 'sedentary');
  const [cal, setCal] = useState(g ? String(g.calories) : '');
  const [protein, setProtein] = useState(g?.protein != null ? String(g.protein) : '');
  const [sleep, setSleep] = useState(g ? String(g.sleep) : '7.5');
  const [water, setWater] = useState(g ? String(g.water) : '64');
  const [ceiling, setCeiling] = useState(g?.weightCeiling != null ? String(g.weightCeiling) : '');
  const [flash, setFlash] = useState<string | null>(null);

  function profile(): NonNullable<HealthGoals['profile']> {
    return { units, age, sex, heightFt, heightIn, heightCm, weight, activity, goalWeight };
  }

  function suggest() {
    const prof = profile();
    const base = computeCalorieGoal(prof);
    if (base == null) {
      alert('Fill in age, height and weight to suggest a calorie goal.');
      return;
    }
    let c = base;
    const goalW = parseGoalWeight(goalWeight);
    const curLb = bodyWeightLb(prof);
    if (goalW && curLb) {
      if (goalW < curLb - 0.5) c -= 500;
      else if (goalW > curLb + 0.5) c += 500;
    }
    setCal(String(c));
    const lb = bodyWeightLb(prof);
    if (lb) setProtein(String(Math.round(lb * 0.7)));
    if (!sleep) setSleep('7.5');
    if (!water) setWater('64');
    setFlash('Suggested — edit any of them.');
    setTimeout(() => setFlash(null), 1900);
  }

  function saveGoals() {
    const calN = parseInt(cal, 10);
    const proteinN = parseInt(protein, 10);
    const sleepN = parseFloat(sleep);
    const waterN = parseInt(water, 10);
    const ceilN = ceiling === '' ? null : parseFloat(ceiling);
    if (!calN) {
      alert('Enter a calorie goal (or tap "Suggest goals from profile").');
      return;
    }
    const goals: HealthGoals = {
      profile: profile(),
      calories: calN,
      protein: isNaN(proteinN) ? null : proteinN,
      sleep: isNaN(sleepN) ? 7.5 : sleepN,
      water: isNaN(waterN) ? 64 : waterN,
      weightCeiling: ceilN == null || isNaN(ceilN) ? null : ceilN,
    };
    setLS('healthGoals', goals);
    cloudSaveSetting('healthGoals', goals);
    setFlash('Goals saved.');
    setTimeout(() => {
      setFlash(null);
      navigate('/health/health');
    }, 600);
  }

  return (
    <div>
      {g && (
        <button type="button" onClick={() => navigate('/health/health')} className="mb-3 text-sm font-medium" style={{ color: 'var(--primary)' }}>
          ← Back
        </button>
      )}
      <h2 className="mb-3 text-[22px] font-bold" style={{ color: 'var(--navy)' }}>🍎 Health setup</h2>
      {flash && (
        <div className="mb-3 rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}>
          {flash}
        </div>
      )}

      <div className="mb-3 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="mb-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Used to suggest a daily calorie goal. Everything stays on your device and your private database.
        </div>

        <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Units</label>
        <select value={units} onChange={(e) => setUnits(e.target.value)} className="mb-3 h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}>
          <option value="imperial">Imperial (lb, ft/in)</option>
          <option value="metric">Metric (kg, cm)</option>
        </select>

        <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Age</label>
        <input type="number" min={10} max={100} value={age} onChange={(e) => setAge(e.target.value)} className="mb-3 h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} />

        <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          Sex <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>(for the calorie formula)</span>
        </label>
        <select value={sex} onChange={(e) => setSex(e.target.value)} className="mb-3 h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>

        {units === 'imperial' ? (
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Height</label>
            <div className="flex gap-2">
              <input type="number" min={3} max={8} placeholder="ft" value={heightFt} onChange={(e) => setHeightFt(e.target.value)} className="h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} />
              <input type="number" min={0} max={11} placeholder="in" value={heightIn} onChange={(e) => setHeightIn(e.target.value)} className="h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} />
            </div>
          </div>
        ) : (
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Height (cm)</label>
            <input type="number" min={120} max={230} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} className="h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} />
          </div>
        )}

        <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Current weight ({units === 'metric' ? 'kg' : 'lb'})</label>
        <input type="number" min={50} max={600} value={weight} onChange={(e) => setWeight(e.target.value)} className="mb-3 h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} />

        <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          Goal weight (lb) <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>(optional — a number or range like 170-175)</span>
        </label>
        <input type="text" placeholder="blank = maintenance" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} className="mb-3 h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} />

        <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Activity level</label>
        <select value={activity} onChange={(e) => setActivity(e.target.value)} className="mb-3 h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}>
          <option value="sedentary">Sedentary — little exercise</option>
          <option value="light">Light — 1–3 days/week</option>
          <option value="moderate">Moderate — 3–5 days/week</option>
          <option value="active">Active — 6–7 days/week</option>
        </select>

        <button type="button" onClick={suggest} className="w-full rounded-xl py-2.5 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
          Suggest goals from profile
        </button>
      </div>

      <div className="mb-4 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="mb-3 text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--gold-dark)' }}>Daily goals (editable)</div>

        <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Calories</label>
        <input type="number" min={800} max={6000} value={cal} onChange={(e) => setCal(e.target.value)} className="mb-3 h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} />

        <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Protein (g)</label>
        <input type="number" min={0} max={400} value={protein} onChange={(e) => setProtein(e.target.value)} className="mb-3 h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} />

        <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Sleep (hours)</label>
        <input type="number" min={3} max={12} step={0.5} value={sleep} onChange={(e) => setSleep(e.target.value)} className="mb-3 h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} />

        <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Water (oz)</label>
        <input type="number" min={8} max={200} step={8} value={water} onChange={(e) => setWater(e.target.value)} className="mb-3 h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} />

        <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
          Weight ceiling (lb) <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>(optional)</span>
        </label>
        <input type="number" min={0} max={700} placeholder="leave blank to disable" value={ceiling} onChange={(e) => setCeiling(e.target.value)} className="mb-1 h-12 w-full rounded-xl border px-3" style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }} />
        <div className="mb-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>If set, a quiet note appears only when your 7-day average is above this.</div>

        <button type="button" onClick={saveGoals} className="w-full rounded-xl py-3 text-[17px] font-bold text-white" style={{ background: 'var(--primary)' }}>
          Save Goals
        </button>
      </div>
    </div>
  );
}
