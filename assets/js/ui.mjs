import { seller, sellerAddress } from "./site.mjs";
import { GHS07 } from "./labels.mjs";
import { isCandle, scentFamilies } from "./catalog.mjs";
import { FREE_SHIPPING_FROM } from "./pricing.mjs";

/** Short scent character tags (sladká, svěží, …) from data/products.json. */
const scentTags = (p) =>
  p.character?.length
    ? `<ul class="scent-tags" aria-label="Charakter vůně">${p.character.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`
    : "";

/** "±50 h hoření · cca 5 Kč/h" for a candle size with a known burn time. */
/** "Hodí se jako dárek pro ni / pro něj" with links to the gift pages. */
const giftNote = (p) => {
  const links = [
    ["pro-ni", "pro ni", "/darek-pro-ni.html"],
    ["pro-nej", "pro něj", "/darek-pro-nej.html"],
  ].filter(([who]) => p.gift?.includes(who));
  return links.length
    ? `<p class="gift-note">Hodí se jako dárek ${links.map(([, label, href]) => `<a href="${href}">${label}</a>`).join(" i ")}.</p>`
    : "";
};

/** Line icon from /assets/img/icons.svg (same style everywhere, coloured by CSS currentColor). */
/** Manufacturer and product identification on every product page (GPSR, EU 2023/988). */
const makerBlock = (p) =>
  `<div class="maker-info"><h2>Výrobce a bezpečnost výrobku</h2><p><strong>Výrobce:</strong> ${esc(seller.name)}, ${esc(sellerAddress)}, ${esc(seller.country)} · <a href="mailto:${esc(seller.email)}">${esc(seller.email)}</a></p><p><strong>Výrobek:</strong> ${esc(p.name)} (${p.category === "lapace-slunce" ? `lapač slunce${p.size ? `, ${esc(p.size)}` : ""}` : "sójová svíčka ve skle"}), kód ${esc(p.id)}${p.category === "lapace-slunce" ? "" : "; číslo šarže je na etiketě na dně"}.</p><p>${p.category === "lapace-slunce" ? "Bezpečnostní upozornění: není hračka, obsahuje malé části — uchovávejte mimo dosah malých dětí. Lepte jen na vnitřní stranu čistého hladkého skla." : 'Bezpečnostní upozornění a složení najdete výše v části „Složení a bezpečnost“ a na etiketě. Hořící svíčku nenechávejte bez dozoru, mimo dosah dětí a zvířat. <a href="/slozeni-a-bezpecnost.html">Více o bezpečnosti →</a>'}</p></div>`;

export const icon = (name, cls = "") =>
  `<svg class="ico${cls ? " " + cls : ""}" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><use href="/assets/img/icons.svg#${name}" /></svg>`;

export const burnLine = (variant, price = variant?.price) =>
  variant?.burn_hours && price
    ? `±${variant.burn_hours} h hoření · cca ${Math.round(price / variant.burn_hours)} Kč/h`
    : "";

export const safetyBlock = (p) =>
  p.safety
    ? `<details class="safety"><summary>Složení a bezpečnost</summary><p>Sójový vosk, vonný olej s certifikátem IFRA, dřevěný knot, čiré sklo.</p>${p.safety.pictogram ? `<p class="safety-warning">${GHS07}<span>${esc(p.safety.extra)}</span></p>` : p.safety.extra ? `<p>${esc(p.safety.extra)}</p>` : ""}${p.safety.contains ? `<p>Obsahuje ${esc(p.safety.contains)}. Může vyvolat alergickou reakci.</p>` : ""}<p><a href="/slozeni-a-bezpecnost.html">Co znamenají látky na etiketě a jak svíčku používat bezpečně →</a></p></details>`
    : "";

export const safetyTable = (products) =>
  `<div class="table-wrap"><table class="safety-table"><thead><tr><th>Vůně</th><th>Obsahuje (alergeny)</th><th>Upozornění na etiketě</th></tr></thead><tbody>${products
    .filter((p) => p.safety)
    .map(
      (p) =>
        `<tr><td><a href="/produkty/${encodeURIComponent(p.id)}.html">${esc(p.name)}</a></td><td>${esc(p.safety.contains)}</td><td>${esc(p.safety.extra)}</td></tr>`,
    )
    .join("")}</tbody></table></div>`;
