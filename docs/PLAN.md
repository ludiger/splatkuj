# Splatkuj.sk – plán (stav k 10. 10. 2026)

Prenesené zo súkromného účtu (stránka „Splatkuj plán“) a aktualizované. Hotové body sú označené [x].
Pri práci na pláne: vždy si najprv prečítaj CLAUDE.md, potom tento súbor; po dokončení bodu ho tu odškrtni a pushni.

Legenda: **VY** = robí majiteľ, **CLAUDE** = robí Claude, **SPOLU** = spoločne.

## Hotové
- [x] Web www.splatkuj.sk (Cloudflare Pages) s autami od sledovaných predajcov, kalkulačka (96 mesiacov), Laura (fotka + video).
- [x] Reklamy, videá a texty pre každé auto (galéria www.splatkuj.sk/admin/reklamy).
- [x] Admin s heslami (majiteľ + kolegyňa), predané autá, analytika, dopyty z Laury (/admin/dopyty), záchranné kódy.
- [x] Trvalá záloha fotiek v R2. 7 dní po predaji sa fotky auta zmažú, ostane len 1 náhľad (POST /api/admin/cleanup, spúšťa sa sám raz denne pri otvorení adminu).
- [x] Automatika (naplánovaná úloha) – raz denne ráno, nové + predané + znovu vložené autá.
- [x] Doména na Cloudflare, e-mail info@splatkuj.sk (Email Routing do Gmailu).
- [x] Firemný účet Claude (info@splatkuj.sk, Max), GitHub pripojený, projekt Splatkuj.sk.
- [x] Prihlásenie do adminu: malá ikona v hlavičke webu + odkaz v pätičke.

## 1. Dokončenie prechodu (hneď)
- [ ] VY – Zrušiť súkromné predplatné na iPhone (Nastavenia → meno → Predplatné → Claude) až keď firemná automatika prešla.
- [ ] VY – V starom (súkromnom) účte nechať starú naplánovanú úlohu vypnutú (je vypnutá).
- [ ] VY – Admin → Účet: vytvoriť záchranný kód a pridať kolegyňu.
- [ ] VY – Home Assistant: v termináli `claude` → `/logout`, `/login` firemným účtom; odstrániť ANTHROPIC_API_KEY z prostredia, starý kľúč zmazať v Console.

## 2. Laura s AI pre návštevníkov
- [x] CLAUDE – Kód hotový (`functions/api/chat.js`, limity 40/IP/h, 600/deň, model claude-haiku-4-5).
- [ ] VY – Na platform.claude.com vytvoriť API kľúč a v Cloudflare (Pages → splatkuj → Settings → Variables and Secrets) pridať secret `ANTHROPIC_API_KEY`. Kľúč nikdy neposielať do chatu.
- [ ] CLAUDE – Po pridaní: prázdny commit (redeploy) a test /api/chat (GET → enabled: true).
- [x] CLAUDE – Notifikácia o novom dopyte: kód hotový (`functions/_lib/notify.js`, push cez ntfy; v upozornení nie sú osobné údaje zákazníka, len záujem, auto a odkaz na /admin/dopyty). Stav: GET /api/lead → `notify: true/false`.
- [ ] VY – Zapnúť upozornenia: do telefónu nainštalovať aplikáciu ntfy, odoberať novú tému s dlhým náhodným názvom (napr. splatkuj- + 20 náhodných znakov) a ten istý názov pridať v Cloudflare (Pages → splatkuj → Settings → Variables and Secrets) ako secret `NTFY_TOPIC`. Názov témy neposielať do chatu.
- [ ] CLAUDE – Po pridaní: redeploy a skúšobný dopyt.

