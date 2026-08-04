export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const AI_ERROR = 'The AI subscription is having difficulty. Contact 720-745-0911 or 720-745-3166.';

export async function callClaude(system: string, messages: ClaudeMessage[], maxTokens?: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': localStorage.getItem('apiKey') || '',
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
