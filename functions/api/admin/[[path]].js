// API adminu: /api/admin/...
// Prihlásenie, používatelia a jednoduché úložisko dokumentov (inzeráty, nastavenia, leady) v D1.
import {
  json, noDb, schema, currentUser, createSession, sessionCookie, cookieOf, sha256,
  hashPassword, verifyPassword, passwordProblem, tooMany, failed, clearAttempts, audit, SESSION_DAYS, newRecoveryCode, normCode,
} from '../../_lib/auth.js';
import { fotoKey, fetchBazos, bazosInzerat, isExt, fetchExt } from '../../_lib/foto.js';

const COLLS = new Set(['inzeraty', 'config', 'leady', 'reklamy']);
const ID_RE = /^[A-Za-z0-9_.:@+-]{1,120}$/;
const LOGIN_RE = /^[a-z0-9._-]{3,40}$/;

async function body(request) {
  try { return await request.json(); } catch { return {}; }
}

function merge(base, patch) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch || {})) {
    if (v && typeof v === 'object' && v.__delete__ === true) delete out[k];
    else out[k] = v;
  }
  return out;
}

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  const path = (params.path || []).join('/');
  const method = request.method;
  if (!env.DB) return noDb();
  await schema(env.DB);
  const ip = request.headers.get('cf-connecting-ip') || 'x';

  // Zápisy musia prísť z našej stránky (ochrana proti CSRF popri SameSite=Strict).
  if (method !== 'GET' && request.headers.get('x-sk-admin') !== '1') return json({ ok: false, error: 'Zlá požiadavka.' }, 400);

  const userCount = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first()).n;

  // ---------- verejné ----------
  if (path === 'status' && method === 'GET') {
    const user = await currentUser(env, request);
    return json({ ok: true, hasUsers: (await userCount()) > 0, user });
  }

  if (path === 'setup' && method === 'POST') {
    if ((await userCount()) > 0) return json({ ok: false, error: 'Prvý účet už existuje. Prihláste sa.' }, 403);
    if (env.SETUP_KEY) {
      const b0 = await body(request.clone());
      if (b0.setupKey !== env.SETUP_KEY) return json({ ok: false, error: 'Nesprávny kľúč na prvé nastavenie.' }, 403);
    }
    const b = await body(request);
    const login = String(b.login || '').trim().toLowerCase(), name = String(b.name || '').trim().slice(0, 60);
    if (!LOGIN_RE.test(login)) return json({ ok: false, error: 'Prihlasovacie meno: 3 až 40 znakov, malé písmená, číslice, bodka alebo pomlčka.' }, 400);
    if (!name) return json({ ok: false, error: 'Zadajte svoje meno.' }, 400);
    const pp = passwordProblem(b.password); if (pp) return json({ ok: false, error: pp }, 400);
    await env.DB.prepare(`INSERT INTO users (login, name, pass, role, must_change, created_at) VALUES (?, ?, ?, 'owner', 0, ?)`)
      .bind(login, name, await hashPassword(b.password), new Date().toISOString()).run();
    await audit(env, login, 'setup', ip);
    const tok = await createSession(env, login, request);
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie(tok, SESSION_DAYS * 86400) });
  }

  if (path === 'login' && method === 'POST') {
    const b = await body(request);
    const login = String(b.login || '').trim().toLowerCase();
    const keys = ['ip:' + ip, 'u:' + login];
    const wait = await tooMany(env, keys);
    if (wait) return json({ ok: false, error: `Príliš veľa nesprávnych pokusov. Skúste to znova o ${wait} min.` }, 429);
    const u = LOGIN_RE.test(login) ? await env.DB.prepare('SELECT login, pass FROM users WHERE login = ?').bind(login).first() : null;
    const ok = u ? await verifyPassword(String(b.password || ''), u.pass) : (await hashPassword('x'), false);
    if (!ok) { await failed(env, keys); await audit(env, login, 'login_fail', ip); return json({ ok: false, error: 'Nesprávne meno alebo heslo.' }, 401); }
    await clearAttempts(env, keys);
    await env.DB.prepare('UPDATE users SET last_login = ? WHERE login = ?').bind(new Date().toISOString(), login).run();
    await audit(env, login, 'login', ip);
    const tok = await createSession(env, login, request);
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie(tok, SESSION_DAYS * 86400) });
  }

  // Zabudnuté heslo: prihlasovacie meno + záchranný kód -> nové heslo
  if (path === 'reset' && method === 'POST') {
    const b = await body(request);
    const login = String(b.login || '').trim().toLowerCase();
    const keys = ['ip:' + ip, 'u:' + login];
    const wait = await tooMany(env, keys);
    if (wait) return json({ ok: false, error: `Príliš veľa nesprávnych pokusov. Skúste to znova o ${wait} min.` }, 429);
    const u = LOGIN_RE.test(login) ? await env.DB.prepare('SELECT login, recovery FROM users WHERE login = ?').bind(login).first() : null;
    const code = normCode(b.code);
    if (!u || !u.recovery || code.length !== 16 || (await sha256('rc:' + code)) !== u.recovery) {
      await failed(env, keys); await audit(env, login, 'reset_fail', ip);
      return json({ ok: false, error: 'Prihlasovacie meno alebo záchranný kód nie je správny.' }, 401);
    }
    const pp = passwordProblem(b.password); if (pp) return json({ ok: false, error: pp }, 400);
    await env.DB.prepare('UPDATE users SET pass = ?, must_change = 0, recovery = NULL WHERE login = ?').bind(await hashPassword(b.password), login).run();
    await env.DB.prepare('DELETE FROM sessions WHERE login = ?').bind(login).run();
    await clearAttempts(env, keys);
    await audit(env, login, 'reset', ip);
    const tok = await createSession(env, login, request);
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie(tok, SESSION_DAYS * 86400) });
  }

  if (path === 'logout' && method === 'POST') {
    const tok = cookieOf(request);
    if (tok) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(tok)).run();
    return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
  }

  // ---------- len pre prihlásených ----------
  const me = await currentUser(env, request);
  if (!me) return json({ ok: false, error: 'Nie ste prihlásený.' }, 401);
  const owner = me.role === 'owner';

  if (path === 'me' && method === 'GET') return json({ ok: true, user: me });

  if (path === 'password' && method === 'POST') {
    const b = await body(request);
    const u = await env.DB.prepare('SELECT pass FROM users WHERE login = ?').bind(me.login).first();
    if (!(await verifyPassword(String(b.old || ''), u.pass))) return json({ ok: false, error: 'Súčasné heslo nie je správne.' }, 400);
    const pp = passwordProblem(b.password); if (pp) return json({ ok: false, error: pp }, 400);
    await env.DB.prepare('UPDATE users SET pass = ?, must_change = 0 WHERE login = ?').bind(await hashPassword(b.password), me.login).run();
    // odhlási ostatné zariadenia
    const cur = await sha256(cookieOf(request));
    await env.DB.prepare('DELETE FROM sessions WHERE login = ? AND id <> ?').bind(me.login, cur).run();
    await audit(env, me.login, 'password', '');
    return json({ ok: true });
  }

  if (path === 'recovery' && method === 'GET') {
    const u = await env.DB.prepare('SELECT recovery FROM users WHERE login = ?').bind(me.login).first();
    return json({ ok: true, has: !!(u && u.recovery) });
  }
  if (path === 'recovery' && method === 'POST') {
    const code = newRecoveryCode();
    await env.DB.prepare('UPDATE users SET recovery = ? WHERE login = ?').bind(await sha256('rc:' + normCode(code)), me.login).run();
    await audit(env, me.login, 'recovery_new', '');
    return json({ ok: true, code });
  }

  if (path === 'users') {
    if (!owner) return json({ ok: false, error: 'Iba pre majiteľa účtu.' }, 403);
    if (method === 'GET') {
      const r = await env.DB.prepare('SELECT login, name, role, must_change, created_at, last_login FROM users ORDER BY created_at').all();
      return json({ ok: true, users: r.results });
    }
    if (method === 'POST') {
      const b = await body(request);
      const login = String(b.login || '').trim().toLowerCase(), name = String(b.name || '').trim().slice(0, 60);
      if (!LOGIN_RE.test(login)) return json({ ok: false, error: 'Prihlasovacie meno: 3 až 40 znakov, malé písmená, číslice, bodka alebo pomlčka.' }, 400);
      if (!name) return json({ ok: false, error: 'Zadajte meno.' }, 400);
      const pp = passwordProblem(b.password); if (pp) return json({ ok: false, error: pp }, 400);
      const ex = await env.DB.prepare('SELECT 1 FROM users WHERE login = ?').bind(login).first();
      if (ex) return json({ ok: false, error: 'Také prihlasovacie meno už existuje.' }, 409);
      await env.DB.prepare(`INSERT INTO users (login, name, pass, role, must_change, created_at) VALUES (?, ?, ?, 'member', 1, ?)`)
        .bind(login, name, await hashPassword(b.password), new Date().toISOString()).run();
      await audit(env, me.login, 'user_add', login);
      return json({ ok: true });
    }
  }
  const um = path.match(/^users\/([a-z0-9._-]{3,40})(\/reset)?$/);
  if (um) {
    if (!owner) return json({ ok: false, error: 'Iba pre majiteľa účtu.' }, 403);
    const login = um[1];
    if (login === me.login) return json({ ok: false, error: 'Svoj vlastný účet tu meniť nemôžete.' }, 400);
    if (um[2] && method === 'POST') {
      const b = await body(request);
      const pp = passwordProblem(b.password); if (pp) return json({ ok: false, error: pp }, 400);
      await env.DB.prepare('UPDATE users SET pass = ?, must_change = 1 WHERE login = ?').bind(await hashPassword(b.password), login).run();
      await env.DB.prepare('DELETE FROM sessions WHERE login = ?').bind(login).run();
      await audit(env, me.login, 'user_reset', login);
      return json({ ok: true });
    }
    if (!um[2] && method === 'DELETE') {
      await env.DB.prepare('DELETE FROM sessions WHERE login = ?').bind(login).run();
      await env.DB.prepare('DELETE FROM users WHERE login = ?').bind(login).run();
      await audit(env, me.login, 'user_del', login);
      return json({ ok: true });
    }
  }

  if (path === 'log' && method === 'GET') {
    if (!owner) return json({ ok: false, error: 'Iba pre majiteľa účtu.' }, 403);
    const r = await env.DB.prepare('SELECT * FROM log ORDER BY at DESC LIMIT 200').all();
    return json({ ok: true, log: r.results });
  }

  // Trvalá záloha fotiek inzerátu do R2: POST archiv/<bazosId>  (po dávkach, vracia koľko ešte ostáva)
  const am = path.match(/^archiv\/(\d{9})$/);
  if (am && method === 'POST') {
    if (!env.FOTO) return json({ ok: false, error: 'Úložisko fotiek (R2 bucket FOTO) ešte nie je pripojené.' }, 503);
    const id = am[1];
    const row = await env.DB.prepare('SELECT data FROM docs WHERE coll = ? AND id = ?').bind('inzeraty', id).first();
    const doc = row ? JSON.parse(row.data) : {};
    const ext = isExt(id);
    let nums = Array.isArray(doc.fotky) ? doc.fotky : null;
    if (ext && (!nums || !nums.length)) {
      // auto z vlastného webu predajcu: fotky sú adresy v poli imgs (1 = prvá)
      const imgs = Array.isArray(doc.imgs) ? doc.imgs : [];
      if (!imgs.length) return json({ ok: false, error: 'Auto nemá zoznam fotiek (imgs).' }, 404);
      nums = imgs.map((_, i) => i + 1);
      if (row) {
        doc.fotky = nums; doc.fotkyAt = new Date().toISOString();
        await env.DB.prepare('UPDATE docs SET data = ?, updated = ? WHERE coll = ? AND id = ?').bind(JSON.stringify(doc), Date.now(), 'inzeraty', id).run();
      }
    }
    if (!nums || !nums.length) {
      const slug = ((doc.url || '').match(/inzerat\/\d+\/([^/?#]+\.php)/) || [])[1];
      const info = slug ? await bazosInzerat(id, slug) : null;
      if (!info) return json({ ok: false, error: 'Inzerát na Bazoši už nie je, fotky sa nedajú stiahnuť.', gone: true }, 404);
      nums = info.nums.length ? info.nums : [1];
      if (row) {
        doc.fotky = nums; doc.fotkyAt = new Date().toISOString();
        await env.DB.prepare('UPDATE docs SET data = ?, updated = ? WHERE coll = ? AND id = ?').bind(JSON.stringify(doc), Date.now(), 'inzeraty', id).run();
      }
    }
    let saved = 0, have = 0, missing = 0, budget = 20;
    for (const n of nums) {
      for (const t of [false, true]) {
        if (await env.FOTO.head(fotoKey(id, n, t))) { have++; continue; }
        if (budget <= 0) continue;
        budget--;
        const buf = ext ? await fetchExt((doc.imgs || [])[n - 1]) : await fetchBazos(id, n, t);
        if (!buf) { missing++; continue; }
        await env.FOTO.put(fotoKey(id, n, t), buf, { httpMetadata: { contentType: 'image/jpeg' } });
        saved++;
      }
    }
    const total = nums.length * 2;
    return json({ ok: true, photos: nums.length, saved, have, missing, remaining: Math.max(0, total - have - saved - missing) });
  }

  // Upratanie fotiek predaných áut: POST cleanup – 7 dní po predaji zmaže z R2 všetky fotky okrem prvej
  // (prvá ostane ako náhľad v admine v časti Predané). Spúšťa sa sama pri otvorení adminu (raz denne).
  if (path === 'cleanup' && method === 'POST') {
    if (!env.FOTO) return json({ ok: true, cars: 0, deleted: 0 });
    const KEEP_DAYS = 7, limit = Date.now() - KEEP_DAYS * 864e5;
    const { results } = await env.DB.prepare('SELECT id, data FROM docs WHERE coll = ?').bind('inzeraty').all();
    let cars = 0, deleted = 0;
    for (const r of results || []) {
      if (cars >= 15) break; // po dávkach, aby to nebolo pomalé
      const d = JSON.parse(r.data || '{}');
      if (d.status !== 'predany' || !d.soldAt || d.fotkyZmazane) continue;
      if (Date.parse(d.soldAt) > limit) continue;
      if (!/^\d{9}$/.test(r.id)) continue;
      const first = Array.isArray(d.fotky) && d.fotky.length ? d.fotky[0] : 1;
      const keep = new Set([fotoKey(r.id, first, false), fotoKey(r.id, first, true)]);
      let cursor;
      do {
        const l = await env.FOTO.list({ prefix: `bazos/${r.id}/`, cursor });
        const del = l.objects.map((o) => o.key).filter((k) => !keep.has(k));
        if (del.length) { await env.FOTO.delete(del); deleted += del.length; }
        cursor = l.truncated ? l.cursor : undefined;
      } while (cursor);
      d.fotky = [first]; d.fotkyZmazane = new Date().toISOString();
      await env.DB.prepare('UPDATE docs SET data = ?, updated = ? WHERE coll = ? AND id = ?').bind(JSON.stringify(d), Date.now(), 'inzeraty', r.id).run();
      cars++;
    }
    if (cars) await audit(env, me.login, 'cleanup', `fotky predaných áut: ${cars} áut, ${deleted} súborov`).catch(() => {});
    return json({ ok: true, cars, deleted });
  }

  // Hromadný zápis (prenos dát a automatická kontrola): {docs:[{coll,id,data,mode:'set'|'merge'|'delete'}]}
  if (path === 'bulk' && method === 'POST') {
    const b = await body(request);
    const docs = Array.isArray(b.docs) ? b.docs.slice(0, 500) : [];
    const now = Date.now(); const stmts = [];
    for (const d of docs) {
      if (!COLLS.has(d.coll) || !ID_RE.test(String(d.id || ''))) continue;
      if (d.mode === 'delete') { stmts.push(env.DB.prepare('DELETE FROM docs WHERE coll = ? AND id = ?').bind(d.coll, d.id)); continue; }
      let data = d.data || {};
      if (d.mode === 'merge') {
        const ex = await env.DB.prepare('SELECT data FROM docs WHERE coll = ? AND id = ?').bind(d.coll, d.id).first();
        data = merge(ex ? JSON.parse(ex.data) : {}, data);
      }
      stmts.push(env.DB.prepare('INSERT INTO docs (coll, id, data, updated) VALUES (?, ?, ?, ?) ON CONFLICT(coll, id) DO UPDATE SET data = excluded.data, updated = excluded.updated')
        .bind(d.coll, d.id, JSON.stringify(data), now));
    }
    if (stmts.length) await env.DB.batch(stmts);
    await audit(env, me.login, 'bulk', `${stmts.length} zápisov`);
    return json({ ok: true, written: stmts.length });
  }

  // Dokumenty: GET docs/<coll>, GET/PUT/PATCH/DELETE doc/<coll>/<id>
  const lm = path.match(/^docs\/([a-z]+)$/);
  if (lm && method === 'GET') {
    if (!COLLS.has(lm[1])) return json({ ok: false, error: 'Neznáma kolekcia.' }, 404);
    const r = await env.DB.prepare('SELECT id, data, updated FROM docs WHERE coll = ?').bind(lm[1]).all();
    const max = r.results.reduce((m, x) => Math.max(m, x.updated), 0);
    return json({ ok: true, rev: `${r.results.length}:${max}`, docs: r.results.map((x) => ({ id: x.id, data: JSON.parse(x.data) })) });
  }
  const dm = path.match(/^doc\/([a-z]+)\/([A-Za-z0-9_.:@+-]{1,120})$/);
  if (dm) {
    const [, coll, id] = dm;
    if (!COLLS.has(coll)) return json({ ok: false, error: 'Neznáma kolekcia.' }, 404);
    const cur = await env.DB.prepare('SELECT data FROM docs WHERE coll = ? AND id = ?').bind(coll, id).first();
    if (method === 'GET') return json({ ok: true, exists: !!cur, data: cur ? JSON.parse(cur.data) : null });
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM docs WHERE coll = ? AND id = ?').bind(coll, id).run();
      await audit(env, me.login, 'delete', `${coll}/${id}`);
      return json({ ok: true });
    }
    if (method === 'PUT' || method === 'PATCH') {
      const b = await body(request);
      if (!b || typeof b !== 'object' || Array.isArray(b)) return json({ ok: false, error: 'Zlé dáta.' }, 400);
      if (method === 'PATCH' && !cur) return json({ ok: false, error: 'Záznam neexistuje.' }, 404);
      const data = method === 'PATCH' ? merge(JSON.parse(cur.data), b) : b;
      const s = JSON.stringify(data);
      if (s.length > 200000) return json({ ok: false, error: 'Záznam je príliš veľký.' }, 413);
      await env.DB.prepare('INSERT INTO docs (coll, id, data, updated) VALUES (?, ?, ?, ?) ON CONFLICT(coll, id) DO UPDATE SET data = excluded.data, updated = excluded.updated')
        .bind(coll, id, s, Date.now()).run();
      await audit(env, me.login, method === 'PUT' ? 'set' : 'update', `${coll}/${id} ${Object.keys(b).join(',')}`);
      return json({ ok: true });
    }
  }

  return json({ ok: false, error: 'Nenájdené.' }, 404);
}
