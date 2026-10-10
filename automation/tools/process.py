#!/usr/bin/env python3
"""Splatkuj – automatické spracovanie nových a predaných áut.
Spúšťa sa v pracovnom priečinku SK_ROOT (default /tmp/sk), kde sú:
  web.html, gallery.html, data/all.json, data/why.json, data/picks.json,
  img/hq/<id>-<n>.jpg   (fotky nových áut z Bazoša, bez ružových okrajov)
  new.json   [{id,title,sub,price,year,km,power,fuel,gear,drive,tags,desc,loc,url,seller,why,picks:[f,w,s,k],webPhotos:[5 čísel]}]
  sold.json  ["adId", ...]   – autá, ktoré treba stiahnuť z webu a galérie
  prices.json {"adId": novaCena, ...} – autá so zmenenou cenou (prepíše sa na webe, v galérii aj v dátach)
Výstup: out/web/…, out/gal/…, out/admin/<id>.jpg a out/publish.json (čo publikovať / zmazať).
"""
import json, os, re, sys, glob, shutil, subprocess
from PIL import Image

ROOT = os.environ.get('SK_ROOT', '/tmp/sk'); os.environ['SK_ROOT'] = ROOT
TK = os.path.dirname(os.path.abspath(__file__))
J = lambda p: json.load(open(os.path.join(ROOT, p)))
def W(p, d): json.dump(d, open(os.path.join(ROOT, p), 'w'), ensure_ascii=False)
WEBN = [1, 2, 3, 4, 8]
R = 0.099 / 12
pay = lambda p: round(p * R / (1 - (1 + R) ** -96))

new = J('new.json') if os.path.exists(f'{ROOT}/new.json') else []
sold = J('sold.json') if os.path.exists(f'{ROOT}/sold.json') else []
prices = {str(k): int(v) for k, v in (J('prices.json') if os.path.exists(f'{ROOT}/prices.json') else {}).items()}
for d in ('out/web/img/p', 'out/gal/r', 'out/gal/t', 'out/gal/v', 'out/admin', 'img/p', 'ads/out', 'ads/video'):
    os.makedirs(f'{ROOT}/{d}', exist_ok=True)

# 1) pečiatka Splatkuj na fotky
B = Image.open(f'{TK}/badge.png').convert('RGBA')
def stamp(src, dst):
    im = Image.open(src).convert('RGB'); s = max(im.size) / 1200
    bw = round(330 * s); bh = round(B.height * bw / B.width); b = B.resize((bw, bh), Image.LANCZOS); m = round(6 * s)
    im.paste(b, (im.width - bw - m, im.height - bh - m), b); im.save(dst, quality=82, optimize=True, progressive=True)
for f in glob.glob(f'{ROOT}/img/hq/*.jpg'):
    stamp(f, f'{ROOT}/img/p/' + os.path.basename(f))

# 2) dáta
cars = J('data/all.json'); why = J('data/why.json'); picks = J('data/picks.json')
ids = {c['id'] for c in cars}
web_new = []
for c in new:
    i = c['id']
    why[i] = c.get('why', ''); picks[i] = c['picks']
    car = {k: c.get(k) for k in ('id', 'title', 'sub', 'price', 'year', 'km', 'power', 'fuel', 'gear', 'drive', 'tags', 'desc', 'loc', 'url', 'seller')}
    car.update(photos=5, eq=[]); car['tags'] = car['tags'] or []
    if i not in ids: cars.append(car)
    web_new.append(car)
    for k, n in enumerate(c['webPhotos'][:5]):
        shutil.copy(f'{ROOT}/img/p/{i}-{n}.jpg', f'{ROOT}/out/web/img/p/{i}-{WEBN[k]}.jpg')
    a = Image.open(f'{ROOT}/img/p/{i}-{c["picks"][0]}.jpg').convert('RGB'); a.thumbnail((720, 720)); a.save(f'{ROOT}/out/admin/{i}.jpg', quality=78)
cars = [c for c in cars if c['id'] not in sold]
for c in cars:
    if c['id'] in prices: c['price'] = prices[c['id']]
W('data/all.json', cars); W('data/why.json', why); W('data/picks.json', picks)

