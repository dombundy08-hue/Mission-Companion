import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLS, setLS, uid } from './storage';
import { isDemoMode } from './demo';

// Same project + same publishable (anon, RLS-protected) key already public
// in index.html — this is not a secret, safe to ship client-side.
const SUPABASE_URL = 'https://mxlfwmwjkanvsjimralh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8HpSPjIDolxclSxlp4OQxw_GDC6XoOL';

export const sb: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// Demo Mode is treated as permanently offline — every cloud write below
// checks this first and silently no-ops instead, so a demo session can
// never reach Dom's real Supabase data.
function sbOnline(): boolean {
  return !!sb && navigator.onLine && !isDemoMode();
}

// A failed or offline cloud write is dropped silently (the local write via
// setLS already succeeded) — there's no retry queue yet. A prior
// `pendingPush` flag pretended to track this for a future retry but was
// never read anywhere; removed rather than left as dead state (matches this
// file's own precedent — see the removed `cloudReady` gate in git history).
function markPending() {}

export interface MiracleEntry {
  id: string;
  cloudId?: string;
  date: string;
  timestamp: number;
  body: string;
}

export interface JournalEntry {
  id: string;
  cloudId?: string;
  date: string;
  timestamp: number;
  body: string;
  reflectionPrompt?: string;
  reflectionResponse?: string;
}

// ---- field mapping (local shape <-> table columns), ported 1:1 from index.html ----
function miracleToCloud(e: MiracleEntry) {
  return { entry_date: e.date || '', body: e.body || '' };
}
function journalToCloud(e: JournalEntry) {
  return {
    entry_date: e.date || '',
    body: e.body || '',
    reflection_prompt: e.reflectionPrompt || '',
    reflection_response: e.reflectionResponse || '',
  };
}

// Stamps the cloudId back onto the matching localStorage record after a
// successful insert — same natural-key-match pattern as the vanilla app
// (rows have no app-side id column, so the freshly-inserted UUID gets
// attached to whichever local record doesn't have one yet and matches).
function stamp<T extends { cloudId?: string }>(
  localKey: string,
  matchFn: (item: T) => boolean,
  cloudId: string
) {
  const arr = getLS<T[]>(localKey, []);
  const it = arr.find(matchFn);
  if (it) {
    it.cloudId = cloudId;
    setLS(localKey, arr);
  }
}

export async function cloudSaveMiracle(entry: MiracleEntry) {
  if (!sbOnline()) {
    markPending();
    return;
  }
  try {
    const ins = await sb.from('miracle_entries').insert(miracleToCloud(entry)).select('id').single();
    if (ins.error) throw ins.error;
    if (!ins.data) throw new Error('No data returned from insert');
    stamp<MiracleEntry>(
      'miracleEntries',
      (x) => x.date === entry.date && x.body === entry.body && !x.cloudId,
      ins.data.id
    );
  } catch {
    markPending();
  }
}

export async function cloudSaveJournal(entry: JournalEntry) {
  if (!sbOnline()) {
    markPending();
    return;
  }
  try {
    const ins = await sb.from('journal_entries').insert(journalToCloud(entry)).select('id').single();
    if (ins.error) throw ins.error;
    if (!ins.data) throw new Error('No data returned from insert');
    stamp<JournalEntry>(
      'journalEntries',
      (x) => x.date === entry.date && x.body === entry.body && !x.cloudId,
      ins.data.id
    );
  } catch {
    markPending();
  }
}

export async function cloudDeleteRow(table: string, item: { cloudId?: string }) {
  if (!item?.cloudId) return;
  if (!sbOnline()) {
    markPending();
    return;
  }
  try {
    const d = await sb.from(table).delete().eq('id', item.cloudId);
    if (d.error) throw d.error;
  } catch {
    markPending();
  }
}

interface ScriptureProgressCard {
  id: number;
  cloudId?: string;
  confidence: number;
  reviewCount: number;
  lastReviewed: string | null;
}

function stampScripture(scripId: number, cloudId: string) {
  const deck = getLS<ScriptureProgressCard[]>('scriptureDeck', []);
  const c = deck.find((x) => x.id === scripId);
  if (c) {
    c.cloudId = cloudId;
    setLS('scriptureDeck', deck);
  }
}

