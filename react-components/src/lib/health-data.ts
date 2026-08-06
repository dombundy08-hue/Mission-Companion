import { getLS, setLS, uid } from './storage';
import { fmtDateShort } from './format';
import { cloudSaveHealth, cloudSaveSetting, cloudDeleteRow, cloudSaveSavedFood } from './supabase-sync';

export function isoDate(d?: Date): string {
  d = d || new Date();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}
export function daysAgoTs(n: number): number {
  return Date.now() - n * 86400000;
}
function avgOf(arr: number[]): number | null {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}
export function round1(x: number | null): number | null {
  return x == null ? null : Math.round(x * 10) / 10;
}
/* ---------- Weekly reflection pop-up: surfaces whichever tracked area
   (calories/protein/journal/miracles) is lowest relative to its own goal
   this week, with a gentle nudge — and a per-week "excuse this" so a false
   flag (e.g. journaling on paper instead) doesn't nag every time. */
export function weekKey(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return isoDate(monday);
}
export function reflectionShownThisWeek(): boolean {
  return getLS<string | null>('weeklyReflectionShown', null) === weekKey();
}
export function markReflectionShown() {
  setLS('weeklyReflectionShown', weekKey());
}
export function getExcusedAreas(): string[] {
  const rec = getLS<Record<string, string[]>>('weeklyReflectionExcused', {});
  return rec[weekKey()] || [];
}
export function excuseArea(area: string) {
  const rec = getLS<Record<string, string[]>>('weeklyReflectionExcused', {});
  const wk = weekKey();
  rec[wk] = [...(rec[wk] || []), area];
  setLS('weeklyReflectionExcused', rec);
}

// Fasting is tracked per calendar date, not a single slot — a missionary
// can fast more than once (not just Sundays), and each fast day needs to
// stay excluded from calorie/protein averages permanently, not just while
// it happens to be the one "active" day.
function migrateLegacyFastDataOnce() {
  const legacyDate = localStorage.getItem('healthFastSunday');
  if (legacyDate == null) return; // nothing to migrate, or already migrated
  let date: string | null = null;
  try { date = JSON.parse(legacyDate); } catch { /* ignore */ }
  if (date) {
    const days = getLS<string[]>('healthFastDays', []);
    if (!days.includes(date)) {
      const next = [...days, date];
      setLS('healthFastDays', next);
      cloudSaveSetting('healthFastDays', next);
    }
    const legacyIntentionRaw = localStorage.getItem('healthFastSundayIntention');
    let legacyIntention = '';
    try { legacyIntention = legacyIntentionRaw ? JSON.parse(legacyIntentionRaw) : ''; } catch { /* ignore */ }
    if (legacyIntention.trim()) {
      const intentions = getLS<Record<string, string>>('healthFastIntentions', {});
      if (!intentions[date]) {
        intentions[date] = legacyIntention;
        setLS('healthFastIntentions', intentions);
        cloudSaveSetting('healthFastIntentions', intentions);
      }
    }
  }
  localStorage.removeItem('healthFastSunday');
  localStorage.removeItem('healthFastSundayIntention');
}
export function getFastDays(): string[] {
  migrateLegacyFastDataOnce();
  return getLS<string[]>('healthFastDays', []);
}
export function isFasting(date: string): boolean {
  return getFastDays().includes(date);
}
export function toggleFasting(date: string) {
  const days = getFastDays();
  const isOn = days.includes(date);
  const next = isOn ? days.filter((d) => d !== date) : [...days, date];
  setLS('healthFastDays', next);
  cloudSaveSetting('healthFastDays', next);
  if (isOn) {
    const intentions = getLS<Record<string, string>>('healthFastIntentions', {});
    delete intentions[date];
    setLS('healthFastIntentions', intentions);
    cloudSaveSetting('healthFastIntentions', intentions);
  }
}
export function getFastingIntention(date: string): string {
  migrateLegacyFastDataOnce();
  return getLS<Record<string, string>>('healthFastIntentions', {})[date] || '';
}
export function setFastingIntention(date: string, text: string) {
  const intentions = getLS<Record<string, string>>('healthFastIntentions', {});
  intentions[date] = text;
  setLS('healthFastIntentions', intentions);
  cloudSaveSetting('healthFastIntentions', intentions);
}

