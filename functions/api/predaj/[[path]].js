// Predaj auta cez Splatkuj.sk – súkromný predajca pošle auto s fotkami, zaradíme ho ZADARMO do ponuky so splátkou
// (po kontrole a schválení v admine → Dopyty). Stránka: /predat
//   POST /api/predaj/start                 -> {ok, id}  nové číslo auta 98xxxxxxx (koncept, platí 24 h)
//   POST /api/predaj/foto/<id>/<n>[/t]     -> {ok}      fotka č. n (1–20) ako JPEG, /t = náhľad; uloží sa do R2 rovnako
//                                                       ako zálohy fotiek (bazos/<id>/<n>.jpg), takže ich /api/foto hneď vie zobraziť
//   POST /api/predaj                       -> {ok, id}  odoslanie: údaje o aute + kontakt → dopyt v CRM (záujem „predaj“) + Telegram
// Ochrana: povolené len zo splatkuj.sk, limity na IP, len JPEG, max. veľkosť, koncept musí existovať a nesmie byť odoslaný.
import { json, noDb, schema } from '../../_lib/auth.js';
import { fotoKey } from '../../_lib/foto.js';
import { notify, notifyEnabled } from '../../_lib/notify.js';

const CATS = ['Osobné auto', 'Motocykel', 'Dodávka / úžitkové', 'Karavan / obytné', 'Nákladné', 'Iné'];
const MAX_FOTO = 20, MAX_BYTES = 2_600_000, MAX_THUMB = 400_000;
const okOrigin = (request) => { const o = request.headers.get('origin') || ''; return !o || /^https:\/\/(www\.)?splatkuj\.sk$|\.pages\.dev$/.test(o); };

// jednoduchý limit na IP (tabuľka attempts zo schémy adminu)
async function limit(env, key, max, windowMs) {
  const now = Date.now();
  const r = await env.DB.prepare('SELECT n, until FROM attempts WHERE k = ?').bind(key).first();
  if (r && r.until > now && r.n >= max) return false;
  await env.DB.prepare(`INSERT INTO attempts (k, n, until) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN until < ? THEN 1 ELSE n + 1 END, until = CASE WHEN until < ? THEN excluded.until ELSE until END`)
    .bind(key, now + windowMs, now, now).run();
  return true;
}
const getDraft = async (env, id) => { const r = await env.DB.prepare('SELECT data FROM docs WHERE coll = ? AND id = ?').bind('predaj', id).first(); return r ? JSON.parse(r.data) : null; };
const putDraft = (env, id, d) => env.DB.prepare('INSERT INTO docs (coll, id, data, updated) VALUES (?, ?, ?, ?) ON CONFLICT(coll, id) DO UPDATE SET data = excluded.data, updated = excluded.updated')
  .bind('predaj', id, JSON.stringify(d), Date.now()).run();
const s = (v, n = 200) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

