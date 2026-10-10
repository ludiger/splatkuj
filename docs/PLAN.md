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
- [x] VY – Na platform.claude.com vytvoriť API kľúč a v Cloudflare (Pages → splatkuj → Settings → Variables and Secrets) pridať secret `ANTHROPIC_API_KEY`. Kľúč nikdy neposielať do chatu.
- [x] CLAUDE – Po pridaní: redeploy a test /api/chat – funguje (10. 10. 2026). Kľúč je v organizácii Splatkuj na platform.claude.com, scope Default workspace, bez expirácie; Laura hovorí v ženskom rode.
- [x] CLAUDE – Notifikácia o novom dopyte: kód hotový (`functions/_lib/notify.js`, push cez ntfy; v upozornení nie sú osobné údaje zákazníka, len záujem, auto a odkaz na /admin/dopyty). Stav: GET /api/lead → `notify: true/false`.
- [x] CLAUDE – Upozornenia prestavené na Telegram (bezplatné ntfy.sh odmieta správy z Cloudflare – denný limit podľa zdieľanej IP). Kód: `functions/_lib/notify.js`, test: POST /api/admin/notify-test, číslo chatu: POST /api/admin/telegram-setup.
- [x] VY – Telegram: bot cez @BotFather, `TELEGRAM_BOT_TOKEN` (secret) a `TELEGRAM_CHAT_ID` (text) sú v Cloudflare.
- [x] CLAUDE – Telegram otestovaný 10. 10. 2026 (notify-test aj skúšobný dopyt).
- [ ] VY – V Cloudflare zmazať NTFY_TOPIC a NTFY_TOKEN (ntfy sa nepoužíva); v admine → Dopyty zmazať dva skúšobné dopyty „TEST“.

## 2b. Predajcovia, kontrola cien a dávkové spracovanie (10. 10. 2026)
- [x] CLAUDE – Noví predajcovia v admine: Martin Trenčín, Autoslovakia (Tomáš, Levice), Predajca Nitra, Viktor (B. Bystrica). Ich 75 áut je zapísaných v admine s needsAds=true (bez fotiek, reklám a webu).
- [x] CLAUDE – Kontrola zmeny ceny pri každej kontrole (Bazoš aj vlastné weby): /api/inzerat vracia aj `price`, automatika pri zmene prepíše cenu v admine, na webe aj v galérii reklám (`automation/tools/process.py` → prices.json).
- [x] CLAUDE – Podpora áut z vlastných webov predajcov (zatiaľ Cooldrive): čísla 9xxxxxxxx, fotky z poľa `imgs`, existencia podľa VIN (`functions/_lib/foto.js`), čítanie webu na serveri (`functions/_lib/web.js`, POST /api/admin/web/list|detail|import).
- [x] CLAUDE – Úsporný beh: najviac 12 spracovaných áut za beh, zvyšok čaká (needsAds=true) na ďalší beh.
- [x] CLAUDE – Predajca Cooldrive (type web, 5 kategórií, 35 áut) a JD Autobazár (Bazoš: hľadanie podľa tel. 0918 811 395 + profil „Jan“) sú v admine. Skúšobné auto Mazda 6 (910000050) zapísané, 29 fotiek zálohovaných v R2, kontrola existencie a ceny funguje. Ostatné autá Cooldrive a JD pridá ranná automatika (po dávkach).
- [x] CLAUDE – Doplnené polia kw, drive, tags, yearText do 75 čakajúcich áut.
- [ ] CLAUDE – Mazda Prešov (mazdaihned.sk): zistiť, či sa dá ponuka čítať spoľahlivo (odkaz z chatu je dočasná adresa ich aplikácie).
- [x] CLAUDE – Prompt naplánovanej úlohy aktualizovaný podľa automation/PROMPT.md (schválené na Mac mini).
- [ ] CLAUDE – GRECAR (grecar.de/autobazar): odkazy sa menia → auto rozpoznávať podľa VIN, inak podľa značka+model+rok+km+výkon (+ prvá fotka); pri zmene odkazu ho len prepísať, nie označiť ako predané.
- [ ] SPOLU – Skontrolovať prvé ranné behy (dávky po 12 autách; vo fronte je ~76 áut + nové od Cooldrive a JD).

## 2c. Úpravy z druhej stránky kolegu (vrátime sa k tomu)
- [x] Spôsob predaja („Ako sa auto predalo?“ – cez nás / cez predajcu) – už je v admine v časti Predané a v analytike.
- [ ] CLAUDE – Analytika: prepínač, ktorý skryje predané autá, aby sa ukazovali len údaje o autách na predaj.
- [ ] SPOLU – Kalkulačka podľa ročníka auta: maximálna doba splácania podľa veku auta (napr. pri aute 2017 sa nedá zvoliť 8 rokov), akontácia predvolene 0 %. Treba presné pravidlo (max. vek auta na konci splácania alebo tabuľka ročník → max. doba) a súhlas majiteľa – dnes je na webe všade 96 mesiacov.
- [ ] VY – Poslať PDF s postupom k API (bez kľúča); kľúč vložiť len v Cloudflare ako secret (pozri bod 2).

## 2d. E-mail marketing a web (10. 10. 2026)
- [x] CLAUDE – Laura sa po telefóne opýta na dobrovoľný súhlas so zasielaním ponúk e-mailom (nič nie je predvolené); uloží e-mail, znenie a čas súhlasu (polia email, marketing, marketingAt, marketingText).
- [x] CLAUDE – Ochrana osobných údajov na webe doplnená o e-mailové ponuky so súhlasom a ich odvolanie.
- [x] CLAUDE – Admin → Dopyty: export CSV pre e-mail marketing (len so súhlasom) a export všetkých dopytov (Excel), štítok „📧 súhlas“.
- [x] CLAUDE – Admin → Newsletter: týždenný e-mail sa zostaví sám (nové autá, znížené ceny, výber týždňa, predané); kopírovanie HTML a predmetu; v pondelok pripomienka v rannej notifikácii.
- [x] CLAUDE – Web: zelený počet áut pri „Aktuálna ponuka“ a filter „splátka do“.
- [ ] VY – Vybrať e-mailový nástroj (Mailchimp, Ecomail, SmartEmailing…), importovať export so súhlasom a nastaviť značku odhlásenia v Newsletteri.
- [ ] VY – Overiť s právnikom znenie súhlasu a text v Ochrane osobných údajov (marketing).

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
