// Spoločná vrstva pre admin na splatkuj.sk/admin:
//  - window.claude.use('db') – rovnaké rozhranie ako v Claude artefakte, dáta idú do /api/admin (Cloudflare D1)
//  - window.claude.use('downloads') – stiahnutie súboru cez prehliadač
//  - horná lišta s menom, odkazmi a odhlásením
(() => {
  const H = { 'content-type': 'application/json', 'x-sk-admin': '1' };
  async function api(path, opt = {}) {
    const r = await fetch('/api/admin/' + path, { credentials: 'same-origin', ...opt, headers: { ...H, ...(opt.headers || {}) } });
    if (r.status === 401) { location.href = '/admin/login'; throw Object.assign(new Error('Odhlásený'), { code: 'unauth' }); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw Object.assign(new Error(j.error || 'Chyba ' + r.status), { code: r.status === 413 ? 'quota_exceeded' : 'http_' + r.status });
    return j;
  }
  window.SKapi = api;

  // ---- databáza (polling každých 15 s + okamžite po vlastnom zápise) ----
  const watchers = new Set();
  const split = (p) => { const i = p.indexOf('/'); return [p.slice(0, i), p.slice(i + 1)]; };
  function snapDoc(id, data) { return { id, exists: !!data, data: () => data }; }
  async function tick(w) {
    try {
      if (w.kind === 'coll') {
        const j = await api('docs/' + w.coll);
        if (j.rev === w.rev) return; w.rev = j.rev;
        w.cb({ docs: j.docs.map((d) => snapDoc(d.id, d.data)) });
      } else {
        const j = await api('doc/' + w.coll + '/' + w.id);
        const s = JSON.stringify(j.data); if (s === w.rev) return; w.rev = s;
        w.cb(snapDoc(w.id, j.data));
      }
    } catch (e) { if (e.code !== 'unauth') w.err && w.err(e); }
  }
  const refresh = () => watchers.forEach((w) => { w.rev = null; tick(w); });
  setInterval(() => { if (!document.hidden) watchers.forEach(tick); }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) watchers.forEach(tick); });
  function watch(w) { watchers.add(w); tick(w); return () => watchers.delete(w); }
  const db = {
    collection: (coll) => ({ onSnapshot: (cb, err) => watch({ kind: 'coll', coll, cb, err }) }),
    doc: (path) => {
      const [coll, id] = split(path);
      const u = 'doc/' + coll + '/' + encodeURIComponent(id);
      return {
        get: async () => { const j = await api(u); return snapDoc(id, j.data); },
        set: async (data) => { await api(u, { method: 'PUT', body: JSON.stringify(data) }); refresh(); },
        update: async (data) => {
          try { await api(u, { method: 'PATCH', body: JSON.stringify(data) }); }
          catch (e) { if (e.code === 'http_404') await api(u, { method: 'PUT', body: JSON.stringify(data) }); else throw e; }
          refresh();
        },
        delete: async () => { await api(u, { method: 'DELETE' }); refresh(); },
        onSnapshot: (cb, err) => watch({ kind: 'doc', coll, id, cb, err }),
      };
    },
  };
  const downloads = {
    save: async ({ filename, data }) => {
      const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data]));
      const a = Object.assign(document.createElement('a'), { href: url, download: filename });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    },
  };
  window.claude = { use: async (name) => {
    if (name === 'db') return db;
    if (name === 'downloads') return downloads;
    throw Object.assign(new Error('nedostupné'), { code: 'not_in_manifest' });
  } };

  // ---- horná lišta ----
  const css = `[hidden]{display:none!important}
  .skbar{position:sticky;top:0;z-index:50;background:color-mix(in srgb,#0d0e11 92%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid #2a2e37}
  .skbar .in{max-width:1180px;margin:0 auto;padding:10px clamp(16px,3vw,32px);display:flex;gap:8px;align-items:center;flex-wrap:wrap;font:600 14px/1 Figtree,system-ui,sans-serif}
  .skbar a,.skbar button{color:#9ca2ad;text-decoration:none;padding:9px 14px;border-radius:999px;border:1px solid #2a2e37;background:none;font:inherit;cursor:pointer}
  .skbar a:hover,.skbar button:hover{color:#f3f4f6;border-color:#9ca2ad}
  .skbar a[aria-current=page]{background:linear-gradient(135deg,#14B47E,#45D99B);color:#03140D;border-color:transparent}
  .skbar .sp{flex:1}.skbar .who{color:#9ca2ad;font-weight:600;padding-inline:4px}
  .skbar .who b{color:#f3f4f6}
  @media (max-width:640px){.skbar .who{display:none}.skbar .in{flex-wrap:nowrap;overflow-x:auto;gap:6px;padding:8px 12px;font-size:13px;scrollbar-width:none}.skbar .in::-webkit-scrollbar{display:none}.skbar a,.skbar button{padding:8px 12px;white-space:nowrap;flex:none}.skbar .sp{display:none}}`;
  document.head.append(Object.assign(document.createElement('style'), { textContent: css }));
  const here = location.pathname.replace(/\/+$/, '') || '/admin';
  const links = [['/admin', 'Inzeráty'], ['/admin/reklamy', 'Reklamy'], ['/admin/dopyty', 'Dopyty'], ['/admin/ucet', 'Účet']];
  const bar = document.createElement('div'); bar.className = 'skbar';
  bar.innerHTML = `<div class="in">${links.map(([h, t]) => `<a href="${h}/"${here === h ? ' aria-current="page"' : ''}>${t}</a>`).join('')}
    <a href="/" target="_blank" rel="noopener">Web ↗</a><span class="sp"></span><span class="who" id="skWho"></span><button type="button" id="skOut">Odhlásiť</button></div>`;
  document.body.prepend(bar);
  bar.querySelector('#skOut').addEventListener('click', async () => { try { await api('logout', { method: 'POST', body: '{}' }); } catch {} location.href = '/admin/login'; });
  window.SKme = api('me').then((j) => {
    const u = j.user; bar.querySelector('#skWho').innerHTML = `Prihlásený: <b>${u.name.replace(/[<>&]/g, '')}</b>`;
    if (u.mustChange && here !== '/admin/ucet') location.href = '/admin/ucet/?zmena=1';
    if (here !== '/admin/ucet') api('recovery').then((r) => { if (!r.has) { const a = document.createElement('a'); a.href = '/admin/ucet/'; a.textContent = '⚠ Záchranný kód'; a.style.cssText = 'color:#f2b84b;border-color:#f2b84b'; bar.querySelector('.sp').after(a); } }).catch(() => {});
    return u;
  });
})();
