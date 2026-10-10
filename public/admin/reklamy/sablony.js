// Splatkuj.sk – šablóny reklám (príspevok 1080×1350, story 1080×1920) kreslené v prehliadači na <canvas>.
// Fotky idú zo zálohy /api/foto (rovnaký pôvod → canvas sa dá uložiť). Nič sa netvorí samo – len na pokyn v admine.
// Použitie: await SKAds.render(canvas, car, imgs, 'halloween', story)
//   car  = {title, sub, price, year, km, kw, power, fuel, gear, tags[], desc}
//   imgs = [hlavná, 3× galéria] – HTMLImageElement / ImageBitmap
(() => {
  const PHONE = '0903 427 088', DOWN = 0, MONTHS = 96, RATE = 9.9;
  const money = (n) => Math.round(n).toLocaleString('sk-SK').replace(/\s/g, ' ');
  const calc = (price) => { const loan = price * (1 - DOWN / 100), r = RATE / 100 / 12, m = loan * r / (1 - Math.pow(1 + r, -MONTHS));
    return { m, loan, down: price - loan, total: price - loan + m * MONTHS, rpmn: (Math.pow(1 + r, 12) - 1) * 100 }; };
  const FEATS = [
    [/matrix/, 'Matrix LED', 'svetlomety'], [/full.?led|led svetl|adaptívne led|led svetlomet/, 'LED svetlá', 'moderné osvetlenie'],
    [/360/, '360° senzory', 'kamery / parkovanie'], [/samoparkov|parkovací asistent|park assist/, 'Park assist', 'samoparkovanie'],
    [/kamer/, 'Kamera', 'parkovacia'], [/\bacc\b|adaptívn\S* tempomat/, 'ACC', 'adaptívny tempomat'],
    [/virtual|digitáln\S* (štít|kokpit|cockpit)/, 'Virtual cockpit', 'digitálny štít'], [/lane|jazdných pruh|asistent v pruhu/, 'Lane assist', 'asistent v pruhu'],
    [/vyhrievan\S* (predn\S* )?sedad|vyhrievan\S* volant/, 'Vyhrievané', 'sedadlá / volant'], [/kessy|keyless|bezkľúč/, 'Keyless', 'bezkľúčový prístup'],
    [/panoram|strešné okno|šíber/, 'Panoráma', 'strešné okno'], [/ťažn/, 'Ťažné', 'zariadenie'], [/navig/, 'Navigácia', 'v palubnom systéme'],
    [/carplay|android auto/, 'CarPlay', 'Android Auto'], [/tepeln\S* čerpad/, 'Tepelné čerpadlo', 'úsporné kúrenie'],
    [/4x4|xdrive|quattro|4motion|awd/, '4x4', 'pohon všetkých kolies'], [/kož/, 'Koža', 'interiér'], [/head.?up/, 'Head-up', 'displej'],
    [/canton|beats|harman|bang|b&o|burmester/, 'Prémiové audio', 'ozvučenie'], [/klím/, 'Klimatizácia', 'automatická'],
  ];
  const BENEFITS = [['Úver online', 'bez návštevy bazára'], ['Celé Slovensko', 'vybavíme kdekoľvek'], ['Rýchle schválenie', 'odpoveď do 24 h']];
  const features = (c) => { const t = [c.title, c.desc, (c.tags || []).join(' ')].join(' ').toLowerCase(); const o = [];
    for (const [rx, a, b] of FEATS) { if (rx.test(t) && !o.some((x) => x[0] === a)) o.push([a, b]); if (o.length === 3) break; }
    return o.length === 3 ? o : BENEFITS; };
  const splitTitle = (t) => { const w = String(t || '').split(' '); const n = w.length > 2 && w[2].length <= 2 ? 3 : 2; return [w.slice(0, n).join(' '), w.slice(n).join(' ')]; };
  const cap = (t) => { const i = t.indexOf(' '); return i < 0 ? t.toUpperCase() : t.slice(0, i).toUpperCase() + t.slice(i); };
  const specs = (c) => { const yr = String(c.year || '—').replace(/^\d+\//, ''); const km = String(c.km || '—').replace(/\s*km$/, '');
    const kw = parseInt(c.kw || c.power) || 0; const g = /utomat|DSG/i.test(c.gear || '') ? 'Automat' : /anu/i.test(c.gear || '') ? 'Manuál' : (c.gear || '—');
    return [[yr, 'rok'], [km, 'km'], [kw ? kw + ' kW' : '—', kw ? Math.round(kw * 1.36) + ' k' : 'výkon'], [g, 'prevodovka'], [c.fuel || '—', 'palivo']]; };

  // ---------- šablóny ----------
  // Farby značky (zelená #16B57F / #14B47E) ostávajú vo všetkých šablónach – sezónu robia ozdoby, nádych fotky (tint/glow) a texty.
  // bg = pozadie, tag = štítok vpravo hore, glow = farebný nádych, deco = ozdoby, hl = text v zelenom páse nad názvom
  const THEMES = {
    klasicka: { name: 'Klasická', bg: '#0d0f13', tag: '✓ Od 0 % akontácie', tagC: '#14B47E', glow: null, deco: null, pay: ['#14B47E', '#45D99B'], ink: '#03140D' },
    jesen: { name: 'Jeseň', bg: '#160f09', tag: '🍂 Jesenná ponuka', tagC: '#14B47E', glow: 'rgba(232,131,58,.20)', tint: 'rgba(120,60,10,.18)', deco: 'leaves', hl: 'Jeseň je čas na nové auto', pay: ['#14B47E', '#45D99B'], ink: '#03140D' },
    halloween: { name: 'Halloween', bg: '#100a18', tag: '🎃 Strašne dobré splátky', tagC: '#14B47E', glow: 'rgba(140,60,200,.26)', tint: 'rgba(70,20,110,.28)', deco: 'halloween', hl: 'Bez strašidelných poplatkov', pay: ['#14B47E', '#45D99B'], ink: '#03140D' },
    zima: { name: 'Zima', bg: '#0a1322', tag: '❄ Zimná ponuka', tagC: '#14B47E', glow: 'rgba(120,190,255,.18)', tint: 'rgba(40,90,160,.20)', deco: 'snow', hl: 'Do zimy v novom aute', pay: ['#14B47E', '#45D99B'], ink: '#03140D' },
    vianoce: { name: 'Vianoce', bg: '#0f1611', tag: '🎄 Vianočná ponuka', tagC: '#14B47E', glow: 'rgba(220,40,60,.18)', tint: 'rgba(120,10,20,.16)', deco: 'xmas', hl: 'Darček pod stromček na splátky', pay: ['#14B47E', '#45D99B'], ink: '#03140D' },
  };

  // ---------- kreslenie ----------
  const rr = (x, ctx, X, Y, W, H, r) => { ctx.beginPath(); ctx.roundRect(X, Y, W, H, r); };
  function cover(ctx, img, X, Y, W, H, fy = 0.62) {
    if (!img) { ctx.fillStyle = '#1d2027'; ctx.fillRect(X, Y, W, H); return; }
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, k = Math.max(W / iw, H / ih), w = iw * k, h = ih * k;
    ctx.drawImage(img, X + (W - w) / 2, Y + (H - h) * fy, w, h);
  }
  function fit(ctx, text, maxW, size, weight, family) { let s = size; do { ctx.font = `${weight} ${s}px ${family}`; if (ctx.measureText(text).width <= maxW) break; s -= 2; } while (s > 12); return s; }
  function wrap(ctx, text, maxW) { const out = []; let line = ''; for (const w of String(text).split(' ')) { const t = line ? line + ' ' + w : w; if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; }
  const MARK1 = new Path2D('M14 52 H38 A10 10 0 0 0 38 32 H26 A10 10 0 0 1 26 12 H44'), MARK2 = new Path2D('M45 3.5 L60 12 L45 20.5 Z');
  function mark(ctx, X, Y, S) {
    ctx.save(); ctx.translate(X, Y); ctx.scale(S / 64, S / 64);
    ctx.fillStyle = '#16B57F'; ctx.beginPath(); ctx.roundRect(0, 0, 64, 64, 18); ctx.fill();
    ctx.translate(8.5, 9); ctx.scale(0.72, 0.72); ctx.strokeStyle = '#0d0f13'; ctx.lineWidth = 12; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(MARK1);
    ctx.fillStyle = '#0d0f13'; ctx.lineWidth = 4; ctx.fill(MARK2); ctx.stroke(MARK2); ctx.restore();
  }
  // ozdoby (vektorové, nezávislé od emoji písma)
  function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  function leaf(ctx, x, y, s, a, col) { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -s); ctx.bezierCurveTo(s * .9, -s * .5, s * .7, s * .6, 0, s); ctx.bezierCurveTo(-s * .7, s * .6, -s * .9, -s * .5, 0, -s); ctx.fill();
    ctx.strokeStyle = 'rgba(60,25,5,.55)'; ctx.lineWidth = Math.max(1, s / 12); ctx.beginPath(); ctx.moveTo(0, -s * .8); ctx.lineTo(0, s * 1.25); ctx.stroke(); ctx.restore(); }
  function flake(ctx, x, y, s, col) { ctx.save(); ctx.translate(x, y); ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, s / 7); ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s); ctx.moveTo(0, -s * .55); ctx.lineTo(s * .28, -s * .8); ctx.moveTo(0, -s * .55); ctx.lineTo(-s * .28, -s * .8); ctx.stroke(); } ctx.restore(); }
  function pumpkin(ctx, x, y, s) { ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#3d7a2a'; ctx.beginPath(); ctx.roundRect(-s * .08, -s * .78, s * .16, s * .3, s * .05); ctx.fill();
    const g = ctx.createRadialGradient(-s * .2, -s * .2, s * .1, 0, 0, s); g.addColorStop(0, '#FFA53A'); g.addColorStop(1, '#D4580A'); ctx.fillStyle = g;
    for (const [dx, w] of [[-s * .45, .5], [s * .45, .5], [0, .6]]) { ctx.beginPath(); ctx.ellipse(dx, 0, s * w, s * .58, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#2a1204'; ctx.beginPath(); ctx.moveTo(-s * .38, -s * .12); ctx.lineTo(-s * .18, -s * .3); ctx.lineTo(-s * .08, -s * .08); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s * .38, -s * .12); ctx.lineTo(s * .18, -s * .3); ctx.lineTo(s * .08, -s * .08); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-s * .42, s * .12); ctx.quadraticCurveTo(0, s * .45, s * .42, s * .12); ctx.quadraticCurveTo(0, s * .28, -s * .42, s * .12); ctx.fill(); ctx.restore(); }
  function bat(ctx, x, y, s, col) { ctx.save(); ctx.translate(x, y); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -s * .15);
    ctx.quadraticCurveTo(s * .3, -s * .55, s, -s * .35); ctx.quadraticCurveTo(s * .75, -s * .1, s * .8, s * .2); ctx.quadraticCurveTo(s * .55, 0, s * .45, s * .25); ctx.quadraticCurveTo(s * .3, s * .05, 0, s * .3);
    ctx.quadraticCurveTo(-s * .3, s * .05, -s * .45, s * .25); ctx.quadraticCurveTo(-s * .55, 0, -s * .8, s * .2); ctx.quadraticCurveTo(-s * .75, -s * .1, -s, -s * .35); ctx.quadraticCurveTo(-s * .3, -s * .55, 0, -s * .15); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-s * .12, -s * .2); ctx.lineTo(-s * .08, -s * .38); ctx.lineTo(0, -s * .22); ctx.lineTo(s * .08, -s * .38); ctx.lineTo(s * .12, -s * .2); ctx.fill(); ctx.restore(); }
  // ozdoby len v pásoch, kde neprekážajú autu ani textu: nebo nad autom (y < 250 mimo loga a štítku) a päta (medzi textom a telefónom)
  function deco(ctx, th, W, H, hero, phase, fy) {
    const R = rnd(7), sky = (n, f) => { for (let i = 0; i < n; i++) { const x = 60 + R() * (W - 120), y = 140 + R() * 120; f(x, y, i); } };
    const footC = (f) => { [[W * .42, fy + 26], [W * .52, fy + 36], [W * .47, fy + 10]].forEach(([x, y], i) => f(x, y, i)); };
    if (th.deco === 'leaves') { const C = ['#E8833A', '#C8461E', '#F2B84B', '#A63A15', '#E0A030'];
      sky(10, (x, y, i) => leaf(ctx, x, y + Math.sin(phase + i) * 10, 16 + R() * 18, R() * 6.28 + phase * .5, C[i % C.length]));
      for (let i = 0; i < 9; i++) leaf(ctx, W * .36 + R() * W * .22, fy - 6 + R() * 70, 14 + R() * 14, R() * 6.28, C[i % C.length]); }
    if (th.deco === 'snow' || th.deco === 'xmas') {
      for (let i = 0; i < 26; i++) { const x = R() * W, y = (R() * 260 + phase * 30 * (.4 + R())) % 300; const s = 4 + R() * 16; if (s > 11) flake(ctx, x, y, s, 'rgba(230,245,255,.8)'); else { ctx.fillStyle = 'rgba(240,248,255,.85)'; ctx.beginPath(); ctx.arc(x, y, s / 3, 0, 7); ctx.fill(); } }
      for (let i = 0; i < 18; i++) { const x = R() * W, y = H - 170 + R() * 160; ctx.fillStyle = 'rgba(240,248,255,.55)'; ctx.beginPath(); ctx.arc(x, y, 1.5 + R() * 3, 0, 7); ctx.fill(); }
      if (th.deco === 'xmas') footC((x, y, i) => ornament(ctx, x, y, 22 - i * 3, ['#D62839', '#F2C14E', '#2E8B57'][i])); else footC((x, y, i) => flake(ctx, x, y, 26 - i * 5, 'rgba(200,235,255,.9)')); }
    if (th.deco === 'halloween') {
      ctx.save(); ctx.fillStyle = 'rgba(255,236,170,.95)'; ctx.shadowColor = 'rgba(255,220,140,.8)'; ctx.shadowBlur = 40; ctx.beginPath(); ctx.arc(W * .62, 175, 46, 0, 7); ctx.fill(); ctx.restore();
      [[W * .52, 160, 26], [W * .72, 215, 22], [W * .66, 130, 18], [W * .45, 220, 16]].forEach(([x, y, s], i) => bat(ctx, x + Math.sin(phase * 2 + i) * 10, y + Math.cos(phase * 2 + i) * 6, s, 'rgba(8,4,12,.92)'));
      pumpkin(ctx, W * .43, fy + 30, 34); pumpkin(ctx, W * .52, fy + 40, 24); }
  }
  function ornament(ctx, x, y, s, col) { ctx.save(); const g = ctx.createRadialGradient(x - s * .3, y - s * .3, s * .1, x, y, s); g.addColorStop(0, '#fff'); g.addColorStop(.25, col); g.addColorStop(1, col);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill(); ctx.fillStyle = '#c9a227'; ctx.fillRect(x - s * .25, y - s * 1.2, s * .5, s * .3); ctx.restore(); }

  function draw(ctx, W, H, c, imgs, th, story, phase = 0) {
    const E = (s) => String(s ?? '');
    const hero = story ? 1000 : 720, k = calc(c.price), [t1, t2] = splitTitle(c.title), sub = c.sub || '';
    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
    cover(ctx, imgs[0], 0, 0, W, hero, 0.62);
    let g = ctx.createLinearGradient(0, 0, 0, hero);
    g.addColorStop(0, 'rgba(13,15,19,.88)'); g.addColorStop(.24, 'rgba(13,15,19,0)'); g.addColorStop(.5, 'rgba(13,15,19,0)'); g.addColorStop(.97, th.bg);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hero + 2);
    if (th.glow) { const rg = ctx.createRadialGradient(W * .5, hero * .2, 50, W * .5, hero * .2, W); rg.addColorStop(0, th.glow); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H); }
    if (th.tint) { ctx.fillStyle = th.tint; ctx.fillRect(0, 0, W, hero); }
    const fyD = H - (story ? 44 : 26) - 44 - 22 - 60;
    if (th.deco) deco(ctx, th, W, H, hero, phase, fyD);
    // logo a štítok
    const ty = story ? 70 : 46; mark(ctx, 60, ty, 62);
    ctx.textBaseline = 'middle'; ctx.font = "800 38px Unbounded"; ctx.fillStyle = '#fff'; ctx.fillText('splatkuj', 138, ty + 33);
    const sw = ctx.measureText('splatkuj').width; ctx.fillStyle = '#16B57F'; ctx.fillText('.sk', 138 + sw, ty + 33);
    ctx.font = '600 21px Poppins'; const tw = ctx.measureText(th.tag).width + 48;
    rr(0, ctx, W - 60 - tw, ty + 8, tw, 50, 25); ctx.fillStyle = 'rgba(13,15,19,.6)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = th.tagC; ctx.stroke();
    ctx.fillStyle = th.tagC; ctx.fillText(th.tag, W - 60 - tw + 24, ty + 34);
    // nadpis
    let y = story ? hero - 360 : hero - 300;
    if (th.hl) { const hs = story ? 28 : 22; ctx.font = `800 ${hs}px Poppins`; ctx.letterSpacing = '1px'; const hw = ctx.measureText(th.hl.toUpperCase()).width + 40;
      rr(0, ctx, 60, y - hs - 34, hw, hs + 22, (hs + 22) / 2); ctx.fillStyle = th.pay[0]; ctx.fill(); ctx.fillStyle = th.ink; ctx.textBaseline = 'middle'; ctx.fillText(th.hl.toUpperCase(), 80, y - hs / 2 - 23); ctx.letterSpacing = '0px'; }
    let ts = (t1.length <= 13 ? 112 : t1.length <= 16 ? 96 : 82); if (!story) ts = Math.round(ts * .8);
    ts = fit(ctx, cap(t1), W - 120, ts, 800, 'Poppins');
    ctx.textBaseline = 'top'; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 30; ctx.fillText(cap(t1), 58, y); ctx.shadowBlur = 0;
    y += ts * 0.98 + 14; ctx.font = `500 ${story ? 34 : 27}px Poppins`; ctx.fillStyle = '#c3c9d4';
    const subt = E(t2 + (t2 && sub ? ' · ' : '') + sub); const sl = wrap(ctx, subt, W - 120).slice(0, 2);
    sl.forEach((l, i) => ctx.fillText(l, 60, y + i * (story ? 42 : 34))); y += sl.length * (story ? 42 : 34) + (story ? 30 : 18);
    // splátka
    const ph = story ? 230 : 194, rw = 300;
    ctx.save(); ctx.shadowColor = th.pay[0] + '73'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20; rr(0, ctx, 60, y, W - 120, ph, 28); ctx.fillStyle = th.pay[0]; ctx.fill(); ctx.restore();
    ctx.save(); rr(0, ctx, 60, y, W - 120, ph, 28); ctx.clip();
    g = ctx.createLinearGradient(60, y, W - 60, y + ph); g.addColorStop(0, th.pay[0]); g.addColorStop(1, th.pay[1]); ctx.fillStyle = g; ctx.fillRect(60, y, W - 120, ph);
    ctx.fillStyle = '#111'; ctx.fillRect(W - 60 - rw, y, rw, ph); ctx.restore();
    ctx.fillStyle = th.ink; ctx.font = '600 23px Poppins'; ctx.textBaseline = 'top'; ctx.letterSpacing = '2px'; ctx.fillText('MESAČNÁ SPLÁTKA UŽ OD', 96, y + (story ? 34 : 26)); ctx.letterSpacing = '0px';
    const vs = story ? 150 : 116; ctx.font = `800 ${vs}px Poppins`; ctx.letterSpacing = '-4px'; const mv = money(k.m); ctx.textBaseline = 'alphabetic';
    const vy = y + ph - (story ? 34 : 28); ctx.fillText(mv, 92, vy); const mw = ctx.measureText(mv).width; ctx.letterSpacing = '0px';
    ctx.font = `800 ${Math.round(vs * .36)}px Poppins`; ctx.fillText('€', 100 + mw, vy - vs * .55); ctx.font = `600 ${Math.round(vs * .26)}px Poppins`; ctx.fillText('/ mes.', 104 + mw + vs * .2, vy - 6);
    ctx.fillStyle = '#9aa3b2'; ctx.font = '400 20px Poppins'; ctx.textBaseline = 'middle'; const rx = W - 60 - rw + 34;
    ctx.fillText('alebo cena', rx, y + ph * .25); ctx.fillStyle = '#fff'; ctx.font = '700 44px Poppins'; ctx.fillText(money(c.price) + ' €', rx, y + ph * .5);
    ctx.fillStyle = '#9aa3b2'; ctx.font = '400 20px Poppins'; ctx.fillText(`akontácia od ${DOWN} %`, rx, y + ph * .76);
    y += ph + (story ? 32 : 20);
    // parametre
    const sp = specs(c), gw = (W - 120 - 4 * 12) / 5, sh = story ? 104 : 94;
    sp.forEach(([a, b], i) => { const x = 60 + i * (gw + 12); rr(0, ctx, x, y, gw, sh, 18); ctx.fillStyle = '#171a21'; ctx.fill(); ctx.strokeStyle = '#262b35'; ctx.lineWidth = 1; ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; fit(ctx, String(a), gw - 16, story ? 27 : 24, 700, 'Poppins'); ctx.fillText(String(a), x + gw / 2, y + sh * .38);
      ctx.fillStyle = '#9aa3b2'; ctx.font = '400 18px Poppins'; ctx.fillText(b, x + gw / 2, y + sh * .7); ctx.textAlign = 'left'; });
    y += sh + (story ? 28 : 16);
    // výbava
    const fe = features(c), fw = (W - 120 - 24) / 3, fh = story ? 96 : 88;
    fe.forEach(([a, b], i) => { const x = 60 + i * (fw + 12); ctx.fillStyle = '#14171d'; rr(0, ctx, x, y, fw, fh, [0, 14, 14, 0]); ctx.fill(); ctx.fillStyle = BENEFITS.some((z) => z[0] === a) ? '#3a4150' : '#14B47E'; ctx.fillRect(x, y, 4, fh);
      ctx.fillStyle = '#fff'; fit(ctx, a, fw - 40, 24, 700, 'Poppins'); ctx.fillText(a, x + 22, y + fh * .36); ctx.fillStyle = '#9aa3b2'; ctx.font = '400 17px Poppins'; ctx.fillText(b, x + 22, y + fh * .7); });
    y += fh + (story ? 24 : 18);
    // galéria
    const foot = story ? 200 : 160, gh = Math.max(120, Math.min(story ? 400 : 190, H - foot - y - 10)), gwi = (W - 120 - 24) / 3;
    for (let i = 0; i < 3; i++) { const x = 60 + i * (gwi + 12); ctx.save(); rr(0, ctx, x, y, gwi, gh, 18); ctx.clip(); cover(ctx, imgs[i + 1], x, y, gwi, gh, 0.5); ctx.restore(); }
    // päta
    const fy = H - (story ? 44 : 26) - 44 - 22 - 60;
    ctx.textBaseline = 'middle'; ctx.font = '500 21px Poppins'; ctx.fillStyle = '#9aa3b2'; ctx.fillText('Úver vybavíme', 60, fy + 16); const ow = ctx.measureText('Úver vybavíme ').width;
    ctx.fillStyle = '#fff'; ctx.font = '700 21px Poppins'; ctx.fillText('online', 60 + ow, fy + 16); ctx.font = '500 21px Poppins'; ctx.fillStyle = '#9aa3b2'; ctx.fillText('po celom Slovensku', 60, fy + 44);
    ctx.font = '700 34px Poppins'; const pt = '📞 ' + PHONE, pw = ctx.measureText(pt).width + 64; rr(0, ctx, W - 60 - pw, fy - 4, pw, 72, 36); ctx.fillStyle = '#fff'; ctx.fill(); ctx.fillStyle = '#111'; ctx.fillText(pt, W - 60 - pw + 32, fy + 32);
    const fn = `Reprezentatívny príklad: cena vozidla ${money(c.price)} €, akontácia ${DOWN} % (${money(k.down)} €), výška úveru ${money(k.loan)} €, doba splácania ${MONTHS} mes., mesačná splátka ${money(k.m)} €, úroková sadzba ${String(RATE).replace('.', ',')} % p.a., RPMN ${k.rpmn.toFixed(2).replace('.', ',')} %, celková splatná suma ${money(k.total)} €. Informatívny výpočet bez poplatkov, nie je záväznou ponukou.`;
    ctx.font = '400 13px Inter, sans-serif'; ctx.fillStyle = '#6b7280'; ctx.textBaseline = 'top'; wrap(ctx, fn, W - 120).slice(0, 3).forEach((l, i) => ctx.fillText(l, 60, fy + 86 + i * 18));
  }

  async function fonts() { try { await Promise.all(['800 40px Poppins', '700 40px Poppins', '600 40px Poppins', '500 40px Poppins', '800 40px Unbounded', '400 13px Inter'].map((f) => document.fonts.load(f))); } catch {} }
  async function render(canvas, car, imgs, theme = 'klasicka', story = false, phase = 0) {
    await fonts(); const W = 1080, H = story ? 1920 : 1350; canvas.width = W; canvas.height = H;
    draw(canvas.getContext('2d'), W, H, car, imgs, THEMES[theme] || THEMES.klasicka, story, phase); return canvas;
  }
  const loadImg = (src) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ok(null); im.src = src; });
  // video: 4 fotky s pomalým priblížením a cenou, ~12 s, MP4 ak to prehliadač vie, inak WebM
  async function video(car, imgs, theme = 'klasicka', onProgress) {
    await fonts(); const W = 1080, H = 1920, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
    const type = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
    if (!type) throw new Error('Tento prehliadač nevie nahrávať video.');
    const st = cv.captureStream(30), rec = new MediaRecorder(st, { mimeType: type, videoBitsPerSecond: 6e6 }), chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise((ok) => (rec.onstop = ok)); rec.start(200);
    const th = THEMES[theme] || THEMES.klasicka, T = 12000, t0 = performance.now(), order = [imgs[0], imgs[1], imgs[2], imgs[3]].filter(Boolean);
    await new Promise((ok) => { const step = (now) => { const t = now - t0, seg = T / (order.length + 1), i = Math.min(order.length, Math.floor(t / seg)), p = (t % seg) / seg;
        if (i < order.length) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); const z = 1.04 + p * .08; ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2); cover(ctx, order[i], 0, 0, W, H, .5); ctx.restore();
          const g = ctx.createLinearGradient(0, H * .55, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.85)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
          if (th.deco) deco(ctx, th, W, H, H * .5, t / 900, H - 150);
          mark(ctx, 60, 80, 70); ctx.font = '800 42px Unbounded'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('splatkuj', 146, 116); ctx.fillStyle = '#16B57F'; ctx.fillText('.sk', 146 + ctx.measureText('splatkuj').width, 116);
          ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic'; fit(ctx, car.title, W - 120, 64, 800, 'Poppins'); ctx.fillText(car.title, 60, H - 330);
          ctx.fillStyle = '#45D99B'; ctx.font = '800 120px Poppins'; ctx.fillText(money(calc(car.price).m) + ' € / mes.', 60, H - 190);
          ctx.fillStyle = '#c3c9d4'; ctx.font = '500 36px Poppins'; ctx.fillText('od 0 % akontácie · cena ' + money(car.price) + ' €', 60, H - 120);
        } else draw(ctx, W, H, car, imgs, th, true, t / 900);
        onProgress && onProgress(Math.min(1, t / T)); if (t < T) requestAnimationFrame(step); else ok(); }; requestAnimationFrame(step); });
    rec.stop(); await done; return new Blob(chunks, { type: type.split(';')[0] });
  }
  window.SKAds = { THEMES, render, video, loadImg, calc, money };
})();
