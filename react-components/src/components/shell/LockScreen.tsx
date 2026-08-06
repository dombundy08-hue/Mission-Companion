import { useState } from 'react';
import { signIn, signUp, accountCount, MAX_ACCOUNTS } from '@/lib/auth';
import { useAuth } from './AuthContext';
import { InstallPwaCard } from './InstallPwaCard';

type Mode = 'signIn' | 'signUp';

const fieldClass = 'h-12 w-full rounded-xl border-0 px-3.5 text-base';
const fieldStyle = { background: 'var(--card)', color: 'var(--foreground)' };

export function LockScreen() {
  const { unlockDemo } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setNotice('');
    setPassword('');
    setConfirmPassword('');
  }

  async function handleSignIn() {
    setError('');
    setBusy(true);
    const { error: err } = await signIn(email.trim(), password);
    setBusy(false);
    if (err) setError(err.message);
    // On success, AuthContext's onAuthStateChange listener picks up the
    // new session automatically — nothing else to do here.
  }

  async function handleSignUp() {
    setError('');
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    const count = await accountCount();
    if (count >= MAX_ACCOUNTS) {
      setBusy(false);
      setError('This app is currently full.');
      return;
    }
    // Name/title/language are collected right after this by Onboarding.tsx,
    // not here — sign-up itself is just email + password.
    const { data, error: err } = await signUp(email.trim(), password, '');
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (!data.session) {
      // Email confirmation is required before this account can log in —
      // switch to Log In mode without switchMode()'s reset, which would
      // immediately clear the notice we're about to show.
      setMode('signIn');
      setPassword('');
      setConfirmPassword('');
      setNotice('Account created — check your email to confirm it, then log in.');
    }
    // If a session came back immediately (confirmation disabled),
    // AuthContext's listener picks it up automatically.
  }

  function handleSubmit() {
    if (busy) return;
    if (mode === 'signIn') handleSignIn();
    else handleSignUp();
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" style={{ background: 'var(--navy)' }}>
      <div className="w-full max-w-[360px] text-center">
        <div className="mb-3 text-4xl">✝️</div>
        <h1 className="mb-6 font-heading text-xl font-semibold text-white">Missionary Companion</h1>

        <div className="mb-5 flex rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <button
            type="button"
            onClick={() => switchMode('signIn')}
            className="flex-1 rounded-lg py-2 text-sm font-bold"
            style={{ background: mode === 'signIn' ? 'var(--card)' : 'transparent', color: mode === 'signIn' ? 'var(--foreground)' : '#fff' }}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => switchMode('signUp')}
            className="flex-1 rounded-lg py-2 text-sm font-bold"
            style={{ background: mode === 'signUp' ? 'var(--card)' : 'transparent', color: mode === 'signUp' ? 'var(--foreground)' : '#fff' }}
          >
            Create Account
          </button>
        </div>

        <div className="space-y-3 text-left">
          <div>
            <label htmlFor="authEmail" className="mb-1.5 block text-sm font-medium text-white/80">Email</label>
            <input
              id="authEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              autoCapitalize="off"
              spellCheck={false}
              autoFocus
              className={fieldClass}
              style={fieldStyle}
            />
          </div>
          <div>
            <label htmlFor="authPassword" className="mb-1.5 block text-sm font-medium text-white/80">Password</label>
            <input
              id="authPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (mode === 'signIn' ? handleSubmit() : undefined)}
              placeholder="••••••••"
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              className={fieldClass}
              style={fieldStyle}
            />
          </div>
          {mode === 'signUp' && (
            <div>
              <label htmlFor="authConfirm" className="mb-1.5 block text-sm font-medium text-white/80">Confirm Password</label>
              <input
                id="authConfirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="••••••••"
                autoComplete="new-password"
                className={fieldClass}
                style={fieldStyle}
              />
            </div>
          )}
        </div>

        {error && <div className="mt-3 text-sm text-red-300">{error}</div>}
        {notice && <div className="mt-3 text-sm text-green-300">{notice}</div>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={busy}
          className="mt-4 w-full rounded-xl py-3 text-[17px] font-bold text-white disabled:opacity-60"
          style={{ background: 'var(--primary)', boxShadow: '0 2px 0 var(--gold-dark)' }}
        >
          {busy ? 'Please wait…' : mode === 'signIn' ? 'Log In' : 'Create Account'}
        </button>
        <button type="button" onClick={unlockDemo} className="mt-4 text-sm text-white/70 underline">
          Try Demo Mode
        </button>
        <div className="mt-5 text-xs text-white/60">Need help? Contact 720-745-0911 or 720-745-3166.</div>

        <InstallPwaCard />
      </div>
    </div>
  );
}
