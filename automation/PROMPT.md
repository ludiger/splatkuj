# Prompt naplánovanej úlohy „Autá – kontrola, nové a predané“

Spúšťa sa denne o 7:35 a 15:35 (Europe/Bratislava). Úloha musí bežať na počítači majiteľa
(potrebuje Claude v Chrome, kde je majiteľ prihlásený do www.splatkuj.sk/admin).
Nižšie je presný text, ktorý sa vloží ako prompt úlohy.

---

Úsporne skontroluj autá sledovaných predajcov na Bazoši: zisti PREDANÉ a NOVÉ autá, nové HNEĎ celé spracuj (fotky, reklamy, video, web) a všetko zapíš do adminu na www.splatkuj.sk/admin. Pracuj bez otázok. Nikomu nič neposielaj okrem jednej push notifikácie majiteľovi na konci. Šetri tokeny: stránky čítaj cez JavaScript (fetch + DOMParser), screenshoty/zoom rob LEN pri fotkách v kroku B. Pole sellerId pri existujúcich autách NIKDY nemeň.

ADMIN = www.splatkuj.sk (Cloudflare, databáza D1). Číta sa a zapisuje cez Chrome v karte na https://www.splatkuj.sk/admin/ – majiteľ je tam prihlásený, takže fetch má jeho prihlásenie. Pomocník (vlož na začiatok každého javascript_tool v tejto karte):
const A=(p,b,m)=>fetch('/api/admin/'+p,{method:m||(b?'POST':'GET'),headers:{'content-type':'application/json','x-sk-admin':'1'},body:b?JSON.stringify(b):undefined}).then(async r=>({s:r.status,j:await r.json().catch(()=>({}))}));
- čítanie: A('docs/inzeraty') → j.docs[{id,data}], A('doc/config/main') → j.data (sources = predajcovia {id,name,url,links[]}).
- zápis: A('bulk',{docs:[{coll:'inzeraty',id:adId,data:{…},mode:'merge'|'set'|'delete'}]}) – najviac 200 naraz; pri 'merge' sa polia doplnia/prepíšu, {"__delete__":true} pole zmaže.
- záloha fotiek do úložiska: A('archiv/'+adId,{}) opakuj, kým j.remaining nie je 0 (najviac 6×).
- čerstvý stav inzerátu: fetch('/api/inzerat/'+adId+'?p='+slug+'&fresh=1') → 200 {ok:true,n} = inzerát existuje, 404 = zmazaný/predaný (slug = časť url za /inzerat/ID/).

REPOZITÁR: GitHub ludiger/splatkuj (vetva main) – Cloudflare z neho po každom pushnutí nasadí www.splatkuj.sk. Zdroj webu src/web.html, zdroj galérie reklám src/ads.html, nástroje automation/tools, dáta automation/data.
Bazoš zakazuje automatom (WebFetch) čítať stránky predajcov, preto ich čítaj cez Claude in Chrome. Stránky predajcov (hodnotenie.php, search.php) fetchuj z karty na www.bazos.sk, detaily inzerátov (auto.bazos.sk/inzerat/ID/slug.php – vždy s plným slugom) z karty na auto.bazos.sk.

A) KONTROLA A NÁJDENIE
1. ToolSearch "select:PushNotification,mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__browser_batch,mcp__claude-in-chrome__tabs_close_mcp". Ak Chrome nie je dostupný: pošli PushNotification (status "proactive") "Automatika: Chrome nebol dostupný – skontrolujte, či je otvorený Chrome s rozšírením Claude." a skonči.
2. Vytvor kartu (tabs_create_mcp) a otvor https://www.splatkuj.sk/admin/. javascript_tool: A('me'). Ak s=401: pošli PushNotification "Automatika: v Chrome nie ste prihlásený do adminu – otvorte www.splatkuj.sk/admin a prihláste sa." a skonči. Inak načítaj A('docs/inzeraty') a A('doc/config/main').
3. KONTROLA PREDANÝCH (v karte admina, jeden javascript_tool, paralelne po 6): pre každé auto so status "aktivny", "caka" alebo "chyba" zisti čerstvý stav cez /api/inzerat/…&fresh=1.
   - 200 → merge {status:"aktivny", checkedAt: teraz, note:{"__delete__":true}}.
   - 404 → merge {status:"predany", soldAt: teraz (len ak ešte nie je), checkedAt: teraz}; zapamätaj ako NOVO PREDANÉ.
   - iná chyba → merge {status:"chyba", note:"…", checkedAt: teraz}.
   Zapíš jedným A('bulk',…). Archívne polia (title, price, carTitle, photo, desc, why, fotky…) nikdy nemaž.
