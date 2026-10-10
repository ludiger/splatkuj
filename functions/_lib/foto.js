// Spoločné pre fotky z Bazoša a ich trvalú zálohu v R2 (premenná FOTO).
export const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
export const fotoKey = (id, n, t) => `bazos/${id}/${n}${t ? 't' : ''}.jpg`;
export const bazosUrl = (id, n, t) => `https://www.bazos.sk/img/${n}${t ? 't' : ''}/${id.slice(-3)}/${id}.jpg`;

export async function fetchBazos(id, n, t) {
  let r;
  try { r = await fetch(bazosUrl(id, n, t), { headers: { 'user-agent': UA, referer: 'https://www.bazos.sk/' }, cf: { cacheTtl: 2592000, cacheEverything: true } }); } catch { return null; }
  if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image/')) return null;
  return r.arrayBuffer();
}

// Cena z HTML inzerátu na Bazoši („Cena:</td><td><b><span> 21 450 €</span>“) – číslo alebo null (dohodou, v texte…).
export function bazosPrice(h) {
  const m = h.match(/Cena:<\/td>\s*<td[^>]*>([\s\S]{0,200}?)<\/td>/i);
  if (!m) return null;
  const t = m[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
  const d = t.match(/(\d[\d\s.]{2,10})\s*€/);
  return d ? +d[1].replace(/\D/g, '') : null;
}

// Zistí čísla fotiek a popis z inzerátu na Bazoši.
export async function bazosInzerat(id, slug) {
  const r = await fetch(`https://auto.bazos.sk/inzerat/${id}/${slug}`, { headers: { 'user-agent': UA, 'accept-language': 'sk' }, cf: { cacheTtl: 21600, cacheEverything: true } });
  const h = await r.text();
  const m = h.match(/class=["']?popisdetail["']?[^>]*>([\s\S]*?)<\/div>/i);
  if (!m) return null;
  const nums = [...new Set([...h.matchAll(new RegExp(`/img/(\\d+)/\\d+/${id}\\.jpg`, 'g'))].map((x) => +x[1]))].sort((a, b) => a - b);
  return { html: h, popisHtml: m[1], nums };
}

// ── Autá z vlastných webov predajcov (nie z Bazoša) ──────────────────────────
// Dostanú 9-miestne číslo začínajúce deviatkou (rozsah, ktorý Bazoš ešte desaťročia nepoužije):
//   91xxxxxxx = cooldrive.sk (xxxxxxx = číslo stránky „/m50“ → 910000050)
// V dokumente inzerátu sú: url (stránka auta u predajcu), imgs (adresy fotiek v poradí), mark (VIN – podľa neho
// poznáme, že inzerát ešte existuje), popis (výbava a údaje z webu).
export const isExt = (id) => /^9\d{8}$/.test(String(id || ''));
const EXT_HOSTS = ['cooldrive.sk', 'www.cooldrive.sk'];
export const extHostOk = (u) => { try { const x = new URL(u); return x.protocol === 'https:' && EXT_HOSTS.includes(x.hostname); } catch { return false; } };

export async function fetchExt(url) {
  if (!extHostOk(url)) return null;
  let r;
  try { r = await fetch(url, { headers: { 'user-agent': UA, referer: new URL(url).origin + '/' }, cf: { cacheTtl: 2592000, cacheEverything: true } }); } catch { return null; }
  if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image/')) return null;
  return r.arrayBuffer();
}

// Cena zo stránky auta na vlastnom webe predajcu.
export function extPrice(h, url) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  if (host === 'cooldrive.sk') {
    // prvá cena za nadpisom: „14.940 EUR“ (cena s prihlásením – hlavná cena inzerátu)
    const i = h.search(/<h1[\s>]/i);
    const m = h.slice(i < 0 ? 0 : i).replace(/<[^>]+>/g, ' ').match(/(\d{1,3}(?:[.\s]\d{3})+|\d{3,6})\s*EUR/);
    return m ? +m[1].replace(/\D/g, '') : null;
  }
  return null;
}

// Čerstvý stav auta z webu predajcu: {exists, price}. exists=false, keď stránka zmizla alebo na nej už nie je VIN.
export async function extState(doc, fresh) {
  if (!doc || !extHostOk(doc.url)) return { exists: false, error: 'zlý odkaz' };
  let r;
  try {
    r = await fetch(doc.url, { headers: { 'user-agent': UA, 'accept-language': 'sk' }, cf: fresh ? { cacheTtl: 0 } : { cacheTtl: 21600, cacheEverything: true } });
  } catch { return { exists: null, error: 'chyba' }; }
  if (r.status === 404 || r.status === 410) return { exists: false };
  if (!r.ok) return { exists: null, error: 'HTTP ' + r.status };
  const h = await r.text();
  if (doc.mark && !h.includes(doc.mark)) return { exists: false };
  return { exists: true, price: extPrice(h, doc.url) };
}

export async function getDoc(env, id) {
  if (!env.DB) return null;
  const row = await env.DB.prepare('SELECT data FROM docs WHERE coll = ? AND id = ?').bind('inzeraty', String(id)).first();
  return row ? JSON.parse(row.data) : null;
}
