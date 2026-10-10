# Splatkuj.sk – čo všetko systém má a dokáže

Prehľad všetkých funkcií webu, Laury, adminu a automatiky. **Pri každej novej alebo zmenenej funkcii sa tento
dokument aktualizuje a na koniec sa doplní záznam do časti „Denník zmien“** (pravidlo je aj v CLAUDE.md).
Plán a otvorené úlohy sú v `docs/PLAN.md`.

Posledná aktualizácia: 10. 10. 2026

---

## 1. Web pre zákazníkov – www.splatkuj.sk

**Aktuálna ponuka áut**
- Všetky aktívne autá od sledovaných predajcov (Bazoš aj vlastné weby predajcov).
- Zelený údaj **Aktuálny počet vozidiel** vpravo od filtrov na výšku oboch riadkov (mení sa podľa filtra).
- **Filtre:** vyhľadávanie modelu, značka, palivo, cena do, **splátka do** (100–500 €/mes.), zoradenie (odporúčané, cena od najnižšej / najvyššej, rok od najnovšieho / najstaršieho, najazdené km od najmenej / najviac, výkon od najvyššieho, palivo A – Z). Na mobile v dvoch stĺpcoch.
- **Karta auta:** fotka, „splátka od“, rok, km, výkon, palivo, výbava (štítky).
- **Detail auta:** galéria všetkých fotiek, technické údaje, výbava zoskupená podľa kategórií, popis od predajcu, odkaz na pôvodný inzerát, tlačidlo na chat s Laurou.
- Autá, ktoré automatika ešte plne nespracovala, sa na webe zobrazujú hneď (fotky zo zálohy cez `/api/foto`). Po spracovaní ich nahradí plná verzia s vybranými fotkami a pečiatkou Splatkuj.
- Predané autá z webu zmiznú samy, zmenená cena sa prepíše sama.
- Priame odkazy na auto: `splatkuj.sk/#auto-<názov>-<číslo>` (používajú reklamy a newsletter).

**Kalkulačka splátok** – cena, akontácia, doba splácania; predvolene 96 mesiacov a 0 % akontácia; výpočet je orientačný, úroková sadzba sa nikde nezobrazuje.

**Služby** – kúpa auta na splátky, predaj vozidla, poistenie vozidla.

**Ďalšie časti** – blog (`blog/posts`), sekcia „Našli ste auto inde?“, **žiadosť o úver** v 3 krokoch namiesto kontaktného formulára (1. osobné údaje: meno, priezvisko, e-mail, telefón, dátum narodenia, kraj; 2. zdroj príjmu: SZČO / zamestnanec na Slovensku / v zahraničí / s.r.o. / dôchodca – podľa toho IČO s overením v registri, názov firmy, fakturácia, alebo zamestnávateľ s návrhmi z registra, nástup a čistý príjem; 3. deti, typ financovania, auto, súhrn splátky, prehlásenie) – dopyt ide do adminu → Dopyty a na Telegram, „Mám záujem“ v detaile auta žiadosť predvyplní aj s odkazom na auto, cookies so súhlasom (nevyhnutné / analytické / marketingové), Ochrana osobných údajov (vrátane e-mailových ponúk so súhlasom), prihlásenie do adminu (ikona v hlavičke a odkaz v pätičke).

## 2. Laura – virtuálna asistentka na webe

- Chat v pravom dolnom rohu, vždy vyká, je šarmantná a pozitívna, nikdy neflirtuje, chváli len to, čo auto naozaj má, o sebe hovorí v ženskom rode.
- **AI odpovede** cez Claude API (`/api/chat`, model claude-haiku-4-5), kľúč `ANTHROPIC_API_KEY` v Cloudflare. Ochrana kreditu: 40 správ z jednej IP za hodinu, 600 správ denne, krátke odpovede. Neuvádza úrokovú sadzbu ani RPMN, nesľubuje schválenie úveru.
- **Scenáre:** výber auta z ponuky, výpočet splátky, auto z iného inzerátu (odkaz), predaj auta, poistenie, časté otázky, otázky na príjem, IČO (dohľadanie firmy v registri cez `/api/firma`), ročník vozidla.
- **Predbežné posúdenie (7 otázok):** zdroj príjmu (zamestnanec na Slovensku / v zahraničí, SZČO, s.r.o., dôchodca, cudzinec), pri zamestnancovi pracovný pomer, zamestnávateľ, nástup a čistý príjem, pri SZČO/firme IČO (overené v registri) a priemerná fakturácia za 3 mesiace, pri dôchodcovi výška dôchodku; ďalej počet vyživovaných detí, exekúcie, registre, akontácia, doba splácania.
- Na konci zbiera meno a priezvisko, dátum narodenia (pri financovaní), telefón, e-mail (dá sa preskočiť), potom **dobrovoľný súhlas s e-mailovými ponukami** (nič nie je predvolené). Uloží znenie a čas súhlasu.
- Dopyt sa uloží do adminu (`/api/lead`) a zákazník ho môže poslať aj cez WhatsApp, SMS alebo zavolať.
- Scenár rozhovoru: `docs/laura-scenar.md`.

