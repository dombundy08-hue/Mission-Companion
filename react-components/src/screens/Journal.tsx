import { useMemo, useState } from 'react';
import { getLS, setLS } from '@/lib/storage';
import { fmtDateTime, fmtDateShort } from '@/lib/format';
import { pickPrompt } from '@/lib/journal-prompts';
import { cloudSaveJournal, cloudSaveSetting, cloudDeleteRow, uid, type JournalEntry } from '@/lib/supabase-sync';

type View = 'list' | 'new' | 'read';

function newSinceBackup() {
  const last = localStorage.getItem('lastBackupTimestamp');
  const lastT = last ? new Date(last).getTime() : 0;
  const j = getLS<JournalEntry[]>('journalEntries', []).filter((e) => e.timestamp > lastT);
  const m = getLS<{ timestamp: number }[]>('miracleEntries', []).filter((e) => e.timestamp > lastT);
  return { j, m, last };
}

function doExport() {
  const { j, m } = newSinceBackup();
  if (j.length === 0 && m.length === 0) {
    alert('Nothing new to back up.');
    return;
  }
  const today = fmtDateShort(new Date());
  let body = `MISSION JOURNAL BACKUP — ${today}\n\n`;
  body += `========================================\nJOURNAL ENTRIES (${j.length})\n========================================\n\n`;
  if (j.length === 0) body += '(none)\n\n';
  [...j].sort((a, b) => a.timestamp - b.timestamp).forEach((e) => {
    body += `${e.date}\n${e.body || ''}\n`;
    if (e.reflectionResponse) body += `\nReflection — ${e.reflectionPrompt}\n${e.reflectionResponse}\n`;
    body += `\n----------------------------------------\n\n`;
  });
  body += `\n========================================\nMIRACLES (${m.length})\n========================================\n\n`;
  if (m.length === 0) body += '(none)\n\n';

  const subject = `Mission Journal Backup — ${today}`;
  const href = `mailto:dom.bundy08@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = href;

  setTimeout(() => {
    if (confirm('Did you successfully send the backup email?\n\nTap OK to mark as backed up, or Cancel if not yet.')) {
      const iso = new Date().toISOString();
      localStorage.setItem('lastBackupTimestamp', iso);
      cloudSaveSetting('lastBackupTimestamp', iso);
    }
  }, 700);
}

export function Journal() {
  const [view, setView] = useState<View>('list');
  const [entries, setEntries] = useState<JournalEntry[]>(() => getLS('journalEntries', []));
  const [search, setSearch] = useState('');
  const [readId, setReadId] = useState<string | null>(null);
  const [draftPrompt, setDraftPrompt] = useState('');

  const filtered = useMemo(() => {
    const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (e) =>
        (e.body || '').toLowerCase().includes(q) ||
        (e.date || '').toLowerCase().includes(q) ||
        (e.reflectionResponse || '').toLowerCase().includes(q)
    );
  }, [entries, search]);

  if (view === 'new') {
    return (
      <JournalNew
        draftPrompt={draftPrompt}
        onCancel={() => setView('list')}
        onSaved={(entry) => {
          const arr = [...getLS<JournalEntry[]>('journalEntries', []), entry];
          setLS('journalEntries', arr);
          setEntries(arr);
          setView('list');
        }}
      />
    );
  }

  const reading = readId ? entries.find((e) => e.id === readId) : null;
  if (view === 'read' && reading) {
    return (
      <JournalRead
        entry={reading}
        onBack={() => setView('list')}
        onDeleted={() => {
          const arr = entries.filter((e) => e.id !== reading.id);
          setLS('journalEntries', arr);
          setEntries(arr);
          setView('list');
        }}
      />
    );
  }

  const { j, m, last } = newSinceBackup();
  const count = j.length + m.length;
  const lastTxt = last ? fmtDateShort(new Date(last)) : 'never';

  return (
    <div>
      <div className="mb-4 rounded-[14px] p-4 text-white" style={{ background: 'linear-gradient(150deg,#163C64,#1F5389)' }}>
        <div className="mb-3 text-sm">
          📤 <b>{count}</b> new {count === 1 ? 'entry' : 'entries'} since last backup on <b>{lastTxt}</b>.
        </div>
        <button
          type="button"
          onClick={doExport}
          className="w-full rounded-xl py-2.5 text-sm font-bold text-white"
          style={{ background: 'var(--primary)' }}
        >
          Export New Entries →
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          setDraftPrompt(pickPrompt());
          setView('new');
        }}
        className="mb-4 w-full rounded-xl py-3 text-[17px] font-bold text-white"
        style={{ background: 'var(--navy)' }}
      >
        ＋ New Entry
      </button>

      <h2 className="mb-3 text-[22px] font-bold" style={{ color: 'var(--navy)' }}>Past Entries</h2>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search your entries…"
        className="mb-3 h-12 w-full rounded-xl border px-3.5 text-base"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      />

      {filtered.length === 0 ? (
        <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {search ? 'No entries match your search.' : 'No entries yet. Tap "New Entry" to begin.'}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((e) => {
            const preview = (e.body || '').slice(0, 100) + ((e.body || '').length > 100 ? '…' : '');
            return (
              <div key={e.id} className="rounded-[14px] border p-3.5" style={{ background: 'var(--card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="mb-1 text-sm font-bold" style={{ color: 'var(--navy)' }}>{e.date}</div>
                <div className="mb-2.5 text-[15px]" style={{ color: preview ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                  {preview || '(no text)'}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReadId(e.id);
                    setView('read');
                  }}
                  className="rounded-xl px-4 py-2 text-sm font-medium"
                  style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}
                >
                  Read
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function JournalNew({
  draftPrompt,
  onCancel,
  onSaved,
}: {
  draftPrompt: string;
  onCancel: () => void;
  onSaved: (entry: JournalEntry) => void;
}) {
  const [body, setBody] = useState('');
  const [reflect, setReflect] = useState('');
  const header = fmtDateTime(new Date());

  function handleSave() {
    const trimmedBody = body.trim();
    const trimmedReflect = reflect.trim();
    if (!trimmedBody && !trimmedReflect) {
      alert('Write something before saving.');
      return;
    }
    const entry: JournalEntry = {
      id: uid(),
      date: header,
      timestamp: Date.now(),
      body: trimmedBody,
      reflectionPrompt: draftPrompt,
      reflectionResponse: trimmedReflect,
    };
    cloudSaveJournal(entry);
    onSaved(entry);
  }

  return (
    <div>
      <button type="button" onClick={onCancel} className="mb-3 text-sm font-medium" style={{ color: 'var(--primary)' }}>
        ← Back
      </button>
      <div className="card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, boxShadow: 'var(--shadow-sm)' }}>
        <div className="mb-2 text-[15px] font-bold" style={{ color: 'var(--gold-dark)' }}>{header}</div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write freely. This is your space."
          className="min-h-[200px] w-full rounded-xl border p-3 text-base leading-[1.55]"
          style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
        />
        <hr className="my-4" style={{ border: 'none', height: 1, background: 'var(--border)' }} />
        <div className="rounded-xl border p-3.5" style={{ background: 'var(--card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="mb-1 text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--gold-dark)' }}>Today's Reflection (optional)</div>
          <div className="mb-2.5 text-[15px] italic" style={{ color: 'var(--foreground)' }}>{draftPrompt}</div>
          <textarea
            value={reflect}
            onChange={(e) => setReflect(e.target.value)}
            placeholder="Your reflection…"
            className="min-h-[120px] w-full rounded-xl border p-3 text-base leading-[1.55]"
            style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
          />
        </div>
        <div className="mt-3.5 flex gap-2.5">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl py-3 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="flex-1 rounded-xl py-3 text-[17px] font-bold text-white" style={{ background: 'var(--primary)', boxShadow: '0 2px 0 var(--gold-dark)' }}>
            Save Entry
          </button>
        </div>
      </div>
    </div>
  );
}

function JournalRead({
  entry,
  onBack,
  onDeleted,
}: {
  entry: JournalEntry;
  onBack: () => void;
  onDeleted: () => void;
}) {
  function handleDelete() {
    if (!confirm('Delete this entry permanently?')) return;
    cloudDeleteRow('journal_entries', entry);
    onDeleted();
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 text-sm font-medium" style={{ color: 'var(--primary)' }}>
        ← Back
      </button>
      <div className="card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, boxShadow: 'var(--shadow-sm)' }}>
        <div className="mb-2 text-[15px] font-bold" style={{ color: 'var(--gold-dark)' }}>{entry.date}</div>
        <div className="whitespace-pre-wrap text-[15px]" style={{ color: entry.body ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
          {entry.body || '(no text)'}
        </div>
        {entry.reflectionResponse && (
          <>
            <hr className="my-4" style={{ border: 'none', height: 1, background: 'var(--border)' }} />
            <div className="rounded-xl border p-3.5" style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="mb-1 text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--gold-dark)' }}>Today's Reflection</div>
              <div className="mb-2.5 text-[15px] italic" style={{ color: 'var(--foreground)' }}>{entry.reflectionPrompt}</div>
              <div className="whitespace-pre-wrap text-[15px]" style={{ color: 'var(--foreground)' }}>{entry.reflectionResponse}</div>
            </div>
          </>
        )}
        <button type="button" onClick={handleDelete} className="mt-4 rounded-xl px-4 py-2 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
          Delete Entry
        </button>
      </div>
    </div>
  );
}
