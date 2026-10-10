// Upozornenia majiteľovi na telefón.
// Hlavný kanál: TELEGRAM (zadarmo, funguje spoľahlivo aj z Cloudflare).
//   V Cloudflare (Pages → splatkuj → Settings → Variables and Secrets):
//   - TELEGRAM_BOT_TOKEN (Secret) – token bota od @BotFather („123456:ABC…“)
//   - TELEGRAM_CHAT_ID (Text) – číslo chatu, kam sa posiela (zistí sa cez POST /api/admin/telegram-setup)
// Záložný kanál: ntfy (NTFY_TOPIC, voliteľne NTFY_TOKEN, NTFY_SERVER) – bezplatné ntfy.sh správy z Cloudflare
//   odmieta (denný limit podľa zdieľanej IP adresy), funguje len s plateným účtom alebo vlastným serverom.
// Do upozornenia nikdy nedávame osobné údaje zákazníka (meno, telefón, e-mail) – tie sú len v admine.

const tgOn = (env) => !!(env && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
const ntfyOn = (env) => !!(env && env.NTFY_TOPIC);

export function notifyEnabled(env) {
  return tgOn(env) || ntfyOn(env);
}

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function sendTelegram(env, { title, message, click }) {
  const text = `<b>${esc(title)}</b>\n${esc(message)}` + (click ? `\n\n<a href="${esc(click)}">Otvoriť v admine</a>` : '');
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  const d = await r.json().catch(() => ({}));
  // description od Telegramu neobsahuje token
  return { sent: r.ok && d.ok === true, status: r.status, detail: r.ok ? undefined : String(d.description || '').slice(0, 200) };
}

async function sendNtfy(env, { title, message, click, tags, priority }) {
  const server = (env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/+$/, '');
  const r = await fetch(server + '/', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(env.NTFY_TOKEN ? { authorization: 'Bearer ' + env.NTFY_TOKEN } : {}) },
    body: JSON.stringify({ topic: env.NTFY_TOPIC, title, message, click, tags, priority }),
  });
  return { sent: r.ok, status: r.status, detail: r.ok ? undefined : (await r.text().catch(() => '')).slice(0, 200) };
}

// Pošle upozornenie všetkými nastavenými kanálmi. Vracia {sent (aspoň jeden kanál), telegram?, ntfy?}.
export async function notify(env, { title, message, click, tags = [], priority = 4 }) {
  if (!notifyEnabled(env)) return { sent: false };
  const out = {};
  const safe = async (k, f) => { try { out[k] = await f(); } catch (e) { out[k] = { sent: false, error: String(e && e.message || e).slice(0, 100) }; } };
  if (tgOn(env)) await safe('telegram', () => sendTelegram(env, { title, message, click }));
  if (ntfyOn(env)) await safe('ntfy', () => sendNtfy(env, { title, message, click, tags, priority }));
  out.sent = Object.values(out).some((x) => x && x.sent);
  return out;
}

// Zistí chaty, ktoré nedávno písali botovi (na nastavenie TELEGRAM_CHAT_ID). Vracia len čísla a mená chatov.
export async function telegramChats(env) {
  if (!env.TELEGRAM_BOT_TOKEN) return { ok: false, error: 'Chýba TELEGRAM_BOT_TOKEN.' };
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates`);
  const d = await r.json().catch(() => ({}));
  if (!d.ok) return { ok: false, error: String(d.description || 'HTTP ' + r.status).slice(0, 200) };
  const chats = new Map();
  for (const u of d.result || []) {
    const c = (u.message || u.channel_post || u.my_chat_member || {}).chat;
    if (c) chats.set(String(c.id), { id: String(c.id), type: c.type, name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.title || c.username || '' });
  }
  return { ok: true, chats: [...chats.values()] };
}

const ZAUJEM = { financovanie: 'Financovanie', poistenie: 'Poistenie', predaj: 'Predaj auta' };

export function leadMessage(doc) {
  const parts = [];
  parts.push('Záujem: ' + (ZAUJEM[doc.zaujem] || doc.zaujem || 'financovanie'));
  if (doc.auto) parts.push('Auto: ' + String(doc.auto).slice(0, 80));
  if (doc.zdroj) parts.push('Zdroj: ' + String(doc.zdroj).slice(0, 30));
  parts.push('Kontakt nájdete v admine → Dopyty.');
  return parts.join('\n');
}
