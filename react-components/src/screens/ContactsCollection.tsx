import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchContactLeads, deleteContactLead, type ContactLead } from '@/lib/supabase-sync';

// Full page (not a Settings sub-page) reached via "View Collection" in
// Settings → My QR Code — deleting a lead here deletes it from Supabase
// outright (contact_leads has no local mirror, so there's nothing else to
// clean up) rather than just hiding it locally.
export function ContactsCollection() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<ContactLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchContactLeads().then((rows) => {
      setLeads(rows);
      setLoading(false);
    });
  }, []);

  async function handleDelete(lead: ContactLead) {
    if (!confirm(`Delete ${lead.name}'s info? This can't be undone.`)) return;
    setDeletingId(lead.id);
    const ok = await deleteContactLead(lead.id);
    if (ok) setLeads((prev) => prev.filter((l) => l.id !== lead.id));
    else alert("Couldn't delete — check your connection and try again.");
    setDeletingId(null);
  }

  return (
    <div className="min-h-screen px-4 py-6" style={{ background: 'var(--background)' }}>
      <div className="mx-auto max-w-[720px]">
        <button
          type="button"
          onClick={() => navigate('/spiritual/journal')}
          className="mb-4 text-sm font-medium"
          style={{ color: 'var(--primary)' }}
        >
          ← Back
        </button>
        <h1 className="mb-1 font-heading text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Collected Contacts</h1>
        <p className="mb-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Everyone who has left their info through your QR code.
        </p>

        {loading ? (
          <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading…</div>
        ) : !leads.length ? (
          <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>No one has sent their info yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr style={{ background: 'var(--secondary)' }}>
                  <th className="px-3 py-2 text-left font-bold" style={{ color: 'var(--secondary-foreground)' }}>Name</th>
                  <th className="px-3 py-2 text-left font-bold" style={{ color: 'var(--secondary-foreground)' }}>Phone</th>
                  <th className="px-3 py-2 text-left font-bold" style={{ color: 'var(--secondary-foreground)' }}>Address</th>
                  <th className="px-3 py-2 text-left font-bold" style={{ color: 'var(--secondary-foreground)' }}>Note</th>
                  <th className="px-3 py-2 text-left font-bold" style={{ color: 'var(--secondary-foreground)' }}>Date</th>
                  <th className="px-3 py-2 text-left font-bold" style={{ color: 'var(--secondary-foreground)' }} />
                </tr>
              </thead>
              <tbody>
                {leads.map((l, i) => (
                  <tr key={l.id} style={{ background: i % 2 ? 'var(--card)' : 'var(--background)', borderTop: '1px solid var(--border)' }}>
                    <td className="px-3 py-2 font-medium" style={{ color: 'var(--foreground)' }}>{l.name}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{l.phone || '—'}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--foreground)' }}>{l.address || '—'}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--muted-foreground)' }}>{l.note || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>{new Date(l.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(l)}
                        disabled={deletingId === l.id}
                        className="text-xs font-bold disabled:opacity-50"
                        style={{ color: 'var(--destructive)' }}
                      >
                        {deletingId === l.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