## 2b. Predajcovia, kontrola cien a dávkové spracovanie (10. 10. 2026)
- [x] CLAUDE – Noví predajcovia v admine: Martin Trenčín, Autoslovakia (Tomáš, Levice), Predajca Nitra, Viktor (B. Bystrica). Ich 75 áut je zapísaných v admine s needsAds=true (bez fotiek, reklám a webu).
- [x] CLAUDE – Kontrola zmeny ceny pri každej kontrole (Bazoš aj vlastné weby): /api/inzerat vracia aj `price`, automatika pri zmene prepíše cenu v admine, na webe aj v galérii reklám (`automation/tools/process.py` → prices.json).
- [x] CLAUDE – Podpora áut z vlastných webov predajcov (zatiaľ Cooldrive): čísla 9xxxxxxxx, fotky z poľa `imgs`, existencia podľa VIN (`functions/_lib/foto.js`), čítanie webu na serveri (`functions/_lib/web.js`, POST /api/admin/web/list|detail|import).
- [x] CLAUDE – Úsporný beh: najviac 12 spracovaných áut za beh, zvyšok čaká (needsAds=true) na ďalší beh.
- [ ] CLAUDE – Pridať predajcu Cooldrive (5 kategórií, ~35 áut) a JD Autobazár (Bazoš: hľadanie podľa tel. 0918 811 395 + profil „Jan“) do adminu a prvé autá spracovať na skúšku.
- [ ] CLAUDE – Doplniť do 75 čakajúcich áut polia kw, drive, tags, yearText (pre spracovanie v ďalších behoch).
- [ ] CLAUDE – Mazda Prešov (mazdaihned.sk): zistiť, či sa dá ponuka čítať spoľahlivo (odkaz z chatu je dočasná adresa ich aplikácie).
- [ ] CLAUDE – Aktualizovať prompt naplánovanej úlohy podľa automation/PROMPT.md (zmena promptu musí schváliť majiteľ v aplikácii na počítači).

## 2c. Úpravy z druhej stránky kolegu (vrátime sa k tomu)
- [x] Spôsob predaja („Ako sa auto predalo?“ – cez nás / cez predajcu) – už je v admine v časti Predané a v analytike.
- [ ] CLAUDE – Analytika: prepínač, ktorý skryje predané autá, aby sa ukazovali len údaje o autách na predaj.
- [ ] SPOLU – Kalkulačka podľa ročníka auta: maximálna doba splácania podľa veku auta (napr. pri aute 2017 sa nedá zvoliť 8 rokov), akontácia predvolene 0 %. Treba presné pravidlo (max. vek auta na konci splácania alebo tabuľka ročník → max. doba) a súhlas majiteľa – dnes je na webe všade 96 mesiacov.
- [ ] VY – Poslať PDF s postupom k API (bez kľúča); kľúč vložiť len v Cloudflare ako secret (pozri bod 2).

## 3. Sociálne siete – automatické zverejňovanie áut
- [ ] VY – Prihlásiť Instagram (firemný) vo Windsor.ai.
- [ ] VY – Prihlásiť TikTok v Higgsfield.
- [ ] VY – Byť prihlásený na Facebooku (Meta Business Suite) v Chrome.
- [ ] VY – Prihlásiť Facebook a Instagram v Supermetrics (dosah, kliknutia).
- [ ] CLAUDE – Denné zverejňovanie so schvaľovaním v admine (tlačidlo „Zverejniť“ pri aute).
- [ ] CLAUDE – Príspevok „Predané ✅“ pri predanom aute.
- [ ] SPOLU – Po týždni prepnúť na plne automatické.
- [ ] VY – Meta Ads: prístup k reklamnému účtu (voliteľné).

## 4. Meranie a SEO
- [ ] CLAUDE – Meranie kliknutí podľa siete (?z=fb, ig, tt) a zobrazenie v admine.
- [ ] CLAUDE – Stránka pre každé auto, sitemap.xml, llms.txt, schema.org (SEO a AI vyhľadávanie).
- [ ] CLAUDE – Blog (`blog/posts`) – pravidelné články.

## 5. Právne a dôvera
- [ ] VY – Rozhodnúť o reprezentatívnom príklade v reklamách (teraz je v popiskoch galérie „9,9 % p.a., RPMN 10,36 %“; na webe a u Laury sa úrok neuvádza). Overiť s právnikom/NBS, čo musí reklama na úver obsahovať.
- [ ] CLAUDE – Do pätičky doplniť sídlo, IČO a registračné číslo NBS (číslo dodá majiteľ).

## 6. Značka a prechod z Autá za babku (pozri docs/zasady-znacky.md a docs/strategia-znacky.md)
- [ ] VY – Poslať fotky pracovných listov zo Žltej knihy.
- [ ] CLAUDE – Doplniť chýbajúce princípy: Zrkadlo, Kmeň, OSŤ, Brand Board.
- [ ] SPOLU – Google Business profil Splatkuj.sk.
- [ ] SPOLU – Presmerovať autazababku.sk → splatkuj.sk.
- [ ] VY – Premenovať FB stránku a Instagram Autá za babku na Splatkuj.sk.
- [ ] VY – Zvážiť kúpu splatkuj.com a ochrannú známku.
