import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Server-side proxy for USDA FoodData Central search — the real key lives
// only here (USDA_API_KEY, a Supabase Edge Function secret), never in any
// client bundle. verify_jwt is on (see deploy config), so only a signed-in
// Mission Companion account can call this at all. Returns the raw USDA
// response as-is; lib/health-data.ts's usdaSearch() keeps doing all the
// nutrient parsing client-side, unchanged.
//
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
    const { query } = (await req.json()) as { query: string };

    const apiKey = Deno.env.get('USDA_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url =
      'https://api.nal.usda.gov/fdc/v1/foods/search?api_key=' +
      encodeURIComponent(apiKey) +
      '&query=' +
      encodeURIComponent(query || '') +
      '&pageSize=20';

    const res = await fetch(url);
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
