import { useEffect, useState } from 'react';
import { getLS, setLS } from '@/lib/storage';
import { cloudSaveSetting } from '@/lib/supabase-sync';
import { applyTheme, isDarkModeOn } from '@/lib/theme';
import { listEnglishVoiceNames, getPreferredVoiceName, setPreferredVoiceName, speak } from '@/lib/audio';
import { APP_PASSWORD } from '@/lib/auth';
import { useAuth } from './AuthContext';
import { isDemoMode, wipeLocalData, DEMO_AI_MESSAGE } from '@/lib/demo';
import { getQrCode, contactShareUrl, qrImageUrl } from '@/lib/qr';
import { getBuildHistory } from '@/lib/update-check';
import { notifySettingsChanged } from '@/lib/settings-bus';
import { fetchContactLeads, type ContactLead } from '@/lib/supabase-sync';

type Page = 'appearance' | 'popups' | 'healthMetrics' | 'apiKeys' | 'voice' | 'account' | 'contacts' | null;

const METRIC_OPTIONS = [
  { id: 'calories', label: 'Calories', emoji: '🍽️' },
  { id: 'protein', label: 'Protein', emoji: '💪' },
  { id: 'sleep', label: 'Sleep', emoji: '😴' },
  { id: 'water', label: 'Water', emoji: '💧' },
  { id: 'mood', label: 'Mood', emoji: '😊' },
  { id: 'energy', label: 'Energy', emoji: '⚡' },
  { id: 'weight', label: 'Weight', emoji: '⚖️' },
];

const cardRowClass =
  'flex w-full items-center gap-3 rounded-xl p-3 text-left';
