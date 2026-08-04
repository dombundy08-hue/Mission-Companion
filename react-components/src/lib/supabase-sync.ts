import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLS, setLS, uid } from './storage';

// Same project + same publishable (anon, RLS-protected) key already public
// in index.html — this is not a secret, safe to ship client-side.
const SUPABASE_URL = 'https://mxlfwmwjkanvsjimralh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8HpSPjIDolxclSxlp4OQxw_GDC6XoOL';

export const sb: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// pendingPush marks unsynced local changes waiting for a connection.
// Matches the vanilla app's gating exactly: sbOnline() only. (An earlier
// version of this file added a cloudReady gate meant to unlock after an
// initial boot-time pull+merge, but that pull was never built, so the gate
// never opened and every cloud write silently no-op'd. Since there's no pull
// sync yet, gating on it is strictly worse than vanilla's simpler check —
// removed rather than half-finished.)
let pendingPush = false;

function sbOnline(): boolean {
  return !!sb && navigator.onLine;
}

function markPending() {
  pendingPush = true;
}

export interface MiracleEntry {
  id: string;
  cloudId?: string;
  date: string;
  timestamp: number;
  body: string;
}

export interface GlossaryTerm {
  id: string;
  cloudId?: string;
  term: string;
  child: string;
  skeptic: string;
  adult: string;
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
function glossaryToCloud(t: GlossaryTerm) {
  return {
    term: t.term || '',
    child_explanation: t.child || '',
    skeptic_explanation: t.skeptic || '',
    adult_explanation: t.adult || '',
  };
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

export async function cloudSaveGlossary(term: GlossaryTerm) {
  if (!sbOnline()) {
    markPending();
    return;
  }
  try {
    if (term.cloudId) {
      const up = await sb.from('glossary_terms').update(glossaryToCloud(term)).eq('id', term.cloudId);
      if (up.error) throw up.error;
    } else {
      const ins = await sb.from('glossary_terms').insert(glossaryToCloud(term)).select('id').single();
      if (ins.error) throw ins.error;
      if (!ins.data) throw new Error('No data returned from insert');
      stamp<GlossaryTerm>('glossaryTerms', (x) => x.id === term.id && !x.cloudId, ins.data.id);
    }
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
      .upsert({ key, value: JSON.stringify(value) }, { onConflict: 'key' });
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

export { uid };
