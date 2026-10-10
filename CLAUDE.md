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
- `docs/PLAN.md` – plán a stav úloh (čo je hotové, čo ďalej). Po dokončení bodu ho odškrtni.
- `docs/laura-scenar.md` – scenár rozhovoru Laury.
- `docs/zasady-znacky.md` – 12 princípov budovania značky (Žltá kniha), podľa nich overovať rozhodnutia o značke.
- `docs/strategia-znacky.md` (+ PDF) – strategický základ značky.
- `PREVOD-NA-FIREMNY-UCET.md` – postup prechodu na firemný účet Claude.

## Pravidlá (od majiteľa)
- Nové autá od sledovaných predajcov spracovať bez pýtania (fotky, reklamy, video, web).
- Pole `sellerId` pri existujúcich autách nikdy nemeniť.
- Na webe ani u Laury nikde neuvádzať úrokovú sadzbu (percento úroku).
- Laura: šarmantná, pozitívna, vždy vyká, nikdy neflirtuje, chváli len to, čo auto naozaj má.
- Splátky na webe: 96 mesiacov, 0 % akontácia, výpočet orientačný.
- Značka: zelená #16B57F, písmo Unbounded 800 pre logo „splatkuj.sk“.
- Tajné kľúče (API kľúče, heslá) nikdy do repozitára ani do chatu – iba ako secret v Cloudflare.

## Predajcovia (sellerId → Bazoš)
andrej (Audi Predajca Andrej, idmail 6037421 a 6297575), denis (555779), erik (3725731), mf (4412376), peter (4667475), tiguan (Jožko, 1632788), p0902782833 (Juro Šipoš – hľadanie podľa telefónu), p0917881879 (Tibor Ferenczi – hľadanie podľa telefónu). Aktuálny zoznam je v admine (config/main → sources).
