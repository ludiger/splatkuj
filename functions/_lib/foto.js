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


// Zistí čísla fotiek a popis z inzerátu na Bazoši.
export async function bazosInzerat(id, slug) {
  const r = await fetch(`https://auto.bazos.sk/inzerat/${id}/${slug}`, { headers: { 'user-agent': UA, 'accept-language': 'sk' }, cf: { cacheTtl: 21600, cacheEverything: true } });
  const h = await r.text();
  const m = h.match(/class=["']?popisdetail["']?[^>]*>([\s\S]*?)<\/div>/i);
  if (!m) return null;
  const nums = [...new Set([...h.matchAll(new RegExp(`/img/(\\d+)/\\d+/${id}\\.jpg`, 'g'))].map((x) => +x[1]))].sort((a, b) => a - b);
  return { html: h, popisHtml: m[1], nums };
}