export async function cloudSaveScripture(card: ScriptureProgressCard) {
  if (!sbOnline()) {
    markPending();
    return;
  }
  try {
    if (card.cloudId) {
      const up = await sb
        .from('scripture_progress')
        .update({ confidence: card.confidence || 0, review_count: card.reviewCount || 0, last_reviewed: card.lastReviewed || null })
        .eq('id', card.cloudId);
      if (up.error) throw up.error;
    } else {
      const ex = await sb.from('scripture_progress').select('id').eq('scripture_id', card.id).limit(1);
      const exRow = (ex.data || [])[0];
      if (exRow && exRow.id) {
        await sb
          .from('scripture_progress')
          .update({ confidence: card.confidence || 0, review_count: card.reviewCount || 0, last_reviewed: card.lastReviewed || null })
          .eq('id', exRow.id);
        stampScripture(card.id, exRow.id);
      } else {
        const ins = await sb
          .from('scripture_progress')
          .insert({ scripture_id: card.id, confidence: card.confidence || 0, review_count: card.reviewCount || 0, last_reviewed: card.lastReviewed || null })
          .select('id')
          .single();
        if (ins.error) throw ins.error;
        if (!ins.data) throw new Error('No data returned from insert');
        stampScripture(card.id, ins.data.id);
      }
    }
  } catch {
    markPending();
  }
}

export async function cloudSaveSetting(key: string, value: unknown) {
  if (!sbOnline()) {
    markPending();
    return;
  }
  try {
    const up = await sb
      .from('app_settings')
      .upsert({ key, value: JSON.stringify(value) }, { onConflict: 'user_id,key' });
    if (up.error) throw up.error;
  } catch {
    markPending();
  }
}

// Same as cloudSaveSetting but for several keys that belong to one logical
// action (e.g. finishing onboarding) — one multi-row upsert instead of one
// round-trip per key.
export async function cloudSaveSettings(entries: Record<string, unknown>) {
  if (!sbOnline()) {
    markPending();
    return;
  }
  try {
    const rows = Object.entries(entries).map(([key, value]) => ({ key, value: JSON.stringify(value) }));
    const up = await sb.from('app_settings').upsert(rows, { onConflict: 'user_id,key' });
    if (up.error) throw up.error;
  } catch {
    markPending();
  }
}

/* ---------- Health logs: one dispatcher table, ported 1:1 from vanilla's
   HEALTH_LOGS + cloudSaveHealth. Optional-column flags (foodProteinOk etc.)
   let the app survive a Supabase table missing a column it expects — a
   failed insert mentioning the column name drops that field and retries,
   rather than breaking health sync entirely. A missing TABLE (not just a
   column) disables health sync for the session instead of retrying forever. */
interface HealthRow {
  id: string;
  cloudId?: string;
  entryDate: string;
  timestamp: number;
  [key: string]: unknown;
}

let healthTablesOk = true;
let foodProteinOk = true;
let foodGramsOk = true;
let foodSourceOk = true;
let moodEnergyOk = true;
let hydroElectrolytesOk = true;

interface HealthLogConfig {
  table: string;
  day: boolean;
  toCloud: (r: HealthRow) => Record<string, unknown>;
}

const HEALTH_LOGS: Record<string, HealthLogConfig> = {
  healthFood: {
    table: 'health_food_log',
    day: false,
    toCloud: (r) => {
      const o: Record<string, unknown> = {
        entry_date: r.entryDate,
        description: r.description || '',
        calories: parseInt(String(r.calories), 10) || 0,
      };
      if (foodProteinOk && r.protein != null && r.protein !== '') o.protein = parseFloat(String(r.protein)) || 0;
      if (foodGramsOk && r.grams != null && r.grams !== '') o.grams = parseFloat(String(r.grams)) || 0;
      if (foodSourceOk && r.source) o.source = r.source;
      return o;
    },
  },
  healthWeight: {
    table: 'health_weight_log',
    day: true,
    toCloud: (r) => ({ entry_date: r.entryDate, weight: r.weight }),
  },
  healthSleep: {
    table: 'health_sleep_log',
    day: true,
    toCloud: (r) => ({ entry_date: r.entryDate, hours: r.hours }),
  },
  // append-only per-tap rows (day:false -> each tap inserts its own row)
  healthWater: {
    table: 'health_hydration_log',
    day: false,
    toCloud: (r) => {
      const o: Record<string, unknown> = { entry_date: r.entryDate, cups: parseInt(String(r.oz), 10) || 0 };
      if (hydroElectrolytesOk && r.electrolytes != null) o.electrolytes = parseInt(String(r.electrolytes), 10) || 0;
      return o;
    },
  },
  healthMood: {
    table: 'health_mood_log',
    day: true,
    toCloud: (r) => {
      const o: Record<string, unknown> = { entry_date: r.entryDate, score: r.score != null ? parseInt(String(r.score), 10) : null };
      if (moodEnergyOk) o.energy = r.energy != null ? parseInt(String(r.energy), 10) : null;
      return o;
    },
  },
};

