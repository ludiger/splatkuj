#!/usr/bin/env python3
"""Zostaví admin na splatkuj.sk/admin z rovnakých zdrojov ako Claude artefakty.

python3 build_admin.py <admin.html> <reklamy.html> <reklamy_assets_dir>
Výstup: public/admin/index.html, public/admin/reklamy/index.html (+ r/ t/ v/), dopyty/ a ucet/ sú ručne písané.
"""
import re, sys, shutil, os
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / 'public' / 'admin'

HEAD = '''<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
{title}
</head>
<body>
<script src="/admin/shim.js"></script>
'''


FOTO_PANEL = '''  <section class="add" id="fotoBox" style="margin-top:22px">
    <h2>Záloha fotiek vo vysokej kvalite</h2>
    <p class="hint" id="fotoInfo">Uloží všetky fotky ku každému autu (1200×900, najvyššia kvalita, akú Bazoš má) na náš server. Ostanú aj keď predajca inzerát zmaže. 7 dní po predaji sa fotky auta automaticky zmažú a ostane len jedna ako náhľad.</p>
    <div class="row"><button class="btn btn-amber" type="button" id="fotoGo">Stiahnuť fotky všetkých áut</button><span class="hint" id="fotoProg" role="status"></span></div>
  </section>
'''
FOTO_SCRIPT = '''
<script>
(() => {
  const $ = (id) => document.getElementById(id);
  let running = false;
  $('fotoGo').addEventListener('click', async () => {
    if (running) return; running = true; $('fotoGo').disabled = true;
    try {
      const { docs } = await SKapi('docs/inzeraty');
      const list = docs.map((d) => d.data).filter((r) => r.status !== 'predany' || (r.fotky || []).length);
      let done = 0, photos = 0, gone = 0, err = '';
      for (const r of list) {
        for (let k = 0; k < 6; k++) {
          try {
            const j = await SKapi('archiv/' + r.adId, { method: 'POST', body: '{}' });
            if (k === 0) photos += j.photos;
            if (!j.remaining) break;
          } catch (e) { if (/nie je pripojené/.test(e.message)) { err = e.message; break; } gone++; break; }
        }
        if (err) break;
        done++; $('fotoProg').textContent = `${done} / ${list.length} áut · ${photos} fotiek`;
      }
      $('fotoProg').textContent = err || `Hotovo: ${done} áut, ${photos} fotiek uložených.` + (gone ? ` ${gone} inzerátov už na Bazoši nie je.` : '');
    } catch (e) { $('fotoProg').textContent = 'Nepodarilo sa: ' + e.message; }
    running = false; $('fotoGo').disabled = false;
  });
})();
</script>
'''


def wrap(html):
    m = re.search(r'<title>.*?</title>', html)
    title = m.group(0) if m else '<title>Splatkuj Admin</title>'
    body = html.replace(title, '', 1)
    return HEAD.format(title=title) + body + '\n</body>\n</html>\n'


def drop_nav(html):
    return re.sub(r'<nav class="sk-nav".*?</nav>\s*', '', html, count=1, flags=re.S)


def admin(src):
    h = Path(src).read_text()
    h = drop_nav(h)
    # tlačidlo na ručné spustenie funguje len v Claude
    h = h.replace('<button class="btn btn-amber" id="runNow" type="button">', '<button class="btn btn-amber" id="runNow" type="button" hidden>')
    h = h.replace('Otvorte stránku prihlásený v Claude, aby sa načítali uložené inzeráty.', 'Obnovte stránku. Ak to nepomôže, napíšte Claudovi.')
    # ikonka „Reklama“ pri každom aute
    icon = ('<a class="icon" href="/admin/reklamy/#${esc(r.adId)}" title="Reklama k autu" aria-label="Reklama k autu">'
            '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/></svg></a>\n           ')
    anchor = '<button class="icon" data-ask="${esc(r.adId)}"'
    assert anchor in h, 'admin: anchor missing'
    h = h.replace(anchor, icon + anchor, 1)
    # odkaz na reklamu aj v archíve predaného auta
    h = h.replace('<a class="mini" href="${esc(r.url)}" target="_blank" rel="noopener">Pôvodný odkaz na Bazoš ↗</a>',
                  '<a class="mini" href="${esc(r.url)}" target="_blank" rel="noopener">Pôvodný odkaz na Bazoš ↗</a><a class="mini" href="/admin/reklamy/#${esc(r.adId)}">Reklama k autu</a>')
    # galéria uložených fotiek v archíve predaného auta
    old_desc = "${r.desc ? `<p>${esc(r.desc)}</p>` : ''}"
    assert old_desc in h, 'admin: desc anchor'
    h = h.replace(old_desc, old_desc + "${(r.fotky||[]).length ? `<div class=\"fst\">${r.fotky.map(n => `<a href=\"/api/foto/${esc(r.adId)}/${n}\" target=\"_blank\" rel=\"noopener\"><img loading=\"lazy\" src=\"/api/foto/${esc(r.adId)}/${n}/t\" alt=\"Fotka ${n}\"></a>`).join('')}</div>` : ''}", 1)
    h = h.replace("const d = $('dlg'); const srcs = cfg.sources || [];", "const d = $('dlg'); const srcs = cfg.sources || []; if ((r.fotky||[]).length) r = {...r, photo: '/api/foto/' + r.adId + '/' + r.fotky[0]};", 1)
    h = h.replace('</style>', '.fst{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px}.fst img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;display:block}\n</style>', 1)
    h = h.replace('</div>\n<dialog class="dlg" id="dlg"', FOTO_PANEL + '</div>\n<dialog class="dlg" id="dlg"', 1)
    h = h + FOTO_SCRIPT
    (OUT).mkdir(parents=True, exist_ok=True)
    (OUT / 'index.html').write_text(wrap(h))


