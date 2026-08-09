import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLS, setLS } from '@/lib/storage';
import { cloudSaveSetting } from '@/lib/supabase-sync';
import { applyTheme, isDarkModeOn } from '@/lib/theme';
import { listEnglishVoiceNames, getPreferredVoiceName, setPreferredVoiceName, speak } from '@/lib/audio';
import { useAuth } from './AuthContext';
import { getQrCode, contactShareUrl, qrImageUrl } from '@/lib/qr';
import { getBuildHistory } from '@/lib/update-check';
import { notifySettingsChanged } from '@/lib/settings-bus';
import { notifySaved } from '@/lib/save-toast';

type Page = 'appearance' | 'popups' | 'healthMetrics' | 'voice' | 'account' | 'contacts' | null;

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
        ) : page === 'voice' ? (
          <VoicePage onBack={() => setPage(null)} />
        ) : page === 'account' ? (
          <AccountPage onBack={() => setPage(null)} />
        ) : (
          <ContactsPage onBack={() => setPage(null)} onClose={onClose} />
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
          cloudSaveSetting('health_reflectionReminderDay', v);
          notifySettingsChanged();
          notifySaved('Pop-up settings saved.');
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
          notifySaved('Pop-up settings saved.');
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
    cloudSaveSetting('health_visibleMetrics', next);
    notifySettingsChanged();
    notifySaved('Metrics updated.');
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
            notifySaved('Account settings saved.');
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

function ContactsPage({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  useEffect(() => {
    getQrCode().then(setCode);
  }, []);
  const url = contactShareUrl(code);

  function viewCollection() {
    onClose();
    navigate('/contacts');
  }

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

      <button
        type="button"
        onClick={viewCollection}
        className="w-full rounded-xl py-3 text-[15px] font-bold text-white"
        style={{ background: 'var(--primary)', boxShadow: '0 2px 0 var(--gold-dark)' }}
      >
        View Collection →
      </button>
    </div>
  );
}
