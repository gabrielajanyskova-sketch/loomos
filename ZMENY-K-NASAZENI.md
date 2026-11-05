# Změny čekající na nasazení

Změny se sbírají v `claude/relaxed-pascal-yq0b8i` a nasadí se najednou (jeden build v Cloudflare), až to majitelka odsouhlasí. Po nasazení se seznam vymaže.

Poslední hromadné nasazení: 5. 11. 2026 (e-maily ve vzhledu webu, logo a QR ve webmailu).

Čeká na nasazení:

- **Horní lišta:** jen „Doprava zdarma od 1 200 Kč“ (bez „Ručně vyráběné sójové svíčky“).
- **Faktura s logem:** vlevo nahoře tisková verze loga místo textu LOOMOS.
- **Stránka Lapače slunce zkrácená:** nahoře jen nadpis a jedna věta (návod je u každého lapače), bez druhého nadpisu „Nabídka“ a bez spodního odstavce o lapači na přání (je kartou mezi lapači). Lapače 4 vedle sebe (3 na menším notebooku, 2 na tabletu i mobilu).
- **Odstoupení v e-mailech:** potvrzení objednávky a e-mail o odeslání / připravení k vyzvednutí mají dole drobným písmem poučení o 14 dnech a odkazy „Odstoupit od smlouvy“ (formulář s předvyplněným číslem objednávky) a „Obchodní podmínky“.
- **Svíčky také 4 v řadě** (Svíčky, Dárek pro ni / pro něj, úvodní stránka); na kartě výběr velikosti zkrácený na „Malá — 349 Kč“ (celý popis zůstává u svíčky). Na mobilu 2 vedle sebe s menším štítkem.
- **Karty v řadě zarovnané:** výběr velikosti a tlačítka „Přidat do košíku“ jsou ve všech kartách jedné řady ve stejné výšce, i když má některá delší název nebo popis.
- **Obchodní podmínky v PDF:** vytvoří se automaticky z textu stránky při každém sestavení webu (`/obchodni-podminky.pdf`, s logem a vzorovým formulářem pro odstoupení). Přikládají se k potvrzení objednávky; na stránce podmínek je odkaz ke stažení.

Ke kontrole majitelkou:

- Logo Balíkovny (pobočka) je z veřejného modulu jiného autora — ověřit, že odpovídá aktuálnímu logu; případně poslat oficiální.
- Heureka: po registraci ověřit adresu API pro Ověřeno zákazníky (v kódu `https://api.heureka.cz/shop-certification/v2/order/log`, dá se změnit proměnnou `HEUREKA_API_URL`).
- Nové lapače: doplnit velikost v adminu u každého motivu.
