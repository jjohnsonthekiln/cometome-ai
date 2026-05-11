// functions/api/_alerts.js
// Utility: send SMS alerts to available counselors via Twilio REST API.
// Called by chat.js when a new conversation starts.
// No SDK needed — uses native fetch available in Cloudflare Workers.

// ── Fetch available counselors from Supabase ─────────────────────────────────
async function getAvailableCounselors(env) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/counselors?is_available=eq.true&phone=not.is.null&select=id,name,phone`,
    {
      headers: {
        'apikey':         env.SUPABASE_SERVICE_KEY,
        'Authorization':  `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  if (!res.ok) return [];
  return res.json();
}

// ── Create a conversation record in Supabase ──────────────────────────────────
async function createConversation(env, firstMessage) {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/conversations`,
    {
      method: 'POST',
      headers: {
        'apikey':         env.SUPABASE_SERVICE_KEY,
        'Authorization':  `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type':   'application/json',
        'Prefer':         'return=representation',
      },
      body: JSON.stringify({
        mode:                   'ai',
        urgency:                'normal',
        sms_alert_sent:         false,
        last_user_message_at:   new Date().toISOString(),
        // Store first message snippet for counselor context in SMS
        first_message_snippet:  firstMessage.slice(0, 120),
      }),
    }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] ?? null;
}

// ── Send a single SMS via Twilio REST API ────────────────────────────────────
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
  return data.sid ?? null; // Twilio MessageSid
}

// ── Log alert in Supabase ─────────────────────────────────────────────────────
async function logAlert(env, conversationId, counselorId, phone, messageSid) {
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/sms_alert_log`,
    {
      method: 'POST',
      headers: {
        'apikey':         env.SUPABASE_SERVICE_KEY,
        'Authorization':  `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type':   'application/json',
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        counselor_id:    counselorId,
        phone,
        message_sid:     messageSid,
        status:          messageSid ? 'sent' : 'failed',
      }),
    }
  );
}

// ── Mark conversation alert as sent ──────────────────────────────────────────
async function markAlertSent(env, conversationId) {
  await fetch(
    `${env.SUPABASE_URL}/rest/v1/conversations?id=eq.${conversationId}`,
    {
      method: 'PATCH',
      headers: {
        'apikey':         env.SUPABASE_SERVICE_KEY,
        'Authorization':  `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type':   'application/json',
      },
      body: JSON.stringify({ sms_alert_sent: true }),
    }
  );
}

// ── Main export: call this when a new conversation starts ─────────────────────
export async function alertCounselors(env, firstMessage) {
  try {
    // 1. Create conversation record
    const conversation = await createConversation(env, firstMessage);
    if (!conversation) return;

    // 2. Get available counselors
    const counselors = await getAvailableCounselors(env);
    if (!counselors.length) return;

    // 3. Build SMS message (first 120 chars of user's opening message)
    const snippet  = firstMessage.slice(0, 120);
    const smsBody  = `Come to Me: New conversation started.\n\n"${snippet}${firstMessage.length > 120 ? '...' : ''}"\n\nLog in to respond: https://counselors.cometome.ai`;

    // 4. Send SMS + log each alert (run in parallel)
    await Promise.all(
      counselors.map(async (counselor) => {
        const sid = await sendSMS(env, counselor.phone, smsBody);
        await logAlert(env, conversation.id, counselor.id, counselor.phone, sid);
      })
    );

    // 5. Mark conversation alert sent
    await markAlertSent(env, conversation.id);

  } catch (err) {
    // Fail silently — never let alert errors break the chat response
    console.error('alertCounselors error:', err.message);
  }
}