export const money = (n) =>
  n == null
    ? "Cena bude doplněna"
    : new Intl.NumberFormat("cs-CZ", {
        style: "currency",
        currency: "CZK",
        maximumFractionDigits: 0,
      }).format(n);
export const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
/** A sale and its frozen pre-campaign 30-day minimum are distinct values. */
export const saleMarkup = (p) =>
  p.sale_price != null && p.lowest_30 != null
    ? `<p class="sale-reference"><del aria-label="Původní běžná cena">${money(p.regular_price)}</del><span>Nejnižší cena za 30 dní před slevou: <strong>${money(p.lowest_30)}</strong></span></p>`
    : "";
const isSuncatcher = (p) => p.category === "lapace-slunce";
const suncatcherPhotos = new Set([
  "lapac-slunce-sova",
  "lapac-slunce-vila",
  "lapac-slunce-medvidek",
  "lapac-slunce-traktor",
]);
const suncatcherWindowPhotos = new Set([
  "lapac-slunce-traktor",
  "lapac-slunce-sova",
  "lapac-slunce-vila",
  "lapac-slunce-medvidek",
]);
/** Square studio photos on white (assets/img/<id>[-N]-480/960.webp); value = number of photos. */
const suncatcherStudioPhotos = new Map([
  ["lapac-slunce-kocicka", 1],
  ["lapac-slunce-sova-na-vetvi", 1],
  ["lapac-slunce-konik", 1],
  ["lapac-slunce-liska", 1],
  ["lapac-slunce-dracek", 1],
  ["lapac-slunce-pejsek-hasic", 1],
  ["lapac-slunce-dyne", 1],
  ["lapac-slunce-vanocni-stromecek", 2],
  ["lapac-slunce-kote-na-mesici", 1],
  ["lapac-slunce-zimni-vesnicka", 1],
  ["lapac-slunce-vcelka", 1],
  ["lapac-slunce-hasicske-auto", 1],
  ["lapac-slunce-lednacek", 1],
  ["lapac-slunce-zajicek", 1],
]);
const studioSource = (id, i) => `/assets/img/${id}${i ? `-${i + 1}` : ""}`;
/**
 * Real product photos that ship with the website (not illustrations), largest size first.
 * Admin shows them and copies them into its own photos before the first change.
 */
export function builtinPhotos(p) {
  if (suncatcherStudioPhotos.has(p.id))
    return Array.from(
      { length: suncatcherStudioPhotos.get(p.id) },
      (_, i) => `${studioSource(p.id, i)}-960.webp`,
    );
  if (suncatcherWindowPhotos.has(p.id)) return [`/assets/img/${p.id}-960.webp`];
  return [];
}
/** Photos uploaded in admin (served from D1); the first one is the main photo. */
export const photoUrl = (img) => `/api/img?id=${img.id}`;
const uploadedPicture = (p, tag = "") =>
  `<a class="product-image uploaded-photo" href="/produkty/${encodeURIComponent(p.id)}.html"><img src="${photoUrl(p.images[0])}" width="${p.images[0].width}" height="${p.images[0].height}" alt="${esc(p.name)}" loading="lazy" decoding="async" data-main-photo>${tag ? `<span class="product-tag">${p.badge && tag === p.badge.toUpperCase() ? icon("star", "ico-inline") + " " : ""}${esc(tag)}</span>` : ""}</a>`;
/** Thumbnails under the main photo on the product page (switch the main photo on click). */
const gallery = (p) =>
  !p.images?.length && suncatcherStudioPhotos.get(p.id) > 1
    ? `<div class="photo-gallery">${Array.from(
        { length: suncatcherStudioPhotos.get(p.id) },
        (_, i) => studioSource(esc(p.id), i) + "-480.webp",
      )
        .map(
          (src, i) =>
            `<button type="button" data-photo="${src}" class="${i === 0 ? "active" : ""}" aria-label="Fotka ${i + 1}"><img src="${src}" width="80" height="80" alt="" loading="lazy" decoding="async"></button>`,
        )
        .join("")}</div>`
    : p.images?.length > 1
      ? `<div class="photo-gallery">${p.images.map((img, i) => `<button type="button" data-photo="${photoUrl(img)}" class="${i === 0 ? "active" : ""}" aria-label="Fotka ${i + 1}"><img src="${photoUrl(img)}" width="80" height="80" alt="" loading="lazy" decoding="async"></button>`).join("")}</div>`
      : "";
