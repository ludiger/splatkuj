#!/usr/bin/env python3
"""Video prezentácia 1080x1920 (Reels/TikTok/Stories) z fotiek auta.
usage: video.py <car_id> [<car_id> ...]   (car_id ako v data/all.json)"""
import json, os, sys, subprocess, tempfile, shutil
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.environ.get('SK_ROOT','/tmp/sk')
BID = {'cupra':'196254307','tesla':'195922384','superb':'195898559','santafe':'195044448','sportline':'195817373','tiguan':'194599121'}
PN = [1, 2, 3, 4, 8, 10]
W, H, FPS = 1080, 1920, 30
ACC, ACC2, DARK = (20,180,126), (69,217,155), (3,20,13)
F = '/usr/share/fonts/truetype/google-fonts/Poppins-'
def font(w, s): return ImageFont.truetype(F + {'SemiBold':'Bold','ExtraBold':'Bold'}.get(w, w) + '.ttf', s)

def monthly(p, n=96, rate=9.9):
    r = rate / 1200
    return round(p * r / (1 - (1 + r) ** -n))

def fmt(n): return f'{n:,}'.replace(',', ' ')

def band(car):
    """priehľadná vrstva: logo hore, model + splátka dole"""
    o = Image.new('RGBA', (W, H), (0,0,0,0)); d = ImageDraw.Draw(o)
    # gradienty pre čitateľnosť
    for y in range(420):
        a = int(170 * (1 - y / 420)); d.line([(0, y), (W, y)], fill=(5,8,10,a))
    for y in range(760):
        a = int(235 * (y / 760) ** 1.3); d.line([(0, H-760+y), (W, H-760+y)], fill=(5,8,10,a))
    lg = Image.open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logo_white.png')).convert('RGBA')
    o.alpha_composite(lg, (60, 80))
    # pill
    t = 'Od 0 % akontácie'; f = font('SemiBold', 30); pw = d.textlength(t, font=f) + 56
    d.rounded_rectangle([W-64-pw, 92, W-64, 152], 30, outline=ACC2, width=3)
    d.text((W-64-pw+28, 101), t, font=f, fill=ACC2)
    # titulok
    y = H - 600
    title = car['title']; f = font('Bold', 74)
    while d.textlength(title, font=f) > W - 128 and f.size > 46: f = font('Bold', f.size - 4)
    d.text((64, y), title, font=f, fill='white')
    d.text((64, y + f.size + 18), f"{car['year']} · {car['km']} · {car['power']} · {car['fuel']}", font=font('Medium', 34), fill=(200,205,212))
    # splátka box
    by = H - 380
    d.rounded_rectangle([64, by, W-64, by+230], 36, fill=ACC)
    d.text((104, by+28), 'MESAČNÁ SPLÁTKA UŽ OD', font=font('SemiBold', 28), fill=DARK)
    m = f"{monthly(car['price'])} €"; fm = font('ExtraBold', 116)
    d.text((100, by+56), m, font=fm, fill=DARK)
    d.text((110 + d.textlength(m, font=fm), by+122), '/ mes.', font=font('Bold', 44), fill=DARK)
    d.text((W-104, by+64), 'cena', font=font('Medium', 28), fill=DARK, anchor='ra')
    d.text((W-104, by+100), f"{fmt(car['price'])} €", font=font('Bold', 46), fill=DARK, anchor='ra')
    d.text((64, H-120), 'Úver vybavíme online · celé Slovensko · 0903 427 088', font=font('Medium', 30), fill=(220,224,230))
    return o

def frame_src(path):
    """fotka na 9:16: rozmazané pozadie + fotka na šírku"""
    im = Image.open(path).convert('RGB')
    bg = im.copy(); s = max(W / bg.width, H / bg.height)
    bg = bg.resize((int(bg.width*s)+1, int(bg.height*s)+1)).crop((0,0,W,H)).filter(ImageFilter.GaussianBlur(40))
    bg = Image.eval(bg, lambda v: int(v * .45))
    FW = W - 90; s = FW / im.width; fg = im.resize((FW, int(im.height * s)), Image.LANCZOS)
    if fg.height > H * .6: fg = fg.crop((0, (fg.height - int(H*.6))//2, FW, (fg.height - int(H*.6))//2 + int(H*.6)))
    mk = Image.new('L', fg.size, 0); ImageDraw.Draw(mk).rounded_rectangle([0,0,fg.width-1,fg.height-1], 28, fill=255)
    bg.paste(fg, (45, int(H*.42 - fg.height/2)), mk)
    return bg

def build(cid):
    cars = {c['id']: c for c in json.load(open(f'{ROOT}/data/all.json'))}
    car = cars[cid]; bid = BID.get(cid, cid)
    tmp = tempfile.mkdtemp(); ov = band(car)
    PK = json.load(open(f'{ROOT}/data/picks.json')).get(bid, PN)
    order = PK + [n for n in PN if n not in PK]
    photos = [f'{ROOT}/img/hq/{bid}-{n}.jpg' for n in order if os.path.exists(f'{ROOT}/img/hq/{bid}-{n}.jpg')][:6]
    story = f'{ROOT}/ads/out/{bid}-story.jpg'
    segs = []
    # 1) úvodná karta = story reklama (2.5 s)
    if os.path.exists(story):
        Image.open(story).convert('RGB').resize((W, H), Image.LANCZOS).save(f'{tmp}/s0.jpg', quality=92)
        segs.append((f'{tmp}/s0.jpg', 2.5, 'still'))
    for i, p in enumerate(photos):
        b = frame_src(p); b.paste(ov, (0,0), ov); b.save(f'{tmp}/p{i}.jpg', quality=92)
        segs.append((f'{tmp}/p{i}.jpg', 2.2, 'in' if i % 2 == 0 else 'out'))
    if os.path.exists(story): segs.append((f'{tmp}/s0.jpg', 3.0, 'still'))
    # ffmpeg: každý segment zoompan, potom xfade
    inputs, filt = [], []
    for k, (f, dur, mode) in enumerate(segs):
        n = int(dur * FPS)
        inputs += ['-i', f]
        z = {'in': f"min(1+0.06*on/{n},1.06)", 'out': f"max(1.06-0.06*on/{n},1.0)", 'still': '1'}[mode]
        filt.append(f"[{k}:v]scale=1620:2880,zoompan=z='{z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={n}:s={W}x{H}:fps={FPS},setsar=1,format=yuv420p[v{k}]")
    XF = 0.4; prev = 'v0'; off = segs[0][1] - XF
    for k in range(1, len(segs)):
        filt.append(f"[{prev}][v{k}]xfade=transition=fade:duration={XF}:offset={off:.2f}[x{k}]")
        prev = f'x{k}'; off += segs[k][1] - XF
    filt.append(f'[{prev}]scale=720:1280[vout]'); prev = 'vout'
    os.makedirs(f'{ROOT}/ads/video', exist_ok=True)
    out = f'{ROOT}/ads/video/{bid}-video.mp4'
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(filt), '-map', f'[{prev}]',
           '-c:v', 'libx264', '-preset', 'medium', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]
    subprocess.run(cmd, check=True); shutil.rmtree(tmp); print(out)

if __name__ == '__main__':
    for c in sys.argv[1:]: build(c)
