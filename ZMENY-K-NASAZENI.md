# Změny čekající na nasazení

Změny se sbírají v `claude/relaxed-pascal-yq0b8i` a nasadí se najednou (jeden build v Cloudflare), až to majitelka odsouhlasí. Po nasazení se seznam vymaže.

Poslední hromadné nasazení: 4. 11. 2026 (loga dopravců, Lapač na přání jako karta mezi lapači).

Čeká na nasazení:

- **Výrobce u každého produktu (GPSR):** blok „Výrobce a bezpečnost výrobku“ — jméno, adresa, e-mail, označení výrobku, bezpečnostní upozornění.
- **Lapač na přání:** upozornění, že u zboží vyrobeného na přání nelze odstoupit od smlouvy (§ 1837 OZ); návrh ke schválení před výrobou.
- **Ochrana osobních údajů:** doplněna Česká pošta jako příjemce údajů (Balíkovna, doručení na adresu).
- **Doprava zdarma od 1 200 Kč** (zboží po slevách): ukazatel v košíku „Do dopravy zdarma vám chybí …“, v pokladně „Zdarma“ u všech doprav, horní lišta „Doprava zdarma od 1 200 Kč“, obchodní podmínky (účinné od 5. 11. 2026). Hranice: `FREE_SHIPPING_FROM` v `assets/js/pricing.mjs`.
- **Hlídat dostupnost:** u vyprodaného zboží si zákazník nechá poslat e-mail; po naskladnění (sklad v adminu, Dílnička, zrušená objednávka) dostane jediný e-mail a adresa se smaže. V „Sklad a ceny“ je vidět, kolik lidí hlídá. Ochrana osobních údajů doplněna.
- **Ověřená hodnocení produktů:** hodnotit může jen zákazník, který nakoupil (odkaz v e-mailu o odeslání a na stránce objednávky → `/recenze`). U produktu hvězdičky, průměr a text „Ověřený nákup“, na kartách hvězdičky. V adminu záložka „Recenze“ — odpověď, skrytí. Obchodní podmínky čl. 9 (jak hodnocení ověřuji).
- **Heureka Ověřeno zákazníky:** XML feed `/api/feed/heureka.xml`; po objednávce se Heurece pošle e-mail a produkty (jen když je v Cloudflare nastaven tajný klíč `HEUREKA_API_KEY`). V pokladně zaškrtávátko „Nechci dotazník od Heureky“. Ochrana osobních údajů doplněna o Heureka Group a.s.

Ke kontrole majitelkou:

- Logo Balíkovny (pobočka) je z veřejného modulu jiného autora — ověřit, že odpovídá aktuálnímu logu; případně poslat oficiální.
- Heureka: po registraci ověřit adresu API pro Ověřeno zákazníky (v kódu `https://api.heureka.cz/shop-certification/v2/order/log`, dá se změnit proměnnou `HEUREKA_API_URL`).
