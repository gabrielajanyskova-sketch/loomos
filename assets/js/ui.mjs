import { seller, sellerAddress } from "./site.mjs";
import { memberPrice } from "./pricing.mjs";
import { GHS07 } from "./labels.mjs";

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
export const picture = (p, tag = "") =>
  `<a class="product-image" href="/produkty/${encodeURIComponent(p.id)}.html"><img src="/assets/img/candle-480.webp" srcset="/assets/img/candle-480.webp 480w, /assets/img/candle-960.webp 960w" sizes="(max-width: 700px) calc(100vw - 36px), 400px" width="480" height="320" decoding="async" alt="${esc(p.name)} — ilustrační fotografie čirého skla s dřevěným knotem" loading="lazy">${tag ? `<span class="product-tag">${tag}</span>` : ""}<span class="photo-note">Ilustrační fotografie</span></a>`;
export const productCard = (p, i) =>
  `<article class="product-card">${picture(p, i === 0 ? "RUČNĚ VYROBENÉ" : "SÓJOVÁ SVÍČKA")}<div class="product-meta"><small>SÓJOVÝ VOSK · DŘEVĚNÝ KNOT</small><div class="product-title-row"><h3><a href="/produkty/${encodeURIComponent(p.id)}.html">${esc(p.name)}</a></h3><span class="price" data-card-price>${money(p.variants?.[0]?.price ?? p.price)}</span></div><p class="product-notes">${esc(p.notes)}</p>${p.variants?.length ? `<label class="card-size-label" for="size-${esc(p.id)}">Velikost svíčky<select id="size-${esc(p.id)}" data-card-size="${esc(p.id)}">${p.variants.map((v) => `<option value="${esc(v.id)}">${esc(v.name)}${v.detail ? ` (${esc(v.detail)})` : ""} — ${money(v.price)}</option>`).join("")}</select></label>` : ""}<p class="member-price" data-card-member>S účtem o 5 % levněji: <strong>${money(memberPrice(p.variants?.[0]?.price ?? p.price))}</strong></p>${p.price_provisional ? '<p class="provisional-price">Pracovní ceny</p>' : ""}<span class="stock-note" aria-live="polite"></span><button class="add-button" data-add="${esc(p.id)}" ${p.price == null ? "disabled" : ""}><span class="add-label">${p.price == null ? "Cenu připravujeme" : "Přidat do košíku"}</span> <span>${p.price == null ? "" : "＋"}</span></button></div></article>`;

export const renderHeader = (page = "home", { live = false } = {}) =>
  `<div class="announcement">RUČNĚ VYRÁBĚNÉ SÓJOVÉ SVÍČKY &nbsp; ✧ &nbsp; MALÉ RADOSTI OD LOOMOS</div>${live ? "" : '<p class="preview-notice" role="note"><strong>Zkušební provoz.</strong> E-shop teprve ladíme, objednávky zatím nevyřizujeme a nic neplaťte. Fotografie jsou ilustrační. Dotazy: <a href="mailto:info@loomos.cz">info@loomos.cz</a></p>'}<header class="site-header"><div class="container header-inner"><a href="/" class="brand brand-logo" aria-label="Loomos — úvodní stránka"><img src="/assets/img/logo-192.webp" alt="Loomos" width="90" height="80"></a><nav id="navigation" class="main-nav" aria-label="Hlavní navigace"><a href="/obchod.html" class="${["shop", "product"].includes(page) ? "active" : ""}">Svíčky</a><a href="/#dalsi-tvorba">Vůně do auta</a><a href="/#dalsi-tvorba">Tvorba na míru</a><a href="/#pribeh">Náš příběh</a></nav><div class="header-actions"><a class="account-link ${["account", "reset"].includes(page) ? "active" : ""}" href="/ucet.html" aria-label="Můj účet"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg><span class="account-label">Účet</span></a><a class="cart-link" href="/kosik.html" aria-label="Zobrazit košík"><svg viewBox="0 0 24 26" aria-hidden="true"><path d="M4 8h16l1 16H3L4 8Z M8 9V6a4 4 0 0 1 8 0v3"/></svg><span>Košík</span><span class="cart-count">0</span></a><button class="menu-toggle" aria-expanded="false" aria-controls="navigation" aria-label="Otevřít menu">☰</button></div></div></header>`;
