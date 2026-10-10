# Prompt naplánovanej úlohy „Autá – kontrola, nové a predané“

Spúšťa sa raz denne o 7:52 (Europe/Bratislava). Predajcovia sú na Bazoši alebo na vlastnom webe (zatiaľ Cooldrive – cooldrive.sk). Úloha musí bežať na počítači majiteľa
(potrebuje Claude v Chrome, kde je majiteľ prihlásený do www.splatkuj.sk/admin).
Nižšie je presný text, ktorý sa vloží ako prompt úlohy.

---

Úsporne skontroluj autá sledovaných predajcov (Bazoš aj vlastné weby predajcov): zisti PREDANÉ autá, ZMENY CENY a NOVÉ autá, nové HNEĎ celé spracuj (fotky, reklamy, video, web) a všetko zapíš do adminu na www.splatkuj.sk/admin. Pracuj bez otázok. Nikomu nič neposielaj okrem jednej push notifikácie majiteľovi na konci. Šetri tokeny: stránky čítaj cez JavaScript (fetch + DOMParser), screenshoty/zoom rob LEN pri fotkách v kroku B. Pole sellerId pri existujúcich autách NIKDY nemeň.

ADMIN = www.splatkuj.sk (Cloudflare, databáza D1). Číta sa a zapisuje cez Chrome v karte na https://www.splatkuj.sk/admin/ – majiteľ je tam prihlásený, takže fetch má jeho prihlásenie. Pomocník (vlož na začiatok každého javascript_tool v tejto karte):
const A=(p,b,m)=>fetch('/api/admin/'+p,{method:m||(b?'POST':'GET'),headers:{'content-type':'application/json','x-sk-admin':'1'},body:b?JSON.stringify(b):undefined}).then(async r=>({s:r.status,j:await r.json().catch(()=>({}))}));
- čítanie: A('docs/inzeraty') → j.docs[{id,data}], A('doc/config/main') → j.data (sources = predajcovia {id,name,url,links[]}; predajca s type:"web" a site:"cooldrive" má autá na vlastnom webe, links = jeho kategórie).
- zápis: A('bulk',{docs:[{coll:'inzeraty',id:adId,data:{…},mode:'merge'|'set'|'delete'}]}) – najviac 200 naraz; pri 'merge' sa polia doplnia/prepíšu, {"__delete__":true} pole zmaže.
- záloha fotiek do úložiska: A('archiv/'+adId,{}) opakuj, kým j.remaining nie je 0 (najviac 6×).
- čerstvý stav inzerátu: fetch('/api/inzerat/'+adId+'?p='+slug+'&fresh=1') → 200 {ok:true,n,price} = inzerát existuje (price = aktuálna cena alebo null), 404 = zmazaný/predaný (slug = časť url za /inzerat/ID/). Autá z vlastného webu predajcu majú adId 9xxxxxxxx a namiesto slugu sa posiela p=web.
- cena v texte: (n)=>n.toLocaleString('sk-SK').replace(/\s/g,' ')+' €' (napr. "25 990 €").

ČÍSLA ÁUT Z VLASTNÝCH WEBOV: 9-miestne, začínajú deviatkou – Cooldrive 91 + číslo stránky na 7 miest (…/m50 → 910000050). Ich dokument má navyše src:"web", imgs (adresy fotiek v poradí, fotka N = imgs[N-1]), mark (VIN – podľa neho server pozná, že inzerát ešte existuje) a popis (údaje a výbava z webu).

REPOZITÁR: GitHub ludiger/splatkuj (vetva main) – Cloudflare z neho po každom pushnutí nasadí www.splatkuj.sk. Zdroj webu src/web.html, zdroj galérie reklám src/ads.html, nástroje automation/tools, dáta automation/data.
Bazoš zakazuje automatom (WebFetch) čítať stránky predajcov, preto ich čítaj cez Claude in Chrome (to isté platí pre weby predajcov). Stránky predajcov (hodnotenie.php, search.php) fetchuj z karty na www.bazos.sk, detaily inzerátov (auto.bazos.sk/inzerat/ID/slug.php – vždy s plným slugom) z karty na auto.bazos.sk.