## 3. Upozornenia majiteľovi

- **Telegram:** pri každom novom dopyte príde správa „Nový dopyt od Laury“ (záujem, auto, zdroj, odkaz do adminu). **Bez mena a telefónu zákazníka** – tie sú len v admine.
- Nastavenie: `TELEGRAM_BOT_TOKEN` (secret) a `TELEGRAM_CHAT_ID` (text) v Cloudflare. Test: tlačidlo/volanie `POST /api/admin/notify-test`.
- **Ranná notifikácia automatiky** (push z Claude): čo pribudlo, čo sa predalo, zmeny cien, koľko áut čaká; v pondelok aj pripomienka newslettera.

## 4. Admin – www.splatkuj.sk/admin

Prihlásenie menom a heslom (majiteľ a kolegyňa), záchranné kódy, záznam prihlásení a zmien.

- **Inzeráty:** zoznam všetkých áut (aktívne, predané, čakajúce na kontrolu, nové za 7 dní), predajcovia (filtrovanie, úprava mena a odkazov), pridanie inzerátov z Bazoša. Klik na názov auta otvorí **náš inzerát na webe** (detail auta, odkaz `splatkuj.sk/#detail-<číslo>`), pri predanom aute uloženú kópiu; ikonka ↗ vedľa otvorí **pôvodný inzerát** na Bazoši alebo na webe predajcu (napr. cooldrive.sk).
- **Predané autá:** uložená kópia inzerátu, doba predaja, **„Ako sa auto predalo?“** (cez nás / cez predajcu).
- **Analytika:** prepínač Predané / Aktívne / Všetky, dosah a kliknutia, grafy (napr. ako sa autá predali).
- **Reklamy** (`/admin/reklamy`): galéria reklám (príspevok, story) a videí ku každému autu.
- **Dopyty a obchody – CRM** (`/admin/dopyty`): dopyty od Laury aj žiadosti o úver; fázy obchodu (Nový dopyt, Prvý kontakt, Zber podkladov, Na posúdení, Schválené, Zmluva / podpis, Uzavreté; stratené: Zamietnuté, Bez záujmu, Nedvíha + dôvod), pri každej fáze postup hovoru / krokov na odškrtnutie, ďalší krok s termínom (Dnes, Zajtra, O 3 dni, O týždeň), aktivity (hovor, SMS, e-mail, podklady…), kto obchod rieši, výška financovania, prehľad čísel, **📊 týždenný prehľad 5 čísel** (8 týždňov) a **📍 odkiaľ prišiel zákazník** (zdroje za 90 dní), filtre (Rozpracované, Úlohy na dnes, Moje, Uzavreté, Stratené), zobrazenie Zoznam / Lievik, poznámky, štítok „📧 súhlas“, **export pre e-mail marketing (CSV, len so súhlasom)**, **export všetkých dopytov (Excel)**, zmazanie dopytu (len majiteľ, s potvrdením).
- **Newsletter** (`/admin/newsletter`): týždenný e-mail sa zostaví sám – nové autá, autá so zníženou cenou, výber týždňa (téma sa strieda), počet predaných; náhľad, kopírovanie HTML a predmetu, stiahnutie .html, nastavenie značky odhlásenia (Mailchimp `*|UNSUB|*`).
- **Účet** (`/admin/ucet`): zmena hesla, záchranný kód, ľudia s prístupom, posledné prihlásenia a zmeny.
- Fotky: trvalá záloha v R2 (`splatkuj-fotky`); 7 dní po predaji sa zmažú všetky fotky okrem jednej (náhľad).

## 5. Automatika – naplánovaná úloha „Autá – kontrola, nové a predané“

Beží **každý deň o 7:52** na Mac mini (potrebuje Chrome s rozšírením Claude a prihlásenie do adminu). Prompt: `automation/PROMPT.md`.

1. **Kontrola všetkých aktívnych áut** – či inzerát ešte existuje a aká je cena (trvá pár sekúnd, robí to server).
   - zmiznutý inzerát → auto ide medzi predané a stiahne sa z webu,
   - zmenená cena → prepíše sa v admine, na webe aj v galérii reklám (poistka: zmena o viac ako 50 % sa neprepíše, len sa ohlási).
