// GET /api/firma?ico=12345678
// Vyhľadá firmu alebo živnostníka v Registri právnických osôb (Štatistický úrad SR).
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

export async function onRequestGet({ request }) {
  const ico = (new URL(request.url).searchParams.get('ico') || '').replace(/\D/g, '');
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=86400' },
    });
  if (ico.length !== 8) return json({ ok: false, error: 'IČO musí mať 8 číslic' }, 400);
  try {
    const r = await fetch(`https://api.statistics.sk/rpo/v1/search?identifier=${ico}`, {
      headers: { accept: 'application/json' },
      cf: { cacheTtl: 86400, cacheEverything: true },
    });
    if (!r.ok) return json({ ok: false, error: 'register neodpovedá' }, 502);
    const d = await r.json();
    const e = (d.results || d.data || [])[0];
    if (!e) return json({ ok: false, error: 'nenašlo sa' }, 404);
    const name = val(pick(e.fullNames)) || val(e.fullName) || '';
    const est = e.establishment || e.established || pick(e.identifiers)?.validFrom || '';
    const months = est ? Math.floor((Date.now() - Date.parse(est)) / (30.44 * 864e5)) : null;
    return json({
      ok: true,
      ico,
      name,
      address: address(pick(e.addresses)),
      established: est ? String(est).slice(0, 10) : '',
      ageMonths: months,
      legalForm: val(pick(e.legalForms)?.value ?? pick(e.legalForms)),
      active: !e.termination,
    });
  } catch (err) {
    return json({ ok: false, error: 'chyba pri hľadaní' }, 502);
  }
}
