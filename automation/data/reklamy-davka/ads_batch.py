#!/usr/bin/env python3
"""Reklamy pre autá, ktoré už sú na webe cez /api/ponuka (needsAds=true).
1) uloží fotky zo screenshotov (poradie = fullplan.json, súbor screenshot-*-<K0+j>.png)
2) pre autá s kompletnými fotkami vyrobí reklamy (post, story) a video, doplní galériu
3) skopíruje do repozitára (public/admin/reklamy, src/ads.html) a vypíše hotové id
usage: ads_batch.py <screens_dir> <k0> <j_from> <j_to>
"""
import json, os, sys, glob, re, shutil, subprocess
import numpy as np
from PIL import Image

ROOT = '/tmp/sk'; os.environ['SK_ROOT'] = ROOT
TK = f'{ROOT}/tools'; REPO = '/home/claude/splatkuj'
D, K0, J0, J1 = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
plan = json.load(open(f'{ROOT}/fullplan.json'))
picks = json.load(open(f'{ROOT}/picks_new.json'))
rows = {l.split('¦')[0]: l.split('¦') for l in open(f'{ROOT}/pending.tsv').read().strip().split('\n')}
os.makedirs(f'{ROOT}/img/hq', exist_ok=True)
files = {int(f.rsplit('-', 1)[1][:-4]): f for f in glob.glob(D + '/screenshot-*.png')}
pink = lambda a: (a[..., 0] > 150) & (a[..., 2] > 150) & (a[..., 1] < a[..., 0] - 50) & (a[..., 1] < a[..., 2] - 50)
bad = []
for j in range(J0, J1):
    i, n = plan[j]; f = files.get(K0 + j)
    if not f: bad.append((i, n, 'chýba súbor')); continue
    im = Image.open(f).convert('RGB'); a = np.asarray(im).astype(int); m = pink(a)
    rws = np.where(m.mean(1) < 0.5)[0]; cls = np.where(m.mean(0) < 0.5)[0]
    if not len(rws) or not len(cls): bad.append((i, n, 'prázdne')); continue
    im = im.crop((cls[0] + 2, rws[0] + 2, cls[-1] - 2, rws[-1] - 2))
    if max(im.size) < 400: bad.append((i, n, f'malé {im.size}')); continue
    im.save(f'{ROOT}/img/hq/{i}-{n}.jpg', quality=90)

# autá z tohto rozsahu, ktoré majú všetky 4 fotky
ids = []
for i in dict.fromkeys(p[0] for p in plan[J0:J1]):
    if all(os.path.exists(f'{ROOT}/img/hq/{i}-{n}.jpg') for n in picks[i]): ids.append(i)

R = 0.099 / 12
pay = lambda p: round(p * R / (1 - (1 + R) ** -96))
fmtkm = lambda n: (f'{int(n):,}'.replace(',', ' ') + ' km') if int(n or 0) else '—'
cars = json.load(open(f'{ROOT}/data/all.json')); have = {c['id'] for c in cars}
pk = json.load(open(f'{ROOT}/data/picks.json')); why = json.load(open(f'{ROOT}/data/why.json'))
new = []
for i in ids:
    r = rows[i]; _, title, price, year, km, kw, fuel, gear, drive, tags, w, loc, nph = r[:13]
    kw = int(kw or 0); price = int(price)
    car = {'id': i, 'title': title, 'sub': ' · '.join(x for x in [f'{kw} kW' if kw else '', fuel, gear] if x),
           'price': price, 'year': year or '—', 'km': fmtkm(km), 'power': f'{kw} kW' if kw else '—', 'fuel': fuel or '—',
           'gear': gear or '—', 'drive': drive or '—', 'tags': [t for t in tags.split('|') if t], 'desc': '', 'loc': loc,
           'url': '', 'seller': '', 'photos': 4, 'eq': [], 'ap': True}
    if i not in have: cars.append(car); have.add(i)
    pk[i] = picks[i]; why[i] = w; new.append(car)
json.dump(cars, open(f'{ROOT}/data/all.json', 'w'), ensure_ascii=False)
json.dump(pk, open(f'{ROOT}/data/picks.json', 'w'), ensure_ascii=False)
json.dump(why, open(f'{ROOT}/data/why.json', 'w'), ensure_ascii=False)

if ids:
    subprocess.run([sys.executable, f'{TK}/gen_ads.py', *ids], check=True, cwd=ROOT, stdout=subprocess.DEVNULL)
    for i in ids:
        subprocess.run([sys.executable, f'{TK}/video.py', i], check=True, cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    G = f'{REPO}/public/admin/reklamy'
    for i in ids:
        for f in ('post', 'story'):
            src = f'{ROOT}/ads/out/{i}-{f}.jpg'; os.makedirs(f'{G}/r', exist_ok=True); os.makedirs(f'{G}/t', exist_ok=True)
            shutil.copy(src, f'{G}/r/{i}-{f}.jpg')
            t = Image.open(src); t.thumbnail((420, 760)); t.convert('RGB').save(f'{G}/t/{i}-{f}.jpg', quality=80)
        os.makedirs(f'{G}/v', exist_ok=True); shutil.copy(f'{ROOT}/ads/video/{i}-video.mp4', f'{G}/v/{i}.mp4')
    # galéria (src/ads.html)
    p = f'{REPO}/src/ads.html'; g = open(p).read()
    m = re.search(r'const CARS = (\[.*?\]);\n', g); gc = json.loads(m.group(1))
    gc = [c for c in gc if c['id'] not in ids]
    for c in reversed(new):
        gc.insert(0, {"id": c['id'], "t": c['title'], "s": c['sub'], "p": c['price'], "m": pay(c['price']), "y": c['year'], "km": c['km'],
                      "kw": c['power'] if c['power'] != '—' else '', "f": c['fuel'], "loc": c['loc'], "w": why.get(c['id'], '')})
    open(p, 'w').write(g[:m.start(1)] + json.dumps(gc, ensure_ascii=False, separators=(',', ':')) + g[m.end(1):])
    # dáta automatiky do repozitára
    for f in ('all.json', 'picks.json', 'why.json'): shutil.copy(f'{ROOT}/data/{f}', f'{REPO}/automation/data/{f}')
print(json.dumps({'done': ids, 'bad': bad, 'gallery': len(gc) if ids else None}, ensure_ascii=False))