// First-open-of-the-day reminder of what you're fasting for — separate from
// the Weekly Reflection pop-up, keyed by calendar day since it only applies
// when today is an active fast day with a saved intention.
export function fastReminderShownToday(): boolean {
  return getLS<string | null>('fastReminderShown', null) === isoDate();
}
export function markFastReminderShown() {
  setLS('fastReminderShown', isoDate());
}
export function shouldShowFastReminder(): boolean {
  const today = isoDate();
  if (!isFasting(today)) return false;
  if (!getFastingIntention(today).trim()) return false;
  return !fastReminderShownToday();
}

export interface HealthGoals {
  profile?: {
    units?: string;
    age?: string;
    sex?: string;
    heightFt?: string;
    heightIn?: string;
    heightCm?: string;
    weight?: string;
    activity?: string;
    goalWeight?: string;
  };
  calories: number;
  protein: number | null;
  sleep: number;
  water: number;
  weightCeiling: number | null;
}

export function getGoals(): HealthGoals | null {
  const g = getLS<HealthGoals | null>('healthGoals', null);
  return g && typeof g === 'object' ? g : null;
}

export function computeCalorieGoal(p: NonNullable<HealthGoals['profile']>): number | null {
  let kg: number, cm: number;
  if (p.units === 'metric') {
    kg = parseFloat(p.weight || '');
    cm = parseFloat(p.heightCm || '');
  } else {
    kg = (parseFloat(p.weight || '') || 0) * 0.453592;
    cm = (((parseInt(p.heightFt || '', 10) || 0) * 12) + (parseFloat(p.heightIn || '') || 0)) * 2.54;
  }
  const age = parseInt(p.age || '', 10) || 0;
  if (!kg || !cm || !age) return null;
  const bmr = 10 * kg + 6.25 * cm - 5 * age + (p.sex === 'female' ? -161 : 5);
  const mult = ({ sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 } as Record<string, number>)[p.activity || ''] || 1.2;
  return Math.round(bmr * mult);
}

interface DayRow {
  id: string;
  cloudId?: string;
  entryDate: string;
  timestamp: number;
  [key: string]: unknown;
}

export function todaysRow(localKey: string): DayRow | null {
  const t = isoDate();
  return getLS<DayRow[]>(localKey, []).find((e) => e.entryDate === t) || null;
}

export function saveDayRow(localKey: string, field: string, value: unknown): DayRow {
  const t = isoDate();
  const arr = getLS<DayRow[]>(localKey, []);
  let row = arr.find((e) => e.entryDate === t);
  if (row) {
    row[field] = value;
    row.timestamp = Date.now();
  } else {
    row = { id: uid(), entryDate: t, timestamp: Date.now() };
    row[field] = value;
    arr.push(row);
  }
  setLS(localKey, arr);
  cloudSaveHealth(localKey, row);
  return row;
}

/* green (near/at goal) - gray (moderately off) - red (severely off) - grace band */
export function statusColor(value: number | null, goal: number | null | undefined): 'green' | 'gray' | 'red' | null {
  if (value == null || !goal) return null;
  const r = value / goal;
  if (r >= 0.85 && r <= 1.4) return 'green';
  if (r < 0.6 || r > 1.6) return 'red';
  return 'gray';
}
/* Calories use an absolute band: on track only within +/-500 cal of goal */
export function calStatusColor(value: number | null, goal: number | null | undefined): 'green' | 'gray' | 'red' | null {
  if (value == null || !goal) return null;
  const d = Math.abs(value - goal);
  if (d <= 500) return 'green';
  if (d <= 1000) return 'gray';
  return 'red';
}
export function calStatusWord(value: number | null, goal: number | null | undefined): string {
  if (value == null || !goal) return '';
  const d = value - goal;
  const ad = Math.abs(d);
  if (ad <= 500) return 'On track';
  if (d < 0) return ad <= 1000 ? 'Below goal' : 'Well below goal';
  return ad <= 1000 ? 'Above goal' : 'Well above goal';
}
export function statusWord(value: number | null, goal: number | null | undefined): string {
  if (value == null || !goal) return '';
  const r = value / goal;
  if (r >= 0.85 && r <= 1.4) return 'On track';
  if (r < 0.6) return 'Well below goal';
  if (r > 1.6) return 'Well above goal';
  if (r < 0.85) return 'Below goal';
  return 'Above goal';
}

