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
  "Nenechávejte hořet bez dozoru. Mimo dosah dětí a zvířat. Nestavte k hořlavým předmětům, do průvanu ani na zdroj tepla, jen na nehořlavou podložku. Zkracujte knot, hořte max. 4 h, nepřenášejte a nehaste vodou.";

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
}) {
  const maker = [
    `${seller.name}, ${sellerAddress}`,
    phone ? `tel. ${phone}` : "",
    seller.email,
  ]
    .filter(Boolean)
    .join(" · ");
  return `<div class="label-circle"><div class="label-text"><span class="label-shape left" aria-hidden="true"></span><span class="label-shape right" aria-hidden="true"></span><p class="label-name"><strong>LOOMOS ${esc(name)}</strong><br>sójová svíčka · ${esc(grams)} g</p>${pictogram ? `<p class="label-pictogram">${GHS07}</p>` : ""}${extra ? `<p>${esc(extra)}</p>` : ""}${contains ? `<p>Obsahuje ${esc(contains)}. Může vyvolat alergickou reakci.</p>` : ""}<p>${esc(SAFETY_TEXT)}</p><p class="label-maker">${esc(maker)}</p>${batch ? `<p class="label-maker">Šarže: ${esc(batch)}</p>` : ""}</div></div>`;
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