/** Small image for the cart and order summaries. */
export function thumbSrc(p) {
  if (p.images?.length) return photoUrl(p.images[0]);
  if (p.category === "lapace-slunce") {
    if (suncatcherStudioPhotos.has(p.id))
      return `${studioSource(p.id, 0)}-480.webp`;
    if (!suncatcherPhotos.has(p.id)) return null;
    return `/assets/img/${p.id}${suncatcherWindowPhotos.has(p.id) ? "-window" : ""}-480.webp`;
  }
  return "/assets/img/candle-480.webp";
}
const suncatcherPicture = (p) => {
  if (p.images?.length) return uploadedPicture(p);
  const href = `/produkty/${esc(p.id)}.html`;
  if (suncatcherStudioPhotos.has(p.id)) {
    const src = studioSource(esc(p.id), 0);
    return `<a class="product-image suncatcher-product-image studio-photo" href="${href}"><img src="${src}-480.webp" srcset="${src}-480.webp 480w, ${src}-960.webp 960w" sizes="(max-width: 700px) calc(100vw - 36px), 480px" width="960" height="1280" alt="Lapač slunce ${esc(p.name)} — skutečná fotografie výrobku" loading="lazy" decoding="async" data-main-photo></a>`;
  }
  if (suncatcherPhotos.has(p.id)) {
    const visual = suncatcherWindowPhotos.has(p.id);
    const source = esc(p.id) + (visual ? "-window" : "");
    return `<a class="product-image suncatcher-product-image" href="${href}"><img src="/assets/img/${source}-480.webp" srcset="/assets/img/${source}-480.webp 480w, /assets/img/${source}-960.webp 960w" sizes="(max-width: 700px) calc(100vw - 36px), 480px" width="960" height="${visual ? 1200 : 1280}" alt="Lapač slunce ${esc(p.name)} — ${visual ? "ilustrační vizualizace na okně" : "skutečná fotografie výrobku v obalu"}" loading="lazy" decoding="async">${visual ? '<span class="photo-note">Ilustrační vizualizace</span>' : ""}</a>`;
  }
  return `<a class="product-image pending-photo" href="${href}" aria-label="${esc(p.name)} — detail produktu"><span class="pending-photo-circle"><span>${esc(p.name)}</span><small>Fotografii připravujeme</small></span></a>`;
};
const suncatcherCard = (p) =>
  `<article class="product-card">${suncatcherPicture(p)}<div class="product-meta"><small>LAPAČ SLUNCE${p.size ? ` · ${esc(p.size.toUpperCase())}` : ""}</small><div class="product-title-row"><h3><a href="/produkty/${esc(p.id)}.html">${esc(p.name)}</a></h3><span class="price" data-card-price>${money(p.price)}</span></div>${ratingLine(p)}<div data-sale-reference>${saleMarkup(p.variants?.[0] ?? p)}</div>${p.bulk ? `<p class="bulk-note">Od ${p.bulk.min_qty} ks jen ${money(p.bulk.price)} / ks${isCandle(p) ? "" : " (i různé motivy)"}</p>` : ""}<p class="product-notes">${esc(p.notes)}</p><span class="stock-note" aria-live="polite"></span><div class="card-buy"><div class="quantity card-qty"${p.price == null ? " hidden" : ""}><button type="button" data-card-qty="-1" aria-label="Ubrat kus">−</button><output data-card-quantity>1</output><button type="button" data-card-qty="1" aria-label="Přidat kus">＋</button></div><button class="add-button" data-add="${esc(p.id)}" ${p.price == null ? "disabled" : ""}><span class="add-label">${p.price == null ? "Cenu připravuji" : "Přidat do košíku"}</span></button></div></div></article>`;
