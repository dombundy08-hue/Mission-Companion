import { useEffect, useState } from 'react';
import { callClaude, aiErrorMessage, type ClaudeMessage } from '@/lib/claude-api';
import { OBJECTIONS, OBJECTION_SYSTEM, type Objection } from '@/lib/objections-data';
import { demoLimitReached, incrementDemoUsage, DEMO_LIMIT_MESSAGE } from '@/lib/demo';

export function Objections() {
  const [started, setStarted] = useState(false);
  const [question, setQuestion] = useState<Objection | null>(null);
  const [msgs, setMsgs] = useState<ClaudeMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [limited, setLimited] = useState(false);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (started) window.scrollTo(0, 0);
  }, [started]);

  function begin() {
    const pick = OBJECTIONS[Math.floor(Math.random() * OBJECTIONS.length)];
    setStarted(true);
    setSummary(null);
    setError(false);
    setLimited(false);
    setBusy(false);
    setQuestion(pick);
    setMsgs([]);
  }

  async function send() {
    const txt = input.trim();
    if (!txt || busy || !question) return;
    if (demoLimitReached('objections')) {
      setLimited(true);
      return;
    }
    const next: ClaudeMessage[] = [...msgs, { role: 'user', content: txt }];
    setMsgs(next);
    setInput('');
    setError(false);
    setBusy(true);
    try {
      const history: ClaudeMessage[] = [{ role: 'assistant', content: question.text }, ...next];
      const reply = await callClaude(OBJECTION_SYSTEM, history, 400);
      incrementDemoUsage('objections');
      setMsgs((m) => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setError(true);
    }
    setBusy(false);
  }

  async function end() {
    if (!question) return;
    if (demoLimitReached('objections')) {
      setLimited(true);
      return;
    }
    setBusy(true);
    try {
      const history: ClaudeMessage[] = [
        { role: 'assistant', content: question.text },
        ...msgs,
        {
          role: 'user',
          content:
            'End of practice. In one sentence only, give one brief, non-grading observation the missionary could reflect on from this conversation. Do not tell them what the right answer was. Just one gentle, thoughtful sentence.',
        },
      ];
      const reply = await callClaude(OBJECTION_SYSTEM, history, 150);
      incrementDemoUsage('objections');
      setSummary(reply);
    } catch {
      setError(true);
    }
    setBusy(false);
  }

  return (
    <div>
      <h2 className="mb-3 text-[22px] font-bold" style={{ color: 'var(--foreground)' }}>🙋 Objection Practice</h2>
      {limited && (
        <div className="mb-3 rounded-xl border p-3 text-sm font-medium" style={{ borderColor: 'var(--destructive)', color: 'var(--destructive)' }}>
          {DEMO_LIMIT_MESSAGE}
        </div>
      )}
      {error && !limited && (
        <div className="mb-3 rounded-xl border p-3 text-sm" style={{ borderColor: 'var(--destructive)', color: 'var(--destructive)' }}>
          {aiErrorMessage()}
        </div>
      )}

      {!started ? (
        <div className="rounded-[14px] border p-4 text-center" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <p className="mb-2 text-[15px]" style={{ color: 'var(--foreground)' }}>
            A question or concern will appear below.<br />Respond as you would on your mission.<br />The investigator will respond like a real person.
          </p>
          <p className="mb-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>There are no right answers here — just practice.</p>
          <button type="button" onClick={begin} className="rounded-xl px-6 py-2.5 text-sm font-bold text-white" style={{ background: 'var(--primary)' }}>
            Begin Practice
          </button>
        </div>
      ) : (
        question && (
          <div>
            <div className="mb-3 rounded-[14px] border p-4" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
              <div className="mb-1 text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--gold-dark)' }}>The investigator says</div>
              <div className="text-[15px]" style={{ color: 'var(--foreground)' }}>{question.text}</div>
            </div>

            <div className="mb-3 space-y-2">
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
                  <div className="mb-1 text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--gold-dark)' }}>One thing to reflect on from this conversation</div>
                  <div className="text-[15px]" style={{ color: 'var(--foreground)' }}>{summary}</div>
                </div>
                {question.fallacy && !/^none\b/i.test(question.fallacy) && (
                  <div className="mb-3 rounded-xl border p-3.5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                    <div className="mb-1 text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--gold-dark)' }}>🧠 A pattern worth recognizing (not for calling out — just for staying calm)</div>
                    <div className="text-[15px]" style={{ color: 'var(--foreground)' }}>{question.fallacy}</div>
                  </div>
                )}
                {question.comeback && (
                  <div className="mb-3 rounded-xl border p-3.5" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                    <div className="mb-1 text-xs font-bold tracking-wide uppercase" style={{ color: 'var(--gold-dark)' }}>🕊️ A grounded thought — not a debate to win</div>
                    <div className="text-[15px]" style={{ color: 'var(--foreground)' }}>{question.comeback}</div>
                  </div>
                )}
                <button type="button" onClick={begin} className="w-full rounded-xl py-3 text-[17px] font-bold text-white" style={{ background: 'var(--navy)' }}>
                  Try Another Question
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
                    placeholder="Respond as you would…"
                    rows={1}
                    className="flex-1 rounded-xl border p-3 text-base"
                    style={{ borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
                  />
                  <button type="button" onClick={send} className="rounded-xl px-4 text-lg font-bold text-white" style={{ background: 'var(--primary)' }}>➤</button>
                </div>
                <button type="button" onClick={end} className="w-full rounded-xl py-2.5 text-sm font-medium" style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)' }}>
                  End Practice
                </button>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
