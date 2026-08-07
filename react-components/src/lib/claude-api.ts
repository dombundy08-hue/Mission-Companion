import { isDemoMode, DEMO_AI_MESSAGE } from './demo';
import { sb } from './supabase-sync';

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

// Routed through the claude-proxy Edge Function — the real Anthropic key
// lives only as a server-side secret there, never in this client bundle.
// sb.functions.invoke() automatically attaches the signed-in user's auth
// token, which the function requires (verify_jwt) — Demo Mode never
// reaches this call at all (thrown above first).
export async function callClaude(system: string, messages: ClaudeMessage[], maxTokens?: number): Promise<string> {
  if (isDemoMode()) throw new Error(DEMO_AI_MESSAGE);
  const { data, error } = await sb.functions.invoke('claude-proxy', {
    body: { system, messages, maxTokens },
  });
  if (error) throw new Error('API error: ' + error.message);
  return data.content.map((b: { text?: string }) => b.text || '').join('').trim();
}
