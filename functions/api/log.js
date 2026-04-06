// functions/api/log.js
// Cloudflare Pages Function — silently logs conversations to Supabase
// No IP, no name — anonymous session logging only

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { session_id, lang, turn, user_message, ai_response } = await request.json();

    // Fire-and-forget — don't let logging failures affect the user
    if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
      context.waitUntil(
        fetch(`${env.SUPABASE_URL}/rest/v1/conversations`, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'apikey':        env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
            'Prefer':        'return=minimal',
          },
          body: JSON.stringify({
            session_id,
            lang,
            turn,
            user_message,
            ai_response,
          }),
        }).catch(() => {}) // silently swallow any errors
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });

  } catch (err) {
    // Never expose errors to client
    return new Response(JSON.stringify({ ok: false }), {
      headers: { 'Content-Type': 'application/json', ...CORS },
    });
  }
}
