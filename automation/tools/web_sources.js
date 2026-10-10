// Čítačky áut z vlastných webov predajcov (nie z Bazoša). Vlož do karty na webe predajcu (napr. https://cooldrive.sk/),
// fetch potom ide z rovnakej domény. Použitie:
//   await WEB.list('cooldrive', [odkazy na kategórie])  -> [{id, url}]
//   await WEB.detail('cooldrive', url)                    -> {id, url, title, price, year, km, kw, fuel, gear, drive, body, mark, imgs, popis, eq}
// Číslo auta: 9-miestne, začína deviatkou (s Bazošom sa nebije): cooldrive /…/m50 -> 910000050.
window.WEB = (() => {
  const lines = (h) => {
    const ta = document.createElement('textarea');
    ta.innerHTML = h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
      .replace(/<(br|\/p|\/div|\/td|\/th|\/li|\/tr|\/h\d|\/span|\/strong|\/b)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, '');
    return ta.value.split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  };
  const after = (L, lab) => { const i = L.indexOf(lab); return i >= 0 ? L[i + 1] || '' : ''; };
  const num = (s) => +(String(s || '').replace(/\D/g, '')) || 0;

  const S = {
    cooldrive: {
      id: (url) => { const m = url.match(/\/m(\d{1,7})(?:[/?#]|$)/); return m ? '91' + m[1].padStart(7, '0') : null; },
      async list(links) {
        const out = new Map();
        for (const c of links) {
          const h = await (await fetch(new URL(c, location.origin).pathname)).text();
          const d = new DOMParser().parseFromString(h, 'text/html');
          for (const a of d.querySelectorAll('a[href]')) {
            const p = a.getAttribute('href');
            if (!/^\/[^/]+\/[^/]+\/m\d+$/.test(p) || /^\/(ponuka-vozidiel|sluzby|magazin|elektromobily|4-x-4|kontakt)\//.test(p)) continue;
            if (!/\(\d{4}\)/.test(a.textContent)) continue; // karta auta má v názve rok, napr. „… (2021)“
            const id = this.id(p); if (id) out.set(id, 'https://cooldrive.sk' + p);
          }
        }
        return [...out].map(([id, url]) => ({ id, url }));
      },
      async detail(url) {
        const r = await fetch(new URL(url).pathname);
        if (!r.ok) return { id: this.id(url), url, gone: true, status: r.status };
        const h = await r.text(), L = lines(h);
        const h1 = ((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const vin = (h1.match(/VIN:\s*([A-HJ-NPR-Z0-9]{11,17})/i) || [])[1] || '';
        const title = h1.replace(/VIN:.*$/i, '').trim();
        const pi = L.findIndex((s) => /^\d{1,3}(?:[.\s]\d{3})*\s*EUR$/.test(s));
        const kwS = after(L, 'Výkon (kW)');
        const j = L.findIndex((s) => /^VÝBAVA/.test(s));
        const eq = [];
        if (j >= 0) for (const s of L.slice(j + 1)) { if (s.length > 60 || /^[A-ZÁČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ ?!]{6,}$/.test(s)) break; eq.push(s); }
        const imgs = [...new Set([...h.matchAll(/\/storage\/gallery\/[^"'\s]+?\/zoom\/[^"'\s]+?\.jpe?g/gi)].map((m) => 'https://cooldrive.sk' + m[0]))];
        const spec = ['Palivo', 'Rok výroby', 'Objem motora', 'Kilometre', 'Dvere', 'Prevodovka', 'Výkon (kW)', 'Pohon', 'Karoséria']
          .map((k) => [k, after(L, k)]).filter(([, v]) => v);
        const gearS = after(L, 'Prevodovka'), pohon = after(L, 'Pohon');
        return {
          id: this.id(url), url, title, mark: vin,
          price: pi >= 0 ? num(L[pi]) : null,
          year: after(L, 'Rok výroby'), km: num(after(L, 'Kilometre')), kw: num((kwS.match(/(\d+)\s*kW/) || [])[1]),
          fuel: after(L, 'Palivo'), gear: /autom|dsg|tronic|cvt/i.test(gearS) ? 'Automat' : (gearS ? 'Manuál' : ''),
          drive: /4x4|awd|4wd|quattro|xdrive|4motion/i.test(pohon) ? '4x4' : /zadn/i.test(pohon) ? 'Zadný' : /predn/i.test(pohon) ? 'Predný' : '—',
          body: after(L, 'Karoséria'), imgs, eq,
          popis: spec.map(([k, v]) => k + ': ' + v).join('\n') + (eq.length ? '\n\nVýbava:\n' + eq.map((x) => '• ' + x).join('\n') : ''),
        };
      },
    },
  };
  return {
    list: (site, links) => S[site].list(links),
    detail: (site, url) => S[site].detail(url),
    id: (site, url) => S[site].id(url),
  };
})();
'WEB ready';
