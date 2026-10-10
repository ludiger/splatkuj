# Dávkové reklamy pre čakajúce autá (10. 10. 2026)

124 áut, ktoré boli na webe len cez /api/ponuka (needsAds=true), dostáva reklamy dávkovo.
- `pending.tsv` – údaje áut (id¦názov¦cena¦rok¦km¦kW¦palivo¦prevodovka¦pohon¦výbava|…¦prečo¦lokalita¦počet fotiek)
- `picks_new.json` – vybrané fotky [predok, palubná doska, sedadlá, kufor]
- `fullplan.json` – poradie fotiek na stiahnutie (id, číslo fotky)
- `ads_batch.py` – zo screenshotov urobí fotky, reklamy (post, story), video a doplní galériu
- Hotové autá dostanú v admine needsAds=false, webApi=true (na webe ostávajú cez /api/ponuka).

Stav: hotových 7 (po každej dávke spusti python3 build_admin.py!) áut (plan j 0–27). Pokračuje sa od j = 28 (auto 195157428).
