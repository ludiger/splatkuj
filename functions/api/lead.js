// POST /api/lead – dopyt od Laury z webu sa uloží do adminu (kolekcia leady).
import { json, noDb, schema, randomHex } from '../_lib/auth.js';
import { notify, notifyEnabled, leadMessage } from '../_lib/notify.js';

// GET /api/lead – stav: či sú zapnuté upozornenia na nové dopyty (bez citlivých údajov).
export async function onRequestGet({ env }) {
  return json({ ok: true, notify: notifyEnabled(env) });
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.DB) return noDb();
  await schema(env.DB);
  const origin = request.headers.get('origin') || '';
  if (origin && !/^https:\/\/(www\.)?splatkuj\.sk$|\.pages\.dev$/.test(origin)) return json({ ok: false }, 403);
  const ip = request.headers.get('cf-connecting-ip') || 'x';
  // max. 10 dopytov z jednej IP za hodinu
  const k = 'lead:' + ip, now = Date.now();
  const r = await env.DB.prepare('SELECT n, until FROM attempts WHERE k = ?').bind(k).first();
  if (r && r.until > now && r.n >= 10) return json({ ok: false, error: 'Príliš veľa dopytov.' }, 429);
  await env.DB.prepare(`INSERT INTO attempts (k, n, until) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN until < ? THEN 1 ELSE n + 1 END, until = CASE WHEN until < ? THEN excluded.until ELSE until END`)
    .bind(k, now + 3600e3, now, now).run();
  let b; try { b = await request.json(); } catch { return json({ ok: false }, 400); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return json({ ok: false }, 400);
  const clean = {};
  for (const [key, v] of Object.entries(b).slice(0, 60)) {
    if (!/^[A-Za-z0-9_]{1,40}$/.test(key)) continue;
    if (v == null) continue;
    const max = key === 'prepis' ? 12000 : 2000; // prepis rozhovoru môže byť dlhší
    clean[key] = typeof v === 'object' ? JSON.stringify(v).slice(0, max) : String(v).slice(0, max);
  }
  if (!clean.tel && !clean.email && !clean.meno) return json({ ok: false, error: 'Chýba kontakt.' }, 400);
  const id = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14) + '-' + randomHex(3);
  const doc = { ...clean, leadId: id, stav: 'novy', prijate: new Date().toISOString() };
  await env.DB.prepare('INSERT INTO docs (coll, id, data, updated) VALUES (?, ?, ?, ?)').bind('leady', id, JSON.stringify(doc), now).run();
  // push upozornenie majiteľovi – na pozadí, aby nezdržalo odpoveď zákazníkovi
  if (notifyEnabled(env)) {
    const p = notify(env, { title: /formulár/.test(doc.zdroj || '') ? 'Nová žiadosť o úver z webu' : 'Nový dopyt od Laury', message: leadMessage(doc) + '\n⏱ Osloviť do ' + new Date(now + 30 * 60e3).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bratislava' }), click: 'https://www.splatkuj.sk/admin/dopyty/#' + id, tags: ['bell'] });
    if (typeof waitUntil === 'function') waitUntil(p); else await p;
  }
  return json({ ok: true, id });
}
