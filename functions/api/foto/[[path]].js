// GET /api/foto/<bazosId>/<n>  -> fotka č. n k inzerátu z Bazoša (uložená v cache Cloudflare na 30 dní)
// GET /api/foto/<bazosId>/<n>/t -> náhľad
export async function onRequestGet({ params, request }) {
  const [id, n, t] = params.path || [];
  if (!/^\d{9}$/.test(id || '') || !/^\d{1,2}$/.test(n || '')) return new Response('Bad request', { status: 400 });
  const dir = t === 't' ? `${n}t` : n;
  const src = `https://www.bazos.sk/img/${dir}/${id.slice(-3)}/${id}.jpg`;
  const cache = caches.default;
  const key = new Request(new URL(request.url).toString());
  let res = await cache.match(key);
  if (res) return res;
  const r = await fetch(src, {
    headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36', referer: 'https://www.bazos.sk/' },
    cf: { cacheTtl: 2592000, cacheEverything: true },
  });
  if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image/')) return new Response('Not found', { status: 404 });
  res = new Response(r.body, {
    headers: { 'content-type': r.headers.get('content-type'), 'cache-control': 'public, max-age=2592000, immutable' },
  });
  await cache.put(key, res.clone());
  return res;
}
