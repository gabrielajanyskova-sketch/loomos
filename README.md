# LOOMOS

E-shop s ručně vyráběnými sójovými svíčkami. Běží celý na **Cloudflare**: statické stránky (Pages), serverové funkce (Pages Functions), databáze **D1** a e-maily přes **Resend**. Žádný vlastní server ani Python.

## Co e-shop umí

- Katalog čtyř vůní ve dvou velikostech; HTML se předgeneruje (SEO, funguje i bez JavaScriptu).
- **Zákaznické účty:** registrace, přihlášení, zapomenuté heslo e-mailem, změna údajů a hesla, historie objednávek, smazání účtu (GDPR).
- **Sleva 5 % pro přihlášené** na každou položku; v košíku je vidět původní cena, sleva i celková úspora.
- **Slevové kódy:** procenta nebo částka, minimální nákup, platnost od–do, limit použití.
- **Sklad:** počty kusů po velikostech, „Vyprodáno“ / „Poslední kusy“, automatické odečtení při objednávce a vrácení při zrušení.
- **Platba převodem s QR kódem** (český standard QR Platba / SPAYD) na webu i v e-mailu. Dobírka není. Platební brána je připravená jako další krok.
- **Zásilkovna:** výběr výdejního místa na mapě, zakládání zásilek z administrace. Osobní odběr zdarma.
- **E-maily:** potvrzení objednávky, upozornění obchodu, přijetí platby, odeslání, zrušení, registrace a obnova hesla.
- **Administrace** (`/admin/`): přehled, objednávky a jejich stavy, sklad, registrovaní zákazníci (blokace, smazání) a slevové kódy.
- **Právní stránky:** obchodní podmínky, ochrana osobních údajů a cookies, údaje o prodejci v patičce.
- **Google Analytics 4** se načte až po souhlasu návštěvníka (cookie lišta) a měří e-commerce události.

## Dílnička (dilnicka.loomos.cz)

Plánování výroby svíček pro majitelku, chráněné stejným heslem jako administrace (`ADMIN_PASSWORD`). Zadáte vůně, sklenice a počty kusů a Dílnička spočítá sójový vosk, vonný olej (v % z hmotnosti vosku, dodavatel doporučuje 6–8 %), rezervu na ztráty, sklenice a knoty. Režim **Bez UFI** (výchozí) u každé vůně sníží olej tak, aby hotová svíčka zůstala s 5% rezervou pod hranicí, do které dodavatel uvádí „bez UFI“; bez něj Dílnička na překročení upozorní. Upozorní také na vanilin (žloutnutí vosku). Uložené výroby lze označit „Hotovo“ a svíčky se přičtou na sklad e-shopu (podle velikosti nastavené u sklenice).

**Etikety na dno:** Dílnička tiskne kulaté bezpečnostní etikety (název, hmotnost, „Obsahuje: …“ z dokumentů dodavatele, bezpečnostní pokyny, výrobce s telefonem a IČO). Průměr, písmo a rozložení archu se nastavují; náhled ukáže, jestli se text vejde.

Údaje o vonných olejích (bod vzplanutí, vanilin, UFI…) jsou v `data/oils.json` a nikdy se nezveřejňují — čte je jen přihlášená administrace.

Připojení subdomény: v projektu Pages _Custom domains → Set up a custom domain_ → `dilnicka.loomos.cz`. Funguje i adresa `loomos.cz/dilnicka/`.

## Nastavení v Cloudflare (jednorázově)

1. **Databáze:** _Storage & Databases → D1 → Create database_, název `loomos`.
2. **Propojení s webem:** _Workers & Pages → projekt → Settings → Bindings → Add → D1 database_, název proměnné **`DB`**, databáze `loomos`. Tabulky se vytvoří samy při prvním požadavku.
3. **Proměnné:** _Settings → Variables and Secrets_. Tajné hodnoty přidávejte jako **Secret** (typ „Encrypt“):

