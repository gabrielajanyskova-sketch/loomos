# Lapače slunce — pracovní návrh

Větev `feat/suncatchers-draft`. Uživatelka 4. 11. 2026 schválila sloučení a odeslání na main, ceny doplní později.

14 motivů na `/lapace-slunce` a samostatné produktové stránky. Průměr 15 cm, po sejmutí zadní ochranné fólie staticky přilnou na čisté hladké sklo. Údaje vycházejí z popisu a fotografií uživatelky.

Ceny jsou `null` v `data/products.json`; není možná objednávka bez stanovené ceny. Sklad se zadává v administraci pod Skladem, produkty nemají velikostní varianty. Nevyplněný sklad není tvrzení o skutečném počtu. Cenu i počet kusů lze upravit v administraci v záložce Sklad a ceny. Ceny a jejich historie se ukládají v D1; katalog JSON dodává pouze výchozí ceny při prvním spuštění.

Rubble má ilustrační vizualizaci z předchozího návrhu (označenou na webu). Z dodaného ZIPu je doplněno 13 skutečných fotografií: Chase, Bing, Peppa, Zuma, Marshall, Stitch, Mario, sova, víla, medvídek, Skye, traktor a Pikachu. Jsou zachované celé, bez překreslení motivů a barevných filtrů, ve WebP o šířce 480 a 960 px. Velryba byla na žádost uživatelky z nabídky odstraněna. Všech 14 zbývajících motivů má obrázek. ZIP i rozbalené originály jsou uložené mimo veřejný výstup v pracovním prostředí.

Ceny lapačů zůstávají k doplnění v administraci. Neoceněné produkty nelze objednat.


Slevy: zlevněná cena je samostatná od běžné ceny. Před slevou se uloží nejnižší nabídková cena z předchozích 30 dní včetně ceny platné na začátku období. Při postupném snižování ceny v téže akci se reference nemění. Pokud historie ještě nepokrývá 30 dní, vlastnice musí potvrdit ověřenou nejnižší cenu; nesmí být vyšší než dosud zaznamenané minimum. Minulé ceny se nezpětně nedoplňují odhadem. Změny, zdroj reference a skutečné prodejní ceny zůstávají v auditní historii. Cena bez slevy a prázdné pole zlevněné ceny akci ukončí.
