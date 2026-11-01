# LOOMOS

Tmavý responzivní návrh e-shopu se šesti vůněmi, dvěma velikostmi, košíkem a samostatným lokálním API pro správu produktů a zkušebních objednávek. Node.js 22+ (CI používá 24), Python 3.12+, SQLite, vanilla JavaScript.

## Vývoj

```bash
npm ci
npm run serve
```

Aplikační server naslouchá na `127.0.0.1:8080`; port upravuje `PORT`, rozhraní `LOOMOS_HOST`. Administrace je na `/admin/`. Heslo nastavte bezpečně v prostředí serveru jako `LOOMOS_ADMIN_PASSWORD`, nikdy ve zdrojovém kódu. Bez hesla je přihlášení vypnuté. Na HTTPS se nastavuje `LOOMOS_SECURE_COOKIES=1`.

Data zůstávají v ignorované složce `.local/`, případně v `LOOMOS_DATA_DIR`. První spuštění načte `data/products.json`, další starty zachovávají úpravy. Verze migrací ukrývají původní ukázkové produkty a přidávají šest schválených vůní a dvě velikosti, aniž přepisují historické objednávky. Objednávky uchovávají kopii názvů a cen; cenu i velikost ověřuje server. Malá a velká svíčka mají pracovní ceny 249 Kč / 349 Kč. Objem ani doba hoření nejsou potvrzené. Doprava je zatím testovací: osobní odběr zdarma, Zásilkovna 79 Kč.

## Cloudflare Pages a veřejná ukázka

```bash
npm run build
npm run preview
```

Výstupem je **pouze adresář `dist`**. Cloudflare Pages musí mít build command `npm run build` a output directory `dist`; odpovídající cesta je i ve `wrangler.jsonc`. Nepublikujte kořen repozitáře. Pokud už projekt používá jiné nastavení ve svém dashboardu, zkontrolujte jeho výstupní adresář. Přidání konfigurace do Gitu samo nepotvrzuje změnu existujícího projektu ani úspěch deploye.

Statická ukázka obsahuje předgenerované HTML katalogu, detailů, navigace a FAQ. Obsah lze číst i bez JavaScriptu. Při aktivním JavaScriptu funguje výběr velikostí, řazení i košík. Na samotném Pages **neběží Python, databáze, přihlášení ani objednávkové API**. Pokladna zde nezobrazuje formulář osobních údajů a administrace nevyžaduje heslo, protože nemají připojený server. Neobcházíme to ukládáním objednávek nebo hesla do prohlížeče. Lokální server zachovává testovací průchod objednávkou i administrací.

Produkční platby, e-maily, doprava, sklad, zabezpečené provozní nasazení API, zálohování a finální obchodní údaje zůstávají navazující práce. Žádná aktuální objednávka není placená ani expedovaná.

## Doména, SEO a odpovědi

Budoucí doména je `https://loomos.cz`. Build ji používá pro canonical, Open Graph, sociální metadata, JSON-LD a sitemapu. Samotné vytvoření odkazů **nepřipojuje doménu**.

Výchozí režim je před spuštěním: `noindex,follow` v metadatech i odpovědích Pages. Po připojení domény a schválení obsahu nastavte v build prostředí:

```text
SITE_URL=https://loomos.cz
SITE_INDEXABLE=1
```

Preview deploymenty musí ponechat `SITE_INDEXABLE=0`. Sitemap obsahuje pouze hlavní obsah, nikoli košík, pokladnu a administraci. Robots tyto soukromé procesní cesty vyřazuje. Jedinečné titulky a popisy se generují pro každou vůni. JSON-LD propojuje Organization, WebSite, WebPage/CollectionPage, BreadcrumbList, Product a viditelné FAQPage. Pracovní ceny se nevydávají za ostré nabídky; nevymýšlíme recenze, certifikace, adresu ani zeměpisné souřadnice.

Ověřená fakta a FAQ pro SEO/AEO/GEO jsou v `assets/js/site.mjs`, katalog v `data/products.json`, generování v `scripts/seo.mjs`. `llms.txt` shrnuje stejné informace a stav ukázky. Tyto podklady pomáhají strojové čitelnosti, ale nejsou příslibem pozic nebo citací ve vyhledávačích.

## Výkon a bezpečnost

- Hero: WebP 114 382 B místo PNG 1 941 373 B; responzivní zdroje, přednačtení a priorita. Produktový náhled má 20 504 B. Fotografie zůstávají ilustrační.
- Místní WOFF2 písma včetně licencí OFL, úsporné varianty portrétu a loga. Veřejný výstup neobsahuje velké původní PNG/TTF.
- Sdílený renderer pro build i prohlížeč (`ui.mjs`), validovaný katalog a košík (`catalog.mjs`), escapování dynamických textů, omezená velikost požadavků, serverový výpočet cen a ochrana proti duplicitám.
- Same-origin kontroly zápisů, HttpOnly/SameSite cookies, omezené pokusy o přihlášení, omezené relace, SQL parametry a seznam veřejně dostupných souborů. Administrace i objednávky nejsou veřejným API ke čtení.
- Striktní CSP bez inline skriptů a stylů, další bezpečnostní hlavičky a cache pro statické soubory. JS/CSS mají v sestavení hash v názvu. `dist` je explicitně sestaven jen z veřejných souborů; neobsahuje zdroj serveru, testy, databázi, secrets ani node_modules.

Zabezpečení a hlavičky je nutné po skutečném nasazení ověřit na hostingu. Tento Python HTTP server je vývojový, nikoli hotový produkční provoz.

## Kontroly

```bash
npm run format:check
npm test
npx playwright install chromium   # jednou, pokud nemáte prohlížeč
npm run test:e2e
```

`npm test` ověřuje renderování, escapování, metadata, nasazovaný adresář, katalog/košík a API. `test:e2e` skutečně spustí veřejný build i izolované API; testuje mobil, obě velikosti, ceny v košíku, HTML bez JS, striktní CSP, nepřítomnost velkých obrázků, administraci a objednávku. Používá dočasná data a náhodné neveřejné testovací heslo. Snímky vznikají v `.local/artifacts`; cestu lze změnit `ARTIFACTS_DIR`, prohlížeč `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

CI je v `.github/workflows/checks.yml`. Formátování JS/HTML/CSS/JSON zajišťuje Prettier. Pro výměnu nebo opětovné zmenšení médií je volitelný `scripts/optimize_assets.py` a `requirements-tools.txt`; změny obrázků nejsou součástí každého buildu. Původní Tailwind build je zachovaný jako `npm run build:tailwind`, nový vzhled ho nepoužívá.

Pracujte ve stávajícím izolovaném checkoutu. Push do `main` provádějte jen v rámci uživatelem schválených změn.