/* neutral weight-ceiling notice: 7-day rolling avg, needs 3+ days so one spike can't trip it */
export function weightCeilingNotice(): string | null {
  const g = getGoals();
  if (!g || g.weightCeiling == null) return null;
  const ceil = g.weightCeiling;
  if (!ceil) return null;
  const pts = getLS<DayRow[]>('healthWeight', []).filter((e) => e.timestamp >= daysAgoTs(7) && e.weight != null);
  if (pts.length < 3) return null;
  const avg = avgOf(pts.map((e) => +(e.weight as number)));
  if (avg == null) return null;
  const metric = g.profile?.units === 'metric';
  const avgLb = metric ? avg * 2.20462 : avg;
  return avgLb > ceil ? 'Your weight has been trending above the level you set.' : null;
}

export interface WeightPoint {
  timestamp: number;
  weight: number;
}
export interface WeightTrend {
  label: string;
  dir?: string;
  delta?: number;
  pts: WeightPoint[];
  unit: string;
}

export function weightTrend(days?: number): WeightTrend {
  days = days || 30;
  const pts = getLS<DayRow[]>('healthWeight', [])
    .filter((e) => e.timestamp >= daysAgoTs(days!) && e.weight != null)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((e) => ({ timestamp: e.timestamp, weight: +(e.weight as number) }));
  const g = getGoals();
  const unit = g?.profile?.units === 'metric' ? 'kg' : 'lb';
  const span = `over ${days} days`;
  if (pts.length < 2) return { label: 'not enough data yet', pts, unit };
  const delta = pts[pts.length - 1].weight - pts[0].weight;
  const dir = delta > 0.3 ? 'trending up' : delta < -0.3 ? 'trending down' : 'holding steady';
  const amt = Math.abs(Math.round(delta * 10) / 10);
  const label = dir === 'holding steady' ? `holding steady ${span}` : `${dir} ${amt} ${unit} ${span}`;
  return { label, dir, delta, pts, unit };
}

/* 0-100 "how close to goal weight" percentage, matching the shape every
   other metric's ring trend already uses. No goal weight set, or no data
   in the window, both read as 0 (empty ring) rather than a misleading 100. */
export function weightGoalTrend(days?: number): number {
  const g = getGoals();
  const goalWeight = g?.profile?.goalWeight ? parseFloat(g.profile.goalWeight) : null;
  const pts = getLS<DayRow[]>('healthWeight', [])
    .filter((e) => e.timestamp >= daysAgoTs(days || 30) && e.weight != null)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (!pts.length || !goalWeight) return 0;
  const latest = +(pts[pts.length - 1].weight as number);
  const pct = 100 - Math.round((Math.abs(latest - goalWeight) / goalWeight) * 100);
  return Math.max(0, Math.min(100, pct));
}

export function fmtEntryDate(s: string): string {
  const p = String(s || '').split('-');
  if (p.length !== 3) return s || '';
  return fmtDateShort(new Date(+p[0], +p[1] - 1, +p[2]));
}

export interface HealthAverages {
  cal: number | null;
  prot: number | null;
  eatingDays: number;
  sleep: number | null;
  water: number | null;
  mood: number | null;
  energy: number | null;
  calUsedMedian: boolean;
  protUsedMedian: boolean;
}

interface FoodEntry {
  entryDate: string;
  timestamp: number;
  calories?: number;
  protein?: number;
}