export async function cloudSaveHealth(localKey: string, row: HealthRow, _retry?: number): Promise<void> {
  const cfg = HEALTH_LOGS[localKey];
  if (!cfg || !sbOnline() || !healthTablesOk) return;
  try {
    if (row.cloudId) {
      const up = await sb.from(cfg.table).update(cfg.toCloud(row)).eq('id', row.cloudId);
      if (up.error) throw up.error;
    } else if (cfg.day) {
      const ex = await sb.from(cfg.table).select('id').eq('entry_date', row.entryDate).limit(1);
      if (ex.error) throw ex.error;
      const exist = (ex.data || [])[0];
      if (exist) {
        const up = await sb.from(cfg.table).update(cfg.toCloud(row)).eq('id', exist.id);
        if (up.error) throw up.error;
        stamp<HealthRow>(localKey, (x) => x.id === row.id && !x.cloudId, exist.id);
      } else {
        const ins = await sb.from(cfg.table).insert(cfg.toCloud(row)).select('id').single();
        if (ins.error) throw ins.error;
        if (!ins.data) throw new Error('No data returned from insert');
        stamp<HealthRow>(localKey, (x) => x.id === row.id && !x.cloudId, ins.data.id);
      }
    } else {
      const ins = await sb.from(cfg.table).insert(cfg.toCloud(row)).select('id').single();
      if (ins.error) throw ins.error;
      if (!ins.data) throw new Error('No data returned from insert');
      stamp<HealthRow>(localKey, (x) => x.id === row.id && !x.cloudId, ins.data.id);
    }
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e).toLowerCase();
    const n = _retry || 0;
    let flipped = false;
    if (msg.includes('protein') && foodProteinOk) { foodProteinOk = false; flipped = true; }
    if (msg.includes('grams') && foodGramsOk) { foodGramsOk = false; flipped = true; }
    if (msg.includes('source') && foodSourceOk) { foodSourceOk = false; flipped = true; }
    if (msg.includes('energy') && moodEnergyOk) { moodEnergyOk = false; flipped = true; }
    if (msg.includes('electrolytes') && hydroElectrolytesOk) { hydroElectrolytesOk = false; flipped = true; }
    if (flipped && n < 3) return cloudSaveHealth(localKey, row, n + 1);
    if (msg.includes('could not find the table')) healthTablesOk = false;
    markPending();
  }
}

interface SavedFoodRow {
  id: string;
  cloudId?: string;
  name: string;
  calories: number | null;
  protein: number | null;
}

function savedFoodToCloud(r: SavedFoodRow) {
  const o: Record<string, unknown> = { name: r.name || '' };
  if (r.calories != null) o.calories = r.calories;
  if (r.protein != null) o.protein = r.protein;
  return o;
}

let savedFoodsOk = true;

export async function cloudSaveSavedFood(r: SavedFoodRow): Promise<void> {
  if (!sbOnline() || !savedFoodsOk) return;
  try {
    if (r.cloudId) {
      const up = await sb.from('saved_foods').update(savedFoodToCloud(r)).eq('id', r.cloudId);
      if (up.error) throw up.error;
    } else {
      const ins = await sb.from('saved_foods').insert(savedFoodToCloud(r)).select('id').single();
      if (ins.error) throw ins.error;
      if (!ins.data) throw new Error('No data returned from insert');
      stamp<SavedFoodRow>('savedFoods', (x) => x.id === r.id && !x.cloudId, ins.data.id);
    }
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e).toLowerCase();
    if (msg.includes('could not find the table')) savedFoodsOk = false;
    markPending();
  }
}

/* ---------- Exercise: routines + workout log. Isolated like health -
   if the tables don't exist yet, sync disables itself for the session
   rather than retrying forever, and never breaks anything else. */
let workoutTablesOk = true;

