import { createContext, useContext, useState, type ReactNode } from 'react';
import { APP_PASSWORD, isAuthenticated as readAuthenticated, setAuthenticated as writeAuthenticated } from '@/lib/auth';
import { isDemoMode, setDemoMode, wipeLocalData } from '@/lib/demo';

interface AuthContextValue {
  authenticated: boolean;
  unlock: (password: string) => boolean;
  unlockDemo: () => void;
  lock: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Global auth state, lifted out of localStorage so LockScreen, the
// Settings "Lock App" button, and the Scripture Lock overlay can all
// read/flip it without a full page reload.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticatedState] = useState(() => readAuthenticated());

  function unlock(password: string): boolean {
    if (password !== APP_PASSWORD) return false;
    writeAuthenticated(true);
    setAuthenticatedState(true);
    return true;
  }

  // No password check — Demo Mode is meant to be handed to anyone. Wipes
  // first: this device may already hold Dom's real journal/health/scripture
  // data, and demo mode must never expose it to whoever it's shown to.
  // Safe to clear synchronously here — nothing past LockScreen has read
  // localStorage yet, since the gated screens only mount once authenticated
  // flips true below.
  function unlockDemo() {
    localStorage.clear();
    setDemoMode(true);
    writeAuthenticated(true);
    setAuthenticatedState(true);
  }

  // Locking out of a Demo Mode session wipes it, so the next person who
  // opens the app starts from a clean first-run state.
  function lock() {
    if (isDemoMode()) {
      wipeLocalData();
      return;
    }
    writeAuthenticated(false);
    setAuthenticatedState(false);
  }

  return <AuthContext.Provider value={{ authenticated, unlock, unlockDemo, lock }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
