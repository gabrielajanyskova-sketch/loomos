/** Verified brand facts and visible answers. Edit this file when final copy is approved. */
export const brand = {
  name: "LOOMOS",
  url: "https://loomos.cz",
  language: "cs-CZ",
  email: "info@loomos.cz",
  description:
    "Ručně vyráběné sójové svíčky v čirém skle s dřevěným knotem. Vonné oleje z Velké Británie bez ftalátů.",
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
    question: "Z čeho jsou svíčky LOOMOS vyrobené?",
    answer:
      "Svíčky vyrábíme ručně ze sójového vosku. Mají dřevěný knot a čiré sklo. Používáme vonné oleje dovážené z Velké Británie, které neobsahují ftaláty.",
  },
  {
    question: "Jaké vůně si mohu vybrat?",
    answer:
      "V nabídce je Okurka, zázvor a máta; Pomeranč a vanilka; Mořská sůl a pačuli; Sváteční duch; Zázvor a zelený čaj; Goji a červený pomeranč.",
  },
  {
    question: "Jaké velikosti svíček připravujete?",
    answer:
      "Každou vůni připravujeme v malé a velké velikosti. Přesný objem a dobu hoření ještě doplníme. Uvedené ceny jsou zatím pracovní.",
  },
  {
    question: "Mohu už odeslat objednávku?",
    answer:
      "E-shop právě připravujeme. Nabídku i košík si můžete prohlédnout a vyzkoušet. Platby a skutečné odesílání objednávek zatím nejsou spuštěné. S dotazy nám napište na info@loomos.cz.",
  },
  {
    question: "Budou v nabídce i jiné výrobky?",
    answer:
      "Ano, připravujeme vůně do auta, výrobky z 3D tisku, potisky oblečení a samolepky. Tyto kategorie zatím nejsou v prodeji.",
  },
];
