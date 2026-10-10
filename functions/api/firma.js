// GET /api/firma?ico=12345678 – overenie firmy alebo živnostníka podľa IČO.
// GET /api/firma?q=nazov       – návrhy firiem podľa názvu (pre pole „Zamestnávateľ“).
// Zdroje: 1) Register právnických osôb (Štatistický úrad SR, api.statistics.sk),
//         2) záloha: Register účtovných závierok (registeruz.sk) – keď RPO neodpovedá alebo IČO nepozná.
// Každý zdroj má časový limit, aby formulár na webe nečakal.
const pick = (arr) => {
  if (!Array.isArray(arr) || !arr.length) return null;
  const now = arr.filter((x) => !x.validTo);
  return (now.length ? now : arr)[0];
};
const val = (x) => (x == null ? '' : typeof x === 'object' ? (x.value ?? '') : String(x));

function address(a) {
  if (!a) return '';
  const street = [val(a.street), [a.regNumber, a.buildingNumber].filter(Boolean).join('/')].filter(Boolean).join(' ');
  const city = [Array.isArray(a.postalCodes) ? a.postalCodes[0] : '', val(a.municipality)].filter(Boolean).join(' ');
  return [street, city].filter(Boolean).join(', ');
}

const json = (data, status = 200, cache = 86400) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': status === 200 ? `public, max-age=${cache}` : 'no-store' },
  });

async function getJson(url, ms) {
  const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(ms), cf: { cacheTtl: 86400, cacheEverything: true } });
  if (r.status === 404) return { notFound: true };
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
}

function fromRpo(e, ico) {
  const name = val(pick(e.fullNames)) || val(e.fullName) || '';
  const est = e.establishment || e.established || pick(e.identifiers)?.validFrom || '';
  return {
    ok: true, ico, name, source: 'RPO',
    address: address(pick(e.addresses)),
    established: est ? String(est).slice(0, 10) : '',
    legalForm: val(pick(e.legalForms)?.value ?? pick(e.legalForms)),
    active: !e.termination,
  };
}

async function rpoByIco(ico) {
  const d = await getJson(`https://api.statistics.sk/rpo/v1/search?identifier=${ico}`, 6000);
  const e = (d.results || d.data || [])[0];
  return e ? fromRpo(e, ico) : null;
}

async function ruzByIco(ico) {
  const base = 'https://www.registeruz.sk/cruz-public/api';
  const l = await getJson(`${base}/uctovne-jednotky?zmenene-od=2000-01-01&ico=${ico}`, 6000);
  const ids = (l && l.id) || [];
  if (!ids.length) return null;
  const u = await getJson(`${base}/uctovna-jednotka?id=${ids[ids.length - 1]}`, 6000);
  if (!u || !u.nazovUJ) return null;
  return {
    ok: true, ico, name: u.nazovUJ, source: 'RÚZ',
    address: [u.ulica, [u.psc, u.mesto].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    established: u.datumZalozenia ? String(u.datumZalozenia).slice(0, 10) : '',
    legalForm: '', active: !u.datumZrusenia,
  };
}

export async function onRequestGet({ request }) {
  const sp = new URL(request.url).searchParams;
  const q = (sp.get('q') || '').trim().slice(0, 60);
  if (q) {
    if (q.length < 3) return json({ ok: true, items: [] });
    try {
      const d = await getJson(`https://api.statistics.sk/rpo/v1/search?fullName=${encodeURIComponent(q)}&onlyActive=true`, 5000);
      const items = (d.results || d.data || []).slice(0, 8).map((e) => {
        const ic = val(pick(e.identifiers)) || '';
        const a = pick(e.addresses);
        return { name: val(pick(e.fullNames)) || '', ico: ic, city: a ? val(a.municipality) : '' };
      }).filter((x) => x.name);
      return json({ ok: true, items }, 200, 3600);
    } catch { return json({ ok: true, items: [], error: 'register neodpovedá' }, 200, 60); }
  }
  const ico = (sp.get('ico') || '').replace(/\D/g, '');
  if (ico.length !== 8) return json({ ok: false, error: 'IČO musí mať 8 číslic' }, 400);
  // oba registre naraz – vyhrá prvý, ktorý firmu nájde (RPO býva občas pomalé alebo nedostupné)
  let down = 0;
  const found = await new Promise((resolve) => {
    let left = 2;
    for (const src of [rpoByIco, ruzByIco]) {
      src(ico).then((f) => { if (f && f.name) resolve(f); else if (!--left) resolve(null); })
        .catch(() => { down++; if (!--left) resolve(null); });
    }
  });
  if (found) { found.ageMonths = found.established ? Math.floor((Date.now() - Date.parse(found.established)) / (30.44 * 864e5)) : null; return json(found); }
  return down === 2 ? json({ ok: false, error: 'register neodpovedá' }, 502) : json({ ok: false, error: 'nenašlo sa' }, 404);
}
