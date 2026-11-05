# Změny čekající na nasazení

Změny se sbírají v `claude/relaxed-pascal-yq0b8i` a nasadí se najednou (jeden build v Cloudflare), až to majitelka odsouhlasí. Po nasazení se seznam vymaže.

Poslední hromadné nasazení: 5. 11. 2026 (kontrola kódu a bezpečnosti, úklid, oprava symbolů na etiketách, množstevní cena lapačů napříč motivy, zjednodušená nabídka v košíku, vodítka pro stříhání).

Čeká na nasazení:

- **E-maily ve vzhledu webu:** tmavé pozadí, logo nahoře, měděné nadpisy a tlačítka; slevy a „Ušetřili jste“ zeleně; u odeslané objednávky je hlavní „Ohodnotit nákup“, „Stav objednávky“ jen obrysově. „Prosím o úhradu“ v první osobě.
- **Obrázky v e-mailech se načtou i ve webmailu (Seznam, Outlook):** logo (`email-logo.png`) a QR kód pro platbu smí načíst i jiná doména; zbytek webu zůstává chráněný.

Ke kontrole majitelkou:

- Logo Balíkovny (pobočka) je z veřejného modulu jiného autora — ověřit, že odpovídá aktuálnímu logu; případně poslat oficiální.
- Heureka: po registraci ověřit adresu API pro Ověřeno zákazníky (v kódu `https://api.heureka.cz/shop-certification/v2/order/log`, dá se změnit proměnnou `HEUREKA_API_URL`).
- Nové lapače: doplnit velikost v adminu u každého motivu.