2. **Nové autá** od všetkých predajcov sa zapíšu do adminu **hneď všetky** (aj pri novom predajcovi celý jeho inzerát naraz) a hneď sú na webe.
3. **Plné spracovanie** (výber fotiek, pečiatka, reklamy, video, web) najviac 12 áut za deň, najprv tie, ktoré čakajú najdlhšie.
4. **Znovu vložené autá** (predajca zmaže a znovu vloží inzerát) sa rozpoznajú a neberú sa ako predaj.
5. Preskakujú sa diely a príslušenstvo a autá pod 2 500 €.
6. Na záver jedna notifikácia a zápis do adminu (lastRunAt, súhrn).

## 6. Predajcovia (zdroje áut)

- **Bazoš – profil predajcu** (hodnotenie.php) alebo **hľadanie podľa telefónu** (search.php); jeden predajca môže mať viac odkazov.
- **Vlastný web predajcu** – zatiaľ **Cooldrive** (cooldrive.sk, 5 cenových kategórií). Web číta priamo server (`/api/admin/web/list|detail|import`), auto sa spoznáva podľa **VIN**; čísla áut 91xxxxxxx.
- Aktuálny zoznam predajcov je v admine (config/main → sources). K 10. 10. 2026: Juro Šipoš, Jožko, Denis, Peter, Matúš, Erik, Tibor Ferenczi, Audi Predajca Andrej, Martin Trenčín, Autoslovakia (Tomáš, Levice), Predajca Nitra, Viktor (B. Bystrica), Cooldrive (Fiľakovo), JD Autobazár (Myjava), Zoltan (Nitra).

## 7. Server (Cloudflare Pages Functions)

| Adresa | Čo robí |
|---|---|
| `/api/admin/…` | prihlásenie, používatelia, dáta adminu, záloha fotiek (`archiv`), upratanie fotiek (`cleanup`), weby predajcov (`web/…`), newsletter, test upozornení, nastavenie Telegramu |
| `/api/lead` | uloženie dopytu od Laury + upozornenie; GET = stav upozornení |
| `/api/chat` | Laura cez Claude API; GET = či je zapnutá |
| `/api/social` | Laura na Facebooku a Instagrame cez schválený nástroj (ManyChat – External Request); overenie hlavičkou `x-sk-secret` = secret `SOCIAL_SECRET`; rozhovor v D1 (konverzacie), pri telefóne vznikne dopyt v CRM s prepisom + Telegram |
| `/api/ponuka` | autá z adminu, ktoré ešte čakajú na spracovanie (web ich zobrazí hneď) |
| `/api/inzerat/<id>` | čerstvý stav inzerátu: existuje?, cena, počet fotiek, popis |
| `/api/foto/<id>/<n>` | fotka auta (z R2 zálohy, inak z Bazoša alebo z webu predajcu) |
| `/api/firma` | dohľadanie firmy podľa IČO (register RPO) |
| `/api/laura` | fotka a video Laury |

Tajné údaje sú len v Cloudflare (Pages → splatkuj → Settings → Variables and Secrets): `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`; ďalej `TELEGRAM_CHAT_ID`. Nikdy nie v repozitári ani v chate.

## 8. Súkromie a pravidlá

- Do upozornení a newslettera sa nedávajú osobné údaje zákazníkov.
- E-mail marketing len kontaktom so súhlasom; v každom e-maile odkaz na odhlásenie.
- Na webe, u Laury ani v e-mailoch sa neuvádza úroková sadzba.
- Splátky: 96 mesiacov, 0 % akontácia, orientačný výpočet.
- Značka: zelená #16B57F, písmo Unbounded 800 pre logo.

---

## Denník zmien

Formát: dátum – čo pribudlo alebo sa zmenilo (kto).

