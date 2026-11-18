# Změny čekající na nasazení

Změny se sbírají v `claude/relaxed-pascal-yq0b8i` a nasadí se najednou (jeden build v Cloudflare), až to majitelka odsouhlasí. Po nasazení se seznam vymaže.

Poslední hromadné nasazení: 17. 11. 2026 (nadpisy karet jako H2, menší písma pro rychlejší načítání).

Čeká na nasazení:

- Strukturovaná data produktů: aktuální cena, velikosti, dostupnost a hodnocení z adminu (doplňuje se při zobrazení stránky), fotky i u lapačů slunce.
- Časté otázky na úvodní stránce (i pro Google a AI): pryč „e-shop připravuji“ a „lapače nejsou v prodeji“; nové otázky o objednávce a platbě, dopravě, nabídce a péči o svíčku.
- llms.txt pro AI vyhledávače: e-shop v provozu, kdo za LOOMOS stojí, doprava, platba, 3D tisk, blog, seznam lapačů.
- Popis značky zmiňuje i lapače slunce a 3D tisk; autor blogu je Gabriela Janýšková (osoba).
- Stránka 404 odkazuje na čisté adresy bez .html.

Ke kontrole majitelkou:

- Logo Balíkovny (pobočka) je z veřejného modulu jiného autora — ověřit, že odpovídá aktuálnímu logu; případně poslat oficiální.
- Heureka: po registraci ověřit adresu API pro Ověřeno zákazníky (v kódu `https://api.heureka.cz/shop-certification/v2/order/log`, dá se změnit proměnnou `HEUREKA_API_URL`).
- Nové lapače: doplnit velikost v adminu u každého motivu.
- Dílnička → Etikety → Nastavení tisku etiket na dno: doplnit **telefon** (CLP vyžaduje na etiketě jméno, adresu a telefon dodavatele).
