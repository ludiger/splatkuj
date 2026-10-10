// Týždenný newsletter Splatkuj.sk – HTML e-mail zostavený z inzerátov v admine.
// Obsah: nové autá na webe, zľavnené autá (priceOld > priceNum), výber týždňa podľa témy, predané autá.
// Pravidlá: žiadna úroková sadzba; splátka je orientačná (96 mesiacov, 0 % akontácia); odkaz na odhlásenie
// doplní e-mailový nástroj (unsub = jeho značka, napr. *|UNSUB|* v Mailchimpe).

const SITE = 'https://www.splatkuj.sk';
const GREEN = '#16B57F';
const R = 0.099 / 12; // rovnaký výpočet ako kalkulačka na webe – sadzba sa nikde nezobrazuje
const pay = (p) => Math.round((p * R) / (1 - (1 + R) ** -96));
const eur = (n) => Math.round(n).toLocaleString('sk-SK').replace(/\s/g, ' ') + ' €';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (d) => +d.priceNum || +String(d.price || '').replace(/\D/g, '') || 0;
const slug = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// témy „Výber týždňa“ – striedajú sa podľa čísla týždňa
const THEMES = [
  ['Rodinné SUV', (d) => d.body === 'SUV'],
  ['Priestranné kombi', (d) => d.body === 'Kombi'],
  ['Autá s automatom', (d) => /autom/i.test(d.gear || '')],
  ['Autá do 10 000 €', (d) => num(d) > 0 && num(d) <= 10000],
  ['Pohon 4x4', (d) => d.drive === '4x4'],
  ['Elektro a hybridy', (d) => /elektr|hybrid/i.test(d.fuel || '')],
];

function isoWeek(dt) {
  const d = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day);
  return Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7);
}

function card(d, extra) {
  const id = d.adId || d._id, title = d.carTitle || d.title || '';
  // hlavná fotka auta na webe (rovnaká ako v ponuke); pole photo v admine môže mať starú adresu z pôvodného úložiska
  // spracované auto má fotky na webe (znovu vložené pod pôvodným číslom); čakajúce (needsAds) zo zálohy /api/foto
  const img = d.needsAds === true ? `${SITE}/api/foto/${id}/1` : `${SITE}/img/p/${d.relistedFrom || id}-1.jpg`;
  const url = `${SITE}/?z=email#auto-${slug(title + ' ' + (d.year || ''))}-${id}`;
  const p = num(d);
  const meta = [d.yearText || d.year, d.km ? Number(d.km).toLocaleString('sk-SK').replace(/\s/g, ' ') + ' km' : '', d.fuel, d.gear].filter(Boolean).join(' · ');
  return `<tr><td style="padding:0 0 18px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e6e9ee;border-radius:14px;overflow:hidden;background:#fff">
    <tr><td><a href="${esc(url)}"><img src="${esc(img)}" width="560" alt="${esc(title)}" style="display:block;width:100%;max-width:560px;height:auto;border:0"></a></td></tr>
    <tr><td style="padding:14px 16px 16px;font-family:Arial,Helvetica,sans-serif">
      <div style="font-size:17px;font-weight:bold;color:#14181f;margin:0 0 4px">${esc(title)}</div>
      <div style="font-size:13px;color:#5b6472;margin:0 0 10px">${esc(meta)}${d.location ? ' · ' + esc(String(d.location).replace(/^\d{3} ?\d{2} /, '')) : ''}</div>
      ${extra || ''}
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
        <td style="font-family:Arial,Helvetica,sans-serif"><span style="font-size:20px;font-weight:bold;color:${GREEN}">${p ? eur(pay(p)) : ''}</span><span style="font-size:13px;color:#5b6472">${p ? ' / mes. · cena ' + eur(p) : ''}</span></td>
        <td align="right"><a href="${esc(url)}" style="display:inline-block;background:${GREEN};color:#fff;font:bold 14px Arial,Helvetica,sans-serif;text-decoration:none;padding:10px 16px;border-radius:10px">Pozrieť auto</a></td>
      </tr></table>
    </td></tr>
  </table></td></tr>`;
}

const h2 = (t, sub) => `<tr><td style="padding:10px 0 12px;font-family:Arial,Helvetica,sans-serif"><div style="font-size:21px;font-weight:bold;color:#14181f">${t}</div>${sub ? `<div style="font-size:14px;color:#5b6472;margin-top:4px">${sub}</div>` : ''}</td></tr>`;