function daysAgoFromDate(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(isoDate() + 'T00:00:00');
  return Math.round((today.getTime() - d.getTime()) / 86400000);
}

/* Averages per-week first, then averages those weekly averages — rather than
   pooling every logged day together — so a week with fewer logged days
   doesn't get silently over- or under-weighted against a fuller week.
   Falls back to the median of the weekly averages when they vary a lot
   from each other (>35% deviation from their mean), since a wildly
   different week is more likely a real anomaly than representative noise. */
function weeklyBucketAverage(dayValues: Record<string, number>, days: number): { value: number | null; usedMedian: boolean } {
  const numBuckets = Math.max(1, Math.ceil(days / 7));
  const buckets: number[][] = Array.from({ length: numBuckets }, () => []);
  Object.entries(dayValues).forEach(([date, val]) => {
    const ago = daysAgoFromDate(date);
    const idx = Math.floor(ago / 7);
    if (idx >= 0 && idx < numBuckets) buckets[idx].push(val);
  });
  const weekAvgs = buckets.map((b) => avgOf(b)).filter((v): v is number => v != null);
  if (!weekAvgs.length) return { value: null, usedMedian: false };
  if (weekAvgs.length === 1) return { value: weekAvgs[0], usedMedian: false };
  const mean = avgOf(weekAvgs) as number;
  const maxDevRatio = mean ? Math.max(...weekAvgs.map((v) => Math.abs(v - mean))) / Math.abs(mean) : 0;
  if (maxDevRatio > 0.35) {
    const sorted = [...weekAvgs].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return { value: median, usedMedian: true };
  }
  return { value: mean, usedMedian: false };
}

/* same averaging logic the Today snapshot uses - shared so Stats matches exactly */
export function healthAverages(days: number): HealthAverages {
  const foodSums: Record<string, number> = {};
  const protSums: Record<string, number> = {};
  const fastDays = new Set(getFastDays());
  getLS<FoodEntry[]>('healthFood', []).forEach((e) => {
    if (e.timestamp >= daysAgoTs(days)) {
      if (fastDays.has(e.entryDate)) return;
      foodSums[e.entryDate] = (foodSums[e.entryDate] || 0) + (e.calories || 0);
      protSums[e.entryDate] = (protSums[e.entryDate] || 0) + (e.protein || 0);
    }
  });
  const eatingDays = Object.keys(foodSums).length;
  const calResult = weeklyBucketAverage(foodSums, days);
  const protResult = weeklyBucketAverage(protSums, days);
  return {
    cal: calResult.value,
    prot: protResult.value,
    calUsedMedian: calResult.usedMedian,
    protUsedMedian: protResult.usedMedian,
    eatingDays,
    sleep: avgOf(getLS<DayRow[]>('healthSleep', []).filter((e) => e.timestamp >= daysAgoTs(days) && e.hours != null).map((e) => +(e.hours as number))),
    water: avgOf(Object.values(waterDayMap(days)).map((d) => d.oz)),
    mood: avgOf(getLS<DayRow[]>('healthMood', []).filter((e) => e.timestamp >= daysAgoTs(days) && (e.score as number) != null && (e.score as number) > 0).map((e) => +(e.score as number))),
    energy: avgOf(getLS<DayRow[]>('healthMood', []).filter((e) => e.timestamp >= daysAgoTs(days) && (e.energy as number) != null && (e.energy as number) > 0).map((e) => +(e.energy as number))),
  };
}

// Today's actual logged totals (not averaged) — for a "Today" snapshot.
export function todaysFoodTotals(): { calories: number; protein: number } {
  const t = isoDate();
  let calories = 0;
  let protein = 0;
  getLS<FoodEntry[]>('healthFood', []).forEach((e) => {
    if (e.entryDate === t) {
      calories += e.calories || 0;
      protein += e.protein || 0;
    }
  });
  return { calories, protein };
}