const suncatcherDetail = (p) =>
  `<div class="detail-grid"><div class="detail-photo">${suncatcherPicture(p)}${gallery(p)}${!p.images?.length && suncatcherWindowPhotos.has(p.id) ? `<p><a class="text-link" href="/assets/img/${esc(p.id)}-960.webp">Skutečná fotografie výrobku v obalu →</a></p>` : ""}</div><section class="detail-copy"><div class="eyebrow">LAPAČ SLUNCE · LOOMOS</div><h1>${esc(p.name)}</h1>${p.rating?.count ? `<a class="rating-link" href="#reviews-title">${ratingLine(p)}</a>` : ""}<p class="lead">${esc(p.subtitle)}</p><p>${esc(p.description)}</p><span class="price" id="detail-price">${money(p.price)}</span><div data-sale-reference>${saleMarkup(p)}</div>${p.bulk ? `<p class="bulk-note">Od ${p.bulk.min_qty} ks jen ${money(p.bulk.price)} / ks${isCandle(p) ? "" : " — platí pro jakékoli lapače, motivy lze kombinovat"}. Cena se v košíku upraví sama.</p>` : ""}<span class="stock-note" aria-live="polite"></span><div class="buy-row"><div class="quantity"><button data-detail-qty="-1" aria-label="Ubrat kus">−</button><output id="detail-quantity">1</output><button data-detail-qty="1" aria-label="Přidat kus">＋</button></div><button class="button" data-add="${esc(p.id)}" ${p.price == null ? "disabled" : ""}>${p.price == null ? "Cenu připravuji" : "Přidat do košíku ＋"}</button></div><div class="detail-facts">${p.size ? `<span>${icon("sticker")} Velikost ${esc(p.size)}</span>` : ""}<span>${icon("window")} Statické přilnutí ke sklu</span><span>${icon("rainbow")} Duhy po celé místnosti</span><span>${icon("sun")} Bez elektřiny, jen slunce</span></div><details class="howto" id="jak-nalepit" open><summary>Jak lapač nalepit</summary><ol class="howto-steps"><li><strong>Umyjte sklo.</strong> Okno, sklo nebo zrcadlo očistěte a otřete do sucha — na čistém povrchu bez prachu a mastnoty drží nálepka nejlépe.</li><li><strong>Lehce navlhčete.</strong> Stačí pár střiků vody z rozprašovače. Díky vodě můžete nálepku ještě posunout na to správné místo.</li><li><strong>Sloupněte nálepku z podkladu.</strong> Je tenká a k podkladu přilne pevně, tak začněte od okraje a postupujte pomalu a trpělivě.</li><li><strong>Vytlačte vodu.</strong> Přiložte nálepku na sklo a plastovou kartičkou (třeba starou věrnostní) vytlačte vodu a bublinky od středu k okrajům. Pak ji nechte proschnout.</li></ol><p class="muted">Nejlépe vynikne na přímém slunci. Vzhled duhových odlesků závisí na světle a úhlu pohledu.</p></details><div class="detail-notice">Lapač slunce není hračka — obsahuje malé části, uchovávejte ho mimo dosah malých dětí.</div>${makerBlock(p)}</section></div>`;
export const picture = (p, tag = "") =>
  p.images?.length
    ? uploadedPicture(p, tag)
    : !isCandle(p)
      ? `<a class="product-image suncatcher-image" href="/produkty/${encodeURIComponent(p.id)}.html" aria-label="${esc(p.name)}"><span class="rainbow-fill" aria-hidden="true"></span>${tag ? `<span class="product-tag">${p.badge && tag === p.badge.toUpperCase() ? icon("star", "ico-inline") + " " : ""}${esc(tag)}</span>` : ""}</a>`
      : `<a class="product-image" href="/produkty/${encodeURIComponent(p.id)}.html"><img src="/assets/img/candle-480.webp" srcset="/assets/img/candle-480.webp 480w, /assets/img/candle-960.webp 960w" sizes="(max-width: 700px) calc(100vw - 36px), 400px" width="480" height="320" decoding="async" alt="${esc(p.name)} — ilustrační fotografie čirého skla s dřevěným knotem" loading="lazy">${tag ? `<span class="product-tag">${p.badge && tag === p.badge.toUpperCase() ? icon("star", "ico-inline") + " " : ""}${esc(tag)}</span>` : ""}<span class="photo-note">Ilustrační fotografie</span></a>`;
