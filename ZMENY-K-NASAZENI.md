# Změny čekající na nasazení

Změny se sbírají v `claude/relaxed-pascal-yq0b8i` a nasadí se najednou (jeden build v Cloudflare), až to majitelka odsouhlasí. Po nasazení se seznam vymaže.

Poslední hromadné nasazení: 18. 11. 2026 (audit SEO/GEO: ceny ve strukturovaných datech, aktuální FAQ a llms.txt).

Čeká na nasazení:

- Rychlejší úvodní stránka: zrušena funkce pro „/“ (rozlišovala dilnicka.loomos.cz). Dílnička je na loomos.cz/dilnicka/; subdoménu přesměruje pravidlo v Cloudflare (nastavit při nasazení).

Ke kontrole majitelkou:

- Logo Balíkovny (pobočka) je z veřejného modulu jiného autora — ověřit, že odpovídá aktuálnímu logu; případně poslat oficiální.
- Heureka: po registraci ověřit adresu API pro Ověřeno zákazníky (v kódu `https://api.heureka.cz/shop-certification/v2/order/log`, dá se změnit proměnnou `HEUREKA_API_URL`).
- Nové lapače: doplnit velikost v adminu u každého motivu.
- Dílnička → Etikety → Nastavení tisku etiket na dno: doplnit **telefon** (CLP vyžaduje na etiketě jméno, adresu a telefon dodavatele).