const fieldClass = 'h-12 w-full rounded-xl border px-3 text-base';
const fieldStyle = { borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' };

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

// Faithful port of index.html's Settings modal (openSettings()/renderSettingsView()) —
// same card layout, same page set, same localStorage keys + cloudSaveSetting calls.
export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [page, setPage] = useState<Page>(null);

  useEffect(() => {
    if (open) setPage(null);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-8" onClick={onClose}>
      <div
        className="w-full max-w-[480px] rounded-2xl p-5"
        style={{ background: 'var(--card)', boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex justify-end">
          <button type="button" onClick={onClose} aria-label="Close settings" className="text-xl leading-none" style={{ color: 'var(--muted-foreground)' }}>
            ✕
          </button>
        </div>
        {page === null ? (
          <MainView onNavigate={setPage} />
        ) : page === 'appearance' ? (
          <AppearancePage onBack={() => setPage(null)} />
        ) : page === 'popups' ? (
          <PopupsPage onBack={() => setPage(null)} />
        ) : page === 'healthMetrics' ? (
          <HealthMetricsPage onBack={() => setPage(null)} />
        ) : page === 'apiKeys' ? (
          <ApiKeysPage onBack={() => setPage(null)} />
        ) : page === 'voice' ? (
          <VoicePage onBack={() => setPage(null)} />
        ) : page === 'account' ? (
          <AccountPage onBack={() => setPage(null)} />
        ) : (
          <ContactsPage onBack={() => setPage(null)} />
        )}
      </div>
    </div>
  );
}

function MainView({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const cards: { page: Page; icon: string; title: string; subtitle: string }[] = [
    { page: 'appearance', icon: '🌙', title: 'Appearance', subtitle: 'Dark mode' },
    { page: 'popups', icon: '🔔', title: 'Pop-ups', subtitle: 'Manage notification reminders' },
    { page: 'healthMetrics', icon: '📊', title: 'Health Metrics', subtitle: 'Customize visible metrics' },
    { page: 'apiKeys', icon: '🔒', title: 'API Keys & Security', subtitle: 'Manage API credentials' },
    { page: 'voice', icon: '🔊', title: 'Preferences', subtitle: 'Workout voice & settings' },
    { page: 'account', icon: '👤', title: 'Account', subtitle: 'Lock app & security' },
    { page: 'contacts', icon: '📇', title: 'My QR Code', subtitle: 'Share your info, collect theirs' },
  ];

  return (
    <div>
      <h3 className="mb-3 text-[19px] font-bold" style={{ color: 'var(--foreground)' }}>Settings</h3>
      <div className="space-y-1.5">
        {cards.map((c) => (
          <button key={c.title} type="button" onClick={() => onNavigate(c.page)} className={cardRowClass}>
            <span className="text-xl">{c.icon}</span>
            <div className="flex-1">
              <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{c.title}</div>
              <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{c.subtitle}</div>
            </div>
            <span style={{ color: 'var(--muted-foreground)' }}>›</span>
          </button>
        ))}
        <a href="https://donations.churchofjesuschrist.org/donations/donation?tabKey=0" target="_blank" rel="noreferrer">
          <div className={cardRowClass}>
            <span className="text-xl">💝</span>
            <div className="flex-1">
              <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Give</div>
              <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Donate to the Church</div>
            </div>
            <span style={{ color: 'var(--muted-foreground)' }}>↗</span>
          </div>
        </a>
      </div>
      <hr className="my-4" style={{ borderColor: 'var(--border)' }} />
      <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>Need help? 720-745-0911 or 720-745-3166.</p>
    </div>
  );
}

function BackBtn({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="mb-3 text-sm font-medium" style={{ color: 'var(--primary)' }}>
      ← Back to Settings
    </button>
  );
}

function AppearancePage({ onBack }: { onBack: () => void }) {
  const [dark, setDark] = useState(isDarkModeOn());

  return (
    <div>
      <BackBtn onBack={onBack} />
      <h3 className="mb-3 text-[19px] font-bold" style={{ color: 'var(--foreground)' }}>Appearance</h3>
      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={dark}
          onChange={(e) => {
            setDark(e.target.checked);
            applyTheme(e.target.checked);
          }}
          className="h-5 w-5 flex-none"
        />
        <span className="text-sm" style={{ color: 'var(--foreground)' }}>
          Dark mode <span style={{ color: 'var(--muted-foreground)' }}>(auto respects system preference)</span>
        </span>
      </label>
    </div>
  );
}

function PopupsPage({ onBack }: { onBack: () => void }) {
  const [day, setDay] = useState(() => getLS('health_reflectionReminderDay', 0));
  const [time, setTime] = useState(() => getLS('health_reflectionReminderTime', '13:00'));

  return (
    <div>
      <BackBtn onBack={onBack} />
      <h3 className="mb-3 text-[19px] font-bold" style={{ color: 'var(--foreground)' }}>Pop-ups</h3>
      <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Weekly Reflection Day</label>
      <select
        value={day}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          setDay(v);
          setLS('health_reflectionReminderDay', v);
          cloudSaveSetting('health_reflectionReminderDay', String(v));
          notifySettingsChanged();
        }}
        className={fieldClass}
        style={fieldStyle}
      >
        <option value={0}>Sunday</option>
        <option value={1}>Monday</option>
        <option value={2}>Tuesday</option>
        <option value={3}>Wednesday</option>
        <option value={4}>Thursday</option>
        <option value={5}>Friday</option>
        <option value={6}>Saturday</option>
      </select>
      <label className="mb-1.5 mt-3 block text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Time</label>
      <input
        type="time"
        value={time}
        onChange={(e) => {
          setTime(e.target.value);
          setLS('health_reflectionReminderTime', e.target.value);
          cloudSaveSetting('health_reflectionReminderTime', e.target.value);
          notifySettingsChanged();
        }}
        className={fieldClass}
        style={fieldStyle}
      />
      <div className="mt-1.5 text-[13px]" style={{ color: 'var(--muted-foreground)' }}>Get a weekly nudge to reflect on your health progress.</div>
    </div>
  );
}

function HealthMetricsPage({ onBack }: { onBack: () => void }) {
  const [selected, setSelected] = useState<string[]>(() =>
    getLS('health_visibleMetrics', ['calories', 'protein', 'sleep', 'water', 'mood', 'energy'])
  );

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((m) => m !== id) : [...selected, id];
    setSelected(next);
    setLS('health_visibleMetrics', next);
    cloudSaveSetting('health_visibleMetrics', JSON.stringify(next));
    notifySettingsChanged();
  }

  return (
    <div>
      <BackBtn onBack={onBack} />
      <h3 className="mb-3 text-[19px] font-bold" style={{ color: 'var(--foreground)' }}>Health Metrics</h3>
      <div className="mb-3 text-[13px]" style={{ color: 'var(--muted-foreground)' }}>Choose which metrics to display on your health card:</div>
      <div className="space-y-2.5">
        {METRIC_OPTIONS.map((m) => (
          <label key={m.id} className="flex cursor-pointer items-center gap-2.5">
            <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} className="h-5 w-5 flex-none" />
            <span className="text-sm" style={{ color: 'var(--foreground)' }}>{m.emoji} {m.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ApiKeysPage({ onBack }: { onBack: () => void }) {
  const [unlocked, setUnlocked] = useState(false);
  const [showPwPrompt, setShowPwPrompt] = useState(false);
  const [pw, setPw] = useState('');
  const [pwErr, setPwErr] = useState(false);
  const [key, setKey] = useState('');
  const [usda, setUsda] = useState('');
  const [saved, setSaved] = useState(false);

  function tryUnlock() {
    if (pw === APP_PASSWORD) {
      setKey(localStorage.getItem('apiKey') || '');
      setUsda(localStorage.getItem('usdaApiKey') || '');
      setUnlocked(true);
      setShowPwPrompt(false);
      setPwErr(false);
    } else {
      setPwErr(true);
      setPw('');
    }
  }

  function handleSave() {
    const trimmed = key.trim();
    const usdaTrimmed = usda.trim();
    if (!trimmed) {
      alert('Enter your Anthropic API key.');
      return;
    }
    localStorage.setItem('apiKey', trimmed);
    localStorage.setItem('usdaApiKey', usdaTrimmed);
    cloudSaveSetting('apiKey', trimmed);
    cloudSaveSetting('usdaApiKey', usdaTrimmed);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  if (isDemoMode()) {
    return (
      <div>
        <BackBtn onBack={onBack} />
        <h3 className="mb-3 text-[19px] font-bold" style={{ color: 'var(--foreground)' }}>API Keys & Security</h3>
        <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
          {DEMO_AI_MESSAGE} API keys aren't accessible in Demo Mode.
        </div>
      </div>
    );
  }

  return (
    <div>
      <BackBtn onBack={onBack} />
      <h3 className="mb-3 text-[19px] font-bold" style={{ color: 'var(--foreground)' }}>API Keys & Security</h3>

      {!unlocked && !showPwPrompt && (
        <button type="button" onClick={() => setShowPwPrompt(true)} className={cardRowClass} style={{ background: 'var(--secondary)' }}>
          <span>🔒</span>
          <span className="flex-1 text-sm font-medium" style={{ color: 'var(--secondary-foreground)' }}>API Keys</span>
          <span style={{ color: 'var(--muted-foreground)' }}>›</span>
        </button>
      )}

      {showPwPrompt && (
        <div>
          <p className="mb-2 text-sm" style={{ color: 'var(--foreground)' }}>Enter your app password to view or edit your API keys.</p>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && tryUnlock()}
            placeholder="App password"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className={fieldClass}
            style={fieldStyle}
          />
          {pwErr && <div className="mt-1 text-sm" style={{ color: 'var(--destructive)' }}>Incorrect password. Try again.</div>}
          <div className="mt-3 flex gap-2.5">
            <button type="button" onClick={() => { setShowPwPrompt(false); setPw(''); setPwErr(false); }} className="flex-1 rounded-xl py-3 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
              Cancel
            </button>
            <button type="button" onClick={tryUnlock} className="flex-1 rounded-xl py-3 text-sm font-bold text-white" style={{ background: 'var(--primary)', boxShadow: '0 2px 0 var(--gold-dark)' }}>
              Unlock
            </button>
          </div>
        </div>
      )}

      {unlocked && (
        <div>
          <p className="mb-2 text-sm" style={{ color: 'var(--foreground)' }}>Update your Anthropic API key. Stored only on this device.</p>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Anthropic API key"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className={fieldClass + ' mb-3'}
            style={fieldStyle}
          />
          <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
            USDA FoodData Central key <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(for food search)</span>
          </label>
          <input
            type="password"
            value={usda}
            onChange={(e) => setUsda(e.target.value)}
            placeholder="USDA API key"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className={fieldClass}
            style={fieldStyle}
          />
          <div className="mt-1 text-[12.5px] leading-tight" style={{ color: 'var(--muted-foreground)' }}>
            Free 2-minute signup — no cost:<br />fdc.nal.usda.gov/api-key-signup.html
          </div>
          <button type="button" onClick={handleSave} className="mt-3.5 w-full rounded-xl py-3 text-[17px] font-bold text-white" style={{ background: 'var(--primary)', boxShadow: '0 2px 0 var(--gold-dark)' }}>
            Save Keys
          </button>
          {saved && <div className="mt-2 text-sm font-medium" style={{ color: 'var(--primary)' }}>API keys saved.</div>}
        </div>
      )}
    </div>
  );
}

function VoicePage({ onBack }: { onBack: () => void }) {
  const [voices, setVoices] = useState<string[]>(() => listEnglishVoiceNames());
  const [selected, setSelected] = useState(() => getPreferredVoiceName());

  useEffect(() => {
    if (voices.length) return;
    const onChanged = () => setVoices(listEnglishVoiceNames());
    window.speechSynthesis?.addEventListener('voiceschanged', onChanged);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', onChanged);
  }, [voices.length]);

  return (
    <div>
      <BackBtn onBack={onBack} />
      <h3 className="mb-3 text-[19px] font-bold" style={{ color: 'var(--foreground)' }}>Preferences</h3>
      <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Workout Voice</label>
      <div className="mb-2 text-[13px]" style={{ color: 'var(--muted-foreground)' }}>Used to announce steps out loud.</div>
      <select
        value={selected}
        onChange={(e) => {
          setSelected(e.target.value);
          setPreferredVoiceName(e.target.value);
          notifySettingsChanged();
        }}
        className={fieldClass}
        style={fieldStyle}
      >
        {voices.length === 0 && <option value="">No voices available</option>}
        {voices.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => speak('Testing voice.')}
        className="mt-2.5 rounded-xl px-4 py-2 text-sm font-medium"
        style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}
      >
        🔊 Test Voice
      </button>
    </div>
  );
}

function AccountPage({ onBack }: { onBack: () => void }) {
  const { lock } = useAuth();
  const [scriptureLock, setScriptureLock] = useState(() => getLS('scriptureLockMode', false));

  return (
    <div>
      <BackBtn onBack={onBack} />
      <h3 className="mb-3 text-[19px] font-bold" style={{ color: 'var(--foreground)' }}>Account</h3>
      <label className="mb-4 flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={scriptureLock}
          onChange={(e) => {
            setScriptureLock(e.target.checked);
            setLS('scriptureLockMode', e.target.checked);
            cloudSaveSetting('scriptureLockMode', e.target.checked);
            notifySettingsChanged();
          }}
          className="h-5 w-5 flex-none"
        />
        <span className="text-sm" style={{ color: 'var(--foreground)' }}>
          📖 Scripture Lock Mode{' '}
          <span style={{ color: 'var(--muted-foreground)' }}>(type a practiced scripture to re-enter after being idle — password always still works)</span>
        </span>
      </label>
      <button
        type="button"
        onClick={() => {
          if (confirm("Lock the app? You'll need the password to unlock it.")) {
            lock();
          }
        }}
        className="w-full rounded-xl py-3 text-sm font-bold text-white"
        style={{ background: 'var(--destructive)' }}
      >
        🔒 Lock App
      </button>
      <button
        type="button"
        onClick={() => {
          if (confirm('Wipe all data on this device? This clears everything stored locally (journal, health logs, scripture progress, settings) and cannot be undone. Your Supabase cloud backup is not touched.')) {
            wipeLocalData();
          }
        }}
        className="mt-2.5 w-full rounded-xl border py-3 text-sm font-bold"
        style={{ borderColor: 'var(--destructive)', color: 'var(--destructive)' }}
      >
        🗑️ Wipe Local Data
      </button>
      <div className="mt-1.5 text-[12.5px]" style={{ color: 'var(--muted-foreground)' }}>
        Clears data on this device only — does not delete anything from the cloud backup.
      </div>

      <hr className="my-4" style={{ borderColor: 'var(--border)' }} />
      <h4 className="mb-2 text-sm font-bold" style={{ color: 'var(--foreground)' }}>App Version</h4>
      {(() => {
        const history = getBuildHistory();
        if (!history.length) {
          return <div className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>Version info isn't available in this preview — it shows up once the app is live.</div>;
        }
        return (
          <>
            <div className="text-[13px]" style={{ color: 'var(--foreground)' }}>
              Running: <code>{history[0].hash}</code> since {new Date(history[0].firstSeen).toLocaleDateString()}
            </div>
            {history.length > 1 && (
              <div className="mt-1 text-[12.5px]" style={{ color: 'var(--muted-foreground)' }}>
                Recent on this device: {history.slice(1).map((h) => h.hash).join(', ')}
              </div>
            )}
            <div className="mt-2 text-[12.5px]" style={{ color: 'var(--muted-foreground)' }}>
              There's no one-tap rollback for this kind of app — it's hosted as static files with no server to switch versions on. If a version breaks something, the fix is to redeploy a previous working commit (ask whoever manages the app's code to do that).
            </div>
          </>
        );
      })()}
    </div>
  );
}

function ContactsPage({ onBack }: { onBack: () => void }) {
  const [code] = useState(() => getQrCode());
  const [leads, setLeads] = useState<ContactLead[]>([]);
  const [loading, setLoading] = useState(true);
  const url = contactShareUrl(code);

  useEffect(() => {
    fetchContactLeads().then((rows) => {
      setLeads(rows);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <BackBtn onBack={onBack} />
      <h3 className="mb-3 text-[19px] font-bold" style={{ color: 'var(--foreground)' }}>My QR Code</h3>
      <div className="mb-4 rounded-xl border p-4 text-center" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
        <img src={qrImageUrl(url)} alt="QR code linking to your contact-share page" className="mx-auto mb-3 h-[180px] w-[180px]" />
        <div className="break-all text-xs" style={{ color: 'var(--muted-foreground)' }}>{url}</div>
      </div>
      <p className="mb-4 text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
        Anyone can scan this with their phone's camera — no app needed. It opens a page where they can leave their name and contact info for you.
      </p>

      <h4 className="mb-2 text-sm font-bold" style={{ color: 'var(--foreground)' }}>Collected so far</h4>
      {loading ? (
        <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading…</div>
      ) : !leads.length ? (
        <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No one has sent their info yet.</div>
      ) : (
        <div className="space-y-2">
          {leads.map((l) => (
            <div key={l.id} className="rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              <div className="text-sm font-bold" style={{ color: 'var(--foreground)' }}>{l.name}</div>
              {(l.phone || l.email) && (
                <div className="text-sm" style={{ color: 'var(--foreground)' }}>{[l.phone, l.email].filter(Boolean).join(' · ')}</div>
              )}
              {l.note && <div className="mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>{l.note}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
