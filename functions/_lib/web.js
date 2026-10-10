// Čítanie áut z vlastných webov predajcov priamo na serveri (Cloudflare), aby automatika nemusela
// prenášať zoznamy fotiek cez prehliadač. Zatiaľ cooldrive.sk.
import { UA, extHostOk } from './foto.js';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENT[e.toLowerCase()] ?? m;
});
const lines = (h) => decode(h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
  .replace(/<(br|\/p|\/div|\/td|\/th|\/li|\/tr|\/h\d|\/span|\/strong|\/b)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ''))
  .split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
// hodnota za názvom údaja; niektoré stránky Cooldrive majú pred hodnotou „- “
const after = (L, ...labs) => { for (const lab of labs) { const i = L.indexOf(lab); if (i >= 0) return String(L[i + 1] || '').replace(/^-\s*/, ''); } return ''; };
const SPEC = ['Palivo', 'Rok výroby', 'Objem motora', 'Kilometre', 'Dvere', 'Prevodovka', 'Výkon (kW)', 'Výkon', 'Pohon', 'Karoséria'];
const num = (s) => +(String(s || '').replace(/\D/g, '')) || 0;

async function get(url) {
  if (!extHostOk(url)) throw new Error('nepovolený web');
  const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'sk' }, cf: { cacheTtl: 0 } });
  return { status: r.status, ok: r.ok, html: r.ok ? await r.text() : '' };
}

export const SITES = {
  cooldrive: {
    origin: 'https://cooldrive.sk',
    id: (url) => { const m = String(url).match(/\/m(\d{1,7})(?:[/?#]|$)/); return m ? '91' + m[1].padStart(7, '0') : null; },
    async list(links) {
      const out = new Map();
      for (const c of links) {
        const { html } = await get(new URL(c, this.origin).href);
        for (const m of html.matchAll(/<a\b[^>]*href=["'](\/[^/"']+\/[^/"']+\/m\d+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
          const p = m[1];
          if (/^\/(ponuka-vozidiel|sluzby|magazin|elektromobily|4-x-4|kontakt)\//.test(p)) continue;
          if (!/\(\d{4}\)/.test(m[2].replace(/<[^>]+>/g, ''))) continue; // karta auta má v názve rok „(2021)“
          const id = this.id(p); if (id) out.set(id, this.origin + p);
        }
      }
      return [...out].map(([id, url]) => ({ id, url }));
    },
    async detail(url) {
      const { status, ok, html: h } = await get(url);
      if (!ok) return { id: this.id(url), url, gone: true, status };
      const L = lines(h);
      const h1 = decode(((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
      const mark = (h1.match(/VIN:\s*([A-HJ-NPR-Z0-9]{11,17})/i) || [])[1] || '';
      const title = h1.replace(/VIN:.*$/i, '').trim();
      const pi = L.findIndex((s) => /^\d{1,3}(?:[.\s]\d{3})*\s*EUR$/.test(s));
      // výbava: za nadpisom VÝBAVA, alebo (iný formát stránky) hneď za poslednou hodnotou technických údajov
      let j = L.findIndex((s) => /^VÝBAVA/.test(s));
      if (j < 0) { const k = Math.max(...SPEC.map((x) => L.indexOf(x))); if (k >= 0) j = k + 1; }
      const eq = [];
      if (j >= 0) for (const s of L.slice(j + 1)) { if (s.length > 60 || /^[A-ZÁČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ ?!]{6,}$/.test(s) || /^(STAV VOZIDLA|Zavolať|Napísať)/.test(s)) break; if (!/^-/.test(s)) eq.push(s); }
      const imgs = [...new Set([...h.matchAll(/\/storage\/gallery\/[^"'\s]+?\/zoom\/[^"'\s]+?\.jpe?g/gi)].map((m) => this.origin + m[0]))];
      const spec = SPEC.filter((k) => k !== 'Výkon (kW)').map((k) => [k, k === 'Výkon' ? after(L, 'Výkon (kW)', 'Výkon') : after(L, k)]).filter(([, v]) => v);
      const gearS = after(L, 'Prevodovka'), pohon = after(L, 'Pohon');
      return {
        id: this.id(url), url, title, mark,
        price: pi >= 0 ? num(L[pi]) : null,
        yearText: after(L, 'Rok výroby'), km: num(after(L, 'Kilometre')), kw: num((after(L, 'Výkon (kW)', 'Výkon').match(/(\d+)\s*kW/) || [])[1]),
        fuel: after(L, 'Palivo'), gear: /autom|dsg|tronic|cvt/i.test(gearS) ? 'Automat' : (gearS ? 'Manuál' : ''),
        drive: /4x4|awd|4wd|quattro|xdrive|4motion/i.test(pohon) ? '4x4' : /zadn/i.test(pohon) ? 'Zadný' : /predn/i.test(pohon) ? 'Predný' : '—',
        body: after(L, 'Karoséria'), imgs, eq,
        popis: spec.map(([k, v]) => k + ': ' + v).join('\n') + (eq.length ? '\n\nVýbava:\n' + eq.map((x) => '• ' + x).join('\n') : ''),
      };
    },
  },
};