export async function onRequestPost({ request, env, params, waitUntil }) {
  if (!env.DB) return noDb();
  if (!okOrigin(request)) return json({ ok: false }, 403);
  await schema(env.DB);
  const ip = request.headers.get('cf-connecting-ip') || 'x';
  const p = params.path || [];

  // ---------- nový koncept ----------
  if (p[0] === 'start' && p.length === 1) {
    if (!(await limit(env, 'predaj-start:' + ip, 10, 3600e3))) return json({ ok: false, error: 'Príliš veľa pokusov, skúste to o hodinu.' }, 429);
    let id;
    for (let i = 0; i < 5; i++) {
      const r = new Uint32Array(1); crypto.getRandomValues(r);
      id = '98' + String(r[0] % 1e7).padStart(7, '0');
      const ex = await env.DB.prepare('SELECT 1 FROM docs WHERE id = ? AND coll IN (?, ?)').bind(id, 'predaj', 'inzeraty').first();
      if (!ex) break; id = null;
    }
    if (!id) return json({ ok: false, error: 'Skúste to prosím znova.' }, 500);
    await putDraft(env, id, { id, ip, created: Date.now(), fotky: [], odoslane: false });
    return json({ ok: true, id });
  }

  // ---------- fotka ----------
  if (p[0] === 'foto') {
    const [, id, n, t] = p;
    if (!/^98\d{7}$/.test(id || '') || !/^\d{1,2}$/.test(n || '') || +n < 1 || +n > MAX_FOTO || (t && t !== 't')) return json({ ok: false, error: 'Zlá adresa.' }, 400);
    if (!env.FOTO) return json({ ok: false, error: 'Úložisko fotiek nie je pripojené.' }, 503);
    if (!(await limit(env, 'predaj-foto:' + ip, 150, 3600e3))) return json({ ok: false, error: 'Príliš veľa fotiek naraz, skúste to neskôr.' }, 429);
    const d = await getDraft(env, id);
    if (!d || d.odoslane || Date.now() - d.created > 864e5) return json({ ok: false, error: 'Formulár vypršal, začnite prosím znova.' }, 410);
    const buf = await request.arrayBuffer();
    const b = new Uint8Array(buf.slice(0, 3));
    if (buf.byteLength < 500 || buf.byteLength > (t ? MAX_THUMB : MAX_BYTES) || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return json({ ok: false, error: 'Fotka musí byť JPEG do 2,5 MB.' }, 400);
    await env.FOTO.put(fotoKey(id, n, !!t), buf, { httpMetadata: { contentType: 'image/jpeg' } });
    if (!t && !d.fotky.includes(+n)) { d.fotky.push(+n); d.fotky.sort((a, c) => a - c); await putDraft(env, id, d); }
    return json({ ok: true });
  }

  // ---------- odoslanie ----------
  if (p.length === 0) {
    if (!(await limit(env, 'predaj-send:' + ip, 6, 3600e3))) return json({ ok: false, error: 'Príliš veľa odoslaní, skúste to o hodinu.' }, 429);
    let b; try { b = await request.json(); } catch { return json({ ok: false }, 400); }
    const id = s(b.id, 9);
    if (!/^98\d{7}$/.test(id)) return json({ ok: false, error: 'Chýba číslo auta.' }, 400);
    const d = await getDraft(env, id);
    if (!d || d.odoslane) return json({ ok: false, error: 'Formulár už bol odoslaný alebo vypršal.' }, 410);
    const v = {
      kategoria: CATS.includes(b.kategoria) ? b.kategoria : 'Osobné auto', znacka: s(b.znacka, 40), model: s(b.model, 80), rok: s(b.rok, 4), mesiac: s(b.mesiac, 2),
      km: s(b.km, 9).replace(/\D/g, ''), palivo: s(b.palivo, 30), prevodovka: s(b.prevodovka, 30), kw: s(b.kw, 4).replace(/\D/g, ''), pohon: s(b.pohon, 20),
      karoseria: s(b.karoseria, 40), farba: s(b.farba, 40), vin: s(b.vin, 17).toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, ''), cena: s(b.cena, 8).replace(/\D/g, ''),
      lokalita: s(b.lokalita, 80), stav: s(b.stav, 60), vybava: (Array.isArray(b.vybava) ? b.vybava : []).map((x) => s(x, 40)).filter(Boolean).slice(0, 30), popis: s(b.popis, 3000),
    };
    const meno = s(b.meno, 80), tel = s(b.tel, 20), email = s(b.email, 120);
    if (!v.znacka || !v.model || !/^(19|20)\d{2}$/.test(v.rok) || !v.cena || +v.cena < 300) return json({ ok: false, error: 'Vyplňte prosím značku, model, rok a cenu.' }, 400);
    if (meno.length < 3 || (tel.match(/\d/g) || []).length < 9) return json({ ok: false, error: 'Vyplňte prosím meno a telefón.' }, 400);
    if (b.suhlas !== true) return json({ ok: false, error: 'Potvrďte prosím súhlas.' }, 400);
    const nf = Math.min(MAX_FOTO, +b.nfoto || 0);
    if (!nf || !Array.from({ length: nf }, (_, i) => i + 1).every((n) => d.fotky.includes(n))) return json({ ok: false, error: 'Fotky sa nenahrali celé, skúste to prosím znova.' }, 400);
    d.fotky = Array.from({ length: nf }, (_, i) => i + 1);
    const auto = [v.znacka, v.model].join(' ') + ', ' + (v.mesiac ? v.mesiac + '/' : '') + v.rok + ', ' + Number(v.cena).toLocaleString('sk-SK') + ' €';
    const now = new Date().toISOString();
    const leadId = now.replace(/[-:T.Z]/g, '').slice(0, 14) + '-' + id.slice(-6);
    const udaje = { 'Kategória': v.kategoria, 'Značka': v.znacka, 'Model': v.model, 'Rok výroby': (v.mesiac ? v.mesiac + '/' : '') + v.rok, 'Najazdené km': v.km, 'Palivo': v.palivo,
      'Prevodovka': v.prevodovka, 'Výkon (kW)': v.kw, 'Pohon': v.pohon, 'Karoséria': v.karoseria, 'Farba': v.farba, 'VIN': v.vin, 'Cena (€)': v.cena, 'Lokalita': v.lokalita,
      'Stav vozidla': v.stav, 'Výbava': v.vybava.join(', '), 'Počet fotiek': String(d.fotky.length) };
    Object.keys(udaje).forEach((k) => { if (!udaje[k]) delete udaje[k]; });
    const doc = { leadId, meno, tel, email, zaujem: 'predaj', zdroj: 'predaj auta (formulár)', kanal: 'Formulár Predať auto', auto, predajId: id, fotky: d.fotky,
      vozidlo: JSON.stringify(v), udaje: JSON.stringify(udaje), text: 'Predaj auta cez Splatkuj.sk (zaradenie do ponuky zadarmo)\n' + auto + (v.popis ? '\n\n' + v.popis : ''),
      odkial: ['Bazoš', 'Facebook', 'Instagram', 'TikTok', 'Google', 'Odporúčanie'].includes(b.odkial) ? b.odkial : '', ref: s(b.ref, 80),
      stav: 'novy', prijate: now, suhlas: 'áno ' + now };
    await env.DB.prepare('INSERT INTO docs (coll, id, data, updated) VALUES (?, ?, ?, ?)').bind('leady', leadId, JSON.stringify(doc), Date.now()).run();
    d.odoslane = true; d.leadId = leadId; await putDraft(env, id, d);
    if (notifyEnabled(env)) {
      const pr = notify(env, { title: 'Nové auto na zaradenie do ponuky', message: auto + ' · ' + d.fotky.length + ' fotiek\n⏱ Osloviť do ' + new Date(Date.now() + 30 * 60e3).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bratislava' }),
        click: 'https://www.splatkuj.sk/admin/dopyty/#' + leadId, tags: ['car'] });
      if (typeof waitUntil === 'function') waitUntil(pr); else await pr;
    }
    return json({ ok: true, id, leadId });
  }
  return json({ ok: false }, 404);
}