export function buildNewsletter(docs, { days = 7, unsub = '*|UNSUB|*', now = new Date() } = {}) {
  const since = now.getTime() - days * 864e5;
  const t = (x) => (x ? Date.parse(x) || 0 : 0);
  const all = docs.map((x) => ({ ...x.data, _id: x.id }));
  const onWeb = all.filter((d) => d.status === 'aktivny' && num(d) > 0); // aj čakajúce autá sú na webe (cez /api/ponuka)
  const fresh = onWeb.filter((d) => t(d.addedAt) >= since).sort((a, b) => t(b.addedAt) - t(a.addedAt)).slice(0, 8);
  const drops = onWeb.filter((d) => +d.priceOld > num(d) && t(d.priceChangedAt) >= since)
    .sort((a, b) => (b.priceOld - num(b)) - (a.priceOld - num(a))).slice(0, 6);
  const used = new Set([...fresh, ...drops].map((d) => d._id));
  const wk = isoWeek(now), [themeName, themeFn] = THEMES[wk % THEMES.length];
  const pickTheme = onWeb.filter((d) => !used.has(d._id) && themeFn(d)).sort((a, b) => t(b.addedAt) - t(a.addedAt)).slice(0, fresh.length >= 4 ? 3 : 6);
  const sold = all.filter((d) => d.status === 'predany' && t(d.soldAt) >= since);

  const nAut = (n, a, b, c) => `${n} ${n === 1 ? a : n < 5 ? b : c}`; // 1 nové auto, 3 nové autá, 7 nových áut
  const nove = nAut(fresh.length, 'nové auto', 'nové autá', 'nových áut');
  const zlav = nAut(drops.length, 'auto so zníženou cenou', 'autá so zníženou cenou', 'áut so zníženou cenou');
  const subject = drops.length && fresh.length ? `${nove} a ${zlav} 🔥`
    : fresh.length ? `${nove} na splátky tento týždeň 🚗`
    : drops.length ? `Znížené ceny: ${zlav} 🔥` : `${themeName} na splátky bez akontácie`;
  const pre = 'Autá z overených bazárov na splátky, bez akontácie. Výpočet je orientačný.';

  let body = '';
  if (fresh.length) body += h2('Nové autá týždňa', 'Pribudli za posledných 7 dní') + fresh.map((d) => card(d)).join('');
  if (drops.length) body += h2('Znížená cena 🔥', 'Predajcovia zlacnili') + drops.map((d) => card(d, `<div style="font:bold 13px Arial,Helvetica,sans-serif;color:#c0392b;margin:0 0 10px">Pôvodne ${eur(d.priceOld)} → teraz ${eur(num(d))} (−${eur(d.priceOld - num(d))})</div>`)).join('');
  if (pickTheme.length) body += h2('Výber týždňa: ' + esc(themeName)) + pickTheme.map((d) => card(d)).join('');
  if (sold.length) body += `<tr><td style="padding:4px 0 18px;font-family:Arial,Helvetica,sans-serif"><div style="background:#eefaf5;border-radius:12px;padding:14px 16px;font-size:14px;color:#14181f"><b>✅ Tento týždeň sa predalo ${sold.length} ${sold.length === 1 ? 'auto' : sold.length < 5 ? 'autá' : 'áut'}.</b> Dobré autá odchádzajú rýchlo – ak sa vám nejaké páči, ozvite sa čím skôr.</div></td></tr>`;
  if (!body) body = h2('Tento týždeň bez noviniek') + `<tr><td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#5b6472;padding:0 0 18px">Celú ponuku nájdete na <a href="${SITE}/?z=email" style="color:${GREEN}">splatkuj.sk</a>.</td></tr>`;

  const html = `<!doctype html><html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f5f8">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(pre)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">
  <tr><td style="padding:0 20px 18px"><a href="${SITE}/?z=email" style="text-decoration:none;font:900 26px Arial Black,Arial,Helvetica,sans-serif;color:${GREEN}">splatkuj.sk</a></td></tr>
  <tr><td style="background:#fff;border-radius:18px;padding:22px 20px 6px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="font-family:Arial,Helvetica,sans-serif;padding:0 0 16px"><div style="font-size:15px;color:#14181f;line-height:1.5">Dobrý deň,<br>prinášame vám výber áut, ktoré si môžete kúpiť na splátky <b>bez akontácie</b> až na 96 mesiacov.</div></td></tr>
      ${body}
      <tr><td align="center" style="padding:4px 0 22px"><a href="${SITE}/?z=email#ponuka" style="display:inline-block;border:2px solid ${GREEN};color:${GREEN};font:bold 15px Arial,Helvetica,sans-serif;text-decoration:none;padding:12px 22px;border-radius:12px">Celá ponuka áut</a></td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:18px 20px;font:12px/1.6 Arial,Helvetica,sans-serif;color:#7b8494">
    Splátky sú orientačné (96 mesiacov, 0 % akontácia). Presné podmienky dostanete v individuálnej ponuke; schválenie úveru závisí od posúdenia financujúcou spoločnosťou.<br>
    LPFinance s.r.o., Nábrežie mládeže 569/81, 949 01 Nitra, IČO 56022352 · <a href="mailto:info@splatkuj.sk" style="color:#7b8494">info@splatkuj.sk</a><br>
    Tento e-mail dostávate, pretože ste na splatkuj.sk dali súhlas so zasielaním ponúk. <a href="${esc(unsub)}" style="color:#7b8494">Odhlásiť sa</a>
  </td></tr>
</table></td></tr></table></body></html>`;
  return { subject, preheader: pre, html, counts: { nove: fresh.length, zlavy: drops.length, vyber: pickTheme.length, tema: themeName, predane: sold.length } };
}
