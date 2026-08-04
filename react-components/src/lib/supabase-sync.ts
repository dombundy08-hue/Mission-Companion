import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getLS, setLS, uid } from './storage';

// Same project + same publishable (anon, RLS-protected) key already public
// in index.html — this is not a secret, safe to ship client-side.
const SUPABASE_URL = 'https://mxlfwmwjkanvsjimralh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8HpSPjIDolxclSxlp4OQxw_GDC6XoOL';

export const sb: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// Module-level sync state, same shape as the vanilla app's globals.
// cloudReady gates pushes until the initial pull+merge has happened;
// pendingPush marks unsynced local changes waiting for a connection.
export let cloudReady = false;
let pendingPush = false;

export function setCloudReady(v: boolean) {
  cloudReady = v;
}

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
  if (!cloudReady) return;
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
  if (!cloudReady) return;
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
  if (!cloudReady) return;
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
  if (!cloudReady) return;
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

export async function cloudSaveSetting(key: string, value: unknown) {
  if (!cloudReady) return;
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

export { uid };
