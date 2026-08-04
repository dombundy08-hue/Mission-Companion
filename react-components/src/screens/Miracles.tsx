import { useMemo, useState } from 'react';
import { getLS, setLS } from '@/lib/storage';
import { fmtDateTime } from '@/lib/format';
import { cloudSaveMiracle, cloudDeleteRow, uid, type MiracleEntry } from '@/lib/supabase-sync';
import { ReadModal } from '@/components/shell/ReadModal';

// Faithful port of index.html's renderMiracles() — same localStorage key
// (miracleEntries), same cloud sync calls, same search behavior.
export function Miracles() {
  const [entries, setEntries] = useState<MiracleEntry[]>(() => getLS('miracleEntries', []));
  const [body, setBody] = useState('');
  const [search, setSearch] = useState('');
  const [reading, setReading] = useState<MiracleEntry | null>(null);

  const filtered = useMemo(() => {
    const sorted = [...entries].sort((a, b) => b.timestamp - a.timestamp);
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (e) => (e.body || '').toLowerCase().includes(q) || (e.date || '').toLowerCase().includes(q)
    );
  }, [entries, search]);

  function handleSave() {
    const trimmed = body.trim();
    if (!trimmed) {
      alert('Write something before saving.');
      return;
    }
    const entry: MiracleEntry = { id: uid(), date: fmtDateTime(new Date()), timestamp: Date.now(), body: trimmed };
    const arr = [...getLS<MiracleEntry[]>('miracleEntries', []), entry];
    setLS('miracleEntries', arr);
    setEntries(arr);
    cloudSaveMiracle(entry);
    setBody('');
    setSearch('');
  }

  function handleDelete(entry: MiracleEntry) {
    if (!confirm('Delete this miracle permanently?')) return;
    cloudDeleteRow('miracle_entries', entry);
    const arr = getLS<MiracleEntry[]>('miracleEntries', []).filter((x) => x.id !== entry.id);
    setLS('miracleEntries', arr);
    setEntries(arr);
    setReading(null);
  }

  return (
    <div>
      <h2 className="tabtitle mb-4 text-[22px] font-bold" style={{ color: 'var(--navy)' }}>
        ✨ Capture a Miracle
      </h2>
      <div className="card mb-4" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, boxShadow: 'var(--shadow-sm)' }}>
        <div className="mb-2 text-[15px] font-bold" style={{ color: 'var(--gold-dark)' }}>
          {fmtDateTime(new Date())}
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What happened? Write it while it's fresh."
          className="min-h-[120px] w-full rounded-xl border p-3 text-base leading-[1.55]"
          style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
        />
        <button
          type="button"
          onClick={handleSave}
          className="mt-3 w-full rounded-xl py-3 text-[17px] font-bold text-white"
          style={{ background: 'var(--primary)', boxShadow: '0 2px 0 var(--gold-dark)' }}
        >
          Save Miracle
        </button>
      </div>
      <p className="mb-4 -mt-1 text-sm" style={{ color: 'var(--muted-foreground)' }}>
        Miracles are backed up together with your Journal. Export from the Journal tab.
      </p>

      <h2 className="tabtitle mb-3 text-[22px] font-bold" style={{ color: 'var(--navy)' }}>
        Past Miracles
      </h2>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search miracles…"
        className="mb-3 h-12 w-full rounded-xl border px-3.5 text-base"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      />

      {filtered.length === 0 ? (
        <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {search ? 'No miracles match your search.' : 'No miracles captured yet.'}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((e) => {
            const preview = (e.body || '').slice(0, 120) + ((e.body || '').length > 120 ? '…' : '');
            return (
              <div
                key={e.id}
                className="rounded-[14px] border p-3.5"
                style={{ background: 'var(--card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}
              >
                <div className="mb-1 text-sm font-bold" style={{ color: 'var(--navy)' }}>{e.date}</div>
                <div className="mb-2.5 text-[15px]" style={{ color: 'var(--foreground)' }}>{preview}</div>
                <button
                  type="button"
                  onClick={() => setReading(e)}
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

      {reading && (
        <ReadModal
          date={reading.date}
          body={reading.body}
          onClose={() => setReading(null)}
          onDelete={() => handleDelete(reading)}
        />
      )}
    </div>
  );
}
