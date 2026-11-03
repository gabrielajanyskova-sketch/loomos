/** Round safety label for the bottom of a candle (text flows inside the circle). */
import { seller, sellerAddress } from "./site.mjs";

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

export const SAFETY_TEXT =
  "Nenechávejte hořet bez dozoru. Mimo dosah dětí, zvířat a hořlavých předmětů. Stavte na nehořlavou podložku mimo průvan. Zkracujte knot, hořte max. 4 h, nehaste vodou.";

/** Safety pictograms per ČSN EN 15494 (from svicky.cz's reference sheet, distance set to 10 cm). */
const PICTOGRAMS = [
  ["varovani", "Obecný symbol varování"],
  ["bez-dozoru", "Hořící svíčku nikdy nenechávejte bez dozoru"],
  ["deti-zvirata", "Hořící svíčku umístěte mimo dosah dětí a domácích zvířat"],
  [
    "odstup-10cm",
    "Mezi hořícími svíčkami vždy ponechte vzdálenost nejméně 10 cm",
  ],
  [
    "horlave-predmety",
    "Hořící svíčku nenechávejte v blízkosti předmětů, které se mohou snadno vznítit",
  ],
];
export const EN15494_ICONS = PICTOGRAMS.map(
  ([file, alt]) =>
    `<img class="label-icon" src="/assets/img/pikto/${file}.png" alt="${alt}" width="256" height="256">`,
);

/** HTML of one label; sizes are applied by the caller through CSS custom properties. */
/** GHS07 exclamation mark (CLP): red diamond, white background, black symbol. */
export const GHS07 =
  '<svg class="label-ghs" viewBox="0 0 100 100" role="img" aria-label="Výstražný symbol GHS07 – vykřičník"><path d="M50 4 96 50 50 96 4 50Z" fill="#fff" stroke="#e00" stroke-width="7" stroke-linejoin="miter"/><path d="M44 25h12l-2.5 36h-7Z" fill="#000"/><circle cx="50" cy="71" r="6" fill="#000"/></svg>';

export function labelHtml({
  name,
  grams,
  contains,
  extra,
  pictogram,
  phone,
  batch,
  icons,
}) {
  const maker = [
    `${seller.name}, ${sellerAddress}`,
    phone ? `tel. ${phone}` : "",
    seller.email,
  ]
    .filter(Boolean)
    .join(" · ");
  return `<div class="label-circle"><div class="label-text"><span class="label-shape left" aria-hidden="true"></span><span class="label-shape right" aria-hidden="true"></span><p class="label-name"><strong>LOOMOS ${esc(name)}</strong><br>sójová svíčka · ${esc(grams)} g</p>${pictogram ? `<p class="label-pictogram">${GHS07}</p>` : ""}${extra ? `<p>${esc(extra)}</p>` : ""}${contains ? `<p>Obsahuje ${esc(contains)}. Může vyvolat alergickou reakci.</p>` : ""}${icons === false ? "" : `<p class="label-icons">${EN15494_ICONS.join("")}</p>`}<p>${esc(SAFETY_TEXT)}</p><p class="label-maker">${esc(maker)}</p>${batch ? `<p class="label-maker">Šarže: ${esc(batch)}</p>` : ""}</div></div>`;
}

/**
 * Label formatting rules of the revised CLP regulation (EU) 2024/2865 (expected from 1. 1. 2028):
 * x-height of at least 1.2 mm for packaging up to 0.5 l/kg and line spacing of at least 120 %.
 * DM Sans has an x-height of 0.526 em, so 6.6 pt gives 1.22 mm.
 */
export const CLP_FORMAT = {
  minXHeightMm: 1.2,
  xHeightRatio: 0.526,
  minFontPt: 6.6,
  lineHeight: 1.2,
};
export const xHeightMm = (fontPt) =>
  Math.round(fontPt * 0.352778 * CLP_FORMAT.xHeightRatio * 100) / 100;

/** Smallest circle (mm) in which the label text fits, measured in the browser. */
export function smallestFit(el, settings, from = 40, to = 140) {
  for (let d = from; d <= to; d++) {
    sizeLabel(el, { ...settings, diameter: d });
    if (!overflows(el)) return d;
  }
  return null;
}

/** Size a rendered label (mm / pt) without inline style attributes (CSP-safe). */
export function sizeLabel(el, { diameter, font }) {
  el.style.setProperty("--label-d", `${diameter}mm`);
  el.style.setProperty("--label-font", `${font}pt`);
}
/** True when the text does not fit inside the circle. */
export const overflows = (el) => {
  const text = el.querySelector(".label-text");
  return text.scrollHeight > text.clientHeight + 1;
};
