# Změny čekající na nasazení

Změny se sbírají v `claude/relaxed-pascal-yq0b8i` a nasadí se najednou (jeden build v Cloudflare), až to majitelka odsouhlasí. Po nasazení se seznam vymaže.

Poslední hromadné nasazení: 5. 11. 2026 (vodítka pro stříhání etiket, filtr lapačů jen po kliknutí, tipy do dopravy zdarma v košíku).

Čeká na nasazení:

- **Košík — nabídka zjednodušená:** nadpis „Mohlo by se vám hodit“, bez opakované částky a štítků „+ doprava zdarma“ (částka je u ukazatele vpravo).
- **Množstevní cena lapačů platí pro libovolné motivy:** od 2 lapačů v košíku (jakékoli kombinace) stojí každý 175 Kč — v košíku, objednávce i na faktuře. Na kartách „(i různé motivy)“, v nabídce v košíku cena 175 Kč, pokud už lapač v košíku je.
- **Etikety na dno — chybějící symboly opraveny:** tisk se otevíral dřív, než se načetly obrázky piktogramů a loga; teď čeká, až jsou všechny načtené.
- **Úklid:** odstraněny 4 kulaté lapače smazané v adminu (sova, víla, medvídek, traktor) i s fotkami a kódem pro obrázky „na okně“; jejich staré adresy přesměrují na Lapače slunce. Smazány nepoužívané obrázky (favicon-32, favicon.svg, logo-96, maker-1536, 4 varianty loga SVG).
- **Bezpečnost:** smazání účtu má limit pokusů o heslo. Kontrola: admin pod jedním zámkem, limity na všech veřejných formulářích, ochrana proti CSRF, SQL jen s parametry, ošetřený text zákazníků, přísná CSP, žádné klíče v kódu, 0 zranitelností v závislostech.
- **Po nasazení:** smazat z databáze 4 záznamy „smazáno“ u odstraněných lapačů (jinak by v adminu visely jako smazané s nefunkčním Obnovit).

Ke kontrole majitelkou:

- Logo Balíkovny (pobočka) je z veřejného modulu jiného autora — ověřit, že odpovídá aktuálnímu logu; případně poslat oficiální.
- Heureka: po registraci ověřit adresu API pro Ověřeno zákazníky (v kódu `https://api.heureka.cz/shop-certification/v2/order/log`, dá se změnit proměnnou `HEUREKA_API_URL`).
- Nové lapače: doplnit velikost v adminu u každého motivu.
