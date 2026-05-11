// functions/api/test-sms.js
// TEMPORARY debug endpoint — remove after SMS is confirmed working.
// Hit: https://cometome.ai/api/test-sms in browser to test.

export async function onRequestGet(context) {
  const { env } = context;
  const results = {};

  // 1. Check env vars are present
  results.env = {
    TWILIO_ACCOUNT_SID:  env.TWILIO_ACCOUNT_SID ? env.TWILIO_ACCOUNT_SID.slice(0, 6) + '...' : 'MISSING',
    TWILIO_AUTH_TOKEN:   env.TWILIO_AUTH_TOKEN   ? 'SET'     : 'MISSING',
    TWILIO_PHONE_NUMBER: env.TWILIO_PHONE_NUMBER  || 'MISSING',
    SUPABASE_URL:        env.SUPABASE_URL          || 'MISSING',
    SUPABASE_SERVICE_KEY: env.SUPABASE_SERVICE_KEY ? 'SET'   : 'MISSING',
  };

  // 2. Query counselors
  try {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/counselors?is_available=eq.true&phone=not.is.null&select=id,name,phone`,
      {
        headers: {
          'apikey':        env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const text = await res.text();
    results.counselors = { status: res.status, body: text };
  } catch (err) {
    results.counselors = { error: err.message };
  }

  // 3. Send test SMS via Twilio
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: env.TWILIO_PHONE_NUMBER,
        To:   '+17314371173',
        Body: 'Come to Me test SMS — if you received this, it works!',
      }),
    });
    const data = await res.json();
    results.twilio = { status: res.status, sid: data.sid, error: data.message };
  } catch (err) {
    results.twilio = { error: err.message };
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}