| Název                  | Typ    | Hodnota                                                                 |
| ---------------------- | ------ | ----------------------------------------------------------------------- |
| `ADMIN_PASSWORD`       | Secret | heslo do administrace, alespoň 12 znaků                                 |
| `RESEND_API_KEY`       | Secret | API klíč z Resendu (Sending access, doména loomos.cz)                   |
| `BANK_ACCOUNT`         | Text   | číslo účtu, např. `123456789/0800` nebo `19-123456789/0100`             |
| `PACKETA_API_PASSWORD` | Secret | heslo API ze Zásilkovny (volitelné, pro zakládání zásilek)              |
| `PACKETA_SENDER`       | Text   | označení odesílatele ze Zásilkovny (volitelné)                          |
| `MAIL_FROM`            | Text   | volitelné, výchozí `LOOMOS <objednavky@loomos.cz>`                      |
| `SHOP_EMAIL`           | Text   | volitelné, kam chodí upozornění na objednávky; výchozí `info@loomos.cz` |
| `SHOP_LIVE`            | Text   | `1` = ostrý prodej (bez zkušebních upozornění)                          |
| `SITE_INDEXABLE`       | Text   | `1` = povolit indexaci vyhledávači                                      |
| `GA_MEASUREMENT_ID`    | Text   | ID Google Analytics, např. `G-ABC123XYZ` (volitelné)                    |

Po změně proměnných spusťte nový deploy (_Deployments → Retry deployment_). Build: příkaz `npm run build`, výstupní složka `dist`.

Bezpečnost: tajné hodnoty nikdy nepatří do Gitu, do kódu ani do chatu. Heslo API ze Zásilkovny a klíč Resendu jdou jen do Cloudflare.

## Vývoj

```bash
npm ci
npm run dev
```

Spustí web s funkcemi a lokální databází na `http://localhost:8788` (administrace s heslem `mistni-heslo-admin`). E-maily se lokálně neposílají, dokud nepřidáte `--binding RESEND_API_KEY=…`.

Kde co je:

- `data/products.json` — katalog a ceny (jediný zdroj cen pro web i server),
- `assets/js/site.mjs` — údaje o značce a prodejci, FAQ, klíč widgetu Zásilkovny,
- `assets/js/pricing.mjs` — výpočet cen, sleva 5 %, doprava (sdílí web i server),
- `assets/js/payment.mjs` — IBAN, QR Platba,
- `src/server/` — API (objednávky, účty, administrace, e-maily, Zásilkovna),
- `functions/api/[[route]].js` — vstup Cloudflare Functions,
- `scripts/build.mjs`, `scripts/seo.mjs` — sestavení, metadata, sitemap, hlavičky.

## Vlastní fotografie

Současné fotografie jsou ilustrační. Nahraďte `assets/img/candle-editorial.png` (ideálně alespoň 1536 × 1024 px) a spusťte:

```bash
pip install -r requirements-tools.txt
python3 scripts/optimize_assets.py
```

Vzniknou WebP varianty i `og-image.jpg` pro sdílení na sociálních sítích.

## SEO, GEO, AEO

Canonical, Open Graph, JSON-LD (Organization s IČO a adresou, WebSite, Product, FAQPage, BreadcrumbList), sitemap a `llms.txt` se generují při buildu. Do zapnutí `SITE_INDEXABLE=1` mají stránky `noindex`. Účet, košík, pokladna, objednávky a administrace se neindexují nikdy.

## Kontroly

```bash
npm run format:check
npm test
npm run test:e2e
```

`npm test` sestaví web, spustí ho přes `wrangler pages dev` s dočasnou databází a falešným Resendem/Zásilkovnou a ověří ceny, slevy, sklad, účty, obnovu hesla, administraci, ochranu proti cizím požadavkům a omezení pokusů o přihlášení. `test:e2e` totéž projde v prohlížeči (desktop i mobil).

## Před ostrým spuštěním

- doplnit číslo účtu (`BANK_ACCOUNT`) a ověřit QR platbu ve své bankovní aplikaci,
- zkontrolovat obchodní podmínky (lhůta odeslání, splatnost, osobní odběr) — doporučujeme konzultaci s právníkem; prodávající je neplátce DPH (`seller.vatPayer` v `assets/js/site.mjs`),
- vybrat platební bránu (např. Comgate, GoPay nebo Stripe) a založit u ní účet,
- nastavit `SHOP_LIVE=1`, případně `SITE_INDEXABLE=1` a `GA_MEASUREMENT_ID`.
