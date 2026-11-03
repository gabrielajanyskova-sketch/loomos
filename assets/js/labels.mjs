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

const icon = (label, body) =>
  `<svg class="label-icon" viewBox="0 0 24 24" role="img" aria-label="${label}" fill="none" stroke="#000" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const NO =
  '<circle cx="12" cy="12" r="10.5" stroke="#d00" stroke-width="1.6"/><path d="M4.6 4.6 19.4 19.4" stroke="#d00" stroke-width="1.6"/>';
const CANDLE = (x, y = 0) =>
  `<path d="M${x - 2} ${14 + y}h4v7h-4z"/><path d="M${x} ${13 + y}c-1.4-1.3-1-3 0-4.6 1 1.6 1.4 3.3 0 4.6z" fill="#000"/>`;
/** Simplified safety pictograms in the spirit of ČSN EN 15494 (own drawings). */
export const EN15494_ICONS = [
  icon(
    "Výstraha: přečtěte si bezpečnostní pokyny",
    '<path d="M12 2.5 22.5 21h-21z" stroke-width="1.6"/><path d="M12 9v6" stroke-width="2"/><circle cx="12" cy="18" r=".9" fill="#000" stroke="none"/>',
  ),
  icon(
    "Nikdy nenechávejte hořící svíčku bez dozoru",
    `${CANDLE(12, 1)}<path d="M5 6.5s3-3.5 7-3.5 7 3.5 7 3.5-3 3.5-7 3.5-7-3.5-7-3.5z"/><circle cx="12" cy="6.5" r="1.5" fill="#000" stroke="none"/>`,
  ),
  icon(
    "Udržujte mimo dosah dětí a zvířat",
    `${NO}<circle cx="12" cy="7.5" r="2"/><path d="M12 9.5v5.5M8.5 12h7M12 15l-2.5 4M12 15l2.5 4"/>`,
  ),
  icon(
    "Nestavte do blízkosti hořlavých předmětů",
    `${NO}${CANDLE(9)}<path d="M15 6c1.2 1.5-1.2 3 0 4.5s-1.2 3 0 4.5 -1.2 3 0 4.5M18 6c1.2 1.5-1.2 3 0 4.5s-1.2 3 0 4.5-1.2 3 0 4.5"/>`,
  ),
  icon(
    "Mezi hořícími svíčkami ponechte alespoň 10 cm",
    `${CANDLE(4.5, -4)}${CANDLE(19.5, -4)}<path d="M8 14h8M9.5 12.5 8 14l1.5 1.5M14.5 12.5 16 14l-1.5 1.5"/><text x="12" y="22.5" font-size="5" text-anchor="middle" fill="#000" stroke="none" font-family="Arial, sans-serif">10 cm</text>`,
  ),
];

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
