#!/usr/bin/env python3
"""Zostaví blog: blog/posts/*.md -> public/blog/index.html a public/blog/<slug>/index.html"""
import glob, os, re, html, datetime, markdown
from PIL import Image
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'blog', 'posts'); OUT = os.path.join(ROOT, 'public', 'blog')
HQ = '/home/claude/splatkuj/img/hq'
os.makedirs(os.path.join(OUT, 'img'), exist_ok=True)
FONT = "https://fonts.googleapis.com/css2?family=Unbounded:wght@800&family=Inter:wght@400;500;600;700;800&display=swap"
MARK = '<svg viewBox="0 0 64 64" width="38" height="38" aria-hidden="true"><rect width="64" height="64" rx="18" fill="#16B57F"/><g transform="translate(8.5 9) scale(.72)"><path d="M14 52 H38 A10 10 0 0 0 38 32 H26 A10 10 0 0 1 26 12 H44" fill="none" stroke="#0d0f13" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/><path d="M45 3.5 L60 12 L45 20.5 Z" fill="#0d0f13" stroke="#0d0f13" stroke-width="4" stroke-linejoin="round"/><path d="M14 52 H38 A10 10 0 0 0 38 32 H26 A10 10 0 0 1 26 12 H38" fill="none" stroke="#16B57F" stroke-width="2.6" stroke-dasharray="4 5" stroke-linecap="round"/></g></svg>'
CSS = """
:root{--ink:#0d0f13;--panel:#16181d;--panel2:#1d2027;--line:#2a2e37;--fg:#f3f4f6;--mut:#9ca2ad;--brand:#16B57F;--brand2:#45D99B;--on:#03140D;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--ink);color:var(--fg);font:17px/1.7 Inter,system-ui,sans-serif}
a{color:inherit}.wrap{max-width:1120px;margin:0 auto;padding-inline:20px}
header{border-bottom:1px solid var(--line)}header .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-block:16px;flex-wrap:wrap}
.logo{display:flex;align-items:center;gap:10px;text-decoration:none}.wm{font:800 22px/1 Unbounded,sans-serif;letter-spacing:-.04em}.wm i{font-style:normal;color:var(--brand)}
nav{display:flex;gap:18px;font-size:15px;font-weight:600;color:var(--mut)}nav a{text-decoration:none}nav a:hover,nav a[aria-current]{color:var(--fg)}
.cta{display:inline-block;background:var(--brand);color:var(--on);font-weight:800;text-decoration:none;padding:12px 20px;border-radius:999px;font-size:15px}
.hero{padding-block:56px 28px;text-align:center}.eyebrow{color:var(--brand2);font-size:13px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}
h1{font-size:clamp(30px,4.6vw,48px);line-height:1.1;margin:12px auto 12px;max-width:22ch;text-wrap:balance;letter-spacing:-.02em}
.lead{color:var(--mut);max-width:60ch;margin:0 auto}
.cats{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:26px 0 34px}.cats button{font:600 14px Inter,sans-serif;padding:9px 16px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--mut);cursor:pointer}
.cats button[aria-pressed=true]{background:var(--brand);color:var(--on);border-color:var(--brand)}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:26px;padding-bottom:70px}@media(max-width:900px){.grid{grid-template-columns:1fr 1fr}}@media(max-width:600px){.grid{grid-template-columns:1fr}}
.card{text-decoration:none;display:grid;gap:10px;align-content:start}.card img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:16px;background:var(--panel)}
.card .c{color:var(--brand2);font-size:13px;font-weight:700}.card h2{font-size:20px;line-height:1.3;margin:0}.card p{margin:0;color:var(--mut);font-size:15px;line-height:1.55}.card time{color:var(--mut);font-size:13px}
.card:hover h2{color:var(--brand2)}
article{max-width:720px;margin:0 auto;padding-block:40px 30px}article .cover{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:18px;margin:22px 0 10px}
article h1{text-align:left;margin:10px 0}article .meta{color:var(--mut);font-size:14px}
article h2{font-size:24px;line-height:1.25;margin:36px 0 10px}article p,article li{color:#d6d9df}article a{color:var(--brand2)}
article table{width:100%;border-collapse:collapse;margin:16px 0;font-size:15px}article th,article td{border-bottom:1px solid var(--line);padding:10px 8px;text-align:left}
.box{max-width:720px;margin:0 auto 70px;background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:24px;display:flex;gap:18px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.box b{font-size:19px;display:block}.box span{color:var(--mut);font-size:15px}
footer{border-top:1px solid var(--line);color:var(--mut);font-size:13px;padding-block:28px}
@media(max-width:600px){header .cta{display:none}}
"""
def head(title, desc, canon):
    return f'''<!doctype html><html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title><meta name="description" content="{html.escape(desc)}"><link rel="canonical" href="https://www.splatkuj.sk{canon}">
<meta property="og:title" content="{html.escape(title)}"><meta property="og:description" content="{html.escape(desc)}">
<link rel="icon" href="/favicon.svg"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="{FONT}"><style>{CSS}</style></head><body>
<header><div class="wrap"><a class="logo" href="/">{MARK}<span class="wm">splatkuj<i>.sk</i></span></a>
<nav><a href="/#ponuka">Ponuka</a><a href="/#kalkulacka">Kalkulačka</a><a href="/blog/" aria-current="page">Blog</a><a href="/#kontakt">Kontakt</a></nav>
<a class="cta" href="/#kalkulacka">Chcem auto na splátky</a></div></header>'''
FOOT = '<footer><div class="wrap">© 2026 Splatkuj.sk · Prevádzkovateľ: LPFinance s.r.o., IČO: 56022352 · <a href="/">Späť na web</a></div></footer></body></html>'
posts = []
for f in sorted(glob.glob(os.path.join(SRC, '*.md'))):
    raw = open(f, encoding='utf-8').read()
    m = re.match(r'---\n(.*?)\n---\n(.*)', raw, re.S); meta = dict(l.split(': ', 1) for l in m.group(1).splitlines()); body = m.group(2)
    slug = re.sub(r'^\d+-', '', os.path.basename(f)[:-3])
    cov = f'img/{slug}.jpg'
    src = os.path.join(HQ, meta['cover'] + '.jpg')
    if os.path.exists(src):
        im = Image.open(src).convert('RGB'); im.thumbnail((1400, 1400)); im.save(os.path.join(OUT, cov), quality=80, optimize=True, progressive=True)
    posts.append(dict(meta, slug=slug, cover=cov, body=markdown.markdown(body, extensions=['tables'])))
