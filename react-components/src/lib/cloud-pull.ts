// Boot-time pull+merge: this was documented as the intended design
// (CONTEXT.md's cloudSyncAll()) but never actually got ported to the React
// app — every cloudSave* function pushed local writes up, but nothing ever
// pulled existing cloud rows back down. On a device with an empty/cleared
// localStorage, that meant real data sitting safely in Supabase just never
// showed up locally. This fixes that: additive only, never deletes or
// overwrites anything already present locally, so it's safe to run on
// every boot.
import { sb } from './supabase-sync';
import { getLS, setLS, uid } from './storage';
import { isDemoMode } from './demo';
import { saveRoutine, clonePart, type Routine, type RoutinePart, type WorkoutProgram } from './exercise-data';

interface Row {
  id: string;
  cloudId?: string;
}

async function pullSimple<M extends Record<string, unknown>>(
  table: string,
  localKey: string,
  fromCloud: (row: Record<string, unknown>) => M,
  naturalKeyOf: (item: M) => string
): Promise<void> {
  try {
    const res = await sb.from(table).select('*');
    if (res.error || !res.data) return;
    const local = getLS<(Row & M)[]>(localKey, []);
    const haveCloudIds = new Set(local.filter((x) => x.cloudId).map((x) => x.cloudId));
    const haveKeys = new Set(local.map((x) => naturalKeyOf(x)));
    let changed = false;
    for (const row of res.data as Record<string, unknown>[]) {
      const cloudId = String(row.id);
      if (haveCloudIds.has(cloudId)) continue;
      const mapped = fromCloud(row);
      const key = naturalKeyOf(mapped);
      if (haveKeys.has(key)) continue; // already have it locally, just not cloud-stamped yet
      local.push({ ...mapped, id: uid(), cloudId } as Row & M);
      haveKeys.add(key);
      changed = true;
    }
    if (changed) setLS(localKey, local);
  } catch {
    // local-first: a failed pull just means we try again next boot
  }
}

async function pullSettings(): Promise<void> {
  const RAW_KEYS = new Set(['apiKey', 'usdaApiKey', 'theme', 'lastBackupTimestamp', 'qrCode']);
  try {
    const res = await sb.from('app_settings').select('key,value');
    if (res.error || !res.data) return;
    for (const row of res.data as { key: string; value: string }[]) {
      if (localStorage.getItem(row.key) != null) continue; // never clobber existing local value
      if (RAW_KEYS.has(row.key)) {
        try {
          localStorage.setItem(row.key, JSON.parse(row.value));
        } catch {
          localStorage.setItem(row.key, row.value);
        }
      } else {
        localStorage.setItem(row.key, row.value);
      }
    }
  } catch {
    // ignore, retried next boot
  }
}

interface DeckCardLike {
  id: number;
  cloudId?: string;
  confidence: number;
  reviewCount: number;
  lastReviewed: string | null;
}

async function pullScriptureProgress(): Promise<void> {
  try {
    const res = await sb.from('scripture_progress').select('*');
    if (res.error || !res.data) return;
    const deck = getLS<DeckCardLike[]>('scriptureDeck', []);
    if (!deck.length) return;
    let changed = false;
    for (const row of res.data as Record<string, unknown>[]) {
      const card = deck.find((c) => c.id === row.scripture_id);
      if (!card) continue;
      // Only adopt cloud progress if this device hasn't practiced the card
      // yet — never overwrite real local progress with an older cloud copy.
      if (!card.cloudId && card.reviewCount === 0 && (row.review_count as number) > 0) {
        card.cloudId = String(row.id);
        card.confidence = (row.confidence as number) || 0;
        card.reviewCount = (row.review_count as number) || 0;
        card.lastReviewed = (row.last_reviewed as string) || null;
        changed = true;
      }
    }
    if (changed) setLS('scriptureDeck', deck);
  } catch {
    // ignore
  }
}