export const renderFooter = () =>
  `<footer class="site-footer"><div class="container"><div class="footer-grid"><div><a href="/" class="brand brand-logo"><img src="/assets/img/logo-192.webp" alt="Loomos" width="90" height="80"></a><p>Malé věci, které tvoří atmosféru.<br>Ručně vyráběné svíčky a prostor pro další nápady.</p></div><div><h3>Objevte LOOMOS</h3><a href="/obchod.html">Sójové svíčky</a><a href="/#dalsi-tvorba">Co připravujeme</a><a href="/velkoobchod.html">Spolupráce</a></div><div><h3>Jsme tu pro vás</h3><a href="mailto:info@loomos.cz">info@loomos.cz →</a><a href="/ucet.html">Můj účet</a><a href="/kosik.html">Váš košík</a><a href="/#pribeh">Náš příběh</a></div></div><div class="footer-legal"><p>Provozovatel: ${esc(seller.name)} · IČO ${esc(seller.ico)} · ${esc(sellerAddress)} · ${esc(seller.register)}${seller.vatPayer === false ? " · Neplátce DPH" : ""}</p><nav aria-label="Právní informace"><a href="/odstoupeni.html" class="withdrawal-link">Odstoupit od smlouvy zde</a><a href="/slozeni-a-bezpecnost.html">Složení a bezpečnost</a><a href="/obchodni-podminky.html">Obchodní podmínky</a><a href="/ochrana-osobnich-udaju.html">Ochrana osobních údajů</a><a href="/ochrana-osobnich-udaju.html#cookies">Cookies</a><button type="button" class="link-button" data-cookie-settings hidden>Nastavení cookies</button></nav></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} LOOMOS. S péčí o každý detail.</span><span>Ilustrační fotografie · <a href="/admin/">Administrace →</a></span></div></div></footer>`;
export const renderProductDetail = (p) =>
  `<div class="detail-grid"><div class="detail-photo">${picture(p, "RUČNĚ VYROBENÉ")}</div><section class="detail-copy"><div class="eyebrow">SÓJOVÁ SVÍČKA · LOOMOS</div><h1>${esc(p.name)}</h1><p class="lead">${esc(p.subtitle)}</p><p>${esc(p.description)}</p>${p.variants?.length ? `<label class="size-label">Velikost svíčky<select id="size-choice">${p.variants.map((v) => `<option value="${esc(v.id)}">${esc(v.name)}${v.detail ? ` (${esc(v.detail)})` : ""} — ${money(v.price)}</option>`).join("")}</select></label>` : ""}<span class="price" id="detail-price">${money(p.variants?.[0]?.price ?? p.price)}</span><p class="member-price">S <a href="/ucet.html">účtem LOOMOS</a> o 5 % levněji: <strong id="detail-member-price">${money(memberPrice(p.variants?.[0]?.price ?? p.price))}</strong></p>${p.price_provisional ? '<p class="muted">Ceny jsou zatím pracovní.</p>' : ""}<span class="stock-note" aria-live="polite"></span><div class="buy-row"><div class="quantity"><button data-detail-qty="-1" aria-label="Ubrat kus">−</button><output id="detail-quantity">1</output><button data-detail-qty="1" aria-label="Přidat kus">＋</button></div><button class="button" data-add="${esc(p.id)}" ${p.price == null ? "disabled" : ""}>${p.price == null ? "Cenu připravujeme" : "Přidat do košíku ＋"}</button></div><div class="detail-facts"><span>✧ Ruční výroba</span><span>◒ Sójový vosk</span><span>⌁ Oleje z Velké Británie (IFRA)</span><span>♧ Dřevěný knot · čiré sklo</span></div>${p.pyramid ? `<dl class="pyramid"><div><dt>Hlava</dt><dd>${esc(p.pyramid.top)}</dd></div><div><dt>Srdce</dt><dd>${esc(p.pyramid.heart)}</dd></div>${p.pyramid.base ? `<div><dt>Základ</dt><dd>${esc(p.pyramid.base)}</dd></div>` : ""}</dl>` : `<p><strong>Vonné tóny</strong><br>${esc(p.notes)}</p>`}${safetyBlock(p)}<div class="detail-notice">Malý rituál, velká radost. Svíčku pokládejte na nehořlavý povrch a nenechávejte ji hořet bez dozoru. Fotografie je ilustrační.</div></section></div>`;

export function renderFAQ(faqs) {
  return `<div class="section-heading"><div><div class="eyebrow">DOBRÉ VĚDĚT</div><h2>Na co se <em>často ptáte.</em></h2></div></div><div class="faq-grid">${faqs.map((f) => `<details><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`).join("")}</div>`;
}
