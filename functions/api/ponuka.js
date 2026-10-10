// GET /api/ponuka – autá, ktoré sú v admine aktívne, ale nie sú v statickom webe: čakajú na plné spracovanie (needsAds=true)
// alebo majú reklamy hotové dávkovo a fotky na webe idú zo zálohy (webApi=true).
// Web ich pridá do ponuky hneď (fotky idú zo zálohy cez /api/foto). Keď automatika auto plne spracuje,
// objaví sa v src/web.html a odtiaľto sa už nevracia. Predané autá (status != aktivny) sa nevracajú nikdy.
// Vracia len údaje, ktoré sú aj na webe – nič interné (poznámky, VIN, predajca, adresy fotiek u predajcu).
import { json, noDb } from '../_lib/auth.js';

const fmtKm = (n) => (n ? Number(n).toLocaleString('sk-SK').replace(/\s/g, ' ') + ' km' : '—');
const num = (d) => +d.priceNum || +String(d.price || '').replace(/\D/g, '') || 0;

export async function onRequestGet({ env }) {
  if (!env.DB) return noDb();
  const { results } = await env.DB.prepare('SELECT id, data FROM docs WHERE coll = ?').bind('inzeraty').all();
  const cars = [];
  for (const r of results || []) {
    let d; try { d = JSON.parse(r.data); } catch { continue; }
    if (d.status !== 'aktivny' || (d.needsAds !== true && d.webApi !== true)) continue;
    const price = num(d); if (!price) continue;
    const id = String(d.adId || r.id);
    const kw = +d.kw || 0;
    const n = Array.isArray(d.imgs) ? d.imgs.length : Array.isArray(d.fotky) ? d.fotky.length : 0;
    cars.push({
      id, ap: true, title: d.carTitle || d.title || '', price,
      sub: [kw ? kw + ' kW' : '', d.fuel, d.gear].filter(Boolean).join(' · '),
      year: d.yearText || (d.year ? String(d.year) : '—'), km: fmtKm(d.km), power: kw ? kw + ' kW' : '—',
      fuel: d.fuel || '—', gear: d.gear || '—', drive: d.drive || '—',
      photos: n ? Math.min(n, 5) : 5, nimg: n,
      tags: Array.isArray(d.tags) ? d.tags.slice(0, 6) : [], desc: d.desc || '', why: d.why || '', eq: [],
      loc: String(d.location || '').replace(/^\d{3} ?\d{2} /, ''), url: d.url || '', seller: d.sellerId || '',
      added: d.addedAt || '',
    });
  }
  cars.sort((a, b) => String(b.added).localeCompare(String(a.added)));
  return new Response(JSON.stringify({ ok: true, cars }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
}
