# LOOMOS — pracovní e-shop

Tmavý responzivní e-shop: katalog, detaily svíček, košík, zkušební objednávky a administrace. Vanilla JavaScript + Python 3.12 / SQLite, bez externích služeb pro lokální spuštění.

## Spuštění

```bash
npm ci
npm run serve
```

Server ve výchozím nastavení naslouchá pouze na `127.0.0.1:8080`. Port lze nastavit proměnnou `PORT`, rozhraní `LOOMOS_HOST`. Administrace je na `/admin/`. Před spuštěním serveru nastavte `LOOMOS_ADMIN_PASSWORD` v prostředí bezpečným způsobem; bez něj se nelze přihlásit. Heslo nikdy nevkládejte do Git repozitáře. Pro HTTPS nastavte `LOOMOS_SECURE_COOKIES=1`.

Databáze se vytváří v ignorované složce `.local/`; vlastní cestu nastavuje `LOOMOS_DATA_DIR`. První start načte výchozí produkty z `data/products.json`, další starty zachovávají úpravy. Produkty lze přidávat, upravovat a skrývat; jejich detailové stránky se generují automaticky. Objednávky uchovávají kopii názvů a cen z okamžiku objednání. Sazby dopravy jsou prozatím vývojové: osobní odběr zdarma, Zásilkovna 79 Kč.

## Ověření

```bash
npm test
```

Testy používají dočasnou databázi a ověřují přihlášení, nepřístupnost soukromých souborů, ukládání produktů, viditelnost, výpočet cen na serveru, odmítnutí neplatných objednávek, ochranu proti duplicitám a změny stavu objednávek.

Nový design používá `assets/css/store.css`, původní Tailwind skripty jsou ponechané pro starší soubory a nový vzhled se přes ně nesestavuje. Písma Cormorant Garamond a DM Sans jsou uložena místně v assets/fonts včetně licencí OFL; nevyžadují Google Fonts.

## Rozsah prototypu

- Všechny objednávky jsou výslovně **zkušební**, bez platby, potvrzovacího e-mailu a expedice.
- Produktové fotografie jsou ilustrační; rozhraní zatím používá společný snímek. Nahrávání vlastních fotografií a další kategorie v administraci jsou navazující práce.
- Nabídka obsahuje šest vůní dodaných majitelkou. Malá a velká varianta mají pracovní ceny 249 Kč a 349 Kč, nikoli finálně potvrzený ceník. Objem a dobu hoření zatím neuvádíme. V administraci lze upravit obě ceny a označení pracovního ceníku. Aktualizace katalogu je jednorázová verzovaná migrace; staré ukázkové vůně skrývá a zachovává historické objednávky.
- Návrh používá světlou pracovní reprodukci dodaného loga. Před publikací ji nahraďte původním kvalitním souborem loga; logo na generované fotografii je ilustrační.
- Pro ostrý provoz zbývá produkční hosting s HTTPS, zálohování a správa přístupů, platby, potvrzovací e-maily, napojení dopravy, sklad, obchodní a osobní údaje a příslušné podmínky. SQLite a Python vývojový server zde slouží k ověření návrhu a toku objednávky, nikoli jako hotové produkční nasazení.
- Administrace Lucatory nebyla dostupná ani kopírovaná. Přehled, produkty a objednávky jsou samostatný výchozí návrh LOOMOS.

Pracujte ve stávajícím checkoutu na vlastní větvi; nic neodesílejte na `main` bez výslovného pokynu.