A) KONTROLA A NÁJDENIE
1. ToolSearch "select:PushNotification,mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__browser_batch,mcp__claude-in-chrome__tabs_close_mcp". Ak Chrome nie je dostupný: pošli PushNotification (status "proactive") "Automatika: Chrome nebol dostupný – skontrolujte, či je otvorený Chrome s rozšírením Claude." a skonči.
   Hneď potom repozitár: zavolaj nástroj add_repo (owner "ludiger", repo "splatkuj", access "push"; načítaj ho cez ToolSearch "add_repo") a urob git clone podľa jeho pokynov do /tmp/sk/repo (nástroje z automation/tools sú potrebné v krokoch 9–13).
2. Vytvor kartu (tabs_create_mcp) a otvor https://www.splatkuj.sk/admin/. javascript_tool: A('me'). Ak s=401: pošli PushNotification "Automatika: v Chrome nie ste prihlásený do adminu – otvorte www.splatkuj.sk/admin a prihláste sa." a skonči. Inak načítaj A('docs/inzeraty') a A('doc/config/main').
3. KONTROLA PREDANÝCH A CIEN (v karte admina, jeden javascript_tool, paralelne po 6): pre každé auto so status "aktivny", "caka" alebo "chyba" zisti čerstvý stav cez /api/inzerat/…&fresh=1 (pri adId 9xxxxxxxx p=web). Nič iné sa pri existujúcich autách nesťahuje.
   - 200 → merge {status:"aktivny", checkedAt: teraz, note:{"__delete__":true}}. Ak j.price je číslo a líši sa od priceNum (alebo od čísla v poli price, keď priceNum chýba): do toho istého merge pridaj {priceNum: j.price, price: cena v texte, priceOld: stará cena (číslo), priceChangedAt: teraz}; zapamätaj ako ZMENA CENY (adId, názov, stará → nová cena). Ak je auto už na webe (needsAds nie je true), patrí do prices.json v kroku 11.
   - 404 → merge {status:"predany", soldAt: teraz (len ak ešte nie je), checkedAt: teraz}; zapamätaj ako NOVO PREDANÉ.
   - iná chyba → merge {status:"chyba", note:"…", checkedAt: teraz}.
   Zapíš jedným A('bulk',…). Archívne polia (title, price, carTitle, photo, desc, why, fotky…) nikdy nemaž.
4. ZÁLOHA FOTIEK: pre každé auto so status "aktivny" bez poľa fotky (alebo s fotky=[]) zavolaj A('archiv/'+adId,{}) až do remaining 0.
5. Vytvor druhú kartu a otvor https://www.bazos.sk/. Jedným javascript_tool pre všetky odkazy predajcov (links, inak url) urob fetch aj so stránkovaním (&crz=20, &crz=40… kým pribúdajú) a vytiahni /auto\.bazos\.sk\/inzerat\/(\d+)\/([^"'\s>]+)/ s id predajcu; vráť len adId + slug, ktoré NIE SÚ v databáze. Predajcov s type:"web" tu vynechaj.
   VLASTNÉ WEBY (predajcovia s type:"web", web číta server – nič sa neprenáša cez kartu): v karte admina pre každý site A('web/list',{site}) → j.cars = nové autá [{id,url}] (už bez tých v databáze), j.sellerId, j.loc. Pre ne (najviac 12 – pozri krok 6) A('web/detail',{site,url}) → j.car {id, title, price, yearText, km, kw, fuel, gear, drive, body, mark, nimg, eq[]}. Auto, ktoré zmizlo z webu, sa ako predané zistí už v kroku 3.
