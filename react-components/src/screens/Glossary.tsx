import { useMemo, useState } from 'react';
import { getLS, setLS } from '@/lib/storage';
import { cloudSaveGlossary, cloudDeleteRow, uid, type GlossaryTerm } from '@/lib/supabase-sync';

const fieldClass =
  'w-full rounded-xl border p-3 text-base';
const fieldStyle = { borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' };

// Faithful port of index.html's renderGlossary()/renderGlossaryEdit() —
// same localStorage key (glossaryTerms), same cloud sync calls.
export function Glossary() {
  const [terms, setTerms] = useState<GlossaryTerm[]>(() => getLS('glossaryTerms', []));
  const [search, setSearch] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [newTerm, setNewTerm] = useState('');
  const [newChild, setNewChild] = useState('');
  const [newSkeptic, setNewSkeptic] = useState('');
  const [newAdult, setNewAdult] = useState('');

  const filtered = useMemo(() => {
    const sorted = [...terms].sort((a, b) => (a.term || '').localeCompare(b.term || ''));
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((t) =>
      [t.term, t.child, t.skeptic, t.adult].some((f) => (f || '').toLowerCase().includes(q))
    );
  }, [terms, search]);

  function handleSave() {
    const term = newTerm.trim();
    if (!term) {
      alert('Please enter a term name.');
      return;
    }
    const termObj: GlossaryTerm = {
      id: uid(),
      term,
      child: newChild.trim(),
      skeptic: newSkeptic.trim(),
      adult: newAdult.trim(),
    };
    const arr = [...getLS<GlossaryTerm[]>('glossaryTerms', []), termObj];
    setLS('glossaryTerms', arr);
    setTerms(arr);
    cloudSaveGlossary(termObj);
    setSuccess(true);
    setSearch('');
    setNewTerm('');
    setNewChild('');
    setNewSkeptic('');
    setNewAdult('');
    setTimeout(() => setSuccess(false), 2200);
  }

  const editing = editId ? terms.find((t) => t.id === editId) : null;
  if (editing) {
    return (
      <GlossaryEdit
        term={editing}
        onBack={() => setEditId(null)}
        onSaved={(updated) => {
          const arr = terms.map((t) => (t.id === updated.id ? updated : t));
          setLS('glossaryTerms', arr);
          setTerms(arr);
          setEditId(null);
        }}
        onDeleted={() => {
          const arr = terms.filter((t) => t.id !== editing.id);
          setLS('glossaryTerms', arr);
          setTerms(arr);
          setEditId(null);
        }}
      />
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-[22px] font-bold" style={{ color: 'var(--navy)' }}>📖 Glossary</h2>
      {success && (
        <div className="mb-3 rounded-xl p-3 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
          Saved to your Glossary.
        </div>
      )}
      <div className="card mb-4 space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, boxShadow: 'var(--shadow-sm)' }}>
        <div>
          <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--navy)' }}>Gospel Term or Principle *</label>
          <input value={newTerm} onChange={(e) => setNewTerm(e.target.value)} placeholder="e.g. The Atonement" className={fieldClass} style={fieldStyle} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--navy)' }}>
            How would I explain this to a child? <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea value={newChild} onChange={(e) => setNewChild(e.target.value)} placeholder="In simple words…" className={fieldClass + ' min-h-[80px]'} style={fieldStyle} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--navy)' }}>
            How would I explain this to a skeptic? <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea value={newSkeptic} onChange={(e) => setNewSkeptic(e.target.value)} placeholder="To someone with doubts…" className={fieldClass + ' min-h-[80px]'} style={fieldStyle} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--navy)' }}>
            How would I explain this to an adult? <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea value={newAdult} onChange={(e) => setNewAdult(e.target.value)} placeholder="A fuller explanation…" className={fieldClass + ' min-h-[80px]'} style={fieldStyle} />
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="w-full rounded-xl py-3 text-[17px] font-bold text-white"
          style={{ background: 'var(--primary)', boxShadow: '0 2px 0 var(--gold-dark)' }}
        >
          Save Term
        </button>
      </div>

      <h2 className="mb-3 text-[22px] font-bold" style={{ color: 'var(--navy)' }}>Browse</h2>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search terms & definitions…"
        className="mb-3 h-12 w-full rounded-xl border px-3.5 text-base"
        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      />

      {filtered.length === 0 ? (
        <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          {search ? 'No terms match your search.' : 'No terms saved yet.'}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((t) => {
            const parts = [t.child && 'Child', t.skeptic && 'Skeptic', t.adult && 'Adult'].filter(Boolean);
            const preview = (t.child || t.skeptic || t.adult || '').slice(0, 90);
            return (
              <div key={t.id} className="rounded-[14px] border p-3.5" style={{ background: 'var(--card)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="mb-1 text-sm font-bold" style={{ color: 'var(--navy)' }}>{t.term}</div>
                <div className="mb-1 text-[15px]" style={{ color: preview ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
                  {preview ? preview + '…' : '(no definitions yet)'}
                </div>
                {parts.length > 0 && (
                  <div className="mb-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>{parts.join(' · ')}</div>
                )}
                <button
                  type="button"
                  onClick={() => setEditId(t.id)}
                  className="rounded-xl px-4 py-2 text-sm font-medium"
                  style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}
                >
                  Open / Edit
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GlossaryEdit({
  term,
  onBack,
  onSaved,
  onDeleted,
}: {
  term: GlossaryTerm;
  onBack: () => void;
  onSaved: (t: GlossaryTerm) => void;
  onDeleted: () => void;
}) {
  const [t, setT] = useState(term.term);
  const [child, setChild] = useState(term.child);
  const [skeptic, setSkeptic] = useState(term.skeptic);
  const [adult, setAdult] = useState(term.adult);

  function handleSave() {
    const trimmed = t.trim();
    if (!trimmed) {
      alert('Term name cannot be empty.');
      return;
    }
    const updated: GlossaryTerm = { ...term, term: trimmed, child: child.trim(), skeptic: skeptic.trim(), adult: adult.trim() };
    cloudSaveGlossary(updated);
    onSaved(updated);
  }

  function handleDelete() {
    if (!confirm('Delete this term permanently?')) return;
    cloudDeleteRow('glossary_terms', term);
    onDeleted();
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 text-sm font-medium" style={{ color: 'var(--primary)' }}>
        ← Back
      </button>
      <div className="card space-y-3" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, boxShadow: 'var(--shadow-sm)' }}>
        <div>
          <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--navy)' }}>Gospel Term or Principle *</label>
          <input value={t} onChange={(e) => setT(e.target.value)} className={fieldClass} style={fieldStyle} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--navy)' }}>Explain to a child</label>
          <textarea value={child} onChange={(e) => setChild(e.target.value)} className={fieldClass + ' min-h-[80px]'} style={fieldStyle} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--navy)' }}>Explain to a skeptic</label>
          <textarea value={skeptic} onChange={(e) => setSkeptic(e.target.value)} className={fieldClass + ' min-h-[80px]'} style={fieldStyle} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'var(--navy)' }}>Explain to an adult</label>
          <textarea value={adult} onChange={(e) => setAdult(e.target.value)} className={fieldClass + ' min-h-[80px]'} style={fieldStyle} />
        </div>
        <div className="flex gap-2.5">
          <button type="button" onClick={handleDelete} className="flex-1 rounded-xl py-3 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
            Delete
          </button>
          <button type="button" onClick={handleSave} className="flex-1 rounded-xl py-3 text-[17px] font-bold text-white" style={{ background: 'var(--primary)', boxShadow: '0 2px 0 var(--gold-dark)' }}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
