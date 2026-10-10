// Upozornenia majiteľovi (push na telefón cez ntfy – https://ntfy.sh, bez účtu).
// Nastavenie: v Cloudflare (Pages → splatkuj → Settings → Variables and Secrets) pridať secret NTFY_TOPIC
// = dlhý náhodný názov témy (funguje ako heslo). V telefóne v aplikácii ntfy odoberať tú istú tému.
// Voliteľne NTFY_SERVER (predvolene https://ntfy.sh).
// NTFY_TOKEN (secret, „tk_…“ z účtu na ntfy.sh → Account → Access tokens): bez neho ntfy.sh správy z Cloudflare
// často odmietne (429 – zdieľané adresy Cloudflare), s ním sa limit počíta pre náš účet.
// Do upozornenia nikdy nedávame osobné údaje zákazníka (meno, telefón, e-mail) – tie sú len v admine.

export function notifyEnabled(env) {
  return !!(env && env.NTFY_TOPIC);
}

export async function notify(env, { title, message, click, tags = [], priority = 4 }) {
  if (!notifyEnabled(env)) return { sent: false };
  const server = (env.NTFY_SERVER || 'https://ntfy.sh').replace(/\/+$/, '');
  try {
    const r = await fetch(server + '/', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(env.NTFY_TOKEN ? { authorization: 'Bearer ' + env.NTFY_TOKEN } : {}) },
      body: JSON.stringify({ topic: env.NTFY_TOPIC, title, message, click, tags, priority }),
    });
    return { sent: r.ok, status: r.status };
  } catch (e) {
    return { sent: false, error: String(e).slice(0, 100) };
  }
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
