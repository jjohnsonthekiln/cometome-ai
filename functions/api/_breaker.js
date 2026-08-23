// Daily circuit breaker for /api/chat, backed by Workers KV (binding: BREAKER).
//
// Mirrors Great Physician's GLOBAL_DAILY_CAP: once the day's message count
// reaches DAILY_CAP (env, default 2000; 0 disables), non-crisis messages get a
// calm "high demand" reply instead of a model call. Crisis messages are counted
// but never blocked. The counter is sharded across several keys because KV
// allows roughly one write per second per key, and KV is eventually consistent,
// so the cap is soft by design (it can overshoot by a handful of requests).
// Fails open: if the binding is missing, the breaker is simply inactive.

const SHARDS = 8;
const TTL_SECONDS = 3 * 24 * 60 * 60;

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // UTC day, like GP's breaker
}

export function dailyCap(env) {
  const n = Number(env.DAILY_CAP);
  return Number.isFinite(n) && n >= 0 ? n : 2000;
}

export async function breakerCount(env) {
  if (!env.BREAKER) return 0;
  const day = dayKey();
  const vals = await Promise.all(
    Array.from({ length: SHARDS }, (_, i) => env.BREAKER.get(`day:${day}:${i}`))
  );
  return vals.reduce((n, v) => n + (Number(v) || 0), 0);
}

export async function breakerIncrement(env) {
  if (!env.BREAKER) return;
  try {
    const key = `day:${dayKey()}:${Math.floor(Math.random() * SHARDS)}`;
    const cur = Number(await env.BREAKER.get(key)) || 0;
    await env.BREAKER.put(key, String(cur + 1), { expirationTtl: TTL_SECONDS });
  } catch {
    // never let accounting break the chat
  }
}

// One SMS per day when the breaker trips, to ALERT_PHONE (E.164), via the same
// Twilio credentials _alerts.js uses. Silent no-op if anything is unset.
export async function breakerAlertOnce(env, count, cap) {
  if (!env.BREAKER || !env.ALERT_PHONE || !env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_PHONE_NUMBER) return;
  try {
    const key = `alert:${dayKey()}`;
    if (await env.BREAKER.get(key)) return;
    await env.BREAKER.put(key, "1", { expirationTtl: TTL_SECONDS });
    const body = new URLSearchParams({
      From: env.TWILIO_PHONE_NUMBER,
      To: env.ALERT_PHONE,
      Body: `cometome.ai: daily chat cap reached (${count}/${cap}). Non-crisis chats get a "high demand" reply until the next UTC day. Raise DAILY_CAP in the Pages project settings if this is legitimate traffic.`,
    });
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
  } catch {
    // alerting is best-effort
  }
}

export const BREAKER_MESSAGE =
  "We're experiencing unusually high demand right now, and I want to be able to give you my full attention. Please try again in a little while. In the meantime, rest in what God's Word has already shown you, and reach out to a pastor or a trusted believer if you need someone now.";
