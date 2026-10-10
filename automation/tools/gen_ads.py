"""Splatkuj.sk – generátor reklám (story 1080x1920 + post 1080x1350) pre každé auto.
Použitie: python3 gen_ads.py [id ...]   (bez argumentov = všetky autá z data/all.json)
"""
import json, re, sys, pathlib, html
from playwright.sync_api import sync_playwright

import os
ROOT = pathlib.Path(os.environ.get('SK_ROOT','/tmp/sk'))
OUT = ROOT / 'ads' / 'out'; OUT.mkdir(parents=True, exist_ok=True)
BID = {'cupra': '196254307', 'tesla': '195922384', 'superb': '195898559', 'santafe': '195044448',
       'sportline': '195817373', 'tiguan': '194599121'}
PHONE = '0903 427 088'
DOWN, MONTHS, RATE = 0, 96, 9.9
PICKS = json.load(open(ROOT / 'data' / 'picks.json'))

def money(n): return f"{round(n):,}".replace(',', ' ')
def calc(price):
    loan = price * (1 - DOWN / 100); r = RATE / 100 / 12
    m = loan * r / (1 - (1 + r) ** -MONTHS)
    rpmn = ((1 + r) ** 12 - 1) * 100
    return dict(m=m, loan=loan, down=price - loan, total=price - loan + m * MONTHS, rpmn=rpmn)

# (regex, titulok, podtitulok) – poradie = priorita
FEATS = [
    (r'matrix', 'Matrix LED', 'svetlomety'), (r'full.?led|led svetl|adaptívne led|led svetlomet', 'LED svetlá', 'moderné osvetlenie'),
    (r'360', '360° senzory', 'kamery / parkovanie'), (r'samoparkov|parkovací asistent|park assist', 'Park assist', 'samoparkovanie'),
    (r'kamer', 'Kamera', 'parkovacia'), (r'\bacc\b|adaptívny tempomat|adaptívn\w* tempomat', 'ACC', 'adaptívny tempomat'),
    (r'virtual|digitáln\w* (štít|kokpit|cockpit)', 'Virtual cockpit', 'digitálny štít'),
    (r'lane|jazdných pruh|asistent v pruhu', 'Lane assist', 'asistent v pruhu'),
    (r'vyhrievan\w* (predn\w* )?sedad|vyhrievan\w* volant', 'Vyhrievané', 'sedadlá / volant'),
    (r'kessy|keyless|bezkľúč', 'Keyless', 'bezkľúčový prístup'), (r'panoram|strešné okno|šíber', 'Panoráma', 'strešné okno'),
    (r'ťažn', 'Ťažné', 'zariadenie'), (r'navig', 'Navigácia', 'v palubnom systéme'),
    (r'carplay|android auto', 'CarPlay', 'Android Auto'), (r'tepeln\w* čerpad', 'Tepelné čerpadlo', 'úsporné kúrenie'),
    (r'4x4|xdrive|quattro|4motion|awd', '4x4', 'pohon všetkých kolies'), (r'kož', 'Koža', 'interiér'),
    (r'head.?up', 'Head-up', 'displej'), (r'canton|beats|harman|bang|b&o|burmester', 'Prémiové audio', 'ozvučenie'),
    (r'klím', 'Klimatizácia', 'automatická'), (r'servis', 'Servisná história', 'podľa predajcu'),
    (r'1\.?\s?majiteľ|prvý majiteľ', '1. majiteľ', 'podľa predajcu'),
]
BENEFITS = [('Úver online', 'bez návštevy bazára'), ('Celé Slovensko', 'vybavíme kdekoľvek'), ('Rýchle schválenie', 'odpoveď do 24 h')]

def features(c):
    txt = ' '.join([c.get('title', ''), c.get('desc', ''), ' '.join(c.get('tags', [])), ' '.join(c.get('eq', []))]).lower()
    out = []
    for rx, a, b in FEATS:
        if re.search(rx, txt) and a not in [x[0] for x in out]:
            out.append((a, b))
        if len(out) == 6: break
    if len(out) < 3: out = out[:0]
    out = out[:3] if len(out) < 6 else out
    return out + BENEFITS

def split_title(t):
    w = t.split()
    n = 3 if len(w) > 2 and len(w[2]) <= 2 else 2
    return ' '.join(w[:n]), ' '.join(w[n:])

def cap(t):
    w = t.split(' ', 1)
    return w[0].upper() + (' ' + w[1] if len(w) > 1 else '')

def specs(c):
    yr = re.sub(r'^\d+/', '', c.get('year', '') or '—')
    km = (c.get('km') or '—').replace(' km', '')
    pw = c.get('power') or '—'
    kw = re.match(r'(\d+)', pw); hp = f"{round(int(kw.group(1)) * 1.36)} k" if kw else 'výkon'
    gear = c.get('gear') or '—'; g = 'Automat' if 'utomat' in gear or 'DSG' in gear else ('Manuál' if 'anu' in gear else gear)
    return [(yr, 'rok'), (km, 'km'), (pw, hp), (g, 'prevodovka'), (c.get('fuel') or '—', 'palivo')]