async function pullHealthLog(
  table: string,
  localKey: string,
  fromCloud: (row: Record<string, unknown>) => Record<string, unknown>
): Promise<void> {
  try {
    const res = await sb.from(table).select('*');
    if (res.error || !res.data) return;
    interface LocalRow { id: string; cloudId?: string; entryDate: string; timestamp: number; [k: string]: unknown }
    const local = getLS<LocalRow[]>(localKey, []);
    const haveCloudIds = new Set(local.filter((x) => x.cloudId).map((x) => x.cloudId));
    let changed = false;
    for (const row of res.data as Record<string, unknown>[]) {
      const cloudId = String(row.id);
      if (haveCloudIds.has(cloudId)) continue;
      const mapped = fromCloud(row);
      const entryDate = String(row.entry_date);
      // day-based tables (weight/sleep/mood): skip if we already have any
      // local row for that date, so we never duplicate a day that was
      // just never cloud-stamped. Append-only tables (food/water) don't
      // have this collision risk in practice — the cloudId check above
      // already covers them.
      if (local.some((x) => x.entryDate === entryDate && !x.cloudId)) continue;
      local.push({ id: uid(), cloudId, entryDate, timestamp: new Date(String(row.created_at)).getTime(), ...mapped });
      changed = true;
    }
    if (changed) setLS(localKey, local);
  } catch {
    // ignore
  }
}

async function pullPrograms(): Promise<void> {
  try {
    const res = await sb.from('workout_programs').select('*');
    if (res.error || !res.data) return;
    const local = getLS<WorkoutProgram[]>('workoutPrograms', []);
    const haveCloudIds = new Set(local.filter((x) => x.cloudId).map((x) => x.cloudId));
    const haveNames = new Set(local.map((x) => x.name));
    let changed = false;
    for (const row of res.data as Record<string, unknown>[]) {
      const cloudId = String(row.id);
      if (haveCloudIds.has(cloudId) || haveNames.has(String(row.name))) continue;
      const workouts = Array.isArray(row.workouts) ? row.workouts : [];
      const routineIds = workouts
        .filter((w): w is { name: string; parts: RoutinePart[] } => !!w && typeof w.name === 'string' && Array.isArray(w.parts))
        .map((w) => {
          const r: Routine = { id: uid(), name: w.name, steps: w.parts.map(clonePart), createdAt: Date.now() };
          saveRoutine(r);
          return r.id;
        });
      if (!routineIds.length) continue;
      local.push({ id: uid(), cloudId, name: String(row.name), routineIds, createdAt: new Date(String(row.created_at)).getTime() });
      haveNames.add(String(row.name));
      changed = true;
    }
    if (changed) setLS('workoutPrograms', local);
  } catch {
    // ignore, retried next boot
  }
}

export async function pullAndMergeAll(): Promise<void> {
  if (!sb || !navigator.onLine || isDemoMode()) return;
  await Promise.all([
    pullSimple(
      'journal_entries',
      'journalEntries',
      (r) => ({ date: String(r.entry_date), timestamp: new Date(String(r.created_at)).getTime(), body: String(r.body || ''), reflectionPrompt: String(r.reflection_prompt || ''), reflectionResponse: String(r.reflection_response || '') }),
      (x) => `${x.date}|${x.body}`
    ),
    pullSimple(
      'miracle_entries',
      'miracleEntries',
      (r) => ({ date: String(r.entry_date), timestamp: new Date(String(r.created_at)).getTime(), body: String(r.body || '') }),
      (x) => `${x.date}|${x.body}`
    ),
    pullSimple(
      'workout_routines',
      'workoutRoutines',
      (r) => ({ name: String(r.name || ''), steps: r.steps, createdAt: new Date(String(r.created_at)).getTime() }),
      (x) => x.name
    ),
    pullPrograms(),
    pullSimple(
      'workout_log',
      'workoutLog',
      (r) => ({ routineName: String(r.routine_name || ''), date: String(r.performed_at || '').slice(0, 10), timestamp: new Date(String(r.performed_at)).getTime(), durationSec: Number(r.duration_seconds) || 0, stepsCompleted: Number(r.steps_completed) || 0 }),
      (x) => `${x.routineName}|${x.timestamp}`
    ),
    pullHealthLog('health_food_log', 'healthFood', (r) => ({ calories: r.calories, protein: r.protein, description: r.description, grams: r.grams, source: r.source })),
    pullHealthLog('health_weight_log', 'healthWeight', (r) => ({ weight: r.weight })),
    pullHealthLog('health_sleep_log', 'healthSleep', (r) => ({ hours: r.hours })),
    pullHealthLog('health_hydration_log', 'healthWater', (r) => ({ oz: r.cups, electrolytes: r.electrolytes })),
    pullHealthLog('health_mood_log', 'healthMood', (r) => ({ score: r.score, energy: r.energy })),
    pullSimple(
      'saved_foods',
      'savedFoods',
      (r) => ({ name: String(r.name || ''), calories: (r.calories as number) ?? null, protein: (r.protein as number) ?? null, createdAt: new Date(String(r.created_at)).getTime() }),
      (x) => x.name
    ),
    pullScriptureProgress(),
    pullSettings(),
  ]);
}
