// Prihlasovanie do adminu: heslá (PBKDF2), relácie v D1, ochrana pred hádaním hesla.
// Vyžaduje D1 databázu naviazanú v Cloudflare Pages ako premennú DB.

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (s) => new Uint8Array(s.match(/../g).map((h) => parseInt(h, 16)));
const ITER = 100000; // maximum, ktoré Cloudflare Workers dovoľujú
export const SESSION_DAYS = 30;
export const COOKIE = 'sk_admin';

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

export function randomHex(n = 32) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return hex(a);
}

export async function sha256(s) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

export async function hashPassword(pw, saltHex = randomHex(16)) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(saltHex), iterations: ITER }, key, 256);
  return `pbkdf2$${ITER}$${saltHex}$${hex(bits)}`;
}

export async function verifyPassword(pw, stored) {
  const [, , salt, want] = String(stored).split('$');
  if (!salt || !want) return false;
  const got = (await hashPassword(pw, salt)).split('$')[3];
  // porovnanie v konštantnom čase
  let d = got.length ^ want.length;
  for (let i = 0; i < Math.min(got.length, want.length); i++) d |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return d === 0;
}

export function passwordProblem(pw) {
  if (typeof pw !== 'string' || pw.length < 10) return 'Heslo musí mať aspoň 10 znakov.';
  if (pw.length > 200) return 'Heslo je príliš dlhé.';
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return 'Heslo musí obsahovať písmená aj číslice.';
  return null;
}

let ready = false;
export async function schema(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      login TEXT PRIMARY KEY, name TEXT NOT NULL, pass TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member',
      must_change INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, last_login TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, login TEXT NOT NULL, expires INTEGER NOT NULL, created_at TEXT NOT NULL, ua TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS attempts (k TEXT PRIMARY KEY, n INTEGER NOT NULL, until INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS docs (
      coll TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY (coll, id))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS docs_updated ON docs (coll, updated)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS log (
      at TEXT NOT NULL, login TEXT, action TEXT NOT NULL, detail TEXT)`),
  ]);
  ready = true;
}

export function cookieOf(request, name = COOKIE) {
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([a-f0-9]{64})`));
  return m ? m[1] : null;
}

export function sessionCookie(token, maxAge) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

// Vráti prihláseného používateľa alebo null.
export async function currentUser(env, request) {
  if (!env.DB) return null;
  await schema(env.DB);
  const tok = cookieOf(request);
  if (!tok) return null;
  const sid = await sha256(tok);
  const row = await env.DB.prepare(
    `SELECT u.login, u.name, u.role, u.must_change, s.expires FROM sessions s JOIN users u ON u.login = s.login WHERE s.id = ?`
  ).bind(sid).first();
  if (!row || row.expires < Date.now()) return null;
  // predĺženie relácie, keď ostáva menej ako polovica
  if (row.expires - Date.now() < (SESSION_DAYS / 2) * 864e5) {
    await env.DB.prepare(`UPDATE sessions SET expires = ? WHERE id = ?`).bind(Date.now() + SESSION_DAYS * 864e5, sid).run();
  }
  return { login: row.login, name: row.name, role: row.role, mustChange: !!row.must_change };
}

export async function createSession(env, login, request) {
  const tok = randomHex(32);
  await env.DB.prepare(`INSERT INTO sessions (id, login, expires, created_at, ua) VALUES (?, ?, ?, ?, ?)`)
    .bind(await sha256(tok), login, Date.now() + SESSION_DAYS * 864e5, new Date().toISOString(), (request.headers.get('user-agent') || '').slice(0, 200))
    .run();
  await env.DB.prepare(`DELETE FROM sessions WHERE expires < ?`).bind(Date.now()).run();
  return tok;
}

// Obmedzenie pokusov: 5 zlých hesiel na jedno meno alebo 20 z jednej IP = blok na 15 minút.
export async function tooMany(env, keys) {
  const now = Date.now();
  for (const k of keys) {
    const r = await env.DB.prepare(`SELECT n, until FROM attempts WHERE k = ?`).bind(k).first();
    if (r && r.until > now && r.n >= (k.startsWith('ip:') ? 20 : 5)) return Math.ceil((r.until - now) / 60000);
  }
  return 0;
}
export async function failed(env, keys) {
  const now = Date.now(), until = now + 15 * 60000;
  for (const k of keys) {
    await env.DB.prepare(
      `INSERT INTO attempts (k, n, until) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = CASE WHEN until < ? THEN 1 ELSE n + 1 END, until = ?`
    ).bind(k, until, now, until).run();
  }
}
export async function clearAttempts(env, keys) {
  for (const k of keys) await env.DB.prepare(`DELETE FROM attempts WHERE k = ?`).bind(k).run();
}

export async function audit(env, login, action, detail = '') {
  try {
    await env.DB.prepare(`INSERT INTO log (at, login, action, detail) VALUES (?, ?, ?, ?)`)
      .bind(new Date().toISOString(), login || null, action, String(detail).slice(0, 300)).run();
  } catch {}
}

export const noDb = () => json({ ok: false, error: 'Databáza ešte nie je pripojená (chýba D1 väzba DB).' }, 503);