interface WaterRow {
  entryDate: string;
  timestamp: number;
  oz?: number;
  cups?: number;
  electrolytes?: number;
}
function waterOz(row: WaterRow | undefined): number {
  if (!row) return 0;
  if (row.oz != null) return +row.oz;
  if (row.cups != null) return +row.cups * 8;
  return 0;
}
function electroOf(row: WaterRow | undefined): number {
  return row && row.electrolytes != null ? +row.electrolytes : 0;
}
export function waterTotal(date?: string): number {
  date = date || isoDate();
  return getLS<WaterRow[]>('healthWater', []).filter((e) => e.entryDate === date).reduce((s, e) => s + waterOz(e), 0);
}
export function electroTotal(date?: string): number {
  date = date || isoDate();
  return getLS<WaterRow[]>('healthWater', []).filter((e) => e.entryDate === date).reduce((s, e) => s + electroOf(e), 0);
}
export function waterDayMap(days: number): Record<string, { oz: number; el: number }> {
  const cut = daysAgoTs(days);
  const m: Record<string, { oz: number; el: number }> = {};
  getLS<WaterRow[]>('healthWater', []).forEach((e) => {
    if ((e.timestamp || 0) >= cut) {
      if (!m[e.entryDate]) m[e.entryDate] = { oz: 0, el: 0 };
      m[e.entryDate].oz += waterOz(e);
      m[e.entryDate].el += electroOf(e);
    }
  });
  return m;
}
export function waterDailyTotals(n: number): { entryDate: string; oz: number; el: number; ts: number }[] {
  const m: Record<string, { entryDate: string; oz: number; el: number; ts: number }> = {};
  getLS<WaterRow[]>('healthWater', []).forEach((e) => {
    if (!m[e.entryDate]) m[e.entryDate] = { entryDate: e.entryDate, oz: 0, el: 0, ts: 0 };
    m[e.entryDate].oz += waterOz(e);
    m[e.entryDate].el += electroOf(e);
    m[e.entryDate].ts = Math.max(m[e.entryDate].ts, e.timestamp || 0);
  });
  return Object.values(m).sort((a, b) => b.ts - a.ts).slice(0, n);
}
/* append a new timestamped row (never overwrites an existing one) */
export function addTap(localKey: string, field: string, amount: number): DayRow {
  const row: DayRow = { id: uid(), entryDate: isoDate(), timestamp: Date.now() };
  row[field] = amount;
  const arr = getLS<DayRow[]>(localKey, []);
  arr.push(row);
  setLS(localKey, arr);
  cloudSaveHealth(localKey, row);
  return row;
}

/* symptom check-in: taps map to the user's own recent logged numbers */
export const SYMPTOMS = [
  { key: 'headache', label: 'Headache' },
  { key: 'lightheaded', label: 'Light-headed' },
  { key: 'tired', label: 'Tired / fatigued' },
  { key: 'sore', label: 'Sore / muscle soreness' },
  { key: 'lowmood', label: 'Low mood / irritable' },
  { key: 'sleepq', label: 'Trouble sleeping' },
];

function recentRows<T extends { timestamp?: number }>(localKey: string, n: number): T[] {
  return getLS<T[]>(localKey, []).slice().sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, n);
}

interface Factor {
  name: string;
  val: number | null;
  goal: number;
  unit: string;
  fmt: (v: number) => number | null;
  ratio?: number;
}
/* rank the goal-based inputs by how far below goal they've run recently - lowest first */
function lowestFactors(days: number): Factor[] {
  const g = getGoals();
  const a = healthAverages(days);
  const f: Factor[] = [];
  if (!g) return f;
  if (g.calories) f.push({ name: 'Calories', val: a.cal, goal: g.calories, unit: '', fmt: (v) => Math.round(v) });
  if (g.protein != null) f.push({ name: 'Protein', val: a.prot, goal: g.protein, unit: ' g', fmt: (v) => Math.round(v) });
  if (g.sleep) f.push({ name: 'Sleep', val: a.sleep, goal: g.sleep, unit: ' hrs', fmt: (v) => round1(v) });
  if (g.water) f.push({ name: 'Water', val: a.water, goal: g.water, unit: ' oz', fmt: (v) => Math.round(v) });
  return f
    .filter((x) => x.val != null)
    .map((x) => ({ ...x, ratio: (x.val as number) / x.goal }))
    .sort((x, y) => (x.ratio || 0) - (y.ratio || 0));
}

