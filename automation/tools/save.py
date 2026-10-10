#!/usr/bin/env python3
"""Uloží fotky z Chrome screenshotov (zoom 735x735 s fotkou na ružovom pozadí).
usage: save.py <plan.json> <screenshot_dir> [start_index]
plan.json = [["adId", n], ...] v poradí, v akom sa robili zoomy; screenshoty sa berú podľa čísla na konci názvu."""
import sys, os, glob, json, numpy as np
from PIL import Image
ROOT = os.environ.get('SK_ROOT', '/tmp/sk'); os.makedirs(f'{ROOT}/img/hq', exist_ok=True)
plan = json.load(open(sys.argv[1])); D = sys.argv[2]
fs = sorted(glob.glob(D + '/screenshot-*.png'), key=lambda f: int(f.rsplit('-', 1)[1][:-4]))
start = int(sys.argv[3]) if len(sys.argv) > 3 else len(fs) - len(plan)
fs = fs[start:start + len(plan)]
pink = lambda a: (a[..., 0] > 150) & (a[..., 2] > 150) & (a[..., 1] < a[..., 0] - 50) & (a[..., 1] < a[..., 2] - 50)
for (i, n), f in zip(plan, fs):
    im = Image.open(f).convert('RGB'); a = np.asarray(im).astype(int); m = pink(a)
    rows = np.where(m.mean(1) < 0.15)[0]; cols = np.where(m.mean(0) < 0.15)[0]
    if len(rows) and len(cols): im = im.crop((cols[0] + 2, rows[0] + 2, cols[-1] - 2, rows[-1] - 2))
    im.save(f'{ROOT}/img/hq/{i}-{n}.jpg', quality=88); print(i, n, im.size)