export const productCard = (p, i) =>
  isSuncatcher(p)
    ? suncatcherCard(p)
    : `<article class="product-card${p.badge ? " featured" : ""}">${picture(p, p.badge ? p.badge.toUpperCase() : isCandle(p) ? (i === 0 ? "RUČNĚ VYROBENÉ" : "SÓJOVÁ SVÍČKA") : "LAPAČ SLUNCE")}<div class="product-meta"><small>${isCandle(p) ? "SÓJOVÝ VOSK · DŘEVĚNÝ KNOT" : "DUHOVÁ FÓLIE NA OKNO"}</small><div class="product-title-row"><h3><a href="/produkty/${encodeURIComponent(p.id)}.html">${esc(p.name)}</a></h3><span class="price" data-card-price>${money(p.variants?.[0]?.price ?? p.price)}</span></div>${ratingLine(p)}${p.variants?.[0]?.burn_hours ? `<p class="burn-time" data-card-burn>${burnLine(p.variants[0])}</p>` : ""}${p.bulk ? `<p class="bulk-note">Od ${p.bulk.min_qty} ks jen ${money(p.bulk.price)} / ks${isCandle(p) ? "" : " (i různé motivy)"}</p>` : ""}${scentTags(p)}<div data-sale-reference>${saleMarkup(p.variants?.[0] ?? p)}</div><p class="product-notes">${esc(p.notes)}</p>${p.variants?.length ? `<label class="card-size-label" for="size-${esc(p.id)}">${isCandle(p) ? "Velikost svíčky" : "Velikost"}<select id="size-${esc(p.id)}" data-card-size="${esc(p.id)}">${p.variants.map((v) => `<option value="${esc(v.id)}">${esc(v.name)}${v.detail ? ` (${esc(v.detail)})` : ""} — ${money(v.price)}</option>`).join("")}</select></label>` : ""}${p.price_provisional ? '<p class="provisional-price">Pracovní ceny</p>' : ""}<span class="stock-note" aria-live="polite"></span><div class="card-buy"><div class="quantity card-qty"${p.price == null ? " hidden" : ""}><button type="button" data-card-qty="-1" aria-label="Ubrat kus">−</button><output data-card-quantity>1</output><button type="button" data-card-qty="1" aria-label="Přidat kus">＋</button></div><button class="add-button" data-add="${esc(p.id)}" ${p.price == null ? "disabled" : ""}><span class="add-label">${p.price == null ? "Cenu připravuji" : "Přidat do košíku"}</span> <span>${p.price == null ? "" : "＋"}</span></button></div></div></article>`;

export const renderHeader = (page = "home", { live = false } = {}) =>
  `<div class="announcement">RUČNĚ VYRÁBĚNÉ SÓJOVÉ SVÍČKY ${icon("sparkle", "ico-inline")} DOPRAVA ZDARMA OD ${FREE_SHIPPING_FROM.toLocaleString("cs-CZ")} KČ</div>${live ? "" : '<p class="preview-notice" role="note"><strong>Zkušební provoz.</strong> E-shop teprve ladím, objednávky zatím nevyřizuji a nic neplaťte. Fotografie jsou ilustrační. Dotazy: <a href="mailto:info@loomos.cz">info@loomos.cz</a></p>'}<header class="site-header"><div class="container header-inner"><a href="/" class="brand brand-logo" aria-label="Loomos — úvodní stránka"><img src="/assets/img/logo-192.webp" alt="Loomos" width="90" height="80"></a><nav id="navigation" class="main-nav" aria-label="Hlavní navigace"><a href="/obchod.html" class="${["shop", "product"].includes(page) ? "active" : ""}">Svíčky</a><a href="/lapace-slunce.html" class="${page === "suncatchers" ? "active" : ""}">Lapače slunce</a><a href="/#pribeh">Náš příběh</a></nav><div class="header-actions"><a class="account-link ${["account", "reset"].includes(page) ? "active" : ""}" href="/ucet.html" aria-label="Můj účet"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg><span class="account-label">Účet</span></a><a class="cart-link" href="/kosik.html" aria-label="Zobrazit košík"><svg viewBox="0 0 24 26" aria-hidden="true"><path d="M4 8h16l1 16H3L4 8Z M8 9V6a4 4 0 0 1 8 0v3"/></svg><span>Košík</span><span class="cart-count">0</span></a><button class="menu-toggle" aria-expanded="false" aria-controls="navigation" aria-label="Otevřít menu">☰</button></div></div></header>`;