export interface SymptomDataResult {
  lowSpot: { name: string; fmt: string; goalTxt: string; pct: number } | null;
  factors: { name: string; fmt: string; goalTxt: string; pct: number; isLowest: boolean }[];
  detailTitle: string;
  detailRows: { label: string; value: string }[];
}

export function symptomData(key: string): SymptomDataResult {
  const f = lowestFactors(3);
  const factors = f.map((x, i) => ({
    name: x.name,
    fmt: String(x.fmt(x.val as number)),
    goalTxt: `${x.goal}${x.unit}`,
    pct: Math.round((x.ratio || 0) * 100),
    isLowest: i === 0,
  }));

  let detailTitle = '';
  let detailRows: { label: string; value: string }[] = [];
  if (key === 'headache' || key === 'lightheaded') {
    const w = waterDailyTotals(3);
    detailTitle = 'Water & electrolytes · recent';
    detailRows = w.map((d) => ({ label: fmtEntryDate(d.entryDate), value: `${Math.round(d.oz)} oz · ${d.el} elec` }));
  } else if (key === 'tired' || key === 'sleepq') {
    const s = recentRows<DayRow>('healthSleep', 4).filter((e) => e.hours != null);
    detailTitle = 'Recent sleep';
    detailRows = s.map((e) => ({ label: fmtEntryDate(e.entryDate), value: `${e.hours} hrs` }));
  } else if (key === 'sore') {
    interface WorkoutLogRow { routineName?: string; durationSec?: number; timestamp?: number }
    const r = recentRows<WorkoutLogRow>('workoutLog', 5);
    detailTitle = 'Recent workouts';
    detailRows = r.map((e) => ({ label: e.routineName || 'Workout', value: `${Math.round((e.durationSec || 0) / 60)} min` }));
  } else if (key === 'lowmood') {
    const m = recentRows<DayRow>('healthMood', 5).filter((e) => e.score != null);
    detailTitle = 'Recent mood';
    detailRows = m.map((e) => ({ label: fmtEntryDate(e.entryDate), value: `${e.score}/5` }));
  }

  return {
    lowSpot: factors.length ? { name: factors[0].name, fmt: factors[0].fmt, goalTxt: factors[0].goalTxt, pct: factors[0].pct } : null,
    factors,
    detailTitle,
    detailRows,
  };
}

/* ---------- food search ---------- */
export interface FoodResult {
  name: string;
  kcal100: number | null;
  prot100: number | null;
  servingSize: number | null;
  servingText: string;
  source?: string;
}

/* USDA FoodData Central search. Values in search results are per 100g;
   pulls Energy (nutrientNumber 208, kcal) and Protein (203, g). */
export async function usdaSearch(query: string): Promise<FoodResult[]> {
  const key = import.meta.env.VITE_USDA_KEY;
  if (!key) throw new Error('nokey');
  const url =
    'https://api.nal.usda.gov/fdc/v1/foods/search?api_key=' +
    encodeURIComponent(key) +
    '&query=' +
    encodeURIComponent(query) +
    '&pageSize=20';
  const res = await fetch(url);
  if (!res.ok) throw new Error('status ' + res.status);
  const data = await res.json();
  interface UsdaNutrient { nutrientNumber?: string | number; nutrient?: { number?: string | number }; unitName?: string; value?: number }
  interface UsdaFood { description?: string; foodNutrients?: UsdaNutrient[]; servingSize?: number; servingSizeUnit?: string; householdServingFullText?: string }
  return ((data.foods || []) as UsdaFood[])
    .map((f) => {
      let kcal: number | null = null;
      let prot: number | null = null;
      (f.foodNutrients || []).forEach((n) => {
        const num = String(n.nutrientNumber || n.nutrient?.number || '');
        const unit = String(n.unitName || '').toUpperCase();
        if (num === '208' && unit === 'KCAL' && kcal == null) kcal = n.value ?? null;
        if (num === '203' && prot == null) prot = n.value ?? null;
      });
      const servG = f.servingSize && /^g$/i.test(f.servingSizeUnit || '') ? f.servingSize : null;
      return { name: f.description || '', kcal100: kcal, prot100: prot, servingSize: servG, servingText: f.householdServingFullText || '' };
    })
    .filter((f) => f.name && f.kcal100 != null && f.prot100 != null);
}

