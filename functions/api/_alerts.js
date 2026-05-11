// functions/api/_alerts.js
// Simplified version — skips conversation INSERT, just sends SMS to available counselors.

// ── Fetch available counselors from Supabase ─────────────────────────────────
async function getAvailableCounselors(env) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/counselors?is_available=eq.true&phone=not.is.null&select=id,name,phone`,
    {
      headers: {
        'apikey':        env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  if (!res.ok) {
    console.error('getAvailableCounselors failed:', res.status, await res.text());
    return [];
  }
  return res.json();
}

// ── Send a single SMS via Twilio REST API ─────────────────────────────────────
async function sendSMS(env, to, body) {
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
      To:   to,
      Body: body,
    }),
  });
  const data = await res.json();
  console.log('Twilio response:', JSON.stringify(data));
  return data.sid ?? null;
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function alertCounselors(env, firstMessage) {
  try {
    console.log('alertCounselors called, message:', firstMessage?.slice(0, 50));

    const counselors = await getAvailableCounselors(env);
    console.log('Available counselors:', counselors.length);

    if (!counselors.length) {
      console.log('No available counselors found — no SMS sent.');
      return;
    }

    const snippet = typeof firstMessage === 'string'
      ? firstMessage.slice(0, 120)
      : JSON.stringify(firstMessage).slice(0, 120);

    const smsBody = `Come to Me: New conversation started.\n\n"${snippet}${firstMessage.length > 120 ? '...' : ''}"\n\nLog in to respond: https://counselors.cometome.ai`;

    await Promise.all(
      counselors.map(async (counselor) => {
        console.log('Sending SMS to', counselor.phone);
        const sid = await sendSMS(env, counselor.phone, smsBody);
        console.log('SMS sent, sid:', sid);
      })
    );

  } catch (err) {
    console.error('alertCounselors error:', err.message);
  }
}
