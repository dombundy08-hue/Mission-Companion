import { getLS, setLS } from './storage';
import { SCRIPTURE_DEFAULTS, type ScriptureCard } from './scripture-data';
import { cloudSaveSetting } from './supabase-sync';

export interface DeckCard extends ScriptureCard {
  cloudId?: string;
  confidence: number;
  reviewCount: number;
  lastReviewed: string | null;
}

export interface Streak {
  count: number;
  last: string | null;
}

export function getDeck(): DeckCard[] {
  let stored = getLS<DeckCard[] | null>('scriptureDeck', null);
  let changed = false;
  if (!Array.isArray(stored)) {
    stored = SCRIPTURE_DEFAULTS.map((c) => ({ ...c, confidence: 0, reviewCount: 0, lastReviewed: null }));
    changed = true;
  }
  const have = new Set(stored.map((c) => c.id));
  SCRIPTURE_DEFAULTS.forEach((d) => {
    if (!have.has(d.id)) {
      stored!.push({ ...d, confidence: 0, reviewCount: 0, lastReviewed: null });
      have.add(d.id);
      changed = true;
    }
  });
  // Restore custom cards synced from another device. Their content
  // (id/reference/keyPhrase/fullText) has no SCRIPTURE_DEFAULTS entry to
  // merge against, so without this a pulled `customScriptureCards` setting
  // just sits inert in localStorage — never reaches the visible deck, and
  // its confidence/reviewCount can never attach since pullScriptureProgress
  // matches against cards already in `scriptureDeck` by id.
  const customs = getLS<{ id: number; reference: string; keyPhrase: string; fullText: string }[]>('customScriptureCards', []);
  customs.forEach((c) => {
    if (!have.has(c.id)) {
      stored!.push({ id: c.id, collection: 'Custom', reference: c.reference, keyPhrase: c.keyPhrase, fullText: c.fullText, confidence: 0, reviewCount: 0, lastReviewed: null });
      have.add(c.id);
      changed = true;
    }
  });
  if (changed) setLS('scriptureDeck', stored);
  return stored;
}

export function saveDeck(deck: DeckCard[]) {
  setLS('scriptureDeck', deck);
}

export function masteryCards(deck: DeckCard[], coll: string): DeckCard[] {
  return coll === 'All' ? deck : deck.filter((c) => c.collection === coll);
}

/* streak (local-date based) */
function dayKey(offset?: number): string {
  const d = new Date();
  if (offset) d.setDate(d.getDate() + offset);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

export function getStreak(): Streak {
  const s = getLS<Streak>('scriptureStreak', { count: 0, last: null });
  return s && typeof s === 'object' ? s : { count: 0, last: null };
}

/* one-day grace: missing exactly one day (last=-2) keeps the streak alive;
   missing two or more in a row (last<=-3) breaks it */
export function effectiveStreak(): number {
  const s = getStreak();
  if (!s.last) return 0;
  if (s.last === dayKey(0) || s.last === dayKey(-1) || s.last === dayKey(-2)) return s.count || 0;
  return 0;
}

export function streakOnGraceDay(): boolean {
  const s = getStreak();
  return !!(s.last && s.last === dayKey(-2));
}

export function markStreak() {
  const s = getStreak();
  const t = dayKey(0);
  if (s.last === t) {
    // already counted today
  } else if (s.last === dayKey(-1) || s.last === dayKey(-2)) {
    s.count = (s.count || 0) + 1;
    s.last = t;
  } else {
    s.count = 1;
    s.last = t;
  }
  setLS('scriptureStreak', s);
  cloudSaveSetting('scriptureStreak', s);
}

/* weighted selection — lower confidence returns far more often */
const MASTERY_WEIGHTS: Record<number, number> = { 0: 5, 1: 10, 2: 7, 3: 4, 4: 2, 5: 1 };
function masteryWeight(conf: number): number {
  return MASTERY_WEIGHTS[conf || 0] || 1;
}

export function pickWeightedCard(cards: DeckCard[], excludeId: number | null): DeckCard {
  let pool = cards;
  if (cards.length > 1 && excludeId != null) {
    const f = cards.filter((c) => c.id !== excludeId);
    if (f.length) pool = f;
  }
  let total = 0;
  pool.forEach((c) => (total += masteryWeight(c.confidence)));
  let r = Math.random() * total;
  for (const c of pool) {
    r -= masteryWeight(c.confidence);
    if (r <= 0) return c;
  }
  return pool[pool.length - 1];
}

/* blank 3–5 significant words from a phrase */
const MASTERY_STOP = new Set([
  'that', 'this', 'with', 'they', 'them', 'from', 'have', 'will', 'your', 'unto', 'shall', 'which', 'their',
  'then', 'than', 'into', 'upon', 'were', 'what', 'when', 'ye', 'the', 'and', 'for', 'but', 'not', 'are',
  'his', 'him', 'her', 'our', 'you', 'all', 'may', 'was', 'also', 'who', 'one', 'out', 'god', 'lord',
]);

export function blankPhrase(text: string): string {
  const tokens = text.split(/(\s+)/);
  const cand: number[] = [];
  tokens.forEach((tk, i) => {
    const w = tk.replace(/[^A-Za-z]/g, '');
    if (w.length >= 4 && !MASTERY_STOP.has(w.toLowerCase())) cand.push(i);
  });
  let n = Math.min(5, cand.length);
  if (cand.length >= 3) n = Math.min(5, Math.max(3, Math.round(cand.length * 0.4)));
  const chosen = new Set<number>();
  if (n > 0) {
    const step = cand.length / n;
    for (let k = 0; k < n; k++) chosen.add(cand[Math.floor(k * step)]);
  }
  return tokens
    .map((tk, i) => {
      if (chosen.has(i)) {
        const lead = (tk.match(/^[^A-Za-z]*/) || [''])[0];
        const trail = (tk.match(/[^A-Za-z]*$/) || [''])[0];
        const word = tk.slice(lead.length, tk.length - trail.length);
        return lead + '_'.repeat(Math.max(3, word.length)) + trail;
      }
      return tk;
    })
    .join('');
}
