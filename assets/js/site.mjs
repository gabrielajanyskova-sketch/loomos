/** Verified brand facts and visible answers. Edit this file when final copy is approved. */
export const brand = {
  name: "LOOMOS",
  url: "https://loomos.cz",
  language: "cs-CZ",
  email: "info@loomos.cz",
  description:
    "Ručně vyráběné sójové svíčky v čirém skle s dřevěným knotem. Vonné oleje z Velké Británie s certifikátem IFRA.",
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
    question: "Jaké velikosti svíček připravujete?",
    answer:
      "Každou vůni nabízím ve dvou velikostech: malá svíčka ve sklenici 20 cl obsahuje přibližně 180 g vosku a hoří přibližně 50 hodin, velká ve sklenici 30 cl přibližně 220 g a hoří přibližně 60 hodin. Doba hoření je orientační a záleží hlavně na tom, jak dlouho svíčku necháte hořet a jak zkracujete knot.",
  },
  {
    question: "Svíčka má na skle světlejší skvrny nebo bílý povlak. Je vadná?",
    answer:
      "Není. Každou svíčku před odesláním zkontroluji a posílám ji hladkou a hezkou. Sójový vosk je ale přírodní materiál, který se při chladnutí přirozeně smršťuje — světlejší skvrny se proto mohou objevit i při pečlivé výrobě a mají je i velké značky sójových svíček. Výrobci vosku to uvádějí jako jeho přirozenou vlastnost; správným postupem se dá omezit, ale úplně mu zabránit nejde. Vosk navíc reaguje na teplotu: když balík cestou prochladne v autě nebo v depu a pak se zase ohřeje, vosk se smrští a může se místy odlepit od skla. Na skle pak vypadá jako světlejší „mokré“ skvrny. Může se objevit i jemný bílý povlak (krystalky vosku) nebo drobná prasklinka na povrchu. Na hoření ani vůni to nemá žádný vliv a svíčka je úplně v pořádku. Pokud ale dorazí rozbitá sklenice nebo jiné poškození, pošlete mi fotku na info@loomos.cz a vyřeším to s vámi.",
  },
  {
    question: "Mohu už odeslat objednávku?",
    answer:
      "E-shop právě připravuji. Nabídku i košík si můžete prohlédnout a vyzkoušet. Platby a skutečné odesílání objednávek zatím nejsou spuštěné. S dotazy mi napište na info@loomos.cz.",
  },
  {
    question: "Budou v nabídce i jiné výrobky?",
    answer:
      "Ano. Chystám lapače slunce — nálepky na okno, které ze slunce udělají duhu — a dále vůně do auta, výrobky z 3D tisku, potisky oblečení a samolepky. Tyto kategorie zatím nejsou v prodeji.",
  },
];