export const renderFooter = () =>
  `<footer class="site-footer"><div class="container"><div class="footer-grid"><div><a href="/" class="brand brand-logo"><img src="/assets/img/logo-192.webp" alt="Loomos" width="90" height="80"></a><p>Malé věci, které tvoří atmosféru.<br>Ručně vyráběné svíčky a prostor pro další nápady.</p></div><div><h3>Objevte LOOMOS</h3><a href="/obchod.html">Sójové svíčky</a><a href="/lapace-slunce.html">Lapače slunce</a><a href="/darek-pro-ni.html">Dárek pro ni</a><a href="/darek-pro-nej.html">Dárek pro něj</a><a href="/#dalsi-tvorba">Co připravuji</a><a href="/velkoobchod.html">Spolupráce</a></div><div><h3>Jsem tu pro vás</h3><a href="mailto:info@loomos.cz">info@loomos.cz →</a><a href="/ucet.html">Můj účet</a><a href="/kosik.html">Váš košík</a><a href="/#pribeh">Náš příběh</a></div></div><p class="member-info">${icon("sparkle", "ico-inline")} Registrovaní zákazníci mají na všechno <strong>5 % slevu</strong>. <a href="/ucet.html">Založit účet nebo se přihlásit →</a></p><div class="footer-legal"><p>Provozovatel: ${esc(seller.name)} · IČO ${esc(seller.ico)} · ${esc(sellerAddress)} · ${esc(seller.register)}${seller.vatPayer === false ? " · Neplátce DPH" : ""}</p><nav aria-label="Právní informace"><a href="/odstoupeni.html" class="withdrawal-link">Odstoupit od smlouvy zde</a><a href="/slozeni-a-bezpecnost.html">Složení a bezpečnost</a><a href="/obchodni-podminky.html">Obchodní podmínky</a><a href="/ochrana-osobnich-udaju.html">Ochrana osobních údajů</a><a href="/ochrana-osobnich-udaju.html#cookies">Cookies</a><button type="button" class="link-button" data-cookie-settings hidden>Nastavení cookies</button></nav></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} LOOMOS. S péčí o každý detail.</span><span>Ilustrační fotografie · <a href="/admin/">Administrace →</a></span></div></div></footer>`;
