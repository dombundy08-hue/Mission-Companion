import { useState } from 'react';
import { useAuth } from './AuthContext';

// Ported from index.html's #lock screen (showLock()/tryUnlock()).
export function LockScreen() {
  const { unlock, unlockDemo } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  function tryUnlock() {
    if (unlock(password)) return;
    setError(true);
    setPassword('');
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" style={{ background: 'var(--navy)' }}>
      <div className="w-full max-w-[360px] text-center">
        <div className="mb-3 text-4xl">✝️</div>
        <h1 className="mb-6 font-heading text-xl font-semibold text-white">Elder Bundy's Mission Companion</h1>
        <label htmlFor="lockInput" className="mb-1.5 block text-left text-sm font-medium text-white/80">
          Enter Password
        </label>
        <input
          id="lockInput"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && tryUnlock()}
          placeholder="••••••••"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          autoFocus
          className="h-12 w-full rounded-xl border-0 px-3.5 text-base"
          style={{ background: 'var(--card)', color: 'var(--foreground)' }}
        />
        {error && <div className="mt-2 text-sm text-red-300">Incorrect password. Try again.</div>}
        <button
          type="button"
          onClick={tryUnlock}
          className="mt-4 w-full rounded-xl py-3 text-[17px] font-bold text-white"
          style={{ background: 'var(--primary)', boxShadow: '0 2px 0 var(--gold-dark)' }}
        >
          Unlock
        </button>
        <button type="button" onClick={unlockDemo} className="mt-4 text-sm text-white/70 underline">
          Try Demo Mode
        </button>
        <div className="mt-5 text-xs text-white/60">Need help? Contact 720-745-0911 or 720-745-3166.</div>
      </div>
    </div>
  );
}
