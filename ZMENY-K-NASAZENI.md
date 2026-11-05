# Změny čekající na nasazení

Změny se sbírají v `claude/relaxed-pascal-yq0b8i` a nasadí se najednou (jeden build v Cloudflare), až to majitelka odsouhlasí. Po nasazení se seznam vymaže.

Poslední hromadné nasazení: 5. 11. 2026 (filtr lapačů podle tématu, nová fotka na úvodní stránce, uložit vše ve skladu, přední etikety a víc vůní na arch v Dílničce).

Čeká na nasazení:

- **Vodítka pro stříhání u předních etiket:** tenké šedé čáry přes celý arch A4 na hranách etiket (zapnuto automaticky, tisknou se i bez „grafiky pozadí“).
- **Filtr lapačů se nezapíná sám:** po otevření stránky (i po návratu zpět) jsou vždy vidět všechny lapače, téma se použije až po kliknutí. Odkaz `?tema=` už se nepoužívá.
- **Košík: „Do dopravy zdarma vám chybí … — co přidat?“** Pod položkami 3 tipy s tlačítkem Přidat: nejdřív nejlevnější produkty, které hranici samy dorovnají (štítek „+ doprava zdarma“), pak ty, které se k ní nejvíc přiblíží. Nic, co už je v košíku nebo je vyprodané; svíčky v malé velikosti. Po dosažení hranice blok zmizí.

Ke kontrole majitelkou:

- Logo Balíkovny (pobočka) je z veřejného modulu jiného autora — ověřit, že odpovídá aktuálnímu logu; případně poslat oficiální.
- Heureka: po registraci ověřit adresu API pro Ověřeno zákazníky (v kódu `https://api.heureka.cz/shop-certification/v2/order/log`, dá se změnit proměnnou `HEUREKA_API_URL`).
- Nové lapače: doplnit velikost v adminu u každého motivu.
