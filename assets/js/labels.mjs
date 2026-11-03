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
  "Nikdy nenechávejte hořící svíčku bez dozoru. Udržujte mimo dosah dětí a zvířat. Nestavte do blízkosti hořlavých předmětů, na zdroj tepla ani do průvanu. Stavte na nehořlavou podložku. Před zapálením zkraťte knot. Nenechávejte hořet déle než 4 hodiny v kuse. Hořící svíčku nepřenášejte a nehaste vodou.";

/** HTML of one label; sizes are applied by the caller through CSS custom properties. */
export function labelHtml({ name, grams, contains, extra, phone, batch }) {
  const maker = [
    `Výrobce: ${seller.name}, ${sellerAddress}`,
    phone ? `tel. ${phone}` : "",
    seller.email,
    `IČO ${seller.ico}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return `<div class="label-circle"><div class="label-text"><span class="label-shape left" aria-hidden="true"></span><span class="label-shape right" aria-hidden="true"></span><p class="label-brand">LOOMOS</p><p class="label-name"><strong>${esc(name)}</strong><br>sójová svíčka · ${esc(grams)} g</p>${contains ? `<p><strong>Obsahuje:</strong> ${esc(contains)}. Může vyvolat alergickou reakci.</p>` : ""}${extra ? `<p>${esc(extra)}</p>` : ""}<p>${esc(SAFETY_TEXT)}</p><p class="label-maker">${esc(maker)}</p>${batch ? `<p class="label-maker">Šarže: ${esc(batch)}</p>` : ""}</div></div>`;
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
