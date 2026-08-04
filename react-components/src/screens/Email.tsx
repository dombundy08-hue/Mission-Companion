import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLS, setLS } from '@/lib/storage';
import { callClaude, aiErrorMessage } from '@/lib/claude-api';
import { cloudSaveSetting } from '@/lib/supabase-sync';
import { thisWeeksHabitTip } from '@/lib/seven-habits';

const EMAIL_SYSTEM = `You are helping a missionary write his weekly family email. Below are examples of his previous emails that show his voice, tone, and style. Study them carefully. Then, using the bullet points he has provided about this week, write a warm, personal, faith-centered weekly missionary email in his exact voice. Do not add events or details he did not mention. Do not make the email longer than 400 words. Do not use bullet points in the output — write it as flowing paragraphs. Sign off naturally in his voice.`;

type View = 'voice' | null;

export function Email() {
  const navigate = useNavigate();
  const [examples, setExamples] = useState<string[]>(() => getLS('emailVoiceExamples', []));
  const [view, setView] = useState<View>(null);
  const [ev1, setEv1] = useState(examples[0] || '');
  const [ev2, setEv2] = useState(examples[1] || '');
  const [ev3, setEv3] = useState(examples[2] || '');
  const [highlights, setHighlights] = useState('');
  const [generated, setGenerated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  function saveVoice() {
    const arr = [ev1.trim(), ev2.trim(), ev3.trim()].filter(Boolean);
    if (!arr.length) {
      alert('Please paste at least one example email.');
      return;
    }
    setLS('emailVoiceExamples', arr);
    cloudSaveSetting('emailVoiceExamples', arr);
    setExamples(arr);
    setView(null);
  }

  async function write() {
    const trimmed = highlights.trim();
    if (!trimmed) {
      alert("Enter at least one highlight for this week.");
      return;
    }
    setError(false);
    setBusy(true);
    setGenerated(null);
    try {
      let userMsg = 'Here are examples of my previous emails that show my voice:\n\n';
      examples.forEach((ex, i) => {
        userMsg += `--- EXAMPLE ${i + 1} ---\n${ex}\n\n`;
      });
      userMsg += `Here are this week's highlights (bullet points):\n${trimmed}\n\nPlease write my weekly family email in my voice.`;
      const reply = await callClaude(EMAIL_SYSTEM, [{ role: 'user', content: userMsg }], 1200);
      setGenerated(reply);
    } catch {
      setError(true);
    }
    setBusy(false);
  }

  function copy() {
    if (!generated) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(generated)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => fallbackCopy(generated));
    } else {
      fallbackCopy(generated);
    }
  }

  function fallbackCopy(txt: string) {
    const ta = document.createElement('textarea');
    ta.value = txt;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('Copy failed — select the text manually.');
    }
    document.body.removeChild(ta);
  }

  if (!examples.length || view === 'voice') {
    return (
      <div>
        <h2 className="mb-3 text-[22px] font-bold" style={{ color: 'var(--navy)' }}>✉️ Weekly Email</h2>
        {error && (
          <div className="mb-3 rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--destructive)', color: 'var(--destructive)' }}>
            {aiErrorMessage()}
          </div>
        )}
        <div className="rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <p className="mb-3 text-[15px]" style={{ color: 'var(--foreground)' }}>
            Before I can write in your voice, paste in 1–3 example emails you've sent to family. The more examples you give, the better I can match your style.
          </p>
          <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Example 1</label>
          <textarea
            value={ev1}
            onChange={(e) => setEv1(e.target.value)}
            className="mb-3 min-h-[160px] w-full rounded-xl border p-3 text-base"
            style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
          />
          <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Example 2 <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>(optional)</span>
          </label>
          <textarea
            value={ev2}
            onChange={(e) => setEv2(e.target.value)}
            className="mb-3 min-h-[100px] w-full rounded-xl border p-3 text-base"
            style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
          />
          <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Example 3 <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>(optional)</span>
          </label>
          <textarea
            value={ev3}
            onChange={(e) => setEv3(e.target.value)}
            className="mb-3 min-h-[100px] w-full rounded-xl border p-3 text-base"
            style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
          />
          <button type="button" onClick={saveVoice} className="w-full rounded-xl py-3 text-[17px] font-bold text-white" style={{ background: 'var(--primary)' }}>
            Save My Voice Examples
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-3 text-[22px] font-bold" style={{ color: 'var(--navy)' }}>✉️ Weekly Email</h2>
      {error && (
        <div className="mb-3 rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--destructive)', color: 'var(--destructive)' }}>
          {aiErrorMessage()}
        </div>
      )}

      <div className="mb-4 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>This Week's Highlights</label>
        <div className="mb-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>Enter bullet points — one per line.</div>
        <div className="mb-3 rounded-lg p-2.5 text-xs italic" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
          💭 {thisWeeksHabitTip().prompt}
        </div>
        <textarea
          value={highlights}
          onChange={(e) => setHighlights(e.target.value)}
          placeholder={'- Met a family near the chapel…\n- Spanish lesson went better than expected…\n- Felt the Spirit during district meeting…'}
          className="mb-3.5 min-h-[160px] w-full rounded-xl border p-3 text-base"
          style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
        />
        <button type="button" onClick={write} disabled={busy} className="w-full rounded-xl py-3 text-[17px] font-bold text-white disabled:opacity-60" style={{ background: 'var(--primary)' }}>
          ✍️ Write My Email
        </button>
      </div>

      {busy && <div className="mb-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>Writing your email…</div>}

      {generated && (
        <div className="mb-4 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Your Email</label>
          <textarea
            readOnly
            value={generated}
            className="mb-3 min-h-[260px] w-full rounded-xl border p-3 text-base leading-[1.55]"
            style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
          />
          <button type="button" onClick={copy} className="w-full rounded-xl py-2.5 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
            {copied ? 'Copied!' : '📋 Copy Email'}
          </button>
        </div>
      )}

      {generated && (
        <div className="mb-4 rounded-[14px] p-4 text-white" style={{ background: 'linear-gradient(150deg,#163C64,#1F5389)' }}>
          <div className="mb-3 text-sm">📓 Reminder: Don't forget to back up your Journal &amp; Miracles before P-day ends!</div>
          <button type="button" onClick={() => navigate('/spiritual/journal')} className="w-full rounded-xl py-2.5 text-sm font-bold text-white" style={{ background: 'var(--primary)' }}>
            Go to Backup →
          </button>
        </div>
      )}

      <button type="button" onClick={() => setView('voice')} className="text-sm font-medium" style={{ color: 'var(--primary)' }}>
        Update My Voice
      </button>
    </div>
  );
}
