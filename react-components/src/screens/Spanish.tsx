import { useEffect, useRef, useState } from 'react';
import { callClaude, AI_ERROR, type ClaudeMessage } from '@/lib/claude-api';
import { SPANISH_MODES, spanishSystem } from '@/lib/spanish-modes';

export function Spanish() {
  const [mode, setMode] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<ClaudeMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [input, setInput] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatRef.current) window.scrollTo(0, document.body.scrollHeight);
  }, [msgs, summary]);

  async function startMode(modeKey: string) {
    if (busy) return;
    setMode(modeKey);
    setMsgs([]);
    setSummary(null);
    setError(false);
    setBusy(true);
    try {
      const reply = await callClaude(
        spanishSystem(modeKey),
        [{ role: 'user', content: '(El misionero se acerca. Empieza la conversación con una línea natural y apropiada para esta situación.)' }],
        400
      );
      setMsgs([{ role: 'assistant', content: reply }]);
    } catch {
      setError(true);
    }
    setBusy(false);
  }

  async function send() {
    const txt = input.trim();
    if (!txt || busy || !mode) return;
    const next: ClaudeMessage[] = [...msgs, { role: 'user', content: txt }];
    setMsgs(next);
    setInput('');
    setError(false);
    setBusy(true);
    try {
      const reply = await callClaude(spanishSystem(mode), next, 500);
      setMsgs((m) => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setError(true);
    }
    setBusy(false);
  }

  async function done() {
    if (!mode) return;
    if (msgs.length === 0) {
      setMode(null);
      return;
    }
    setBusy(true);
    try {
      const withAsk: ClaudeMessage[] = [
        ...msgs,
        {
          role: 'user',
          content:
            'In one sentence only, in English, tell me one specific thing I should practice or study based on this conversation. Be specific and encouraging. Do not list multiple things. One sentence.',
        },
      ];
      const reply = await callClaude(spanishSystem(mode), withAsk, 200);
      setSummary(reply);
    } catch {
      setError(true);
    }
    setBusy(false);
  }

  return (
    <div>
      <h2 className="mb-3 text-[22px] font-bold" style={{ color: 'var(--navy)' }}>🗣️ Spanish Practice</h2>
      {error && (
        <div className="mb-3 rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--destructive)', color: 'var(--destructive)' }}>
          {AI_ERROR}
        </div>
      )}
      <div className="mb-4 flex gap-2">
        {Object.entries(SPANISH_MODES).map(([key, m]) => (
          <button
            key={key}
            type="button"
            disabled={busy}
            onClick={() => startMode(key)}
            className="flex-1 rounded-xl border py-3 text-sm font-medium"
            style={{
              borderColor: 'var(--border)',
              background: mode === key ? 'var(--primary)' : 'var(--card)',
              color: mode === key ? 'white' : 'var(--foreground)',
            }}
          >
            <span className="mr-1">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      {!mode ? (
        <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Choose a mode above to begin a conversation.</div>
      ) : (
        <div>
          <div ref={chatRef} className="mb-3 space-y-2">
            {msgs.map((msg, i) => (
              <div
                key={i}
                className="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px]"
                style={
                  msg.role === 'assistant'
                    ? { background: 'var(--secondary)', color: 'var(--secondary-foreground)' }
                    : { background: 'var(--primary)', color: 'white', marginLeft: 'auto' }
                }
              >
                {msg.content}
              </div>
            ))}
            {busy && <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>…</div>}
          </div>

          {summary ? (
            <div>
              <div className="mb-3 rounded-xl border p-3.5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                <div className="mb-1 text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--gold-dark)' }}>Practice This</div>
                <div className="text-[15px]" style={{ color: 'var(--foreground)' }}>{summary}</div>
              </div>
              <button type="button" onClick={() => startMode(mode)} className="w-full rounded-xl py-3 text-[17px] font-bold text-white" style={{ background: 'var(--navy)' }}>
                Start New Conversation
              </button>
            </div>
          ) : (
            <div>
              <div className="mb-3 flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Escribe en español…"
                  rows={1}
                  className="flex-1 rounded-xl border p-3 text-base"
                  style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
                />
                <button type="button" onClick={send} className="rounded-xl px-4 text-lg font-bold text-white" style={{ background: 'var(--primary)' }}>➤</button>
              </div>
              <button type="button" onClick={done} className="w-full rounded-xl py-2.5 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
                I'm Done Talking
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