export const renderProductDetail = (p) =>
  isSuncatcher(p)
    ? suncatcherDetail(p)
    : `<div class="detail-grid"><div class="detail-photo">${picture(p, p.images?.length ? "" : "RUČNĚ VYROBENÉ")}${gallery(p)}</div><section class="detail-copy"><div class="eyebrow">${isCandle(p) ? "SÓJOVÁ SVÍČKA" : "LAPAČ SLUNCE"} · LOOMOS</div>${p.badge ? `<p class="badge-pill">${icon("star", "ico-inline")} ${esc(p.badge)}</p>` : ""}<h1>${esc(p.name)}</h1>${p.rating?.count ? `<a class="rating-link" href="#reviews-title">${ratingLine(p)}</a>` : ""}${scentTags(p)}${giftNote(p)}<p class="lead">${esc(p.subtitle)}</p><p>${esc(p.description)}</p>${p.variants?.length ? `<label class="size-label">${isCandle(p) ? "Velikost svíčky" : "Velikost"}<select id="size-choice">${p.variants.map((v) => `<option value="${esc(v.id)}">${esc(v.name)}${v.detail ? ` (${esc(v.detail)})` : ""} — ${money(v.price)}</option>`).join("")}</select></label>` : ""}<span class="price" id="detail-price">${money(p.variants?.[0]?.price ?? p.price)}</span><div data-sale-reference>${saleMarkup(p.variants?.[0] ?? p)}</div>${p.variants?.[0]?.burn_hours ? `<p class="burn-time" id="detail-burn">${burnLine(p.variants[0])}</p>` : ""}${p.bulk ? `<p class="bulk-note">Od ${p.bulk.min_qty} ks jen ${money(p.bulk.price)} / ks${isCandle(p) ? "" : " — platí pro jakékoli lapače, motivy lze kombinovat"}. Cena se v košíku upraví sama.</p>` : ""}${p.price_provisional ? '<p class="muted">Ceny jsou zatím pracovní.</p>' : ""}<span class="stock-note" aria-live="polite"></span><div class="buy-row"><div class="quantity"><button data-detail-qty="-1" aria-label="Ubrat kus">−</button><output id="detail-quantity">1</output><button data-detail-qty="1" aria-label="Přidat kus">＋</button></div><button class="button" data-add="${esc(p.id)}" ${p.price == null ? "disabled" : ""}>${p.price == null ? "Cenu připravuji" : "Přidat do košíku ＋"}</button></div>${isCandle(p) ? `<div class="detail-facts"><span>${icon("hand")} Ruční výroba</span><span>${icon("soy")} Sójový vosk</span><span>${icon("fragrance")} Oleje z Velké Británie (IFRA)</span><span>${icon("wick")} Dřevěný knot · čiré sklo</span></div>` : `<div class="detail-facts"><span>${icon("rainbow")} Duhy po celé místnosti</span><span>${icon("window")} Na vnitřní stranu okna</span><span>${icon("sun")} Bez elektřiny, jen slunce</span><span>${icon("sticker")} <a href="#jak-nalepit">Jak nalepit</a></span></div><details class="howto" id="jak-nalepit" open><summary>Jak lapač nalepit</summary><ol class="howto-steps"><li><strong>Umyjte sklo.</strong> Okno, sklo nebo zrcadlo očistěte a otřete do sucha — na čistém povrchu bez prachu a mastnoty drží nálepka nejlépe.</li><li><strong>Lehce navlhčete.</strong> Stačí pár střiků vody z rozprašovače. Díky vodě můžete nálepku ještě posunout na to správné místo.</li><li><strong>Sloupněte nálepku z podkladu.</strong> Je tenká a k podkladu přilne pevně, tak začněte od okraje a postupujte pomalu a trpělivě.</li><li><strong>Vytlačte vodu.</strong> Přiložte nálepku na sklo a plastovou kartičkou (třeba starou věrnostní) vytlačte vodu a bublinky od středu k okrajům. Pak ji nechte proschnout.</li></ol></details>`}${p.pyramid ? `<dl class="pyramid"><div><dt>Hlava</dt><dd>${esc(p.pyramid.top)}</dd></div><div><dt>Srdce</dt><dd>${esc(p.pyramid.heart)}</dd></div>${p.pyramid.base ? `<div><dt>Základ</dt><dd>${esc(p.pyramid.base)}</dd></div>` : ""}</dl>` : isCandle(p) ? `<p><strong>Vonné tóny</strong><br>${esc(p.notes)}</p>` : ""}${safetyBlock(p)}${isCandle(p) ? `<div class="detail-notice">Malý rituál, velká radost. Svíčku pokládejte na nehořlavý povrch a nenechávejte ji hořet bez dozoru. Fotografie je ilustrační.</div><p class="muted small-note">Sójový vosk je přírodní: změny teploty při přepravě mohou způsobit, že se vosk místy odlepí od skla (světlejší skvrny) nebo se objeví jemný bílý povlak. Na hoření ani vůni to nemá vliv. <a href="/slozeni-a-bezpecnost.html#vzhled">Proč to tak je →</a></p>` : `<div class="detail-notice">Nálepka není hračka — obsahuje malé části, uchovávejte mimo dosah malých dětí.</div>`}${makerBlock(p)}</section></div>`;

export function renderFAQ(faqs) {
  return `<div class="section-heading"><div><div class="eyebrow">DOBRÉ VĚDĚT</div><h2>Na co se <em>často ptáte.</em></h2></div></div><div class="faq-grid">${faqs.map((f) => `<details><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`).join("")}</div>`;
}