posts.sort(key=lambda p: p['date'], reverse=True)
skd = lambda d: '.'.join(str(int(x)) for x in reversed(d.split('-')))
for p in posts:
    d = os.path.join(OUT, p['slug']); os.makedirs(d, exist_ok=True)
    page = head(p['title'] + ' | Splatkuj.sk', p['excerpt'], f"/blog/{p['slug']}/") + f'''
<div class="wrap"><article><span class="eyebrow">{html.escape(p['category'])}</span><h1>{html.escape(p['title'])}</h1>
<div class="meta">Splatkuj.sk · <time datetime="{p['date']}">{skd(p['date'])}</time></div>
<img class="cover" src="../{p['cover']}" alt="">{p['body']}</article>
<div class="box"><div><b>Chcete vedieť, koľko by ste platili?</b><span>Vypočítajte si splátku alebo sa opýtajte Laury.</span></div><a class="cta" href="/#kalkulacka">Vypočítať splátku</a></div></div>''' + FOOT
    open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(page)
cats = sorted({p['category'] for p in posts})
cards = ''.join(f'''<a class="card" href="{p['slug']}/" data-cat="{html.escape(p['category'])}"><img src="{p['cover']}" alt="" loading="lazy"><span class="c">{html.escape(p['category'])}</span><h2>{html.escape(p['title'])}</h2><p>{html.escape(p['excerpt'])}</p><time datetime="{p['date']}">{skd(p['date'])}</time></a>''' for p in posts)
idx = head('Blog | Splatkuj.sk', 'Rady k financovaniu áut, kúpe ojazdených vozidiel a novinky zo sveta motorizmu.', '/blog/') + f'''
<div class="wrap"><div class="hero"><span class="eyebrow">Blog</span><h1>Rady, návody a novinky zo sveta áut</h1><p class="lead">Ako kúpiť auto na splátky výhodne, na čo si dať pozor pri ojazdenom aute a čo znamenajú pojmy z financovania.</p></div>
<div class="cats" role="group" aria-label="Kategórie"><button type="button" data-c="" aria-pressed="true">Všetko</button>{''.join(f'<button type="button" data-c="{html.escape(c)}" aria-pressed="false">{html.escape(c)}</button>' for c in cats)}</div>
<div class="grid">{cards}</div></div>
<script>document.querySelector('.cats').addEventListener('click',e=>{{const b=e.target.closest('button');if(!b)return;document.querySelectorAll('.cats button').forEach(x=>x.setAttribute('aria-pressed',x===b));document.querySelectorAll('.card').forEach(c=>c.hidden=b.dataset.c&&c.dataset.cat!==b.dataset.c);}});</script>''' + FOOT
open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(idx)
print(len(posts), 'článkov')
