import { useEffect, useRef, useState } from 'react';
import { getLS } from '@/lib/storage';
import { getDeck } from '@/lib/mastery';
import { useAuth } from './AuthContext';

const IDLE_MS = 5 * 60 * 1000;
const POLL_MS = 30000;
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'] as const;

function normalize(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function scriptureLockEnabled(): boolean {
  return getLS<boolean>('scriptureLockMode', false) === true;
}

function pickCard() {
  const deck = getDeck();
  if (!deck.length) return null;
  const reviewed = deck.filter((c) => (c.reviewCount || 0) > 0);
  const pool = reviewed.length ? reviewed : deck;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Ported from index.html's Scripture Lock Mode (showScriptureLock()/tryScriptureUnlock()).
// By explicit request (2026-08-04) this is now a real gate, not a gamified
// one: once it triggers, typing a practiced scripture correctly is the only
// way back in on this device — no password fallback. The Hint button is not
// a bypass; it only reveals the first few words of the same scripture being
// asked for. The cold-boot LockScreen (real password entry) is separate and
// unaffected — this only removes the escape hatch from this idle overlay.
export function ScriptureLockOverlay() {
  const { authenticated } = useAuth();
  const [shown, setShown] = useState(false);
  const [card, setCard] = useState<ReturnType<typeof pickCard>>(null);
  const [input, setInput] = useState('');
  const [msg, setMsg] = useState('');
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    if (!authenticated) return;
    const bump = () => {
      lastActivity.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((evt) => document.addEventListener(evt, bump, { passive: true }));
    const interval = setInterval(() => {
      if (!scriptureLockEnabled() || shown) return;
      if (Date.now() - lastActivity.current > IDLE_MS) {
        const c = pickCard();
        if (!c) return; // no deck yet — nothing to challenge with
        setCard(c);
        setInput('');
        setMsg('');
        setShown(true);
      }
    }, POLL_MS);
    return () => {
      ACTIVITY_EVENTS.forEach((evt) => document.removeEventListener(evt, bump));
      clearInterval(interval);
    };
  }, [authenticated, shown]);

  function hide() {
    setShown(false);
    lastActivity.current = Date.now();
  }

  function tryUnlock() {
    if (!card) {
      hide();
      return;
    }
    const typed = normalize(input);
    if (typed && (typed === normalize(card.fullText) || typed === normalize(card.keyPhrase))) {
      hide();
    } else {
      setMsg('Not quite — try again, or use a hint.');
    }
  }

  function showHint() {
    if (!card) return;
    const words = card.fullText.split(/\s+/).slice(0, 4).join(' ');
    setMsg(`Hint: "${words}…"`);
  }

  if (!authenticated || !shown || !card) return null;

  return (
    <div className="fixed inset-0 z-[998] flex items-center justify-center p-4" style={{ background: 'var(--navy)' }}>
      <div className="w-full max-w-[420px] text-center">
        <div className="mb-3 text-4xl">📖</div>
        <h1 className="mb-2 font-heading text-xl font-semibold text-white">Type the scripture to continue</h1>
        <div className="mb-5 text-base font-bold" style={{ color: 'var(--accent)' }}>{card.reference}</div>
        <textarea
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setMsg('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              tryUnlock();
            }
          }}
          placeholder="Type it from memory…"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
          className="h-28 w-full rounded-xl border-0 p-3 text-base"
          style={{ background: 'var(--card)', color: 'var(--foreground)' }}
        />
        {msg && <div className="mt-2 text-sm text-white/90">{msg}</div>}
        <button
          type="button"
          onClick={tryUnlock}
          className="mt-4 w-full rounded-xl py-3 text-[17px] font-bold text-white"
          style={{ background: 'var(--primary)', boxShadow: '0 2px 0 var(--gold-dark)' }}
        >
          Unlock
        </button>
        <div className="mt-3 flex justify-center text-sm">
          <button type="button" onClick={showHint} className="text-white/70 underline">Hint</button>
        </div>
      </div>
    </div>
  );
}
