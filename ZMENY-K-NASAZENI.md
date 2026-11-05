# Změny čekající na nasazení

Změny se sbírají v `claude/relaxed-pascal-yq0b8i` a nasadí se najednou (jeden build v Cloudflare), až to majitelka odsouhlasí. Po nasazení se seznam vymaže.

Poslední hromadné nasazení: 5. 11. 2026 (vodítka pro stříhání etiket, filtr lapačů jen po kliknutí, tipy do dopravy zdarma v košíku).

Čeká na nasazení:

- **Košík — nabídka zjednodušená:** nadpis „Mohlo by se vám hodit“, bez opakované částky a štítků „+ doprava zdarma“ (částka je u ukazatele vpravo).
- **Množstevní cena lapačů platí pro libovolné motivy:** od 2 lapačů v košíku (jakékoli kombinace) stojí každý 175 Kč — v košíku, objednávce i na faktuře. Na kartách „(i různé motivy)“, v nabídce v košíku cena 175 Kč, pokud už lapač v košíku je.

Ke kontrole majitelkou:

- Logo Balíkovny (pobočka) je z veřejného modulu jiného autora — ověřit, že odpovídá aktuálnímu logu; případně poslat oficiální.
- Heureka: po registraci ověřit adresu API pro Ověřeno zákazníky (v kódu `https://api.heureka.cz/shop-certification/v2/order/log`, dá se změnit proměnnou `HEUREKA_API_URL`).
- Nové lapače: doplnit velikost v adminu u každého motivu.
