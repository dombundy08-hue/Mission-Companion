import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { sb } from '@/lib/supabase-sync';
import { isDemoMode, setDemoMode, wipeLocalData } from '@/lib/demo';

interface AuthContextValue {
  authenticated: boolean;
  sessionLoading: boolean;
  unlockDemo: () => void;
  lock: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Global auth state. `authenticated` now reflects a real Supabase Auth
// session (or Demo Mode) instead of a single shared password flag — each
// person who signs in gets their own private data via Postgres RLS.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [hasSession, setHasSession] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [demo, setDemo] = useState(() => isDemoMode());

  useEffect(() => {
    if (demo) {
      setSessionLoading(false);
      return;
    }
    let cancelled = false;
    sb.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setHasSession(!!data.session);
      setSessionLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [demo]);

  // No password check — Demo Mode is meant to be handed to anyone. Wipes
  // first: this device may already hold a real signed-in user's journal/
  // health/scripture data, and demo mode must never expose it to whoever
  // it's shown to. Safe to clear synchronously here — nothing past
  // LockScreen has read localStorage yet, since the gated screens only
  // mount once authenticated flips true below.
  function unlockDemo() {
    localStorage.clear();
    setDemoMode(true);
    setDemo(true);
  }

  // Locking a real account signs out of Supabase Auth AND wipes local data
  // — not just cosmetic cleanup. This app is local-first (localStorage is
  // read before any cloud pull runs), so without the wipe, the next person
  // to log in on this same browser would see the previous account's
  // cached data flash on screen. "Lock App" and "Sign Out" are the same
  // action for this reason — no lighter-weight re-lock that keeps the
  // local cache around.
  async function lock() {
    if (isDemoMode()) {
      wipeLocalData();
      return;
    }
    await sb.auth.signOut();
    wipeLocalData();
  }

  const authenticated = demo || hasSession;

  return (
    <AuthContext.Provider value={{ authenticated, sessionLoading, unlockDemo, lock }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