/* Open Food Facts - free, no key, good for branded/packaged items. Per-100g values. */
export async function offSearch(query: string): Promise<FoodResult[]> {
  const url =
    'https://world.openfoodfacts.net/cgi/search.pl?search_terms=' +
    encodeURIComponent(query) +
    '&search_simple=1&action=process&json=1&page_size=12&fields=product_name,brands,nutriments,serving_quantity';
  const res = await fetch(url);
  if (!res.ok) throw new Error('status ' + res.status);
  const data = await res.json();
  interface OffProduct { product_name?: string; brands?: string; nutriments?: Record<string, number>; serving_quantity?: number }
  return ((data.products || []) as OffProduct[])
    .map((p) => {
      const n = p.nutriments || {};
      const kcal = n['energy-kcal_100g'];
      const prot = n['proteins_100g'];
      const brand = (p.brands || '').split(',')[0].trim();
      const pname = (p.product_name || '').trim();
      const name = brand && pname ? brand + ' — ' + pname : pname || brand;
      return {
        name,
        kcal100: kcal != null ? +kcal : null,
        prot100: prot != null ? +prot : null,
        servingSize: p.serving_quantity ? +p.serving_quantity : null,
        servingText: '',
        source: 'off',
      };
    })
    .filter((f) => f.name && f.kcal100 != null && f.prot100 != null);
}

/* ---------- saved foods: local-first list + one-tap logging ---------- */
export interface SavedFood {
  id: string;
  cloudId?: string;
  name: string;
  calories: number | null;
  protein: number | null;
  createdAt: number;
}

export function getSavedFoods(): SavedFood[] {
  return getLS<SavedFood[]>('savedFoods', []);
}
export function addSavedFood(name: string, calories: string | number, protein: string | number): SavedFood {
  const row: SavedFood = {
    id: uid(),
    name: (name || '').trim(),
    calories: calories == null || calories === '' ? null : Math.round(parseFloat(String(calories))),
    protein: protein == null || protein === '' || isNaN(parseFloat(String(protein))) ? null : Math.round(parseFloat(String(protein))),
    createdAt: Date.now(),
  };
  const arr = getSavedFoods();
  arr.push(row);
  setLS('savedFoods', arr);
  cloudSaveSavedFood(row);
  return row;
}
export function deleteSavedFood(id: string) {
  const arr = getSavedFoods();
  const it = arr.find((x) => x.id === id);
  if (it) cloudDeleteRow('saved_foods', it);
  setLS('savedFoods', arr.filter((x) => x.id !== id));
}
export function logSavedFood(sf: SavedFood) {
  const row = {
    id: uid(),
    entryDate: isoDate(),
    timestamp: Date.now(),
    description: sf.name,
    calories: sf.calories || 0,
    protein: sf.protein == null ? null : sf.protein,
    source: 'saved',
  };
  const arr = getLS<typeof row[]>('healthFood', []);
  arr.push(row);
  setLS('healthFood', arr);
  cloudSaveHealth('healthFood', row);
}

/* count identical food entries (exact match: name+calories+protein) within N days */
export function countIdenticalFoodInWindow(name: string, calories: number | null, protein: number | null, days = 90): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const all = getLS<FoodEntry[]>('healthFood', []);
  return all.filter(
    (f) =>
      (f.timestamp || 0) >= cutoff &&
      (f as unknown as { description?: string }).description === name &&
      f.calories === calories &&
      (f.protein || null) === (protein || null)
  ).length;
}

export { cloudSaveSetting };