- **10. 10. 2026** – Prechod na firemný účet Claude; naplánovaná úloha raz denne o 7:52 (Claude).
- **10. 10. 2026** – Upozornenia o nových dopytoch cez Telegram (bez osobných údajov), diagnostika `notify-test` (Claude).
- **10. 10. 2026** – Laura s AI zapnutá (Claude API, kľúč vo workspace Default); Laura hovorí v ženskom rode (Claude).
- **10. 10. 2026** – Kontrola zmeny ceny pri každej rannej kontrole (Bazoš aj weby predajcov), prepis ceny na webe a v reklamách; poistka pri zmene o viac ako 50 % (Claude).
- **10. 10. 2026** – Podpora áut z vlastných webov predajcov – Cooldrive (čítanie na serveri, VIN, fotky cez `/api/foto`) (Claude).
- **10. 10. 2026** – Noví predajcovia: Martin Trenčín, Autoslovakia, Predajca Nitra, Viktor, Cooldrive, JD Autobazár, Zoltan (Claude).
- **10. 10. 2026** – Všetky aktívne autá z adminu sú hneď na webe (`/api/ponuka`); pri novom predajcovi sa stiahnu všetky inzeráty naraz, plné spracovanie 12 áut denne (Claude).
- **10. 10. 2026** – Web: zelený „Aktuálny počet vozidiel“, filter „splátka do“, filtre na mobile v dvoch stĺpcoch (Claude).
- **10. 10. 2026** – E-mail marketing: súhlas v Laure, Ochrana osobných údajov, export CSV v Dopytoch, týždenný Newsletter v admine (Claude).
- **10. 10. 2026** – Admin Dopyty: tlačidlo Zmazať pre majiteľa (Claude).
- **10. 10. 2026** – Dokument FUNKCIE.md s prehľadom funkcií a denníkom zmien (Claude).
- **10. 10. 2026** – Web: rozšírené zoradenie (cena, rok, km, výkon, palivo – oboma smermi), počet vozidiel na výšku dvoch riadkov filtrov (Claude).
- **10. 10. 2026** – Admin → Inzeráty: klik na auto otvorí náš inzerát na webe, ikonka ↗ pôvodný inzerát (Bazoš / web predajcu); web vie otvoriť detail auta odkazom `#detail-<číslo>` (Claude).
- **10. 10. 2026** – Kontaktný formulár na webe funguje: dopyt sa uloží do adminu → Dopyty (zdroj „kontaktný formulár“, kraj, typ financovania) a príde upozornenie na Telegram; tlačidlo „Mám záujem“ v detaile auta vloží do formulára aj odkaz na auto (Claude).
- **10. 10. 2026** – Kontaktný formulár: po odoslaní sa formulár nahradí výrazným potvrdením „Dopyt sme prijali“ (✓, meno, telefón), tlačidlo počas odosielania ukazuje „Odosielam…“ (Claude).
- **10. 10. 2026** – Žiadosť o úver v 3 krokoch na webe; Laura sa pýta na rovnaké údaje (zdroj príjmu vrátane zamestnanca v zahraničí, zamestnávateľ, nástup, príjem/fakturácia, deti, priezvisko, dátum narodenia, e-mail); /api/firma overuje IČO v RPO so zálohou v Registri účtovných závierok a vie hľadať firmy podľa názvu; doplnená Ochrana osobných údajov (Claude).
- **10. 10. 2026** – Detail auta: klient si vyberie akontáciu 0 / 10 / 20 / 30 % a splátka sa prepočíta (predvolene 0 %); v žiadosti o úver pole Akontácia (0 – 50 %) so súhrnom splátky; pri živnostníkoch sa pri výpadku registra RPO nehlási „nenašlo sa“, ale „overíme ručne“ (Claude).
- **10. 10. 2026** – Žiadosť o úver: pri zamestnancovi sa pod poľom „Názov zamestnávateľa“ ukazujú návrhy firiem z Obchodného registra (orsr.sk), záloha RPO (Claude).
- **10. 10. 2026** – Admin → **Dopyty a obchody (CRM)**: fázy obchodu (nový dopyt → prvý kontakt → zber podkladov → na posúdení → schválené → zmluva → uzavreté; stratené s dôvodom), postup hovoru na odškrtnutie pre každú fázu, ďalší krok s termínom, záznam aktivít, „Prevziať“, výška financovania, prehľad (nové na zavolanie, po termíne, na dnes, uzavreté v mesiaci, úspešnosť), zobrazenie Lievik; upozornenie na Telegram otvorí priamo daný dopyt; ranná notifikácia pripomenie úlohy z CRM (Claude).
- **10. 10. 2026** – Reklamy (post, story, video) dávkovo aj pre autá, ktoré boli na webe len cez /api/ponuka; takéto autá majú v admine webApi=true a na webe ostávajú cez /api/ponuka s fotkami zo zálohy (Claude).
- **10. 10. 2026** – Žiadosť o úver: typ financovania len Autoúver a Úver; pri aute do roku 2014 sa automaticky zvolí Úver (autoúver sa nedá vybrať), pri novšom Autoúver (Claude).
- **10. 10. 2026** – CRM: pri každom dopyte „📞 Call skript – čo povedať klientovi“ – personalizovaný podľa údajov zo žiadosti (meno, auto, príjem, akontácia, splátka, typ financovania): úvod, overenie auta, príjem a registre, podmienky, odpovede na námietky, podklady a ďalší krok; pri nových dopytoch je otvorený (Claude).
- **10. 10. 2026** – CRM: ručné zadanie dopytu (➕ Nový dopyt – telefonát, Facebook, Instagram, WhatsApp, osobne…); pri dopyte „💬 Celý rozhovor“ – web Laura posiela s dopytom celý prepis chatu; nové /api/social pre Lauru na Facebooku a Instagrame (cez ManyChat) s ukladaním rozhovoru a dopytu do CRM; odkaz splatkuj.sk/#laura otvorí rovno chat s Laurou (Claude).
- **10. 10. 2026** – Web: hlavná fotka hore je sivá Tesla Model Y s polepom Splatkuj.sk na D1 (pôvodná fotka Kodiaqu ostáva ako img/hero-kodiaq.jpg); karta pri fotke: akontácia od 0 %, auto od akéhokoľvek predajcu (Claude).
- **10. 10. 2026** – Strategický dokument (docs/strategia-znacky.md + PDF) vyhlásený za záväzný; pravidlo v CLAUDE.md, v PLAN.md nová sekcia Strategický plán s fázami 1–5, bránami a prechodom z Autá za babku (majiteľ, Claude).
- **10. 10. 2026** – Fáza 1 strategického plánu: v CRM pole „📍 Odkiaľ prišiel“ (Bazoš, Facebook, Instagram, TikTok, Google, web, odporúčanie, stály zákazník, predajca, iné) – odhad z odkazu, z ktorého klient prišiel na web (?z=, utm_source, fbclid, referrer), alebo z kanála; vo formulári žiadosti nepovinná otázka „Ako ste sa o nás dozvedeli?“; pri ručnom dopyte výber. Týždenný prehľad 5 čísel (dopyty, žiadosti = fáza Na posúdení, schválené, uzavreté, prefinancovaná suma) za 8 týždňov a zdroje zákazníkov za 90 dní; stĺpec Odkiaľ prišiel v exporte. Oprava: formulár ručného dopytu bol stále viditeľný (Claude).
- **10. 10. 2026** – CRM call skript: pri exekúcii sa operátor opýta, či má klient v rodine dôveryhodnú osobu, ktorá mu vie pomôcť (úver na ňu); ak áno, dohodne sa s ňou hovor, inak slušné ukončenie (majiteľ, Claude).
- **10. 10. 2026** – CRM: časomiera oslovenia pri každom novom dopyte – odpočítava 30 minút od prijatia (zelená, pod 10 min oranžová, po termíne červená bliká); po prvom kontakte (posun fázy alebo zapísaná aktivita) sa uloží čas prvého oslovenia a zobrazí „✓ oslovený za X min“; ukazovateľ „Oslovené do 30 min“ (% a medián za 30 dní); v upozornení na Telegrame „⏱ Osloviť do HH:MM“ (majiteľ, Claude).
- **10. 10. 2026** – CRM Lievik: stĺpce sa zalamujú do riadkov (nič netreba posúvať), kartu dopytu možno presunúť do inej fázy potiahnutím myšou alebo šípkami ◀ ▶; presun sa zapíše do aktivít ako zmena fázy (Claude).
- **10. 10. 2026** – CRM: tlačidlo „✓ Oslovil som“ pri časomiere – jedným klikom zapíše prvé oslovenie (aktivita Hovor), zastaví časomieru a posunie dopyt na Prvý kontakt (Claude).
- **10. 10. 2026** – CRM: odovzdanie rozpracovaného obchodu kolegovi – pri každom dopyte výber „👤 Rieši“ so zoznamom používateľov adminu; zmena sa zapíše do aktivít (kto komu odovzdal). Nové GET /api/admin/team (len mená, pre prihlásených) (majiteľ, Claude).
- **10. 10. 2026** – CRM: „💬 Správa klientovi na WhatsApp / SMS“ – 9 šablón podľa fázy žiadosti (nedvíha, prosba o podklady s dokladmi podľa zdroja príjmu, pripomienka, podklady prijaté, na posúdení, schválené, termín podpisu, poďakovanie po odovzdaní, zamietnuté); šablóna sa vyberie sama podľa fázy, text sa dá upraviť, tlačidlo otvorí WhatsApp (alebo SMS) s hotovou správou a odoslanie sa zapíše do aktivít; rozbalené časti karty ostávajú otvorené aj po uložení (Claude).
