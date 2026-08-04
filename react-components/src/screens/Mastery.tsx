import { useState } from 'react';
import {
  getDeck,
  saveDeck,
  masteryCards,
  effectiveStreak,
  streakOnGraceDay,
  markStreak,
  pickWeightedCard,
  blankPhrase,
  type DeckCard,
} from '@/lib/mastery';
import { MASTERY_COLLECTIONS } from '@/lib/scripture-data';
import { getLS, setLS } from '@/lib/storage';
import { cloudSaveScripture, cloudSaveSetting } from '@/lib/supabase-sync';

type View = 'home' | 'practice';
type Mode = 'ref2text' | 'blank' | 'text2ref';

const MODES: { k: Mode; label: string }[] = [
  { k: 'ref2text', label: '🔖 Reference → Text' },
  { k: 'blank', label: '✏️ Fill in the Blank' },
  { k: 'text2ref', label: '📌 Text → Reference' },
];

function customCardPayload(deck: DeckCard[]) {
  return deck
    .filter((c) => c.collection === 'Custom')
    .map((c) => ({ id: c.id, reference: c.reference || '', keyPhrase: c.keyPhrase || '', fullText: c.fullText || '' }));
}

export function Mastery() {
  const [view, setView] = useState<View>('home');
  const [deck, setDeck] = useState<DeckCard[]>(() => getDeck());
  const [coll, setColl] = useState(() => getLS('scriptureCollection', 'All'));
  const [mode, setMode] = useState<Mode>('ref2text');
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [currentId, setCurrentId] = useState<number | null>(null);

  const cards = masteryCards(deck, coll);

  function selectColl(v: string) {
    setLS('scriptureCollection', v);
    setColl(v);
  }

  function startPractice() {
    const pool = masteryCards(deck, coll);
    if (!pool.length) {
      alert('No cards in this collection yet.');
      return;
    }
    setFlipped(false);
    setReviewed(0);
    setCurrentId(pickWeightedCard(pool, null).id);
    setView('practice');
    window.scrollTo(0, 0);
  }

  function addCustomCard() {
    const ref = prompt('Reference (e.g. Alma 32:21):');
    if (ref === null) return;
    if (!ref.trim()) {
      alert('A reference is required.');
      return;
    }
    const key = prompt('Key phrase (short — used for Fill-in-the-Blank and Text → Reference):');
    if (key === null) return;
    const full = prompt('Full scripture text:');
    if (full === null) return;
    const maxId = deck.reduce((m, c) => Math.max(m, c.id), 0);
    const next: DeckCard = {
      id: maxId + 1,
      collection: 'Custom',
      reference: ref.trim(),
      keyPhrase: key.trim() || ref.trim(),
      fullText: full.trim() || key.trim() || ref.trim(),
      confidence: 0,
      reviewCount: 0,
      lastReviewed: null,
    };
    const newDeck = [...deck, next];
    saveDeck(newDeck);
    setDeck(newDeck);
    const customs = customCardPayload(newDeck);
    if (customs.length) cloudSaveSetting('customScriptureCards', customs);
    selectColl('Custom');
  }

  function rate(score: number) {
    const idx = deck.findIndex((x) => x.id === currentId);
    let newDeck = deck;
    if (idx >= 0) {
      newDeck = [...deck];
      newDeck[idx] = { ...newDeck[idx], confidence: score, reviewCount: (newDeck[idx].reviewCount || 0) + 1, lastReviewed: new Date().toISOString() };
      saveDeck(newDeck);
      setDeck(newDeck);
      cloudSaveScripture(newDeck[idx]);
    }
    markStreak();
    const nextReviewed = reviewed + 1;
    setReviewed(nextReviewed);
    const pool = masteryCards(newDeck, coll);
    setCurrentId(pickWeightedCard(pool, currentId).id);
    setFlipped(false);
    window.scrollTo(0, 0);
  }

  if (view === 'practice') {
    if (!cards.length) {
      setView('home');
      return null;
    }
    const card = deck.find((x) => x.id === currentId) || cards[0];
    const total = cards.length;
    const pos = Math.min(reviewed + 1, total);

    return (
      <div>
        <button type="button" onClick={() => { setView('home'); setFlipped(false); }} className="mb-3 text-sm font-medium" style={{ color: 'var(--primary)' }}>
          ← Back
        </button>
        <div className="mb-3.5 flex flex-col gap-2">
          {MODES.map((m) => (
            <button
              key={m.k}
              type="button"
              onClick={() => { setMode(m.k); setFlipped(false); }}
              className="rounded-xl border py-3 text-sm font-bold"
              style={{
                borderColor: mode === m.k ? 'var(--navy)' : 'var(--border)',
                background: mode === m.k ? 'var(--navy)' : 'var(--card)',
                color: mode === m.k ? 'white' : 'var(--navy)',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="mb-2 text-sm" style={{ color: 'var(--muted-foreground)' }}>Card {pos} of {total}</div>

        {!flipped ? (
          <div>
            <div className="mb-4 rounded-[14px] border p-6 text-center" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              {mode === 'ref2text' && <div className="text-lg font-bold" style={{ color: 'var(--navy)' }}>{card.reference}</div>}
              {mode === 'blank' && (
                <div>
                  <div className="mb-2 text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--gold-dark)' }}>Fill in the Blanks</div>
                  <div className="text-[15px]" style={{ color: 'var(--foreground)' }}>{blankPhrase(card.keyPhrase)}</div>
                </div>
              )}
              {mode === 'text2ref' && <div className="text-[15px] italic" style={{ color: 'var(--foreground)' }}>{card.keyPhrase}</div>}
            </div>
            <button type="button" onClick={() => setFlipped(true)} className="w-full rounded-xl py-3 text-[17px] font-bold text-white" style={{ background: 'var(--primary)' }}>
              Tap to Reveal
            </button>
          </div>
        ) : (
          <div>
            <div className="mb-4 rounded-[14px] border p-6 text-center" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              {mode === 'ref2text' && (
                <div>
                  <div className="mb-2 text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--gold-dark)' }}>{card.reference}</div>
                  <div className="text-[15px] italic" style={{ color: 'var(--foreground)' }}>{card.fullText}</div>
                </div>
              )}
              {mode === 'blank' && (
                <div>
                  <div className="mb-2 text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--gold-dark)' }}>{card.reference}</div>
                  <div className="text-[15px] italic" style={{ color: 'var(--foreground)' }}>{card.keyPhrase}</div>
                </div>
              )}
              {mode === 'text2ref' && (
                <div>
                  <div className="text-lg font-bold" style={{ color: 'var(--navy)' }}>{card.reference}</div>
                  <div className="mt-2.5 text-[15px] italic" style={{ color: 'var(--foreground)' }}>{card.keyPhrase}</div>
                </div>
              )}
            </div>
            <div className="mb-1 text-center text-sm font-medium" style={{ color: 'var(--foreground)' }}>How well did you know this?</div>
            <div className="mb-1 flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => rate(i)}
                  className="flex-1 rounded-xl py-3 text-base font-bold text-white"
                  style={{ background: `color-mix(in srgb, var(--destructive) ${(5 - i) * 25}%, var(--primary))` }}
                >
                  {i}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs" style={{ color: 'var(--muted-foreground)' }}>
              <span>Didn't know</span>
              <span>Got it</span>
              <span>Perfect</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  const total = cards.length;
  const mastered = cards.filter((x) => (x.confidence || 0) >= 4).length;
  const pct = total ? Math.round((mastered / total) * 100) : 0;
  const streak = effectiveStreak();
  const onGrace = streakOnGraceDay();
  const customCount = deck.filter((x) => x.collection === 'Custom').length;

  return (
    <div>
      <h2 className="mb-3 text-[22px] font-bold" style={{ color: 'var(--navy)' }}>📖 Scripture Mastery</h2>

      <div className="mb-3 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="mb-1 text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--gold-dark)' }}>📊 Progress</div>
        <div className="mb-2 text-sm" style={{ color: 'var(--foreground)' }}>
          <b>{mastered}</b> of <b>{total}</b> at confidence 4+
        </div>
        <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--secondary)' }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--primary)' }} />
        </div>
        <div className="mt-1 text-right text-xs" style={{ color: 'var(--muted-foreground)' }}>{pct}%</div>
      </div>

      <div className="mb-3 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="mb-2 text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--gold-dark)' }}>Collections</div>
        <div className="flex flex-wrap gap-2">
          {MASTERY_COLLECTIONS.map((co) => {
            const cnt = co.value === 'All' ? deck.length : deck.filter((x) => x.collection === co.value).length;
            const lbl = co.value === 'All' ? `All ${cnt}` : co.label;
            return (
              <button
                key={co.value}
                type="button"
                onClick={() => selectColl(co.value)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium"
                style={{
                  background: coll === co.value ? 'var(--primary)' : 'var(--secondary)',
                  color: coll === co.value ? 'white' : 'var(--secondary-foreground)',
                }}
              >
                {lbl}
              </button>
            );
          })}
          {customCount > 0 && (
            <button
              type="button"
              onClick={() => selectColl('Custom')}
              className="rounded-lg px-3 py-1.5 text-sm font-medium"
              style={{
                background: coll === 'Custom' ? 'var(--primary)' : 'var(--secondary)',
                color: coll === 'Custom' ? 'white' : 'var(--secondary-foreground)',
              }}
            >
              My Cards ({customCount})
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 text-sm" style={{ color: 'var(--foreground)' }}>
        🔥 Day {streak} streak
        {onGrace && (
          <span className="ml-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
            (missed yesterday — one grace day used, practice today to keep it)
          </span>
        )}
      </div>

      <button type="button" onClick={startPractice} className="w-full rounded-xl py-3 text-[17px] font-bold text-white" style={{ background: 'var(--primary)' }}>
        🃏 Start Practice
      </button>
      <button type="button" onClick={addCustomCard} className="mt-2.5 w-full rounded-xl py-2.5 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
        ＋ Add My Own
      </button>
    </div>
  );
}
