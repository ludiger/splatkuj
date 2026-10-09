#!/usr/bin/env python3
"""Prenesie výstup automatiky (process.py → out/) do repozitára a zostaví web aj admin.

python3 tools/sync_repo.py /tmp/sk/out
- out/web/index.html  -> src/web.html  -> public/index.html
- out/publish.json web -> public/<cesta>  (null = zmazať)
- out/gal/index.html  -> src/ads.html  -> public/admin/reklamy/index.html
- out/publish.json gal -> public/admin/reklamy/<cesta>  (null = zmazať)
"""
import json, shutil, subprocess, sys
from pathlib import Path

R = Path(__file__).resolve().parent.parent
out = Path(sys.argv[1])
pub = json.loads((out / 'publish.json').read_text())

def apply(mapping, base):
    n = 0
    for rel, src in mapping.items():
        dst = base / rel
        if src is None:
            if dst.exists(): dst.unlink(); n += 1
        else:
            dst.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(src, dst); n += 1
    return n

if (out / 'web/index.html').exists():
    shutil.copy2(out / 'web/index.html', R / 'src/web.html')
if (out / 'gal/index.html').exists():
    shutil.copy2(out / 'gal/index.html', R / 'src/ads.html')
w = apply(pub.get('web', {}), R / 'public')
g = apply(pub.get('gal', {}), R / 'public/admin/reklamy')
subprocess.run([sys.executable, str(R / 'build.py')], check=True)
subprocess.run([sys.executable, str(R / 'build_admin.py')], check=True)
print(json.dumps({'web_files': w, 'ads_files': g}))