/** "Mohlo by se vám líbit": other candles, most similar scent families first. */
export function renderRelated(p, all, count = 3) {
  const mine = new Set(scentFamilies(p));
  const score = (q) =>
    scentFamilies(q).filter((f) => mine.has(f)).length * 2 +
    (q.gift || []).filter((g) => p.gift?.includes(g)).length +
    (q.badge ? 1 : 0);
  const list = all
    .filter((q) => q.id !== p.id && isCandle(q) === isCandle(p))
    .map((q, i) => [q, score(q), i])
    .sort((a, b) => b[1] - a[1] || a[2] - b[2])
    .slice(0, count)
    .map(([q]) => q);
  return list.length
    ? `<section class="related" aria-labelledby="related-title"><div class="eyebrow">CO JEŠTĚ MÁM</div><h2 id="related-title">Mohlo by se vám <em>líbit.</em></h2><div class="product-grid">${list.map((q, i) => productCard(q, i + 1)).join("")}</div><p><a class="text-link" href="${isCandle(p) ? "/obchod.html" : "/lapace-slunce.html"}">${isCandle(p) ? "Všechny svíčky" : "Všechny lapače slunce"} →</a></p></section>`
    : "";
}

/** Extra card at the end of the sun catcher offer: a custom motif on request (no cart, leads to the inquiry form). */
export const customSuncatcherCard = () =>
  `<article class="product-card custom-card"><a class="product-image pending-photo custom-photo" href="/poptavka.html"><span class="product-tag">${icon("sparkle", "ico-inline")} NA PŘÁNÍ</span><span class="pending-photo-circle"><span>Váš motiv</span><small>pejsek, kočička, jméno…</small></span></a><div class="product-meta"><small>LAPAČ SLUNCE · 15 CM</small><div class="product-title-row"><h3><a href="/poptavka.html">Lapač na přání</a></h3><span class="price">od ${money(299)}</span></div><p class="product-notes">S vaším pejskem, kočičkou nebo jiným motivem podle fotky.</p><a class="add-button" href="/poptavka.html"><span class="add-label">Poslat poptávku</span> <span>→</span></a></div></article>`;

/** ★★★★☆ as icons; `value` may be a decimal average. */
export const stars = (
  value,
  label = `${String(value).replace(".", ",")} z 5`,
) =>
  `<span class="stars" role="img" aria-label="Hodnocení ${label}">${[1, 2, 3, 4, 5].map((n) => icon("star", value >= n - 0.25 ? "star-on" : "star-off")).join("")}</span>`;

/** Short rating line for product cards. */
export const ratingLine = (p) =>
  p.rating?.count
    ? `<p class="rating-line">${stars(p.rating.average)} <span>${String(p.rating.average).replace(".", ",")} · ${p.rating.count} ${p.rating.count === 1 ? "hodnocení" : p.rating.count < 5 ? "hodnocení" : "hodnocení"}</span></p>`
    : "";

/** Reviews section on the product page, including how reviews are verified (consumer law). */
export const reviewsSection = (p, list) => {
  const count = list.length;
  const average = count
    ? Math.round((list.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10
    : 0;
  return `<section class="reviews" aria-labelledby="reviews-title"><div class="eyebrow">OVĚŘENÁ HODNOCENÍ</div><h2 id="reviews-title">Co říkají <em>zákazníci.</em></h2>${
    count
      ? `<p class="reviews-summary">${stars(average)} <strong>${String(average).replace(".", ",")}</strong> z 5 · ${count} hodnocení</p><ul class="review-list">${list
          .map(
            (r) =>
              `<li><div class="review-head">${stars(r.rating)}<strong>${esc(r.name)}</strong><span class="verified">${icon("sparkle", "ico-inline")} Ověřený nákup</span><time datetime="${new Date(r.created * 1000).toISOString().slice(0, 10)}">${new Date(r.created * 1000).toLocaleDateString("cs-CZ")}</time></div>${r.text ? `<p>${esc(r.text)}</p>` : ""}${r.reply ? `<p class="review-reply"><strong>Odpověď LOOMOS:</strong> ${esc(r.reply)}</p>` : ""}</li>`,
          )
          .join("")}</ul>`
      : '<p class="muted">Tenhle produkt zatím nikdo nehodnotil.</p>'
  }<p class="muted small-note">Jak hodnocení ověřuji: hodnotit mohou jen zákazníci, kteří zboží u mě koupili — odkaz na hodnocení dostanou e-mailem po odeslání objednávky. Zveřejňuji všechna hodnocení, kladná i záporná; skrývám jen vulgární nebo nesouvisející.</p></section>`;
};
