# Splatkuj.sk – kontext pre Clauda

Tento repozitár je celý web a admin firmy **Splatkuj.sk** (LPFinance s.r.o., IČO 56022352, Nábrežie mládeže 569/81, 949 01 Nitra).
Splatkuj.sk je sprostredkovateľ financovania ojazdených áut (predtým značka „Autá za babku“). Majiteľ: Ľubomír. Komunikácia po slovensky.

## Čo kde beží
- **Web** www.splatkuj.sk – Cloudflare Pages (projekt `splatkuj`), nasadí sa sám po každom `git push` do `main`.
  - zdroj: `src/web.html` → `python3 build.py` → `public/index.html`
  - blog: `blog/posts/*.md` → `python3 build_blog.py`
- **Admin** www.splatkuj.sk/admin – prihlásenie menom a heslom (D1 databáza `splatkuj-admin`, väzba `DB`).
  - zdroj: `src/admin.html` (inzeráty), `src/ads.html` (reklamy), `public/admin/dopyty`, `public/admin/ucet`, `public/admin/shim.js`
  - `python3 build_admin.py` zostaví `public/admin/…`
- **Funkcie** (`functions/`): `api/admin` (prihlásenie, dáta), `api/lead` (dopyty od Laury), `api/chat` (Laura cez Claude API – kľúč `ANTHROPIC_API_KEY` ako secret v Cloudflare), `api/foto` (fotky z Bazoša + trvalá záloha v R2 `splatkuj-fotky`, väzba `FOTO`), `api/inzerat` (detail inzerátu), `api/firma` (register firiem RPO), `api/laura` (fotka/video Laury).
- **Automatika** – naplánovaná úloha v Claude 1× denne (7:52), prompt je v `automation/PROMPT.md`, nástroje v `automation/tools`, dáta v `automation/data`, prenos do repozitára `tools/sync_repo.py`.
- E-mail info@splatkuj.sk – Cloudflare Email Routing → preposiela sa do Gmailu majiteľa.

## Dokumenty (čítaj podľa potreby)
- `docs/FUNKCIE.md` – prehľad všetkého, čo web, Laura, admin a automatika robia, a **denník zmien**. **Pri každej novej alebo zmenenej funkcii ho aktualizuj a doplň záznam do Denníka zmien (dátum, čo, kto) v tom istom commite.**
- `docs/PLAN.md` – plán a stav úloh (čo je hotové, čo ďalej). Po dokončení bodu ho odškrtni.
- `docs/laura-scenar.md` – scenár rozhovoru Laury.
- `docs/zasady-znacky.md` – 12 princípov budovania značky (Žltá kniha), podľa nich overovať rozhodnutia o značke.
- `docs/strategia-znacky.md` (+ PDF) – strategický základ značky. **Záväzný – riadime sa ním (pozri Pravidlá).**
- **Príručky (Claude Docs, so snímkami):** „Splatkuj.sk – príručka (web, dopyty a CRM)“ https://claude.ai/artifact/4abVH1HPj3J5ARhLYwDWHS a „Splatkuj.sk vs. Autá za babku – predajný manuál“ https://claude.ai/artifact/6tdXMRUcm5XwbuHZGm6BrS. **Pri každej zmene funkcie, ktorú vidí používateľ (web, Laura, admin, CRM), aktualizuj aj príslušnú časť príručky** (text, prípadne novú snímku – v CRM len s ukážkovými, nie skutočnými údajmi klientov).
- **Kontrolný zoznam podľa strategického plánu** (Claude Docs, odškrtáva majiteľ aj Claude): https://claude.ai/artifact/DUyQJVGiotLsGvXy1D3wMj – **po dokončení úlohy z biblie ju tam odškrtni** (a súčasne v `docs/PLAN.md`).
- `PREVOD-NA-FIREMNY-UCET.md` – postup prechodu na firemný účet Claude.

## Pravidlá (od majiteľa)
- **`docs/strategia-znacky.md` (+ PDF) je záväzný dokument – „biblia“ firmy (rozhodnutie majiteľa 10. 10. 2026).** Každú úlohu, návrh aj rozhodnutie o webe, Laure, reklamách, značke a raste porovnaj s ním. Dodržuj poradie fáz a ich brány (ďalšia fáza až keď platí podmienka predchádzajúcej). Ak požiadavka ide proti dokumentu, upozorni na to a nechaj rozhodnúť majiteľa; zmenu dokumentu rob len na jeho pokyn. Stav fáz sleduj v `docs/PLAN.md` (sekcia Strategický plán).
- Nové autá od sledovaných predajcov spracovať bez pýtania (fotky, reklamy, video, web).
- Pole `sellerId` pri existujúcich autách nikdy nemeniť.
- Na webe ani u Laury nikde neuvádzať úrokovú sadzbu (percento úroku).
- Laura: šarmantná, pozitívna, vždy vyká, nikdy neflirtuje, chváli len to, čo auto naozaj má.
- Splátky na webe: 96 mesiacov, 0 % akontácia, výpočet orientačný.
- Značka: zelená #16B57F, písmo Unbounded 800 pre logo „splatkuj.sk“.
- Tajné kľúče (API kľúče, heslá) nikdy do repozitára ani do chatu – iba ako secret v Cloudflare.

## Predajcovia (sellerId → Bazoš)
andrej (Audi Predajca Andrej, idmail 6037421 a 6297575), denis (555779), erik (3725731), mf (4412376), peter (4667475), tiguan (Jožko, 1632788), p0902782833 (Juro Šipoš – hľadanie podľa telefónu), p0917881879 (Tibor Ferenczi – hľadanie podľa telefónu). Aktuálny zoznam je v admine (config/main → sources).
