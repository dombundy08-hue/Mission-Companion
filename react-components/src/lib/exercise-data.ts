import { getLS, setLS, uid } from './storage';
import { cloudSaveRoutine, cloudSaveWorkoutLog } from './supabase-sync';
import { isoDate } from './health-data';

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

// A small gallery of built-in workouts users can clone as a starting point
// and customize freely — distinct from SAMPLE_ROUTINE (kept as-is for
// backward compat with the "Add a sample routine" empty-state button).
export interface BuiltInWorkout {
  id: string;
  name: string;
  description: string;
  parts: RoutinePart[];
}

export const BUILT_IN_WORKOUTS: BuiltInWorkout[] = [
  {
    id: 'builtin-full-body-circuit',
    name: 'Full-Body Circuit',
    description: '3 rounds, no equipment, ~15 minutes.',
    parts: [
      {
        kind: 'part',
        type: 'circuit',
        rounds: 3,
        work: 40,
        rest: 20,
        restRounds: 60,
        items: [
          { name: 'Jumping Jacks' },
          { name: 'Push-ups' },
          { name: 'Squats' },
          { name: 'Mountain Climbers' },
          { name: 'Plank' },
        ],
      },
    ],
  },
  {
    id: 'builtin-strength-basics',
    name: 'Strength Basics',
    description: 'Classic sets-and-reps, your own pace.',
    parts: [
      {
        kind: 'part',
        type: 'rep',
        items: [
          { name: 'Push-ups', sets: 3, reps: 12, rest: 60 },
          { name: 'Squats', sets: 3, reps: 15, rest: 60 },
          { name: 'Lunges', sets: 3, reps: 10, rest: 60, note: 'each leg' },
          { name: 'Plank Hold', sets: 3, reps: null, rest: 45, note: '30–45 seconds' },
        ],
      },
    ],
  },
  {
    id: 'builtin-mixed-session',
    name: 'Warm-up + Strength + Circuit Finisher',
    description: 'One workout, three styles — a timed warm-up, rep-based main set, and a circuit finisher.',
    parts: [
      {
        kind: 'part',
        type: 'timed',
        items: [
          { name: 'Warm up — march in place', seconds: 60 },
          { name: 'Arm circles', seconds: 30 },
          { name: 'Bodyweight squats', seconds: 30 },
        ],
      },
      {
        kind: 'part',
        type: 'rep',
        items: [
          { name: 'Push-ups', sets: 3, reps: 10, rest: 45 },
          { name: 'Squats', sets: 3, reps: 15, rest: 45 },
        ],
      },
      {
        kind: 'part',
        type: 'circuit',
        rounds: 2,
        work: 30,
        rest: 15,
        restRounds: 45,
        items: [{ name: 'Burpees' }, { name: 'High Knees' }, { name: 'Plank' }],
      },
    ],
  },
];

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

/* ---------- Multi-week workout programs: a named, ordered sequence of
   existing routines (one per day) that can be "applied" — activated from
   a start date so Routines can show "today's workout" from the bundle.
   Local-only for now (no Supabase table yet); references routines by id,
   so deleting a referenced routine just leaves that day showing nothing. */
export interface WorkoutProgram {
  id: string;
  name: string;
  routineIds: string[];
  createdAt: number;
}

export function getPrograms(): WorkoutProgram[] {
  return getLS<WorkoutProgram[]>('workoutPrograms', []);
}
export function saveProgram(p: WorkoutProgram) {
  const arr = getPrograms().filter((x) => x.id !== p.id);
  arr.push(p);
  setLS('workoutPrograms', arr);
}
export function deleteProgram(id: string) {
  setLS('workoutPrograms', getPrograms().filter((p) => p.id !== id));
  const active = getActiveProgram();
  if (active?.programId === id) setActiveProgram(null);
}

export interface ActiveProgram {
  programId: string;
  startDate: string;
}
export function getActiveProgram(): ActiveProgram | null {
  return getLS<ActiveProgram | null>('activeWorkoutProgram', null);
}
export function setActiveProgram(programId: string | null, startDate?: string) {
  setLS('activeWorkoutProgram', programId ? { programId, startDate: startDate || isoDate() } : null);
}

// Serializes a program's routines into a self-contained snapshot (full
// workout content, not just local ids) so it can be posted to Community and
// reconstructed on someone else's device that has none of these routines.
export function programSnapshot(p: WorkoutProgram): { name: string; parts: RoutinePart[] }[] {
  const all = getRoutines();
  return p.routineIds.map((rid) => {
    const r = all.find((x) => x.id === rid);
    return r ? { name: r.name, parts: routineParts(r) } : { name: '(missing routine)', parts: [] };
  });
}

// Clones a Community program snapshot into the user's own routines + a new
// local program, so "Use This Program" works without touching the poster's data.
// `workouts` comes from the shared_programs table, which has fully open RLS
// (anyone can POST arbitrary JSON directly, not just through this app) — so
// its shape is untrusted and malformed entries are skipped, not thrown on.
export function importSharedProgram(name: string, workouts: unknown): void {
  if (!Array.isArray(workouts)) return;
  const routineIds = workouts
    .filter((w): w is { name: string; parts: RoutinePart[] } => !!w && typeof w.name === 'string' && Array.isArray(w.parts))
    .map((w) => {
      const r: Routine = { id: uid(), name: w.name, steps: w.parts.map(clonePart), createdAt: Date.now() };
      saveRoutine(r);
      return r.id;
    });
  if (!routineIds.length) return;
  saveProgram({ id: uid(), name, routineIds, createdAt: Date.now() });
}

export interface TodaysProgramSlot {
  program: WorkoutProgram;
  routine: Routine | null;
  dayIndex: number;
  complete: boolean;
}
export function todaysProgramSlot(): TodaysProgramSlot | null {
  const active = getActiveProgram();
  if (!active) return null;
  const program = getPrograms().find((p) => p.id === active.programId);
  if (!program) return null;
  const start = new Date(active.startDate + 'T00:00:00');
  const today = new Date(isoDate() + 'T00:00:00');
  const dayIndex = Math.floor((today.getTime() - start.getTime()) / 86400000);
  if (dayIndex < 0) return null;
  if (dayIndex >= program.routineIds.length) return { program, routine: null, dayIndex, complete: true };
  const routine = getRoutines().find((r) => r.id === program.routineIds[dayIndex]) || null;
  return { program, routine, dayIndex, complete: false };
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