6. V karte na https://auto.bazos.sk/ jedným javascript_tool stiahni ich detail (fetch plnej url so slugom + DOMParser): h1, cena (bunka za "Cena:"), lokalita (za "Lokalita:"), .popisdetail (1500 znakov), počet fotiek (max N z /img/N/xxx/ID).
   - Preskoč diely/príslušenstvo (disky, pneumatiky, elektróny, nárazník, diely…) a cenu pod 2 500 €.
   - ZNOVU VLOŽENÉ auto (rovnaký predajca, rovnaká značka+model, cena ±5 %, rovnaký rok/km; starý inzerát je "predany" alebo už na Bazoši nie je): vytvor nový dokument (mode "set") ako kópiu starého so zmeneným adId, url, status "aktivny", title, price, checkedAt, relistedFrom; bez soldAt; starý zmaž (mode "delete"). Po kroku 8 uprav pracovnú kópiu /tmp/sk/web.html: do objektu RL pridaj pár 'staréId':'novéId', nahraď starú url novou a ak bolo staré auto v HIDE, odstráň ho odtiaľ (kroky 11–13 to prenesú na web). Nie je to predaj ani nové auto.
   - Ostatné = NOVÉ AUTÁ. Zapíš (mode "set") dokumenty: adId, url, sellerId, status "aktivny", needsAds true, addedAt/checkedAt (ISO teraz), title, price ("25 990 €"), priceNum, location, carTitle (čistý názov), brand, model, body (SUV/Kombi/Hatchback/Sedan / liftback/Van / MPV/Kupé / kabriolet), year (číslo), yearText ("5/2021" alebo "2021"), km (číslo), kw (číslo), fuel, gear, drive ("4x4"/"Predný"/"Zadný"/"—"), tags (max 6 krátkych výbav – len to, čo v inzeráte naozaj je), desc (2 vety po slovensky), why (1 veta po slovensky, prečo auto chcieť – pre koho sa hodí). Autá z vlastného webu nezapisuj cez bulk, ale A('web/import',{site, url, data:{sellerId, location (j.loc), carTitle, brand, model, body, tags, desc, why}}) – server doplní fotky (imgs), VIN, cenu, rok, km, výkon a popis. Potom pre každé nové auto urob zálohu fotiek ako v kroku 4.
   - ÚSPORNOSŤ: v jednom behu spracuj (kroky 9–14) najviac 12 áut: najprv ČAKAJÚCE (aktívne dokumenty s needsAds=true z minulých behov, najstaršie addedAt), potom nové. Zvyšné nové autá len zapíš do adminu s needsAds=true – spracuje ich ďalší beh. Pre čakajúce autá ber údaje z ich dokumentu v admine.
7. PREDANÉ na stiahnutie z webu: dokumenty so status "predany" a bez webRemoved=true (a bez relistedFrom-nástupcu).
Ak nie sú nové ani čakajúce autá, predané na stiahnutie, znovu vložené ani ZMENY CENY áut na webe → choď na krok D.

B) PRÍPRAVA A FOTKY
8. (Vždy, keď je čo publikovať – nové/čakajúce, predané, znovu vložené autá aj zmeny ceny.) Repozitár je už v /tmp/sk/repo z kroku 1 (git -C /tmp/sk/repo pull). Potom: mkdir -p /tmp/sk/img/hq && cp -r /tmp/sk/repo/automation/tools /tmp/sk/tools && cp -r /tmp/sk/repo/automation/data /tmp/sk/data && cp /tmp/sk/repo/src/web.html /tmp/sk/web.html && cp /tmp/sk/repo/src/ads.html /tmp/sk/gallery.html.
9. (Len pre spracúvané nové/čakajúce autá.) V karte bazos.sk spusti javascript_tool s obsahom tools/s2.js (autá z vlastného webu – adId 9xxxxxxxx – berie S2/SHEET automaticky z www.splatkuj.sk/api/foto; ich počet fotiek = dĺžka fotky/imgs v admine). Potom javascript_tool "await SHEET([[adId,pocetFotiek],...])" (najviac 4 autá naraz) a JEDEN screenshot. Pre každé auto vyber čísla fotiek: picks = [predok auta zboku/spredu, volant/palubná doska, predné sedadlá, kufor (ak nie je, zadná časť auta)] a webPhotos = 5 najlepších fotiek (prvá = picks[0], potom exteriér a interiér, žiadne koláže ani doklady).
10. (Len pre spracúvané nové/čakajúce autá.) Pre každú potrebnú fotku (zjednotenie picks a webPhotos) cez browser_batch: javascript_tool "await S2('ID',N)" a computer zoom region [0,0,735,735], save_to_disk true, scale 0.55. Poradie zapíš do /tmp/sk/plan.json ako [["ID",N],...]. Potom Bash: SK_ROOT=/tmp/sk python3 /tmp/sk/tools/save.py /tmp/sk/plan.json <priečinok so screenshotmi>. Skontroluj, že každý súbor má aspoň 500 px na dlhšej strane.