4. ZÁLOHA FOTIEK: pre každé auto so status "aktivny" bez poľa fotky (alebo s fotky=[]) zavolaj A('archiv/'+adId,{}) až do remaining 0.
5. Vytvor druhú kartu a otvor https://www.bazos.sk/. Jedným javascript_tool pre všetky odkazy predajcov (links, inak url) urob fetch aj so stránkovaním (&crz=20, &crz=40… kým pribúdajú) a vytiahni /auto\.bazos\.sk\/inzerat\/(\d+)\/([^"'\s>]+)/ s id predajcu; vráť len adId + slug, ktoré NIE SÚ v databáze.
6. V karte na https://auto.bazos.sk/ jedným javascript_tool stiahni ich detail (fetch plnej url so slugom + DOMParser): h1, cena (bunka za "Cena:"), lokalita (za "Lokalita:"), .popisdetail (1500 znakov), počet fotiek (max N z /img/N/xxx/ID).
   - Preskoč diely/príslušenstvo (disky, pneumatiky, elektróny, nárazník, diely…) a cenu pod 2 500 €.
   - ZNOVU VLOŽENÉ auto (rovnaký predajca, rovnaká značka+model, cena ±5 %, rovnaký rok/km; starý inzerát je "predany" alebo už na Bazoši nie je): vytvor nový dokument (mode "set") ako kópiu starého so zmeneným adId, url, status "aktivny", title, price, checkedAt, relistedFrom; bez soldAt; starý zmaž (mode "delete"). Po kroku 8 uprav pracovnú kópiu /tmp/sk/web.html: do objektu RL pridaj pár 'staréId':'novéId', nahraď starú url novou a ak bolo staré auto v HIDE, odstráň ho odtiaľ (kroky 11–13 to prenesú na web). Nie je to predaj ani nové auto.
   - Ostatné = NOVÉ AUTÁ. Zapíš (mode "set") dokumenty: adId, url, sellerId, status "aktivny", needsAds true, addedAt/checkedAt (ISO teraz), title, price ("25 990 €"), priceNum, location, carTitle (čistý názov), brand, model, body (SUV/Kombi/Hatchback/Sedan / liftback/Van / MPV/Kupé / kabriolet), year (číslo), km (číslo), fuel, gear, desc (2 vety po slovensky), why (1 veta po slovensky, prečo auto chcieť – pre koho sa hodí). Potom pre každé nové auto urob zálohu fotiek ako v kroku 4.
7. PREDANÉ na stiahnutie z webu: dokumenty so status "predany" a bez webRemoved=true (a bez relistedFrom-nástupcu).
Ak nie sú nové autá ani predané na stiahnutie ani znovu vložené → choď na krok D.

B) PRÍPRAVA A FOTKY
8. (Vždy, keď je čo publikovať – nové, predané aj znovu vložené autá.) Repozitár: zavolaj nástroj add_repo (owner "ludiger", repo "splatkuj", access "push"; načítaj ho cez ToolSearch "add_repo") a urob git clone podľa jeho pokynov do /tmp/sk/repo. Potom: mkdir -p /tmp/sk/img/hq && cp -r /tmp/sk/repo/automation/tools /tmp/sk/tools && cp -r /tmp/sk/repo/automation/data /tmp/sk/data && cp /tmp/sk/repo/src/web.html /tmp/sk/web.html && cp /tmp/sk/repo/src/ads.html /tmp/sk/gallery.html.
9. (Len pre nové autá.) V karte bazos.sk spusti javascript_tool s obsahom tools/s2.js. Potom javascript_tool "await SHEET([[adId,pocetFotiek],...])" (najviac 4 autá naraz) a JEDEN screenshot. Pre každé auto vyber čísla fotiek: picks = [predok auta zboku/spredu, volant/palubná doska, predné sedadlá, kufor (ak nie je, zadná časť auta)] a webPhotos = 5 najlepších fotiek (prvá = picks[0], potom exteriér a interiér, žiadne koláže ani doklady).
10. (Len pre nové autá.) Pre každú potrebnú fotku (zjednotenie picks a webPhotos) cez browser_batch: javascript_tool "await S2('ID',N)" a computer zoom region [0,0,735,735], save_to_disk true, scale 0.55. Poradie zapíš do /tmp/sk/plan.json ako [["ID",N],...]. Potom Bash: SK_ROOT=/tmp/sk python3 /tmp/sk/tools/save.py /tmp/sk/plan.json <priečinok so screenshotmi>. Skontroluj, že každý súbor má aspoň 500 px na dlhšej strane.

C) SPRACOVANIE A PUBLIKOVANIE
11. Zapíš /tmp/sk/new.json: pre každé nové auto {id, title (=carTitle), sub ("150 kW · Elektro · Automat"), price (číslo), year ("2022" alebo "5/2021"), km ("115 000 km"), power ("150 kW"), fuel, gear, drive ("4x4"/"Predný"/"Zadný"/"—"), tags (max 6 krátkych výbav), desc, loc, url, seller (sellerId), why, picks, webPhotos}. Zapíš /tmp/sk/sold.json = zoznam adId z kroku 7. (Ak nie sú nové autá, new.json = []; ak nie sú predané, sold.json = [].)
12. Bash: cd /tmp/sk && SK_ROOT=/tmp/sk python3 tools/process.py → vytvorí out/publish.json, out/web/index.html, out/gal/index.html.
13. Publikuj do repozitára: cp /tmp/sk/data/* /tmp/sk/repo/automation/data/ && cd /tmp/sk/repo && python3 tools/sync_repo.py /tmp/sk/out && git add -A && git commit -m "Automatika: nové/predané autá" && git push. Over git ls-remote, že main = tvoj commit. Ak push zlyhá, napíš to do notifikácie (web sa vtedy neaktualizuje).
14. A('bulk',…) v karte admina: pri nových autách merge {needsAds:false, picks, photo:'/api/foto/'+adId+'/'+picks[0]}; pri stiahnutých predaných merge {webRemoved:true}.

D) ZÁVER
15. VŽDY pošli presne jednu PushNotification (status "proactive"):
   - Ak niečo pribudlo/predalo sa: napr. "Pridané na web aj s reklamami: Škoda Enyaq iV 80 25 990 €. Predané: Škoda Superb 15 490 €."
   - Ak nič: krátko, napr. "✅ Kontrola hotová: nič nové (83 áut skontrolovaných, 8 predajcov)."
   - Ak sa niečo pokazilo, napíš to do notifikácie.
16. A('bulk',{docs:[{coll:'config',id:'main',mode:'merge',data:{lastRunAt: teraz, lastRunSummary:"…", lastScanAt: teraz, lastScanSummary:"…"}}]}). Polia sources ani triggerId nemeň. Zatvor svoje karty v Chrome.
17. Na záver jedna veta so súhrnom.
