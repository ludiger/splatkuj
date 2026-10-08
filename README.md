# splatkuj.sk

Web Splatkuj.sk pre Cloudflare Pages.

- `public/` – statický web (index.html, fotky áut v img/p)
- `functions/api/firma.js` – vyhľadanie firmy podľa IČO v Registri právnických osôb
- `build.py` – zostaví `public/index.html` zo zdrojovej stránky

Cloudflare Pages: Framework preset **None**, Build command prázdny, Build output directory **public**.