# 3) reklamy + videá pre nové autá
nid = [c['id'] for c in new]
if nid:
    subprocess.run([sys.executable, f'{TK}/gen_ads.py', *nid], check=True, cwd=ROOT)
    for i in nid:
        subprocess.run([sys.executable, f'{TK}/video.py', i], check=True, cwd=ROOT)
        for f in ('post', 'story'):
            src = f'{ROOT}/ads/out/{i}-{f}.jpg'; shutil.copy(src, f'{ROOT}/out/gal/r/{i}-{f}.jpg')
            t = Image.open(src); t.thumbnail((420, 760)); t.convert('RGB').save(f'{ROOT}/out/gal/t/{i}-{f}.jpg', quality=80)
        shutil.copy(f'{ROOT}/ads/video/{i}-video.mp4', f'{ROOT}/out/gal/v/{i}.mp4')

# 4) galéria reklám
g = open(f'{ROOT}/gallery.html').read()
m = re.search(r'const CARS = (\[.*?\]);\n', g); gc = json.loads(m.group(1))
gc = [c for c in gc if c['id'] not in sold and c['id'] not in nid]
for c in gc:
    if c['id'] in prices: c['p'] = prices[c['id']]; c['m'] = pay(prices[c['id']])
for c in reversed(new):
    gc.insert(0, {"id": c['id'], "t": c['title'], "s": c['sub'], "p": c['price'], "m": pay(c['price']), "y": c['year'], "km": c['km'],
                  "kw": c.get('power', ''), "f": c.get('fuel', ''), "loc": c.get('loc', ''), "w": c.get('why', '')})
g = g[:m.start(1)] + json.dumps(gc, ensure_ascii=False, separators=(',', ':')) + g[m.end(1):]
open(f'{ROOT}/out/gal/index.html', 'w').write(g)

# 5) web
s = open(f'{ROOT}/web.html').read()
hm = re.search(r'const HIDE=new Set\((\[.*?\])\);', s)
hide = sorted(set(json.loads(hm.group(1))) | set(sold))
s = s[:hm.start(1)] + json.dumps(hide) + s[hm.end(1):]
# zmena ceny: auto môže byť vo webe pod číslom inzerátu alebo pod menom (BID={cupra:'1951…'})
bm = re.search(r'const BID=(\{.*?\});', s)
bid = {}
if bm:
    for k, v in re.findall(r"['\"]?([\w-]+)['\"]?\s*:\s*['\"](\d+)['\"]", bm.group(1)): bid.setdefault(v, []).append(k)
price_done = []
for i, p in prices.items():
    for key in [i] + bid.get(i, []):
        s, n = re.subn(r'(\{[^{}]*?["\']?id["\']?\s*:\s*["\']' + re.escape(key) + r'["\'][^{}]*?["\']?price["\']?\s*:\s*)\d+', lambda m: m.group(1) + str(p), s)
        if n: price_done.append(i); break
web_new = [c for c in web_new if f'"id": "{c["id"]}"' not in s and f'"id":"{c["id"]}"' not in s]
if web_new:
    k = s.index('  const BID={cupra'); k = s.rindex(';', 0, k)
    s = s[:k] + '.concat(' + json.dumps(web_new, ensure_ascii=False) + ')' + s[k:]
open(f'{ROOT}/out/web/index.html', 'w').write(s)

# 6) čo publikovať
pub = {"web": {}, "gal": {}, "admin": sorted(glob.glob(f'{ROOT}/out/admin/*.jpg'))}
for f in glob.glob(f'{ROOT}/out/web/img/p/*.jpg'): pub['web']['img/p/' + os.path.basename(f)] = f
for i in sold:
    for n in WEBN: pub['web'][f'img/p/{i}-{n}.jpg'] = None
for d in ('r', 't', 'v'):
    for f in glob.glob(f'{ROOT}/out/gal/{d}/*'): pub['gal'][f'{d}/' + os.path.basename(f)] = f
for i in sold:
    for x in ('r', 't'):
        for f in ('post', 'story'): pub['gal'][f'{x}/{i}-{f}.jpg'] = None
    pub['gal'][f'v/{i}.mp4'] = None
W('out/publish.json', pub)
print(json.dumps({"new": nid, "sold": sold, "prices": price_done, "prices_missing": [i for i in prices if i not in price_done], "web_files": len(pub['web']), "gal_files": len(pub['gal'])}))
