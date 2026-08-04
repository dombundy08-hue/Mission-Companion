import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { submitContactLead } from '@/lib/supabase-sync';

const fieldClass = 'h-12 w-full rounded-xl border px-3 text-base';
const fieldStyle = { borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' };

// Public page reached by scanning a missionary's QR code — no app password
// needed, reached outside the AuthProvider/LockScreen gate entirely.
export function ContactShare() {
  const { code = '' } = useParams();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      alert('Please enter your name.');
      return;
    }
    setStatus('sending');
    const ok = await submitContactLead(code, trimmed, phone.trim(), address.trim(), note.trim());
    setStatus(ok ? 'sent' : 'error');
  }

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: 'var(--background)' }}>
      <div className="mx-auto max-w-[420px]">
        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">✝️</div>
          <h1 className="mb-1 font-heading text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Elder Bundy's Mission Companion</h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Reach out anytime: 720-745-0911 or 720-745-3166</p>
        </div>

        <div className="rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          {status === 'sent' ? (
            <div className="py-4 text-center text-sm" style={{ color: 'var(--foreground)' }}>
              Thanks — your info was sent. We'll be in touch!
            </div>
          ) : (
            <>
              <h2 className="mb-3 text-sm font-bold" style={{ color: 'var(--foreground)' }}>Leave your contact info</h2>
              <div className="space-y-3">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={fieldClass} style={fieldStyle} />
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number (optional)" className={fieldClass} style={fieldStyle} />
                <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address (optional)" className={fieldClass} style={fieldStyle} />
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything you'd like us to know (optional)" className="min-h-[70px] w-full rounded-xl border p-3 text-base" style={fieldStyle} />
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={status === 'sending'}
                  className="w-full rounded-xl py-3 text-[17px] font-bold text-white disabled:opacity-60"
                  style={{ background: 'var(--primary)', boxShadow: '0 2px 0 var(--gold-dark)' }}
                >
                  {status === 'sending' ? 'Sending…' : 'Send'}
                </button>
                {status === 'error' && (
                  <div className="text-sm" style={{ color: 'var(--destructive)' }}>Something went wrong — please try again.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