interface RoutineRow {
  id: string;
  cloudId?: string;
  name: string;
  steps: unknown;
}
function routineToCloud(r: RoutineRow) {
  return { name: r.name || '', steps: r.steps || [] };
}
export async function cloudSaveRoutine(r: RoutineRow): Promise<void> {
  if (!sbOnline() || !workoutTablesOk) return;
  try {
    if (r.cloudId) {
      const up = await sb.from('workout_routines').update(routineToCloud(r)).eq('id', r.cloudId);
      if (up.error) throw up.error;
    } else {
      const ins = await sb.from('workout_routines').insert(routineToCloud(r)).select('id').single();
      if (ins.error) throw ins.error;
      if (!ins.data) throw new Error('No data returned from insert');
      stamp<RoutineRow>('workoutRoutines', (x) => x.id === r.id && !x.cloudId, ins.data.id);
    }
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e).toLowerCase();
    if (msg.includes('could not find the table')) workoutTablesOk = false;
    markPending();
  }
}

interface WorkoutLogRow {
  id: string;
  cloudId?: string;
  routineName: string;
  timestamp: number;
  durationSec: number;
  stepsCompleted: number;
}
function wlogToCloud(e: WorkoutLogRow) {
  return {
    routine_name: e.routineName || '',
    performed_at: new Date(e.timestamp || Date.now()).toISOString(),
    duration_seconds: e.durationSec || 0,
    steps_completed: e.stepsCompleted || 0,
  };
}
export async function cloudSaveWorkoutLog(e: WorkoutLogRow): Promise<void> {
  if (!sbOnline() || !workoutTablesOk) return;
  try {
    const ins = await sb.from('workout_log').insert(wlogToCloud(e)).select('id').single();
    if (ins.error) throw ins.error;
    if (!ins.data) throw new Error('No data returned from insert');
    stamp<WorkoutLogRow>('workoutLog', (x) => x.id === e.id && !x.cloudId, ins.data.id);
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err).toLowerCase();
    if (msg.includes('could not find the table')) workoutTablesOk = false;
    markPending();
  }
}

/* ---------- Multi-week workout programs. Stored as a self-contained
   snapshot (full routine content, not local-only routine ids) so it
   survives a pull to a device with different local routine ids.
   `workouts` is pre-built by the caller (exercise-data.ts's
   programSnapshot) to avoid a circular import. */
export async function cloudSaveProgram(
  program: { id: string; cloudId?: string; name: string },
  workouts: unknown
): Promise<void> {
  if (!sbOnline()) return;
  try {
    if (program.cloudId) {
      const up = await sb.from('workout_programs').update({ name: program.name, workouts }).eq('id', program.cloudId);
      if (up.error) throw up.error;
    } else {
      const ins = await sb.from('workout_programs').insert({ name: program.name, workouts }).select('id').single();
      if (ins.error) throw ins.error;
      if (!ins.data) throw new Error('No data returned from insert');
      stamp<{ id: string; cloudId?: string }>('workoutPrograms', (x) => x.id === program.id && !x.cloudId, ins.data.id);
    }
  } catch {
    markPending();
  }
}

/* ---------- QR contact exchange: a visitor who scans a missionary's QR
   code leaves their own contact info here. No auth required to submit —
   the public /contact/:code page is reached outside the app's lock screen. */
export interface ContactLead {
  id: string;
  createdAt: string;
  code: string | null;
  name: string;
  phone: string | null;
  address: string | null;
  note: string | null;
}

export async function submitContactLead(code: string, name: string, phone: string, address: string, note: string): Promise<boolean> {
  if (!sb) return false;
  try {
    const ins = await sb.from('contact_leads').insert({
      code: code || null,
      name,
      phone: phone || null,
      address: address || null,
      note: note || null,
    });
    return !ins.error;
  } catch {
    return false;
  }
}

export async function fetchContactLeads(): Promise<ContactLead[]> {
  if (!sbOnline()) return [];
  try {
    const res = await sb.from('contact_leads').select('*').order('created_at', { ascending: false }).limit(100);
    if (res.error || !res.data) return [];
    return res.data.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      code: r.code,
      name: r.name,
      phone: r.phone,
      // legacy rows collected an email instead of an address — fall back so
      // old entries still show something in the Address column.
      address: r.address ?? r.email ?? null,
      note: r.note,
    }));
  } catch {
    return [];
  }
}

// contact_leads has no local mirror (fetched live each time), so deleting
// just needs a straight cloud delete by row id — no cloudId indirection.
export async function deleteContactLead(id: string): Promise<boolean> {
  if (!sb) return false;
  try {
    const d = await sb.from('contact_leads').delete().eq('id', id);
    return !d.error;
  } catch {
    return false;
  }
}

export { uid };
