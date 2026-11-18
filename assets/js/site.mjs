/** Verified brand facts and visible answers. Edit this file when final copy is approved. */
export const brand = {
  name: "LOOMOS",
  url: "https://loomos.cz",
  language: "cs-CZ",
  email: "info@loomos.cz",
  description:
    "Ručně vyráběné sójové svíčky v čirém skle s dřevěným knotem, duhové lapače slunce na okno a 3D tisk. Vonné oleje s certifikátem IFRA.",
};
/** Seller identification required by Czech consumer law (public data from ARES). */
export const seller = {
  name: "Gabriela Janýšková",
  ico: "19616295",
  street: "Starojická Lhota 45",
  city: "Starý Jičín",
  zip: "741 01",
  country: "Česká republika",
  register: "Fyzická osoba podnikající dle živnostenského zákona",
  email: "info@loomos.cz",
  vatPayer: false,
};
export const sellerAddress = `${seller.street}, ${seller.zip} ${seller.city}`;
/** Packeta (Zásilkovna) widget key. It is public by design; the API password never belongs here. */
export const packeta = {
  apiKey: "bba87c051aab6fc0",
  library: "https://widget.packeta.com/v6/www/js/library.js",
};
export const faqs = [
  {
    question: "Jsou vonné oleje ve svíčkách bezpečné?",
    answer:
      "Ano. Používám vonné oleje určené přímo pro svíčky s certifikátem IFRA, podle kterého je jejich použití ve svíčkách bez omezení. Dávkuji je v množství doporučeném výrobcem (6–8 %) a každou várku vážím. Látky uvedené na etiketě jsou většinou přirozené složky vůní, jaké najdete i v kosmetice; povinně se uvádějí kvůli lidem s alergií. Podrobnosti najdete na stránce Složení a bezpečnost.",
  },
  {
    question: "Z čeho jsou svíčky LOOMOS vyrobené?",
    answer:
      "Svíčky vyrábím ručně ze sójového vosku. Mají dřevěný knot a čiré sklo. Používám vonné oleje dovážené z Velké Británie s certifikátem IFRA.",
  },
  {
    question: "Jaké vůně si mohu vybrat?",
    answer:
      "Nejoblíbenější je Mořská sůl a pačuli. Dál nabízím Okurku, zázvor a mátu; Pomeranč a vanilku; Zázvor a zelený čaj; Jantar a citrusy; Vanilku, pačuli a santal a Moře a cedr. V obchodě si je můžete vyfiltrovat podle oblíbených tónů (vanilka, pižmo, dřevo…) nebo podle toho, jestli hledáte dárek pro ni, nebo pro něj.",
  },
  {
    question: "Jaké velikosti svíček nabízíte?",
    answer:
      "Každou vůni nabízím ve dvou velikostech: malá svíčka ve sklenici 20 cl obsahuje přibližně 180 g vosku, má křížový dřevěný knot a hoří přibližně 50 hodin, velká ve sklenici 30 cl přibližně 220 g, má plochý dřevěný knot a hoří přibližně 60 hodin. Doba hoření je orientační a záleží hlavně na tom, jak dlouho svíčku necháte hořet a jak zkracujete knot.",
  },
  {
    question: "Svíčka má na skle světlejší skvrny nebo bílý povlak. Je vadná?",
    answer:
      "Není. Každou svíčku před odesláním zkontroluji a posílám ji hladkou a hezkou. Sójový vosk je ale přírodní materiál, který se při chladnutí přirozeně smršťuje — světlejší skvrny se proto mohou objevit i při pečlivé výrobě a mají je i velké značky sójových svíček. Výrobci vosku to uvádějí jako jeho přirozenou vlastnost; správným postupem se dá omezit, ale úplně mu zabránit nejde. Vosk navíc reaguje na teplotu: když balík cestou prochladne v autě nebo v depu a pak se zase ohřeje, vosk se smrští a může se místy odlepit od skla. Na skle pak vypadá jako světlejší „mokré“ skvrny. Může se objevit i jemný bílý povlak (krystalky vosku) nebo drobná prasklinka na povrchu. Na hoření ani vůni to nemá žádný vliv a svíčka je úplně v pořádku. Pokud ale dorazí rozbitá sklenice nebo jiné poškození, pošlete mi fotku na info@loomos.cz a vyřeším to s vámi.",
  },
  {
    question: "Jak se starat o svíčku s dřevěným knotem?",
    answer:
      "Poprvé nechte svíčku hořet, dokud se nerozpustí celá horní vrstva vosku až ke sklu (zhruba 2–3 hodiny), jinak se v ní udělá tunel. Před každým zapálením zkraťte knot na 3–5 mm, nenechávejte ji hořet déle než 4 hodiny v kuse a stavte ji mimo průvan. Když na dně zbývá asi 1 cm vosku, už ji nezapalujte. Podrobný návod i s opravou nejčastějších chyb najdete v článku Jak pečovat o svíčku s dřevěným knotem na blogu.",
  },
  {
    question: "Jak objednávka probíhá a jak zaplatím?",
    answer:
      "Vyberete zboží, v pokladně zvolíte dopravu a objednávku odešlete. Platí se převodem na účet, k platbě dostanete i QR kód pro mobilní bankovnictví. Po připsání platby objednávku připravím a odešlu zpravidla do 5 pracovních dnů. Registrovaní zákazníci mají na všechno 5% slevu.",
  },
  {
    question: "Kolik stojí doprava?",
    answer:
      "Při nákupu od 1 200 Kč je doprava zdarma. Jinak posílám Zásilkovnou na výdejní místo nebo do Z-BOXu za 109 Kč, s doručením domů za 149 Kč, nebo Balíkovnou na pobočku za 99 Kč a domů za 129 Kč. Možný je i osobní odběr ve Starojické Lhotě zdarma. Doručuji v rámci České republiky.",
  },
  {
    question: "Co kromě svíček nabízíte?",
    answer:
      "Lapače slunce: nálepky na okno z duhové fólie, které ze slunečních paprsků vykouzlí duhy po celé místnosti. Stojí 199 Kč a od 2 kusů 175 Kč za kus, motivy lze kombinovat. Lapač vám udělám i na přání podle vaší fotky. Dál nabízím 3D tisk: hotové výrobky i menší zakázkovou výrobu podle vašeho nápadu. Připravuji také potisky a samolepky.",
  },
];
