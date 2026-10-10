// GET /api/inzerat/<bazosId>?p=<slug.php>  -> {ok, popis, n, price} – celý popis, počet fotiek a cena z inzerátu na Bazoši
// GET /api/inzerat/<9xxxxxxxx>?p=web      -> to isté pre auto z vlastného webu predajcu (údaje z adminu + čerstvý stav webu)
// &fresh=1 = bez cache (kontrola predaných a zmeny ceny v automatike). 404 = inzerát už neexistuje.
import { bazosPrice, isExt, extState, getDoc } from '../../_lib/foto.js';
const decode = (s) => s
  .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
// telefónne čísla a e-maily predajcu zo zverejneného textu vynecháme
const clean = (s) => s
  .replace(/(\+?421|0)\s?9\d{2}[\s/-]?\d{3}[\s/-]?\d{3}/g, '')
  .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '')
  .split('\n').filter((l) => !/^\s*(📞|☎|tel\.?|telef[oó]n|kontakt)\s*[:.]?\s*$/i.test(l)).join('\n').trim();

export async function onRequestGet({ params, request, env }) {
  const id = params.id;
  const q = new URL(request.url).searchParams, p = q.get('p') || '', fresh = q.get('fresh') === '1';
  const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': fresh ? 'no-store' : 'public, max-age=21600' } });
  const okBazos = /^\d{9}$/.test(id) && !isExt(id) && /^[a-z0-9-]+\.php$/.test(p);
  const okExt = isExt(id) && p === 'web';
  if (!okBazos && !okExt) return json({ ok: false, error: 'zlý odkaz' }, 400);
  if (isExt(id)) {
    const doc = await getDoc(env, id);
    if (!doc) return json({ ok: false, error: 'neznáme auto' }, 404);
    const st = await extState(doc, fresh);
    if (st.exists === false) return json({ ok: false, error: 'inzerát už nie je dostupný' }, 404);
    if (st.exists !== true) return json({ ok: false, error: st.error || 'chyba' }, 502);
    return json({ ok: true, popis: clean(String(doc.popis || '')), n: Array.isArray(doc.imgs) ? doc.imgs.length : 0, price: st.price });
  }
  try {
    const r = await fetch(`https://auto.bazos.sk/inzerat/${id}/${p}`, {
      headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36', 'accept-language': 'sk' },
      cf: fresh ? { cacheTtl: 0 } : { cacheTtl: 21600, cacheEverything: true },
    });
    const h = await r.text();
    const m = h.match(/class=["']?popisdetail["']?[^>]*>([\s\S]*?)<\/div>/i);
    if (!m) return json({ ok: false, error: 'inzerát už nie je dostupný' }, 404);
    const nums = [...h.matchAll(new RegExp(`/img/(\\d+)/\\d+/${id}\\.jpg`, 'g'))].map((x) => +x[1]);
    return json({ ok: true, popis: clean(decode(m[1])), n: nums.length ? Math.max(...nums) : 0, price: bazosPrice(h) });
  } catch (e) {
    return json({ ok: false, error: 'chyba' }, 502);
  }
}
