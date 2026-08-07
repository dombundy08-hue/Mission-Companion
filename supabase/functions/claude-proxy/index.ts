import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Server-side proxy for Anthropic's Messages API — the real key lives only
// here (ANTHROPIC_API_KEY, a Supabase Edge Function secret), never in any
// client bundle. verify_jwt is on (see deploy config), so only a signed-in
// Mission Companion account can call this at all. Mirrors the request/
// response shape lib/claude-api.ts used to send directly to Anthropic, so
// the client-side change is a one-line swap.
interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

// The browser sends a CORS preflight (OPTIONS) before the real POST because
// sb.functions.invoke() attaches an Authorization header — without an
// explicit OPTIONS response the preflight 405s and the browser never sends
// the actual request at all.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }
  try {
    const { system, messages, maxTokens } = (await req.json()) as {
      system: string;
      messages: ClaudeMessage[];
      maxTokens?: number;
    };

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens || 1000,
        system,
        messages,
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
