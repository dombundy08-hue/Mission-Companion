import { useState } from 'react';
import { sb, cloudSaveSetting } from '@/lib/supabase-sync';
import { setLS } from '@/lib/storage';
import { notifySaved } from '@/lib/save-toast';

const LANGUAGES = ['Spanish', 'Portuguese', 'French', 'German', 'Italian', 'Tagalog', 'Mandarin', 'Japanese', 'Korean', 'Vietnamese', 'Russian', 'Mongolian', 'Other'];

const fieldClass = 'h-12 w-full rounded-xl border-0 px-3.5 text-base';
const fieldStyle = { background: 'var(--card)', color: 'var(--foreground)' };

// Runs once, right after a real (non-Demo) account's first successful
// login/signup — see App.tsx's `onboardingDone` gate. Sign-up itself only
// collects email + password; this is where the rest of the profile is
// gathered, structured (title + name rather than one free-text field) so
// `display_name` stays consistent everywhere it's read (HomeScreen's
// "Welcome back", ContactShare's public page).
export function Onboarding({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState<'Elder' | 'Sister'>('Elder');
  const [name, setName] = useState('');
  const [teachesLanguage, setTeachesLanguage] = useState(false);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [otherLanguage, setOtherLanguage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Enter your name.');
      return;
    }
    setError('');
    setBusy(true);
    const displayName = `${title} ${trimmedName}`;
    const finalLanguage = teachesLanguage ? (language === 'Other' ? otherLanguage.trim() : language) : '';

    const { data } = await sb.auth.getUser();
    const uid = data.user?.id;
    await sb.auth.updateUser({ data: { display_name: displayName } });
    if (uid) await sb.from('profiles').update({ display_name: displayName }).eq('id', uid);

    setLS('profile_title', title);
    setLS('profile_language', finalLanguage);
    setLS('onboarding_complete', true);
    cloudSaveSetting('profile_title', title);
    cloudSaveSetting('profile_language', finalLanguage);
    cloudSaveSetting('onboarding_complete', true);

    setBusy(false);
    notifySaved('Profile saved.');
    onDone();
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center overflow-y-auto p-4" style={{ background: 'var(--navy)' }}>
      <div className="w-full max-w-[360px] py-6 text-center">
        <div className="mb-3 text-4xl">👋</div>
        <h1 className="mb-2 font-heading text-xl font-semibold text-white">Welcome!</h1>
        <p className="mb-6 text-sm text-white/70">A couple quick things before you get started.</p>

        <div className="space-y-3 text-left">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-white/80">You are a...</label>
            <div className="flex rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <button
                type="button"
                onClick={() => setTitle('Elder')}
                className="flex-1 rounded-lg py-2 text-sm font-bold"
                style={{ background: title === 'Elder' ? 'var(--card)' : 'transparent', color: title === 'Elder' ? 'var(--foreground)' : '#fff' }}
              >
                Elder
              </button>
              <button
                type="button"
                onClick={() => setTitle('Sister')}
                className="flex-1 rounded-lg py-2 text-sm font-bold"
                style={{ background: title === 'Sister' ? 'var(--card)' : 'transparent', color: title === 'Sister' ? 'var(--foreground)' : '#fff' }}
              >
                Sister
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="obName" className="mb-1.5 block text-sm font-medium text-white/80">Name</label>
            <input
              id="obName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bundy"
              autoFocus
              className={fieldClass}
              style={fieldStyle}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 pt-1">
            <input type="checkbox" checked={teachesLanguage} onChange={(e) => setTeachesLanguage(e.target.checked)} className="h-5 w-5 flex-none" />
            <span className="text-sm text-white/80">I teach in another language</span>
          </label>

          {teachesLanguage && (
            <div>
              <label htmlFor="obLang" className="mb-1.5 block text-sm font-medium text-white/80">Language</label>
              <select id="obLang" value={language} onChange={(e) => setLanguage(e.target.value)} className={fieldClass} style={fieldStyle}>
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              {language === 'Other' && (
                <input
                  type="text"
                  value={otherLanguage}
                  onChange={(e) => setOtherLanguage(e.target.value)}
                  placeholder="Which language?"
                  className={fieldClass + ' mt-2'}
                  style={fieldStyle}
                />
              )}
            </div>
          )}
        </div>

        {error && <div className="mt-3 text-sm text-red-300">{error}</div>}

        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="mt-5 w-full rounded-xl py-3 text-[17px] font-bold text-white disabled:opacity-60"
          style={{ background: 'var(--primary)', boxShadow: '0 2px 0 var(--gold-dark)' }}
        >
          {busy ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </div>
  );
}