MARK = '''<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="18" fill="#16B57F"/><g transform="translate(8.5 9) scale(.72)">
<path d="M14 52 H38 A10 10 0 0 0 38 32 H26 A10 10 0 0 1 26 12 H44" fill="none" stroke="#0d0f13" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/>
<path d="M45 3.5 L60 12 L45 20.5 Z" fill="#0d0f13" stroke="#0d0f13" stroke-width="4" stroke-linejoin="round"/>
<path d="M14 52 H38 A10 10 0 0 0 38 32 H26 A10 10 0 0 1 26 12 H38" fill="none" stroke="#16B57F" stroke-width="2.6" stroke-dasharray="4 5" stroke-linecap="round"/></g></svg>'''
FONTDIR = pathlib.Path(__file__).resolve().parent
UFONT = "@font-face{font-family:'Unbounded';font-weight:800;src:url(" + (FONTDIR/'unbounded-800.woff2').as_uri() + ")}@font-face{font-family:'Unbounded';font-weight:800;src:url(" + (FONTDIR/'unbounded-800-ext.woff2').as_uri() + ");unicode-range:U+0100-024F}"

def page(c, story):
    w, h = 1080, (1920 if story else 1350)
    bid = BID.get(c['id'], c['id']); E = html.escape
    hq = lambda n: (ROOT / 'img' / 'hq' / f'{bid}-{n}.jpg').as_uri()
    pp = lambda n: (ROOT / 'img' / 'p' / f'{bid}-{n}.jpg').as_uri()
    PK = PICKS.get(bid, [1, 4, 8, 10])
    k = calc(c['price']); t1, t2 = split_title(c['title'])
    sub = c.get('sub') or ''
    hero = 1000 if story else 720
    fe = features(c)
    tsize = 112 if len(t1) <= 13 else (96 if len(t1) <= 16 else 82)
    if not story: tsize = int(tsize * .8)
    css = UFONT + f"""
*{{box-sizing:border-box;margin:0;padding:0}}
body{{width:{w}px;height:{h}px;overflow:hidden;display:flex;flex-direction:column;font-family:'Poppins',sans-serif;background:#0d0f13;color:#fff;position:relative}}
:root{{--acc:#14B47E;--acc2:#45D99B;--mut:#9aa3b2}}
.hero{{position:absolute;inset:0 0 auto 0;height:{hero}px;background:url({hq(PK[0])}) center 62%/cover}}
.hero:after{{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(13,15,19,.88) 0%,rgba(13,15,19,0) 24%,rgba(13,15,19,0) 50%,#0d0f13 97%)}}
.top{{position:absolute;top:{70 if story else 46}px;left:60px;right:60px;display:flex;justify-content:space-between;align-items:center;z-index:2}}
.brand{{display:flex;align-items:center;gap:16px}} .brand svg{{width:62px;height:62px}}
.brand b{{display:block;font-family:'Unbounded',sans-serif;font-weight:800;font-size:38px;letter-spacing:-1.5px;line-height:1}} .brand b i{{font-style:normal;color:#16B57F}}
.brand small{{display:block;font-size:13px;letter-spacing:4px;color:var(--mut);margin-top:6px;font-weight:600}}
.tag{{font-size:21px;font-weight:600;padding:11px 24px;border:2px solid var(--acc);border-radius:40px;color:var(--acc);background:rgba(13,15,19,.55)}}
.wrap{{position:relative;margin:{hero - 360 if story else hero - 300}px 60px 0;z-index:2}}
h1{{font-size:{tsize}px;line-height:.95;font-weight:800;letter-spacing:-2px;text-shadow:0 4px 30px rgba(0,0,0,.5)}}
h1 small{{display:block;font-size:{34 if story else 27}px;font-weight:500;letter-spacing:0;text-transform:none;color:#c3c9d4;margin-top:14px;line-height:1.25}}
.pay{{margin-top:{38 if story else 24}px;display:flex;border-radius:28px;overflow:hidden;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#03140D;box-shadow:0 30px 60px -20px rgba(20,180,126,.45)}}
.pay .l{{padding:{30 if story else 22}px 36px;flex:1}}
.pay .k{{font-size:23px;font-weight:600;text-transform:uppercase;letter-spacing:2px}}
.pay .v{{font-size:{150 if story else 116}px;font-weight:800;line-height:1;letter-spacing:-4px;white-space:nowrap}}
.pay .v sup{{font-size:.36em;letter-spacing:0;vertical-align:.95em;margin-left:8px}}
.pay .v em{{font-style:normal;font-size:.26em;letter-spacing:0;font-weight:600}}
.pay .r{{background:#111;color:#fff;padding:0 34px;display:flex;flex-direction:column;justify-content:center;gap:6px;min-width:300px}}
.pay .r span{{font-size:20px;color:var(--mut)}} .pay .r b{{font-size:44px;font-weight:700;white-space:nowrap}}
.specs{{display:flex;gap:12px;margin-top:{32 if story else 20}px}}
.spec{{flex:1;min-width:0;background:#171a21;border:1px solid #262b35;border-radius:18px;padding:16px 8px;text-align:center}}
.spec b{{display:block;font-size:{27 if story else 24}px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}} .spec span{{font-size:18px;color:var(--mut)}}
.feats{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:{28 if story else 16}px}}
.feat{{border-left:4px solid var(--acc);background:#14171d;padding:14px 18px;border-radius:0 14px 14px 0;min-width:0}}
.feat b{{display:block;font-size:24px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}} .feat span{{font-size:17px;color:var(--mut)}}
.feat.sv{{border-left-color:#3a4150}}
.gal{{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:{24 if story else 18}px;height:{(400 if len(fe) <= 3 else 230) if story else 190}px}}
.gal div{{border-radius:18px;background-size:cover;background-position:center}}
.foot{{margin:auto 60px 0;padding:22px 0 {44 if story else 26}px;position:relative;z-index:2}}
.cta{{display:flex;justify-content:space-between;align-items:center}}
.cta .ok{{font-size:21px;font-weight:500;color:var(--mut);line-height:1.35}} .cta .ok b{{color:#fff}}
.cta .ph{{background:#fff;color:#111;padding:16px 32px;border-radius:50px;font-size:34px;font-weight:700;white-space:nowrap}}
.fn{{font-family:'Inter',sans-serif;font-size:13px;color:#6b7280;margin-top:16px;line-height:1.4}}
"""
    if not story: fe = fe[:3]
    feats = ''.join(f'<div class="feat{" sv" if (a, b) in BENEFITS else ""}"><b>{E(a)}</b><span>{E(b)}</span></div>' for a, b in fe)
    sp = ''.join(f'<div class="spec"><b>{E(a)}</b><span>{E(b)}</span></div>' for a, b in specs(c))
    gal = ''.join(f'<div style="background-image:url({pp(n)})"></div>' for n in PK[1:4])
    fn = (f"Reprezentatívny príklad: cena vozidla {money(c['price'])} €, akontácia {DOWN} % ({money(k['down'])} €), výška úveru {money(k['loan'])} €, "
          f"doba splácania {MONTHS} mes., mesačná splátka {money(k['m'])} €, úroková sadzba {str(RATE).replace('.', ',')} % p.a., "
          f"RPMN {k['rpmn']:.2f} %, celková splatná suma {money(k['total'])} €. Informatívny výpočet bez poplatkov, nie je záväznou ponukou.").replace('.', ',', 0)
    fn = fn.replace(f"{k['rpmn']:.2f}", f"{k['rpmn']:.2f}".replace('.', ','))
    body = f"""<div class="hero"></div>
<div class="top"><div class="brand">{MARK}<div><b>splatkuj<i>.sk</i></b></div></div><div class="tag">✓ Od 0 % akontácie</div></div>
<div class="wrap"><h1>{E(cap(t1))}<small>{E(t2 + (' · ' if t2 and sub else '') + sub)}</small></h1>
<div class="pay"><div class="l"><div class="k">Mesačná splátka už od</div><div class="v">{money(k['m'])}<sup>€</sup><em> / mes.</em></div></div>
<div class="r"><span>alebo cena</span><b>{money(c['price'])} €</b><span>akontácia od {DOWN} %</span></div></div>
<div class="specs">{sp}</div><div class="feats">{feats}</div><div class="gal">{gal}</div></div>
<div class="foot"><div class="cta"><div class="ok">Úver vybavíme <b>online</b><br>po celom Slovensku</div><div class="ph">📞 {PHONE}</div></div><div class="fn">{fn}</div></div>"""
    return f"""<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&family=Inter:wght@400&family=Archivo:wdth,wght@125,800&display=swap" rel="stylesheet">
<style>{css}</style></head><body>{body}</body></html>"""

def main(ids):
    cars = json.load(open(ROOT / 'data' / 'all.json'))
    if ids: cars = [c for c in cars if c['id'] in ids or BID.get(c['id']) in ids]
    with sync_playwright() as p:
        b = p.chromium.launch()
        for c in cars:
            bid = BID.get(c['id'], c['id'])
            for story in (True, False):
                pg = b.new_page(viewport={'width': 1080, 'height': 1920 if story else 1350})
                f = OUT / f"{bid}-{'story' if story else 'post'}.html"; f.write_text(page(c, story))
                pg.goto(f.as_uri()); pg.wait_for_load_state('networkidle'); pg.wait_for_timeout(300)
                pg.screenshot(path=str(f.with_suffix('.jpg')), type='jpeg', quality=90); pg.close(); f.unlink()
        b.close()
    print(len(cars))

if __name__ == '__main__': main(sys.argv[1:])
