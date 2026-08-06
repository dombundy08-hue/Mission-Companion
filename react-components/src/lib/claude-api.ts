import { isDemoMode, DEMO_AI_MESSAGE } from './demo';

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const AI_ERROR = 'The AI subscription is having difficulty. Contact 720-745-0911 or 720-745-3166.';

// Callers show AI_ERROR verbatim on catch — this lets a demo-mode failure
// surface a truthful message instead of implying a real outage.
export function aiErrorMessage(): string {
  return isDemoMode() ? DEMO_AI_MESSAGE : AI_ERROR;
}

export async function callClaude(system: string, messages: ClaudeMessage[], maxTokens?: number): Promise<string> {
  if (isDemoMode()) throw new Error(DEMO_AI_MESSAGE);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_ANTHROPIC_KEY || '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens || 1000,
      system,
      messages,
    }),
  });
  if (!res.ok) throw new Error('API status ' + res.status);
  const data = await res.json();
  return data.content.map((b: { text?: string }) => b.text || '').join('').trim();
}
