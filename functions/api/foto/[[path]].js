// GET /api/foto/<bazosId>/<n>    -> fotka č. n k inzerátu (1200×900, najvyššia kvalita, akú Bazoš má)
// GET /api/foto/<bazosId>/<n>/t  -> náhľad
// Ak je pripojený R2 bucket FOTO, fotka sa pri prvom zobrazení natrvalo uloží a ostane aj po zmazaní inzerátu.
import { fotoKey, fetchBazos } from '../../_lib/foto.js';

const IMG = { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=2592000, immutable' };

export async function onRequestGet({ params, env, waitUntil }) {
  const [id, n, t] = params.path || [];
  if (!/^\d{9}$/.test(id || '') || !/^\d{1,2}$/.test(n || '')) return new Response('Bad request', { status: 400 });
  const thumb = t === 't';
  if (env.FOTO) {
    const o = await env.FOTO.get(fotoKey(id, n, thumb));
    if (o) return new Response(o.body, { headers: IMG });
  }
  const buf = await fetchBazos(id, n, thumb);
  if (!buf) return new Response('Not found', { status: 404 });
  if (env.FOTO) waitUntil(env.FOTO.put(fotoKey(id, n, thumb), buf, { httpMetadata: { contentType: 'image/jpeg' } }));
  return new Response(buf, { headers: IMG });
}
