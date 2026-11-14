# Změny čekající na nasazení

Změny se sbírají v `claude/relaxed-pascal-yq0b8i` a nasadí se najednou (jeden build v Cloudflare), až to majitelka odsouhlasí. Po nasazení se seznam vymaže.

Poslední hromadné nasazení: 6. 11. 2026 (13 nových lapačů, „Jak vzniká duha“, skutečné fotky 4 svíček, knot u velikostí, odkaz janyskovadigital.cz v patičce).

Čeká na nasazení:

- **3D tisk na zakázku:** nová stránka `/3d-tisk` (jak to funguje ve 3 krocích, upozornění na § 1837 a licence modelů, poptávkový formulář s rozměry, materiálem, souborem STL/3MF/OBJ nebo obrázkem a odkazem na model). Dlaždice „3D tvorba“ na úvodní stránce vede sem s pilulkou „Na zakázku“, odkaz i v patičce. V adminu u poptávky „Materiál“ a odkaz na model.
- **Vlastní výrobky z 3D tisku:** nová kategorie „3D tisk“ v adminu (Produkty → 3D tisk → Nový produkt: název, popis, cena, množstevní cena, velikost, fotky). Zapnuté výrobky se ukážou na stránce `/3d-tisk` v sekci „Hotové výrobky“ nad zakázkovou výrobou (bez výrobků se sekce neukáže), mají vlastní stránku, košík, sklad, hlídání dostupnosti i hodnocení. Na Heureku jdou, až mají fotku.

Ke kontrole majitelkou:

- Logo Balíkovny (pobočka) je z veřejného modulu jiného autora — ověřit, že odpovídá aktuálnímu logu; případně poslat oficiální.
- Heureka: po registraci ověřit adresu API pro Ověřeno zákazníky (v kódu `https://api.heureka.cz/shop-certification/v2/order/log`, dá se změnit proměnnou `HEUREKA_API_URL`).
- Nové lapače: doplnit velikost v adminu u každého motivu.
- Dílnička → Etikety → Nastavení tisku etiket na dno: doplnit **telefon** (CLP vyžaduje na etiketě jméno, adresu a telefon dodavatele).
- 3D tisk: ověřit text „Tisknu menší předměty z plastů PLA a PETG“ (materiály a velikost podle tiskárny).