C) SPRACOVANIE A PUBLIKOVANIE
11. Zapíš /tmp/sk/new.json: pre každé spracúvané nové/čakajúce auto {id, title (=carTitle), sub ("150 kW · Elektro · Automat"), price (číslo), year ("2022" alebo "5/2021"), km ("115 000 km"), power ("150 kW"), fuel, gear, drive ("4x4"/"Predný"/"Zadný"/"—"), tags (max 6 krátkych výbav), desc, loc, url, seller (sellerId), why, picks, webPhotos}. Zapíš /tmp/sk/sold.json = zoznam adId z kroku 7. Zapíš /tmp/sk/prices.json = {"adId": novaCena, …} pre ZMENY CENY áut, ktoré už sú na webe (krok 3). (Ak nie sú nové autá, new.json = []; ak nie sú predané, sold.json = []; ak nie sú zmeny ceny, prices.json = {}.) Pri autách z vlastného webu je url = stránka auta u predajcu.
12. Bash: cd /tmp/sk && SK_ROOT=/tmp/sk python3 tools/process.py → vytvorí out/publish.json, out/web/index.html, out/gal/index.html. Vo výpise skontroluj "prices_missing" (zmena ceny auta, ktoré sa na webe nenašlo) – uveď ho v notifikácii.
13. Publikuj do repozitára: cp /tmp/sk/data/* /tmp/sk/repo/automation/data/ && cd /tmp/sk/repo && python3 tools/sync_repo.py /tmp/sk/out && git add -A && git commit -m "Automatika: nové/predané autá, zmeny cien" && git push. Over git ls-remote, že main = tvoj commit. Ak push zlyhá, napíš to do notifikácie (web sa vtedy neaktualizuje).
14. A('bulk',…) v karte admina: pri spracovaných nových/čakajúcich autách merge {needsAds:false, picks, photo:'/api/foto/'+adId+'/'+picks[0]}; pri stiahnutých predaných merge {webRemoved:true}.

D) ZÁVER
15. VŽDY pošli presne jednu PushNotification (status "proactive"):
   - Ak niečo pribudlo/predalo sa/zmenila sa cena: napr. "Pridané na web aj s reklamami: Škoda Enyaq iV 80 25 990 €. Predané: Škoda Superb 15 490 €. Zmena ceny: Kia Ceed 5 490 → 4 990 €. Čaká na spracovanie: 63 áut."
   - Ak nič: krátko, napr. "✅ Kontrola hotová: nič nové (83 áut skontrolovaných, 8 predajcov)."
   - Ak sa niečo pokazilo, napíš to do notifikácie.
   - Ak je dnes pondelok, pridaj na koniec: "📰 Newsletter na tento týždeň je pripravený: www.splatkuj.sk/admin/newsletter".
16. A('bulk',{docs:[{coll:'config',id:'main',mode:'merge',data:{lastRunAt: teraz, lastRunSummary:"…", lastScanAt: teraz, lastScanSummary:"…"}}]}). Polia sources ani triggerId nemeň. Zatvor svoje karty v Chrome.
17. Na záver jedna veta so súhrnom.
