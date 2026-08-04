import { getLS, setLS, uid } from './storage';
import { cloudSaveRoutine, cloudSaveWorkoutLog } from './supabase-sync';

export interface TimedItem { name: string; seconds: number }
export interface RepItem { name: string; sets: number; reps: number | null; rest: number; note?: string }
export interface CircuitItem { name: string }

export interface TimedPart { kind: 'part'; type: 'timed'; items: TimedItem[] }
export interface RepPart { kind: 'part'; type: 'rep'; items: RepItem[] }
export interface CircuitPart { kind: 'part'; type: 'circuit'; rounds: number; work: number; rest: number; restRounds: number; items: CircuitItem[] }
export type RoutinePart = TimedPart | RepPart | CircuitPart;

export interface Routine {
  id: string;
  cloudId?: string;
  name: string;
  steps: RoutinePart[] | TimedItem[]; // legacy flat arrays auto-wrap via routineParts()
  createdAt: number;
}

export const SAMPLE_ROUTINE = {
  name: 'Quick Morning Set',
  steps: [
    { name: 'Warm up — march in place', seconds: 60 },
    { name: 'Push-ups', seconds: 45 },
    { name: 'Rest', seconds: 20 },
    { name: 'Squats', seconds: 45 },
    { name: 'Rest', seconds: 20 },
    { name: 'Plank', seconds: 40 },
    { name: 'Rest', seconds: 20 },
    { name: 'Lunges', seconds: 45 },
    { name: 'Cool down — stretch', seconds: 60 },
  ] as TimedItem[],
};

export function getRoutines(): Routine[] {
  const a = getLS<Routine[]>('workoutRoutines', []);
  return Array.isArray(a) ? a : [];
}

export function fmtClock(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}
export function isRest(name: string): boolean {
  return /^\s*rest\b/i.test(name || '');
}

function isPartArray(steps: unknown): steps is RoutinePart[] {
  return Array.isArray(steps) && !!steps[0] && (steps[0] as RoutinePart).kind === 'part';
}
export function routineParts(r: Routine): RoutinePart[] {
  const s = r && r.steps;
  if (isPartArray(s)) return s;
  if (Array.isArray(s) && s.some((x) => x && (x as unknown as { type?: string }).type === 'rep')) {
    const items = s as unknown as RepItem[];
    return [{ kind: 'part', type: 'rep', items: items.map((x) => ({ name: x.name, sets: x.sets, reps: x.reps, rest: x.rest, note: x.note })) }];
  }
  return [{ kind: 'part', type: 'timed', items: ((s as TimedItem[]) || []).map((x) => ({ name: x.name, seconds: x.seconds })) }];
}
export function clonePart<T>(p: T): T {
  return JSON.parse(JSON.stringify(p));
}
export function partTypeLabel(t: string): string {
  return t === 'rep' ? 'Reps' : t === 'circuit' ? 'Circuit' : 'Timed';
}
export function partTotalSec(p: RoutinePart): number {
  if (p.type === 'timed') return (p.items || []).reduce((s, x) => s + (x.seconds || 0), 0);
  if (p.type === 'circuit') {
    const n = (p.items || []).length, rounds = p.rounds || 1, work = p.work || 0, rest = p.rest || 0, rr = p.restRounds || 0;
    return rounds * (n * work + Math.max(0, n - 1) * rest) + Math.max(0, rounds - 1) * rr;
  }
  return 0;
}
export function partSummary(p: RoutinePart): string {
  if (p.type === 'rep') {
    const n = (p.items || []).length;
    return `Reps · ${n} exercise${n === 1 ? '' : 's'}`;
  }
  if (p.type === 'circuit') return `Circuit · ${p.rounds || 1} rounds × ${(p.items || []).length} moves`;
  const n = (p.items || []).length;
  return `Timed · ${n} step${n === 1 ? '' : 's'} · ${fmtClock(partTotalSec(p))}`;
}
export function routineMeta(r: Routine): string {
  const parts = routineParts(r);
  if (parts.length === 1) return partSummary(parts[0]);
  return `${parts.length} parts · ${parts.map((p) => partTypeLabel(p.type)).join(' + ')}`;
}
export function routineBadge(r: Routine): string {
  const parts = routineParts(r);
  return parts.length > 1 ? 'Mixed' : partTypeLabel(parts[0].type);
}

/* a circuit expands into a plain timed sequence so it reuses the timed engine */
export function expandCircuit(p: CircuitPart): TimedItem[] {
  const items = (p.items || []).filter((x) => x && x.name);
  const rounds = p.rounds || 1, work = p.work || 30, rest = p.rest || 0, rr = p.restRounds || 0;
  const out: TimedItem[] = [];
  for (let r = 0; r < rounds; r++) {
    items.forEach((it, idx) => {
      out.push({ name: rounds > 1 ? `${it.name} (round ${r + 1})` : it.name, seconds: work });
      if (idx < items.length - 1 && rest > 0) out.push({ name: 'Rest', seconds: rest });
    });
    if (r < rounds - 1 && rr > 0) out.push({ name: 'Rest', seconds: rr });
  }
  return out;
}

export function saveRoutine(r: Routine) {
  const arr = getRoutines();
  arr.push(r);
  setLS('workoutRoutines', arr);
  cloudSaveRoutine(r);
}

export interface WorkoutLogEntry {
  id: string;
  cloudId?: string;
  routineName: string;
  date: string;
  timestamp: number;
  durationSec: number;
  stepsCompleted: number;
}

export function logWorkout(entry: WorkoutLogEntry) {
  const log = getLS<WorkoutLogEntry[]>('workoutLog', []);
  log.push(entry);
  setLS('workoutLog', log);
  cloudSaveWorkoutLog(entry);
}
