import { useEffect, useState } from 'react';

// Global "Saved" confirmation — a single source of truth so every save
// action across the app shows the exact same brief toast, instead of each
// screen hand-rolling its own flash/setTimeout. Not a Supabase/network
// thing — purely a same-tab, same-page notification, same shape as
// settings-bus.ts.
const EVENT = 'mc:saved';
const VISIBLE_MS = 1600;

export function notifySaved(label = 'Saved') {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: label }));
}

export function useSaveToast(): string | null {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    function onSaved(e: Event) {
      setMsg((e as CustomEvent<string>).detail);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), VISIBLE_MS);
    }
    window.addEventListener(EVENT, onSaved);
    return () => {
      window.removeEventListener(EVENT, onSaved);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return msg;
}