def ads(src, assets):
    h = Path(src).read_text()
    h = drop_nav(h)
    # stav áut z adminu: predané označíme a dáme na koniec
    h = h.replace("let status = {}, filter = 'all'", "let status = {}, soldSet = new Set(), filter = 'all'")
    h = h.replace("const list = CARS.filter(", "const list = CARS.slice().sort((a,b) => soldSet.has(a.id) - soldSet.has(b.id)).filter(")
    h = h.replace('''<span class="pill ${on?'on':''}">${on?'Zverejnené':'Pripravené'}</span>''',
                  '''<span class="pill ${on?'on':''}${soldSet.has(c.id)?' sold':''}">${soldSet.has(c.id)?'Predané':on?'Zverejnené':'Pripravené'}</span>''')
    h = h.replace('<article class="card" data-id="${c.id}">', '<article class="card${soldSet.has(c.id)?\' is-sold\':\'\'}${c.id===hlId?\' hl\':\'\'}" data-id="${c.id}" id="c${c.id}">')
    h = h.replace('</style>', '.pill.sold{background:#3a1519;color:#f0616d}.card.is-sold .prev img{opacity:.45}.card.hl .prev{outline:3px solid var(--amber);outline-offset:3px}\n</style>', 1)
    hook = "else db.collection('reklamy').onSnapshot("
    assert hook in h, 'ads: hook missing'
    h = h.replace(hook, "else { db.collection('inzeraty').onSnapshot(s => { soldSet = new Set(s.docs.map(d => d.data()).filter(r => r.status === 'predany').map(r => String(r.adId))); render(); jump(); }, () => {}); }\n  if (db) db.collection('reklamy').onSnapshot(", 1)
    h = h.replace("render();\n(async () => {", '''let jumped = false, hlId = null;
function jump(){ const id = decodeURIComponent(location.hash.slice(1)); if (!id || jumped) return; const el = document.getElementById('c' + id);
  if (!el){ if (CARS.length && !CARS.some(c => c.id === id)) { jumped = true; toast('K tomuto autu ešte reklama nie je'); } return; }
  jumped = true; hlId = id; el.classList.add('hl'); el.scrollIntoView({block:'center'}); }
addEventListener('hashchange', () => { jumped = false; hlId = null; document.querySelectorAll('.card.hl').forEach(x => x.classList.remove('hl')); jump(); });
render(); jump();
(async () => {''', 1)
    h = h.replace("Stav „Zverejnené“ sa tu nedá uložiť – otvor stránku prihlásený v Claude.", 'Stav „Zverejnené“ sa nepodarilo načítať. Obnovte stránku.')
    d = OUT / 'reklamy'
    d.mkdir(parents=True, exist_ok=True)
    (d / 'index.html').write_text(wrap(h))
    if Path(assets).resolve() == d.resolve():
        return
    for sub in ('r', 't', 'v'):
        s, t = Path(assets) / sub, d / sub
        t.mkdir(exist_ok=True)
        for f in s.iterdir():
            dst = t / f.name
            if not dst.exists() or dst.stat().st_size != f.stat().st_size:
                shutil.copy2(f, dst)


if __name__ == '__main__':
    a = sys.argv[1:] or [str(ROOT / 'src/admin.html'), str(ROOT / 'src/ads.html'), str(OUT / 'reklamy')]
    admin(a[0]); ads(a[1], a[2])
    print('ok')
