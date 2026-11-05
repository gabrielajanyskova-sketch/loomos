import { faqs, packeta } from "./site.mjs";
import {
  money,
  esc,
  productCard,
  saleMarkup,
  burnLine,
  thumbSrc,
  icon,
  customSuncatcherCard,
  reviewsSection,
  stars,
  renderHeader,
  renderFooter,
  renderProductDetail,
  renderRelated,
  renderFAQ,
} from "./ui.mjs";
import {
  validateCatalog,
  readCart,
  isCandle,
  giftFor,
  SCENT_FAMILIES,
  SUNCATCHER_THEMES,
  scentFamilies,
} from "./catalog.mjs";
import {
  priceCart,
  FREE_SHIPPING_FROM,
  SHIPPING,
  PAYMENT,
  MAX_QTY,
  shippingSummary,
} from "./pricing.mjs";
import { qrSvg } from "./payment.mjs";
import { ORDER_STATUS, orderSteps } from "./orders.mjs";
import { initAnalytics, track } from "./analytics.mjs";

const $ = (s, el = document) => el.querySelector(s);
const page = document.body.dataset.page;
const live = document.querySelector('meta[name="shop-live"]')?.content === "1";
const storageKey = "loomos_cart_v3";
const codeKey = "loomos_code";
const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
};
let cart = [];
try {
  cart = readCart(store.get(storageKey) || store.get("loomos_cart_v2"));
} catch {
  cart = [];
}
let products = [];
let member = null;
let code = null;
try {
  code = JSON.parse(store.get(codeKey) || "null");
} catch {
  code = null;
}
let toastTimer;

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
}
async function api(path, data, method = data ? "POST" : "GET") {
  const response = await fetch("/api/" + path, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "same-origin",
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw Error("Služba e-shopu teď není dostupná. Zkuste to prosím později.");
  }
  if (!response.ok)
    throw Object.assign(
      Error(result.error || "Požadavek se nepodařilo dokončit."),
      { status: response.status },
    );
  return result;
}
const persist = () => {
  if (!store.set(storageKey, JSON.stringify(cart)))
    toast("Prohlížeč nepovoluje uložení košíku.");
  updateCount();
};
const updateCount = () =>
  document.querySelectorAll(".cart-count").forEach((el) => {
    el.textContent = cart.reduce((s, i) => s + i.qty, 0);
  });
const lineKey = (i) => i.id + "::" + (i.variant ?? "mala");
const variantOf = (p, id) =>
  p.variants?.find((v) => v.id === (id || "mala")) || null;
const stockOf = (p, variantId) => {
  const value = p.stock?.[variantId ?? ""];
  return value === undefined ? null : value;
};
function lines() {
  return cart
    .map((i) => {
      const p = products.find((p) => p.id === i.id);
      if (!p) return null;
      const v = variantOf(p, i.variant);
      return {
        key: lineKey(i),
        id: i.id,
        variant: v?.id || "",
        name: p.name + (v ? " — " + v.name : ""),
        price: v ? v.price : p.price,
        ...((v?.bulk ?? p.bulk) ? { bulk: v?.bulk ?? p.bulk } : {}),
        qty: i.qty,
      };
    })
    .filter(Boolean);
}
const pricing = (shipping = null) =>
  priceCart({ lines: lines(), member: Boolean(member), code, shipping });

/* ---------- layout ---------- */
if (!$("#site-header").children.length)
  $("#site-header").innerHTML = renderHeader(page, { live });
if (!$("#site-footer").children.length)
  $("#site-footer").innerHTML = renderFooter();
if ($("#otazky") && !$("#otazky").children.length)
  $("#otazky").innerHTML = renderFAQ(faqs);
updateCount();
const closeMenu = () => {
  $("#navigation").classList.remove("open");
  $(".menu-toggle").setAttribute("aria-expanded", "false");
};
$(".menu-toggle").addEventListener("click", (e) => {
  const open = e.currentTarget.getAttribute("aria-expanded") !== "true";
  e.currentTarget.setAttribute("aria-expanded", String(open));
  $("#navigation").classList.toggle("open", open);
});
$("#navigation").addEventListener("click", (e) => {
  if (e.target.closest("a")) closeMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeMenu();
});
initAnalytics();

/* ---------- catalog ---------- */
function add(id, qty = 1, variantId = "mala") {
  const product = products.find((p) => p.id === id);
  const variant = variantOf(product || {}, variantId);
  if (
    !product ||
    !Number.isInteger(variant ? variant.price : product.price) ||
    (product.variants?.length && !variant)
  )
    return;
  if (!product.variants?.length) variantId = "";
  const stock = stockOf(product, variant?.id ?? "");
  const item = cart.find(
    (i) => i.id === id && lineKey(i) === `${id}::${variantId}`,
  );
  const wanted = Math.min(MAX_QTY, (item?.qty || 0) + qty);
  if (stock !== null && wanted > stock) {
    toast(
      stock
        ? `Skladem ${product.variants?.length ? "této velikosti " : ""}jsou jen ${stock} ks.`
        : product.variants?.length
          ? "Tahle velikost je bohužel vyprodaná."
          : "Tohle je bohužel vyprodané.",
    );
    return;
  }
  if (item) item.qty = wanted;
  else cart.push({ id, variant: variantId, qty: wanted });
  persist();
  toast(
    isCandle(product)
      ? "Máte přidáno. Vaše vůně čeká v košíku."
      : `Máte přidáno. ${product.name} čeká v košíku.`,
  );
  track("add_to_cart", product, variant, qty);
}
/** "Hlídat dostupnost" under a sold-out product: one e-mail when it is back in stock. */
function stockAlert(button, product, variantId, soldOut) {
  const row = button.closest(".card-buy, .buy-row");
  if (!row) return;
  let box = row.nextElementSibling?.classList.contains("stock-alert")
    ? row.nextElementSibling
    : null;
  if (!soldOut) return box?.remove();
  if (!box) {
    box = document.createElement("div");
    box.className = "stock-alert";
    row.after(box);
  }
  if (box.dataset.variant !== variantId || !box.innerHTML) {
    box.dataset.product = product.id;
    box.dataset.variant = variantId;
    box.innerHTML = `<button type="button" class="link-button" data-alert-open>${icon("mail", "ico-inline")} Hlídat dostupnost</button>`;
  }
}
document.addEventListener("click", (e) => {
  const open = e.target.closest("[data-alert-open]");
  if (!open) return;
  const box = open.closest(".stock-alert");
  box.innerHTML = `<form class="stock-alert-form"><label>Pošlu vám e-mail, až bude zase skladem<span class="code-row"><input type="email" name="email" required maxlength="200" autocomplete="email" placeholder="váš e-mail" value="${esc(member?.email || "")}"><button class="inline-button">Hlídat</button></span></label><small class="muted">Jediný e-mail o naskladnění, potom adresu smažu.</small><p class="error" role="alert"></p></form>`;
  $("input", box).focus();
});
document.addEventListener("submit", async (e) => {
  const form = e.target.closest(".stock-alert-form");
  if (!form) return;
  e.preventDefault();
  const box = form.closest(".stock-alert");
  try {
    await api("stock-alert", {
      product_id: box.dataset.product,
      variant_id: box.dataset.variant,
      email: form.elements.email.value,
    });
    box.innerHTML = `<p class="stock-alert-done">${icon("sparkle", "ico-inline")} Hlídám. Jakmile bude zase skladem, napíšu vám.</p>`;
  } catch (err) {
    $(".error", form).textContent = err.message;
  }
});

function availability(button, product, variantId) {
  if (!button || !product) return;
  const stock = stockOf(product, variantId);
  const soldOut = stock === 0;
  const selected = variantOf(product, variantId);
  const selectedPrice = selected ? selected.price : product.price;
  button.disabled = soldOut || selectedPrice == null;
  button.dataset.soldOut = soldOut ? "1" : "";
  const label = button.querySelector(".add-label") || button;
  const plus = button.querySelector(".add-label + span");
  if (plus) {
    plus.hidden = soldOut || selectedPrice == null;
    plus.textContent = "＋";
  }
  stockAlert(button, product, variantId, soldOut);
  if (soldOut) label.textContent = "Vyprodáno";
  else if (selectedPrice == null) label.textContent = "Cenu připravuji";
  else
    label.textContent = button.querySelector(".add-label")
      ? "Přidat do košíku"
      : "Přidat do košíku ＋";
  const note = button
    .closest(".product-meta, .detail-copy")
    ?.querySelector(".stock-note");
  if (note)
    note.textContent =
      stock !== null && stock > 0 && stock <= 3
        ? `Poslední ${stock} ks skladem`
        : "";
}
function refreshCards(root = document) {
  root.querySelectorAll(".product-card").forEach((card) => {
    const button = $("[data-add]", card);
    const product = products.find((p) => p.id === button?.dataset.add);
    if (!product) return;
    const select = $("[data-card-size]", card);
    const variant = variantOf(product, select?.value);
    const price = variant ? variant.price : product.price;
    $("[data-card-price]", card).textContent = money(price);
    const reference = $("[data-sale-reference]", card);
    if (reference) reference.innerHTML = saleMarkup(variant ?? product);
    const burn = $("[data-card-burn]", card);
    if (burn) burn.textContent = burnLine(variant, price);
    button.dataset.label ||= button.firstChild?.textContent?.trim() || "";
    availability(button, product, variant?.id ?? "");
  });
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-add]");
  if (b && !b.disabled)
    add(
      b.dataset.add,
      Number(
        (
          b.closest(".product-card")?.querySelector("[data-card-quantity]") ||
          $("#detail-quantity")
        )?.textContent || 1,
      ),
      b.closest(".product-card")?.querySelector("[data-card-size]")?.value ||
        $("#size-choice")?.value ||
        "mala",
    );
  // After adding from a card, its quantity starts again from 1.
  if (b && !b.disabled) {
    const cardQty = b
      .closest(".product-card")
      ?.querySelector("[data-card-quantity]");
    if (cardQty) cardQty.textContent = "1";
  }
  const cq = e.target.closest("[data-card-qty]");
  if (cq) {
    const output = cq.parentElement.querySelector("[data-card-quantity]");
    output.textContent = Math.max(
      1,
      Math.min(
        MAX_QTY,
        Number(output.textContent) + Number(cq.dataset.cardQty),
      ),
    );
  }
  const q = e.target.closest("[data-detail-qty]");
  if (q) {
    const output = $("#detail-quantity");
    output.textContent = Math.max(
      1,
      Math.min(
        MAX_QTY,
        Number(output.textContent) + Number(q.dataset.detailQty),
      ),
    );
  }
});
document.addEventListener("click", (e) => {
  const thumb = e.target.closest("[data-photo]");
  if (!thumb) return;
  const main = $(".detail-photo [data-main-photo]");
  if (main) {
    main.removeAttribute("srcset");
    main.src = thumb.dataset.photo;
  }
  thumb.parentElement
    .querySelectorAll("[data-photo]")
    .forEach((b) => b.classList.toggle("active", b === thumb));
});
document.addEventListener("change", (e) => {
  if (e.target.matches("[data-card-size]"))
    refreshCards(e.target.closest(".product-card").parentElement);
  if (e.target.id === "size-choice") updateDetail();
});
function updateDetail() {
  const p = products.find((p) => p.id === document.body.dataset.product);
  if (!p) return;
  const v = variantOf(p, $("#size-choice")?.value);
  const price = v ? v.price : p.price;
  $("#detail-price").textContent = money(price);
  const reference = $(".detail-copy [data-sale-reference]");
  if (reference) reference.innerHTML = saleMarkup(v ?? p);
  if ($("#detail-burn")) $("#detail-burn").textContent = burnLine(v, price);
  const button = $(".detail-copy [data-add]");
  if (button) {
    button.dataset.label ||= "Přidat do košíku ＋";
    availability(button, p, v?.id ?? "");
  }
}
function renderProduct() {
  const id = document.body.dataset.product;
  const p = products.find((p) => p.id === id);
  if (!p) {
    $("#product-detail").innerHTML =
      '<div class="empty-state"><h2>Tenhle produkt právě není v nabídce.</h2><a class="button" href="/obchod.html">Zpět do obchodu</a></div>';
    return;
  }
  document.title = `${p.name} — ${isCandle(p) ? "sójová svíčka" : "lapač slunce"} | LOOMOS`;
  $("#product-breadcrumb").textContent = p.name;
  const parent = $("#product-breadcrumb")?.previousElementSibling;
  if (parent && !isCandle(p)) {
    parent.href = "/lapace-slunce.html";
    parent.textContent = "Lapače slunce";
  }
  $("#product-detail").innerHTML = renderProductDetail(p);
  const reviewsBox = $("#product-reviews");
  if (reviewsBox)
    api(`reviews?product=${encodeURIComponent(p.id)}`)
      .then((list) => (reviewsBox.innerHTML = reviewsSection(p, list)))
      .catch(() => {});
  const related = $("#product-related");
  if (related) {
    related.innerHTML = renderRelated(p, products);
    refreshCards(related);
  }
  const size = new URLSearchParams(location.search).get("velikost");
  if (size && p.variants?.some((v) => v.id === size))
    $("#size-choice").value = size;
  updateDetail();
  track("view_item", p, variantOf(p, $("#size-choice")?.value), 1);
}

/* ---------- verified review ---------- */
async function renderReview() {
  const el = $("#review-content");
  const token = new URLSearchParams(location.search).get("t") || "";
  let data;
  try {
    if (!token) throw Error("missing token");
    data = await api(`reviews/pending?t=${encodeURIComponent(token)}`);
  } catch {
    el.innerHTML =
      '<p class="notice">Odkaz na hodnocení nefunguje. Použijte prosím odkaz z e-mailu o odeslání objednávky.</p>';
    return;
  }
  const open = data.items.filter((i) => !i.reviewed);
  if (!data.open) {
    el.innerHTML = `<p class="notice">Hodnotit půjde, až bude objednávka ${esc(data.number)} odeslaná. Pošlu vám odkaz e-mailem.</p>`;
    return;
  }
  if (!open.length) {
    el.innerHTML = `<div class="success-panel"><span class="tiny-star">${icon("sparkle")}</span><h2>Děkuji za hodnocení!</h2><p>Všechno z objednávky ${esc(data.number)} už máte ohodnocené.</p><a class="button" href="/obchod.html">Zpět do obchodu →</a></div>`;
    return;
  }
  el.innerHTML = `<form id="review-form" class="review-form">${open
    .map(
      (i) =>
        `<fieldset class="review-item" data-product="${esc(i.id)}"><legend>${esc(i.name)}</legend><div class="star-input" role="radiogroup" aria-label="Počet hvězdiček">${[5, 4, 3, 2, 1].map((n) => `<input type="radio" id="r-${esc(i.id)}-${n}" name="rating-${esc(i.id)}" value="${n}"><label for="r-${esc(i.id)}-${n}" title="${n} z 5">${icon("star")}<span class="visually-hidden">${n} z 5</span></label>`).join("")}</div><label>Co se vám líbilo? (nepovinné)<textarea name="text-${esc(i.id)}" rows="3" maxlength="1500" placeholder="Jak voní, jak hoří, komu jste ji dali…"></textarea></label></fieldset>`,
    )
    .join(
      "",
    )}<label>Jméno u hodnocení<input name="name" maxlength="40" value="${esc(data.name)}"></label><p class="muted small-note">Hodnocení se zveřejní u produktu s označením „Ověřený nákup“. Celé příjmení ani e-mail se nezobrazí. Produkty bez hvězdiček se neodešlou.</p><p class="error" id="review-error" role="alert"></p><button class="button">Odeslat hodnocení →</button></form>`;
  $("#review-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const reviews = open
      .map((i) => ({
        product_id: i.id,
        rating: Number(
          form.querySelector(`[name="rating-${CSS.escape(i.id)}"]:checked`)
            ?.value || 0,
        ),
        text: form.elements[`text-${i.id}`].value,
      }))
      .filter((r) => r.rating);
    if (!reviews.length) {
      $("#review-error").textContent =
        "Vyberte prosím u produktu počet hvězdiček.";
      return;
    }
    try {
      await api("reviews", { token, name: form.elements.name.value, reviews });
      el.innerHTML = `<div class="success-panel"><span class="tiny-star">${icon("sparkle")}</span><h2>Moc děkuji za hodnocení!</h2><p>Pomůže dalším zákazníkům s výběrem.</p><a class="button" href="/obchod.html">Zpět do obchodu →</a></div>`;
    } catch (err) {
      $("#review-error").textContent = err.message;
    }
  });
}

/* ---------- individual inquiry ---------- */
const MAX_UPLOAD = 1_400_000;
/** Photos are scaled down in the browser (max. 2000 px) so they fit the upload limit. */
async function prepareFile(file) {
  const resizable = ["image/jpeg", "image/png", "image/webp"].includes(
    file.type,
  );
  let blob = file;
  if (resizable && file.size > 500_000) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));
    if (blob.size > MAX_UPLOAD && type === "image/png")
      blob = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.85),
      );
  }
  if (blob.size > MAX_UPLOAD)
    throw new Error(
      "Soubor je příliš velký (max. 1,4 MB). Pošlete prosím menší nebo mi ho pošlete e-mailem.",
    );
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const name =
    blob.type === file.type
      ? file.name
      : file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return { name, type: blob.type || file.type, data };
}
function renderInquiry() {
  const form = $("#inquiry-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const btn = $("#inquiry-send");
    const error = $("#inquiry-error");
    error.textContent = "";
    btn.disabled = true;
    try {
      const f = form.elements;
      const file = f.file.files[0] ? await prepareFile(f.file.files[0]) : null;
      await api("inquiry", {
        type: f.type.value,
        size: "kruh 15 cm",
        quantity: Number(f.quantity.value),
        motif: f.motif.value,
        deadline: f.deadline.value,
        name: f.name.value,
        email: f.email.value,
        phone: f.phone.value,
        consent: f.consent.checked,
        file,
      });
      form.outerHTML = `<div class="success-panel"><span class="tiny-star">${icon("sparkle")}</span><h2>Děkuji, poptávka je odeslaná.</h2><p>Potvrzení jsem vám poslala na ${esc(f.email.value)}. Do pár dnů se ozvu s návrhem.</p><a class="button" href="/obchod.html">Mezitím se podívejte na svíčky →</a></div>`;
    } catch (err) {
      error.textContent = err.message;
      btn.disabled = false;
    }
  });
}

/* ---------- cart ---------- */
/** Progress bar width is set through CSSOM: the CSP forbids inline style attributes. */
const paintProgress = () =>
  document
    .querySelectorAll(".free-shipping-bar [data-progress]")
    .forEach((el) => (el.style.width = `${el.dataset.progress}%`));
/** "Do dopravy zdarma vám chybí 150 Kč" with a progress bar, or a confirmation once reached. */
const freeShippingBar = (t) =>
  t.items
    ? t.freeShipping
      ? `<p class="free-shipping reached">${icon("sparkle", "ico-inline")} Máte <strong>dopravu zdarma</strong>.</p>`
      : `<div class="free-shipping"><p>Do dopravy zdarma vám chybí <strong>${money(t.missingForFreeShipping)}</strong>.</p><div class="free-shipping-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${FREE_SHIPPING_FROM}" aria-valuenow="${FREE_SHIPPING_FROM - t.missingForFreeShipping}"><span data-progress="${Math.round(((FREE_SHIPPING_FROM - t.missingForFreeShipping) / FREE_SHIPPING_FROM) * 100)}"></span></div></div>`
    : "";
function summary({ checkout = false, shipping = null } = {}) {
  const t = pricing(shipping);
  const memberRow = member
    ? `<div class="summary-row saving"><span>Sleva s účtem (5 %)</span><span>−${money(t.memberSavings)}</span></div>`
    : `<p class="member-hint"><a href="/ucet.html?navrat=${checkout ? "pokladna" : "kosik"}">Přihlaste se nebo se zaregistrujte</a> a ušetříte ${money(t.itemsOriginal - priceCart({ lines: lines(), member: true }).items)} (5 % na vše).</p>`;
  const bulkRow = t.bulkSavings
    ? `<div class="summary-row saving"><span>Množstevní sleva</span><span>−${money(t.bulkSavings)}</span></div>`
    : "";
  const codeRow = t.code
    ? `<div class="summary-row saving"><span>Kód ${esc(t.code)} <button type="button" class="link-button" data-remove-code>odebrat</button></span><span>−${money(t.codeDiscount)}</span></div>`
    : "";
  const codeForm = code
    ? t.codeError
      ? `<p class="error">${esc(t.codeError)} <button type="button" class="link-button" data-remove-code>Odebrat kód</button></p>`
      : ""
    : `<form class="code-form" id="code-form"><label>Slevový kód<span class="code-row"><input name="code" maxlength="40" autocomplete="off" required><button class="inline-button">Uplatnit</button></span></label><p class="error" id="code-error" role="alert"></p></form>`;
  return `<aside class="summary"><h2>Vaše objednávka</h2>${
    checkout
      ? t.lines
          .map(
            (l) =>
              `<div class="summary-row"><span>${esc(l.name)} × ${l.qty}</span><span>${money(l.total)}</span></div>`,
          )
          .join("")
      : ""
  }<div class="summary-row"><span>Zboží</span><span>${money(t.itemsOriginal + t.bulkSavings)}</span></div>${bulkRow}${memberRow}${codeRow}${codeForm}${freeShippingBar(t)}<div class="summary-row"><span>Doprava</span><span id="shipping-price">${shipping ? (t.shippingPrice ? money(t.shippingPrice) : "Zdarma") : "Dle výběru"}</span></div><div class="summary-row summary-total"><span>Celkem</span><span id="order-total">${money(t.total)}</span></div>${t.savings ? `<p class="savings">Ušetříte <strong>${money(t.savings)}</strong></p>` : ""}${checkout ? "" : `<a href="/pokladna.html" class="button">Pokračovat k údajům →</a><p class="muted">Dopravu a platbu vyberete v dalším kroku.</p>`}</aside>`;
}
async function applyCode(form, rerender) {
  const error = $("#code-error");
  error.textContent = "";
  try {
    code = await api("codes/check", { code: form.elements.code.value });
    store.set(codeKey, JSON.stringify(code));
    rerender();
    toast("Slevový kód je uplatněný.");
  } catch (err) {
    error.textContent = err.message;
  }
}
function bindSummary(container, rerender) {
  container.addEventListener("submit", (e) => {
    if (e.target.id !== "code-form") return;
    e.preventDefault();
    applyCode(e.target, rerender);
  });
  container.addEventListener("click", (e) => {
    if (!e.target.closest("[data-remove-code]")) return;
    code = null;
    store.set(codeKey, null);
    rerender();
  });
}
function renderCart() {
  const el = $("#cart-content");
  if (!lines().length) {
    el.innerHTML = `<div class="empty-state"><span class="tiny-star">${icon("sparkle")}</span><h2>Vaše chvíle teprve čeká.</h2><p>Košík je zatím prázdný. Najděte si vůni, která vám sedne.</p><a class="button" href="/obchod.html">Prohlédnout svíčky →</a></div>`;
    return;
  }
  const t = pricing();
  el.innerHTML = `<div class="cart-layout"><section aria-label="Položky košíku">${t.lines
    .map(
      (l) =>
        `<article class="cart-item"><a href="/produkty/${encodeURIComponent(l.id)}.html">${((src) => (src ? `<img class="cart-thumb" src="${esc(src)}" width="90" height="105" loading="lazy" decoding="async" alt="${esc(l.name)}">` : '<span class="cart-thumb rainbow-fill" aria-hidden="true"></span>'))(thumbSrc(products.find((p) => p.id === l.id) || {}))}</a><div><h3><a href="/produkty/${encodeURIComponent(l.id)}.html">${esc(l.name)}</a></h3><p>${money(l.unit)} / ks${l.unit !== l.listUnit ? ` <s>${money(l.listUnit)}</s>` : ""}</p>${l.bulk && l.qty < l.bulk.min_qty ? `<p class="bulk-note">Od ${l.bulk.min_qty} ks jen ${money(l.bulk.price)} / ks — přidejte ještě ${l.bulk.min_qty - l.qty} ks.</p>` : l.bulk ? `<p class="bulk-note">Množstevní cena ${money(l.bulk.price)} / ks ✓</p>` : ""}<div class="quantity"><button data-qty="${esc(l.key)}" data-delta="-1" aria-label="Ubrat ${esc(l.name)}" ${l.qty === 1 ? "disabled" : ""}>−</button><output>${l.qty}</output><button data-qty="${esc(l.key)}" data-delta="1" aria-label="Přidat ${esc(l.name)}" ${l.qty === MAX_QTY ? "disabled" : ""}>＋</button></div></div><div><span class="price">${money(l.total)}</span>${l.total !== l.listUnit * l.qty ? `<s class="old-price">${money(l.listUnit * l.qty)}</s>` : ""}<button class="remove" data-remove="${esc(l.key)}" aria-label="Odebrat ${esc(l.name)}">Odebrat</button></div></article>`,
    )
    .join(
      "",
    )}<a class="text-link spaced-top" href="/obchod.html">← Pokračovat v nákupu</a></section>${summary()}</div>`;
  paintProgress();
}
$("#cart-content")?.addEventListener("click", (e) => {
  const b = e.target.closest("[data-qty],[data-remove]");
  if (!b) return;
  if (b.dataset.remove)
    cart = cart.filter((i) => lineKey(i) !== b.dataset.remove);
  else {
    const i = cart.find((i) => lineKey(i) === b.dataset.qty);
    const p = products.find((p) => p.id === i?.id);
    const stock = p ? stockOf(p, variantOf(p, i.variant)?.id ?? "") : null;
    if (i) {
      const next = Math.max(
        1,
        Math.min(MAX_QTY, i.qty + Number(b.dataset.delta)),
      );
      if (stock !== null && next > stock)
        toast(`Skladem jsou jen ${stock} ks.`);
      else i.qty = next;
    }
  }
  persist();
  renderCart();
});
if ($("#cart-content")) bindSummary($("#cart-content"), renderCart);

/* ---------- checkout ---------- */
let packetaLoad;
const loadPacketa = () =>
  (packetaLoad ||= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = packeta.library;
    script.onload = () =>
      window.Packeta?.Widget ? resolve(window.Packeta) : reject();
    script.onerror = () => {
      packetaLoad = null;
      reject();
    };
    document.head.append(script);
  }));

function paymentBlock(payment, testOrder) {
  if (!payment)
    return '<p class="notice">Platební údaje vám pošlu e-mailem.</p>';
  return `<div class="payment-box"><div class="qr">${qrSvg(payment.spayd)}</div><div><h3>Platba převodem</h3>${testOrder ? '<p class="notice">Zkušební objednávka — nic neplaťte.</p>' : ""}<p>Naskenujte QR kód v bankovní aplikaci, nebo zadejte údaje ručně. Zaplaťte prosím do ${payment.due_days} dnů.</p><dl class="payment-details"><dt>Číslo účtu</dt><dd>${esc(payment.account)}</dd><dt>IBAN</dt><dd>${esc(payment.iban)}</dd><dt>Variabilní symbol</dt><dd><strong>${esc(payment.vs)}</strong></dd><dt>Částka</dt><dd><strong>${money(payment.amount)}</strong></dd></dl></div></div>`;
}

function renderCheckout() {
  const el = $("#checkout-content");
  if (!lines().length) {
    el.innerHTML =
      '<div class="empty-state"><h2>Košík je zatím prázdný.</h2><a class="button" href="/obchod.html">Do obchodu →</a></div>';
    return;
  }
  const shippingOptions = Object.entries(SHIPPING)
    .map(
      ([id, s], i) =>
        `<label class="radio shipping-option"><input type="radio" name="shipping" value="${id}" ${i === 0 ? "checked" : ""}><span class="carrier-logo-box">${s.logo ? `<img class="carrier-logo${s.logo.includes("balikovna") ? " on-light" : ""}" src="${esc(s.logo)}" alt="" width="96" height="24" loading="lazy">` : icon("hand", "carrier-ico")}</span><span class="shipping-label">${esc(s.logo && s.short ? s.short : s.label)}</span><span data-ship-price="${id}">${s.price ? money(s.price) : "Zdarma"}</span></label>`,
    )
    .join("");
  const paymentOptions = Object.entries(PAYMENT)
    .map(
      ([id, p]) =>
        `<label class="radio ${p.available ? "" : "disabled"}"><input type="radio" name="payment" value="${id}" ${p.available ? (id === "transfer" ? "checked" : "") : "disabled"}>${esc(p.label)}<span>${p.available ? "Zdarma" : "Připravuji"}</span></label>`,
    )
    .join("");
  el.innerHTML = `<div class="checkout-layout"><form id="checkout-form" class="checkout-form" novalidate>${member ? `<p class="notice">Jste přihlášeni jako ${esc(member.email)}. Sleva 5 % je započítaná.</p>` : `<p class="notice">Máte účet? <a href="/ucet.html?navrat=pokladna">Přihlaste se</a> a ušetříte 5 % na všem.</p>`}<h2>01 / Kontakt</h2><div class="form-grid"><label>Jméno a příjmení<input name="name" required autocomplete="name" maxlength="120" value="${esc(member?.name || "")}"></label><label>E-mail<input name="email" type="email" required autocomplete="email" maxlength="200" value="${esc(member?.email || "")}"></label><label class="full">Telefon<input name="phone" type="tel" required autocomplete="tel" maxlength="30" value="${esc(member?.phone || "")}"></label></div><h2>02 / Doprava</h2>${shippingOptions}<div id="pickup-address" class="notice">Osobní odběr ve Starojické Lhotě — čas předání domluvím po zaplacení.</div><div class="form-grid" id="delivery-fields" hidden><div class="full packeta-pick"><button type="button" class="inline-button" id="packeta-pick">Vybrat na mapě →</button><p id="packeta-selected" class="muted" aria-live="polite"></p></div><input type="hidden" name="packeta_point_id"><input type="hidden" name="balikovna_id"><input type="hidden" name="balikovna_zip"><input type="hidden" name="balikovna_name"><label class="full" id="pickup-point-label">Výdejní místo<input name="pickup_point" maxlength="200" placeholder="Vyberte na mapě nebo napište název"></label></div><div class="form-grid" id="home-fields" hidden><label class="full">Ulice a číslo domu<input name="street" maxlength="120" autocomplete="street-address" placeholder="např. Hlavní 12"></label><label>Obec<input name="city" maxlength="80" autocomplete="address-level2"></label><label>PSČ<input name="zip" maxlength="6" inputmode="numeric" autocomplete="postal-code" pattern="\\d{3} ?\\d{2}" placeholder="741 01"></label></div><h2>03 / Platba</h2>${paymentOptions}<p class="muted">Po odeslání objednávky uvidíte QR kód pro platbu a stejné údaje vám přijdou e-mailem. Zboží odesílám po připsání platby.</p><h2>04 / Poznámka</h2><label class="muted">Je něco, co bych měla vědět?<textarea name="note" rows="3" maxlength="1000"></textarea></label><label class="check" id="heureka-optout" hidden><input type="checkbox" name="heureka_optout"><span>Nesouhlasím se zasláním dotazníku spokojenosti v rámci programu Ověřeno zákazníky (Heureka), který pomáhá zlepšovat služby.</span></label><label class="check"><input type="checkbox" name="terms" required><span>Souhlasím s <a href="/obchodni-podminky.html" target="_blank" rel="noopener">obchodními podmínkami</a> a beru na vědomí <a href="/ochrana-osobnich-udaju.html" target="_blank" rel="noopener">zpracování osobních údajů</a>.</span></label>${live ? "" : '<p class="notice">Zkušební provoz: objednávka se uloží jen pro testování a nebude vyřízena.</p>'}<p id="checkout-error" class="error" role="alert"></p><button id="place-order" class="button">Objednat s povinností platby →</button></form><div id="checkout-summary"></div></div>`;
  const form = $("#checkout-form");
  const renderSummary = () => {
    $("#checkout-summary").innerHTML = summary({
      checkout: true,
      shipping: form.elements.shipping.value,
    });
    // With free shipping every delivery option shows "Zdarma".
    const free = pricing(form.elements.shipping.value).freeShipping;
    form.querySelectorAll("[data-ship-price]").forEach((el) => {
      const price = SHIPPING[el.dataset.shipPrice]?.price;
      el.textContent = free || !price ? "Zdarma" : money(price);
    });
    paintProgress();
  };
  renderSummary();
  bindSummary($("#checkout-summary"), renderSummary);
  // The Heureka opt-out is shown only when the shop takes part in "Ověřeno zákazníky".
  api("config")
    .then((c) => ($("#heureka-optout").hidden = !c.heureka))
    .catch(() => {});
  track("begin_checkout");
  // A point chosen for one Packeta option is kept separately from the other option.
  const chosen = {};
  const setPoint = (shipping, point) => {
    chosen[shipping] = point;
    form.elements.packeta_point_id.value = point?.packetaId || "";
    form.elements.balikovna_id.value = point?.balikovna?.id || "";
    form.elements.balikovna_zip.value = point?.balikovna?.zip || "";
    form.elements.balikovna_name.value = point?.balikovna?.name || "";
    form.elements.pickup_point.value = point?.label || "";
    $("#packeta-selected").textContent = point ? "Vybráno: " + point.label : "";
  };
  /** Česká pošta Balíkovna map (iframe + postMessage, see their implementation manual). */
  const openBalikovna = () => {
    const dialog = document.createElement("div");
    dialog.className = "map-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-label", "Výběr Balíkovny");
    dialog.innerHTML =
      '<div class="map-dialog-box"><button type="button" class="map-dialog-close" aria-label="Zavřít">✕</button><iframe title="Výběr místa pro vyzvednutí zásilky" src="https://b2c.cpost.cz/locations/?type=BALIKOVNY" allow="geolocation"></iframe></div>';
    const close = () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("keydown", onKey);
      dialog.remove();
    };
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const onMessage = (event) => {
      if (event.origin !== "https://b2c.cpost.cz") return;
      if (event.data?.message !== "pickerResult" || !event.data.point) return;
      const point = event.data.point;
      const zip = String(point.zip || "").replace(/\s/g, "");
      if (!/^\d{5}$/.test(zip) || !/^\d{1,12}$/.test(String(point.id))) return;
      const name = String(point.name || "").slice(0, 120);
      setPoint("balikovna", {
        label: `${name}, ${zip.slice(0, 3)} ${zip.slice(3)}`,
        balikovna: { id: String(point.id), zip, name },
      });
      close();
    };
    window.addEventListener("message", onMessage);
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog || e.target.closest(".map-dialog-close")) close();
    });
    document.body.append(dialog);
  };
  const openMap = async () => {
    const shipping = form.elements.shipping.value;
    const option = SHIPPING[shipping];
    if (option?.kind !== "point") return;
    if (option.provider === "balikovna") return openBalikovna();
    try {
      const Packeta = await loadPacketa();
      Packeta.Widget.pick(
        packeta.apiKey,
        (point) => {
          if (!point || !/^\d{1,10}$/.test(String(point.id))) return;
          const label = String(
            point.formatedValue || point.name || point.place || "",
          ).slice(0, 200);
          setPoint(shipping, { packetaId: String(point.id), label });
        },
        { country: "cz", language: "cs", ...option.packeta },
      );
    } catch {
      $("#packeta-selected").textContent =
        "Mapu se nepodařilo načíst. Napište prosím název výdejního místa nebo Z-BOXu.";
    }
  };
  const applyShipping = (open) => {
    const shipping = form.elements.shipping.value;
    const kind = SHIPPING[shipping]?.kind;
    // Point / address fields sit right under the chosen delivery option.
    const row = form
      .querySelector(`input[name="shipping"][value="${CSS.escape(shipping)}"]`)
      ?.closest(".radio");
    const panel = {
      point: "#delivery-fields",
      home: "#home-fields",
      pickup: "#pickup-address",
    }[kind];
    if (row && panel) row.after($(panel));
    $("#delivery-fields").hidden = kind !== "point";
    $("#home-fields").hidden = kind !== "home";
    $("#pickup-address").hidden = kind !== "pickup";
    form.elements.pickup_point.required =
      kind === "point" && shipping !== "balikovna";
    for (const name of ["street", "city", "zip"])
      form.elements[name].required = kind === "home";
    if (kind === "point") {
      const title =
        { zbox: "Z-BOX", balikovna: "Balíkovna" }[shipping] || "Výdejní místo";
      $("#packeta-pick").textContent =
        `Vybrat ${{ zbox: "Z-BOX", balikovna: "Balíkovnu" }[shipping] || "výdejní místo"} na mapě →`;
      $("#pickup-point-label").firstChild.textContent = title;
      // Balíkovna must be picked on the map (the label needs its ZIP); Packeta points can be typed.
      $("#pickup-point-label").hidden = shipping === "balikovna";
      const point = chosen[shipping];
      setPoint(shipping, point || null);
      if (open && !point) openMap();
    }
    renderSummary();
  };
  form.addEventListener("change", (e) => {
    if (e.target.name === "shipping") applyShipping(true);
  });
  $("#packeta-pick").addEventListener("click", openMap);
  form.elements.pickup_point.addEventListener("input", () => {
    form.elements.packeta_point_id.value = "";
    $("#packeta-selected").textContent = "";
  });
  const requestId = crypto.randomUUID();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    if (
      form.elements.shipping.value === "balikovna" &&
      !form.elements.balikovna_id.value
    ) {
      $("#checkout-error").textContent = "Vyberte prosím Balíkovnu na mapě.";
      openMap();
      return;
    }
    const btn = $("#place-order");
    btn.disabled = true;
    $("#checkout-error").textContent = "";
    const f = Object.fromEntries(new FormData(form));
    try {
      const result = await api("orders", {
        ...f,
        terms: form.elements.terms.checked,
        heureka_optout: form.elements.heureka_optout.checked,
        code: code?.code || "",
        items: cart.map((i) => ({ id: i.id, variant: i.variant, qty: i.qty })),
        request_id: requestId,
      });
      track("purchase", result);
      cart = [];
      code = null;
      store.set(codeKey, null);
      persist();
      el.innerHTML = `<div class="success-panel"><span class="tiny-star">${icon("sparkle")}</span><h2>Děkuji, objednávka ${esc(result.number)} je přijatá.</h2><p>Potvrzení jsem poslala na ${esc(f.email)}.${result.pricing.savings ? ` Ušetřili jste ${money(result.pricing.savings)}.` : ""}</p>${paymentBlock(result.payment, result.test)}<p><a class="text-link" href="/objednavka.html?t=${encodeURIComponent(result.token)}">Stránka objednávky — sem se můžete kdykoli vrátit →</a></p><a href="/obchod.html" class="button">Zpět ke svíčkám →</a></div>`;
      const heading = $(".success-panel h2", el);
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      el.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      $("#checkout-error").textContent = err.message;
      btn.disabled = false;
      if (err.status === 409) refreshCatalog();
    }
  });
}

/* ---------- order page ---------- */
const day = (t) =>
  new Date(t * 1000).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
function orderTimeline(o) {
  const history = o.history || [];
  const reachedAt = (status) =>
    [...history].reverse().find((h) => h.status === status)?.at;
  const steps = orderSteps(o.shipping);
  const current = steps.findIndex(([id]) => id === o.status);
  const notes = history.filter((h) => h.note);
  const tracking = o.tracking
    ? `<div class="tracking"><span>Sledovací číslo</span><strong>${esc(o.tracking.code)}</strong>${o.tracking.url ? `<a class="text-link" href="${esc(o.tracking.url)}" target="_blank" rel="noopener">Sledovat zásilku →</a>` : ""}</div>`
    : "";
  if (o.status === "zrusena")
    return `<section class="panel timeline-panel"><p class="status-label">Objednávka byla zrušena${reachedAt("zrusena") ? " " + day(reachedAt("zrusena")) : ""}</p>${notes.map((n) => `<p class="shop-note"><span>${day(n.at)}</span>${esc(n.note)}</p>`).join("")}</section>`;
  return `<section class="panel timeline-panel"><ol class="timeline">${steps
    .map(([id, label], i) => {
      const state = i < current ? "done" : i === current ? "current" : "";
      const at = i <= current ? reachedAt(id) : null;
      return `<li class="${state}"${state === "current" ? ' aria-current="step"' : ""}><span class="dot" aria-hidden="true"></span><strong>${esc(label)}</strong>${at ? `<small>${day(at)}</small>` : ""}</li>`;
    })
    .join(
      "",
    )}</ol><p class="timeline-status">${esc(ORDER_STATUS[o.status] || o.status)}</p>${tracking}${notes.length ? `<div class="shop-notes"><h3>Zprávy ode mě</h3>${notes.map((n) => `<p class="shop-note"><span>${day(n.at)}</span>${esc(n.note)}</p>`).join("")}</div>` : ""}</section>`;
}
async function renderOrderPage() {
  const el = $("#order-content");
  const token = new URLSearchParams(location.search).get("t") || "";
  try {
    if (!token)
      throw Error("Odkaz na objednávku najdete v potvrzovacím e-mailu.");
    const o = await api("orders/view?t=" + encodeURIComponent(token));
    const p = o.pricing;
    el.innerHTML = `${orderTimeline(o)}${["odeslana", "k-vyzvednuti", "dokoncena"].includes(o.status) ? `<p class="notice review-invite">${icon("star", "ico-inline")} Jak se vám nákup líbí? <a href="/recenze.html?t=${encodeURIComponent(token)}">Ohodnotit →</a></p>` : ""}<section class="panel"><h2>Objednávka ${esc(o.number)}</h2>${o.test ? '<p class="muted">Zkušební objednávka</p>' : ""}${o.items.map((i) => `<div class="summary-row"><span>${esc(i.name)} × ${i.qty}</span><span>${money(i.total)}</span></div>`).join("")}${p.bulkSavings ? `<div class="summary-row saving"><span>Množstevní sleva</span><span>−${money(p.bulkSavings)}</span></div>` : ""}${p.memberSavings ? `<div class="summary-row saving"><span>Sleva s účtem (5 %)</span><span>−${money(p.memberSavings)}</span></div>` : ""}${p.codeDiscount ? `<div class="summary-row saving"><span>Kód ${esc(p.code)}</span><span>−${money(p.codeDiscount)}</span></div>` : ""}<div class="summary-row"><span>${esc(shippingSummary(o))}</span><span>${p.shippingPrice ? money(p.shippingPrice) : "Zdarma"}</span></div><div class="summary-row summary-total"><span>Celkem</span><span>${money(p.total)}</span></div></section>${o.payment ? paymentBlock(o.payment, o.test) : ""}<div class="order-actions">${o.invoice ? `<a class="button" href="/api/invoice?t=${encodeURIComponent(token)}" target="_blank" rel="noopener">Faktura ${esc(o.invoice)} (PDF)</a>` : ""}${o.status !== "zrusena" ? `<a class="text-link" href="/odstoupeni.html?objednavka=${encodeURIComponent(o.number)}">Odstoupit od smlouvy zde</a>` : ""}</div>`;
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><h2>Objednávku se nepodařilo najít.</h2><p>${esc(err.message)}</p><a class="button" href="/ucet.html">Můj účet →</a></div>`;
  }
}

/* ---------- withdrawal (§ 1830a OZ) ---------- */
function renderWithdrawal() {
  const el = $("#withdrawal-content");
  const params = new URLSearchParams(location.search);
  el.innerHTML = `<form id="withdrawal-form" class="panel checkout-form narrow-form" novalidate><p>Od smlouvy můžete odstoupit bez udání důvodu do 14 dnů od převzetí zboží. Vyplňte prosím údaje z objednávky. Přihlášení není potřeba.</p><div class="form-grid"><label>Jméno a příjmení<input name="name" required maxlength="120" autocomplete="name" value="${esc(member?.name || "")}"></label><label>E-mail použitý při objednávce<input name="email" type="email" required maxlength="200" autocomplete="email" value="${esc(member?.email || "")}"></label><label class="full">Číslo objednávky<input name="order_number" required maxlength="30" inputmode="numeric" value="${esc(params.get("objednavka") || "")}"></label><label class="full">Které zboží vracíte (nepovinné — prázdné = celá objednávka)<textarea name="items" rows="2" maxlength="1000" placeholder="např. Okurka, zázvor a máta — Velká, 1 ks"></textarea></label><label class="full">Důvod (nepovinné)<textarea name="reason" rows="2" maxlength="1000"></textarea></label></div><p class="error" role="alert"></p><button class="button" id="withdrawal-next">Pokračovat →</button></form>`;
  const form = $("#withdrawal-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const error = $(".error", form);
    error.textContent = "";
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form));
    if (!form.dataset.review) {
      form.dataset.review = "1";
      form
        .querySelectorAll("input, textarea")
        .forEach((i) => (i.readOnly = true));
      $(".form-grid", form).insertAdjacentHTML(
        "afterend",
        '<p class="notice" id="withdrawal-review">Zkontrolujte prosím údaje a odstoupení potvrďte. <button type="button" class="link-button" id="withdrawal-edit">Upravit údaje</button></p>',
      );
      $("#withdrawal-next").textContent = "Potvrdit odstoupení";
      $("#withdrawal-edit").addEventListener("click", () => {
        delete form.dataset.review;
        form
          .querySelectorAll("input, textarea")
          .forEach((i) => (i.readOnly = false));
        $("#withdrawal-review").remove();
        $("#withdrawal-next").textContent = "Pokračovat →";
      });
      return;
    }
    const button = $("#withdrawal-next");
    button.disabled = true;
    try {
      const result = await api("withdrawal", { ...data, confirm: true });
      const at = new Date(result.received * 1000).toLocaleString("cs-CZ", {
        timeZone: "Europe/Prague",
      });
      el.innerHTML = `<div class="success-panel"><span class="tiny-star">${icon("sparkle")}</span><h2>Odstoupení od smlouvy jsem přijala.</h2><p>Přijato ${esc(at)}. Potvrzení jsem poslala na ${esc(data.email)}.</p><p>Zboží mi prosím pošlete zpět do 14 dnů. Adresu a další postup najdete v e-mailu.</p><a class="button" href="/">Zpět na úvod</a></div>`;
    } catch (err) {
      error.textContent = err.message;
      button.disabled = false;
    }
  });
}

/* ---------- account ---------- */
const formData = (form) => Object.fromEntries(new FormData(form));
function returnTarget() {
  const target = new URLSearchParams(location.search).get("navrat");
  return { pokladna: "/pokladna.html", kosik: "/kosik.html" }[target] || null;
}
function bindForm(form, handler) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const error = $(".error", form);
    const button = $("button[type=submit], button:not([type])", form);
    error.textContent = "";
    button.disabled = true;
    try {
      await handler(formData(form), form);
    } catch (err) {
      error.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });
}
function renderAccount() {
  const el = $("#account-content");
  if (!member) {
    el.innerHTML = `<div class="account-grid"><section class="panel"><h2>Přihlášení</h2><form id="login-form"><label>E-mail<input name="email" type="email" autocomplete="email" required maxlength="200"></label><label>Heslo<input name="password" type="password" autocomplete="current-password" required></label><p class="error" role="alert"></p><button class="button">Přihlásit se →</button></form><button type="button" class="link-button spaced-top" id="show-forgot">Zapomněli jste heslo?</button><form id="forgot-form" hidden class="spaced-top"><p class="muted">Pošlu vám odkaz pro nastavení nového hesla.</p><label>E-mail<input name="email" type="email" autocomplete="email" required maxlength="200"></label><p class="error" role="alert"></p><p class="success" role="status"></p><button class="inline-button">Poslat odkaz</button></form></section><section class="panel"><h2>Nový účet</h2><p>Registrovaní zákazníci mají <strong>automaticky 5 % slevu na všechno</strong> a přehled svých objednávek.</p><form id="register-form"><label>Jméno a příjmení<input name="name" autocomplete="name" required maxlength="120"></label><label>E-mail<input name="email" type="email" autocomplete="email" required maxlength="200"></label><label>Telefon (nepovinné)<input name="phone" type="tel" autocomplete="tel" maxlength="30"></label><label>Heslo (alespoň 8 znaků)<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><label class="check"><input type="checkbox" name="terms" required><span>Beru na vědomí <a href="/ochrana-osobnich-udaju.html" target="_blank" rel="noopener">zpracování osobních údajů</a>.</span></label><p class="error" role="alert"></p><button class="button">Vytvořit účet →</button></form></section></div>`;
    const done = (result, message) => {
      member = result.customer;
      const target = returnTarget();
      if (target) location.href = target;
      else {
        renderAccount();
        toast(message);
      }
    };
    bindForm($("#login-form"), async (f) =>
      done(await api("account/login", f), "Vítejte zpět."),
    );
    bindForm($("#register-form"), async (f, form) =>
      done(
        await api("account/register", {
          ...f,
          terms: form.elements.terms.checked,
        }),
        "Účet je vytvořený. Sleva 5 % platí od teď.",
      ),
    );
    $("#show-forgot").addEventListener("click", () => {
      $("#forgot-form").hidden = false;
      $("#forgot-form input").focus();
    });
    bindForm($("#forgot-form"), async (f, form) => {
      const result = await api("account/forgot", f);
      $(".success", form).textContent = result.message;
    });
    return;
  }
  el.innerHTML = `<div class="account-head"><div><h2>Dobrý den, ${esc(member.name)}.</h2><p>Vaše sleva 5 % se v košíku odečítá automaticky.</p></div><button type="button" class="inline-button" id="logout">Odhlásit se</button></div><div class="account-grid"><section class="panel"><h2>Moje objednávky</h2><div id="my-orders"><p class="muted">Načítám…</p></div></section><section class="panel"><h2>Osobní údaje</h2><form id="profile-form"><label>Jméno a příjmení<input name="name" autocomplete="name" required maxlength="120" value="${esc(member.name)}"></label><label>E-mail<input type="email" value="${esc(member.email)}" disabled></label><label>Telefon<input name="phone" type="tel" autocomplete="tel" maxlength="30" value="${esc(member.phone || "")}"></label><p class="error" role="alert"></p><button class="inline-button">Uložit údaje</button></form><h2 class="spaced-top">Změna hesla</h2><form id="password-form"><label>Současné heslo<input name="current" type="password" autocomplete="current-password" required></label><label>Nové heslo<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><p class="error" role="alert"></p><button class="inline-button">Změnit heslo</button></form><details class="spaced-top"><summary>Smazat účet</summary><form id="delete-form"><p class="muted">Účet i přihlašovací údaje smažu. Objednávky si musím ponechat kvůli účetnictví, ale už nebudou propojené s účtem.</p><label>Pro potvrzení zadejte heslo<input name="password" type="password" autocomplete="current-password" required></label><p class="error" role="alert"></p><button class="inline-button danger">Trvale smazat účet</button></form></details></section></div>`;
  $("#logout").addEventListener("click", async () => {
    await api("account/logout", {}).catch(() => {});
    member = null;
    renderAccount();
    toast("Jste odhlášeni.");
  });
  bindForm($("#profile-form"), async (f) => {
    member = (await api("account/update", f)).customer;
    toast("Údaje jsou uložené.");
  });
  bindForm($("#password-form"), async (f, form) => {
    await api("account/password", f);
    form.reset();
    toast("Heslo je změněné.");
  });
  bindForm($("#delete-form"), async (f) => {
    if (!confirm("Opravdu chcete účet trvale smazat?")) return;
    await api("account/delete", f);
    member = null;
    renderAccount();
    toast("Účet byl smazán.");
  });
  api("account/orders")
    .then((orders) => {
      $("#my-orders").innerHTML = orders.length
        ? `<ul class="order-list">${orders.map((o) => `<li><a href="/objednavka.html?t=${encodeURIComponent(o.token)}"><strong>${esc(o.number)}</strong> · ${new Date(o.created * 1000).toLocaleDateString("cs-CZ")}</a><span>${esc(ORDER_STATUS[o.status] || o.status)}</span><span>${money(o.total)}</span></li>`).join("")}</ul>`
        : '<p class="muted">Zatím tu nic není. <a href="/obchod.html">Vyberte si svou první vůni →</a></p>';
    })
    .catch((err) => {
      $("#my-orders").textContent = err.message;
    });
}
function renderReset() {
  const el = $("#reset-content");
  const token = new URLSearchParams(location.search).get("token") || "";
  el.innerHTML = `<section class="panel narrow"><h2>Nové heslo</h2><form id="reset-form"><label>Nové heslo (alespoň 8 znaků)<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><label>Heslo znovu<input name="again" type="password" autocomplete="new-password" minlength="8" required></label><p class="error" role="alert"></p><button class="button">Uložit heslo →</button></form></section>`;
  bindForm($("#reset-form"), async (f) => {
    if (f.password !== f.again) throw Error("Hesla se neshodují.");
    await api("account/reset", { token, password: f.password });
    history.replaceState(null, "", "/obnova-hesla.html");
    el.innerHTML = `<div class="success-panel"><span class="tiny-star">${icon("sparkle")}</span><h2>Heslo je změněné.</h2><p>Jste přihlášeni.</p><a class="button" href="/ucet.html">Můj účet →</a></div>`;
  });
}

/* ---------- boot ---------- */
async function loadProducts() {
  let res = await fetch("/api/products").catch(() => null);
  if (!res?.ok || !(res.headers.get("content-type") || "").includes("json"))
    res = await fetch("/data/products.json");
  if (!res.ok) throw Error("Nabídka není dostupná.");
  return validateCatalog(await res.json()).filter((p) => p.active);
}
async function refreshCatalog() {
  products = await loadProducts();
  refreshCards();
}
async function init() {
  const needsMember = [
    "home",
    "shop",
    "product",
    "cart",
    "checkout",
    "account",
    "withdrawal",
  ].includes(page);
  const [loaded, me] = await Promise.all([
    loadProducts().catch(() => null),
    needsMember ? api("account/me").catch(() => ({ customer: null })) : null,
  ]);
  member = me?.customer || null;
  document.body.classList.toggle("is-member", Boolean(member));
  if (page === "account") return renderAccount();
  if (page === "reset") return renderReset();
  if (page === "order") return renderOrderPage();
  if (page === "withdrawal") return renderWithdrawal();
  if (!loaded) {
    const target =
      $("#home-products") ||
      $("#shop-products") ||
      $("#product-detail") ||
      $("#cart-content") ||
      $("#checkout-content");
    if (target)
      target.innerHTML =
        '<p class="notice">Nabídku se nepodařilo načíst. Zkuste stránku obnovit.</p>';
    return;
  }
  products = loaded;
  const before = cart.length;
  cart = cart.filter((i) => {
    const p = products.find((p) => p.id === i.id);
    return (
      p &&
      Number.isInteger(
        p.variants?.length ? variantOf(p, i.variant)?.price : p.price,
      ) &&
      (!p.variants?.length || variantOf(p, i.variant))
    );
  });
  if (cart.length !== before) {
    persist();
    toast("Košík byl aktualizován podle aktuální nabídky.");
  }
  const candles = products.filter(isCandle);
  if (page === "home")
    $("#home-products").innerHTML = candles.map(productCard).join("");
  if (page === "gifts-her" || page === "gifts-him") {
    const who = page === "gifts-her" ? "pro-ni" : "pro-nej";
    $("#gift-products").innerHTML = candles
      .filter((p) => giftFor(p, who))
      .map(productCard)
      .join("");
  }
  if (page === "suncatchers") {
    const all = products.filter((p) => !isCandle(p));
    const themes = SUNCATCHER_THEMES.filter(([id]) =>
      all.some((p) => p.themes?.includes(id)),
    );
    // Always start with every motif; a theme applies only after a click.
    let theme = "";
    const chips = $("#theme-filter");
    const render = () => {
      chips?.querySelectorAll("[data-theme]").forEach((b) => {
        b.classList.toggle("active", b.dataset.theme === theme);
        b.setAttribute("aria-pressed", String(b.dataset.theme === theme));
      });
      const list = all.filter((p) => !theme || p.themes?.includes(theme));
      // The custom-made card stays last: any motif can be made to order.
      $("#suncatcher-products").innerHTML =
        list.map(productCard).join("") + customSuncatcherCard();
      refreshCards();
    };
    if (chips && themes.length) {
      chips.innerHTML =
        '<span class="scent-filter-label">Téma:</span>' +
        themes
          .map(
            ([id, label]) =>
              `<button type="button" data-theme="${id}">${esc(label)}</button>`,
          )
          .join("");
      chips.addEventListener("click", (e) => {
        const b = e.target.closest("[data-theme]");
        if (!b) return;
        theme = theme === b.dataset.theme ? "" : b.dataset.theme;
        render();
      });
    }
    // Coming back with the Back button (page kept in memory) also shows every motif again.
    window.addEventListener("pageshow", (e) => {
      if (e.persisted && theme) {
        theme = "";
        render();
      }
    });
    if (all.length) render();
    else
      $("#suncatcher-products").innerHTML =
        '<div class="coming-soon"><span class="pill">PŘIPRAVUJEME</span><p>První lapače slunce právě vyrábím. Chcete vědět, až budou? <a href="mailto:info@loomos.cz?subject=Lapa%C4%8De%20slunce">Napište mi</a> a dám vám vědět.</p></div>';
  }
  if (page === "shop") {
    const tabs = [...document.querySelectorAll("[data-filter]")];
    const params = new URLSearchParams(location.search);
    let filter = params.get("pro") ? `pro-${params.get("pro")}` : "all";
    const families = SCENT_FAMILIES.filter(([id]) =>
      candles.some((p) => scentFamilies(p).includes(id)),
    );
    let family = families.some(([id]) => id === params.get("ton"))
      ? params.get("ton")
      : "";
    const updateUrl = () => {
      const url = new URL(location.href);
      if (filter === "all") url.searchParams.delete("pro");
      else url.searchParams.set("pro", filter.slice(4));
      if (family) url.searchParams.set("ton", family);
      else url.searchParams.delete("ton");
      history.replaceState(null, "", url);
    };
    const chips = $("#scent-filter");
    if (chips) {
      chips.innerHTML =
        '<span class="scent-filter-label">Oblíbená vůně:</span>' +
        families
          .map(
            ([id, label]) =>
              `<button type="button" data-family="${id}">${esc(label)}</button>`,
          )
          .join("");
      chips.addEventListener("click", (e) => {
        const b = e.target.closest("[data-family]");
        if (!b) return;
        family = family === b.dataset.family ? "" : b.dataset.family;
        updateUrl();
        render();
      });
    }
    const render = () => {
      chips?.querySelectorAll("[data-family]").forEach((b) => {
        b.classList.toggle("active", b.dataset.family === family);
        b.setAttribute("aria-pressed", String(b.dataset.family === family));
      });
      tabs.forEach((t) => {
        t.classList.toggle("active", t.dataset.filter === filter);
        t.setAttribute("aria-pressed", String(t.dataset.filter === filter));
      });
      const list = candles.filter(
        (p) =>
          (filter === "all" || giftFor(p, filter)) &&
          (!family || scentFamilies(p).includes(family)),
      );
      const sort = $("#sort").value;
      if (sort === "price-up") list.sort((a, b) => a.price - b.price);
      if (sort === "price-down") list.sort((a, b) => b.price - a.price);
      if (sort === "name")
        list.sort((a, b) => a.name.localeCompare(b.name, "cs"));
      $("#shop-products").innerHTML = list.length
        ? list.map(productCard).join("")
        : family || filter !== "all"
          ? "<p>S touto kombinací teď žádnou svíčku nemám. Zkuste jiný filtr.</p>"
          : "<p>Nové vůně právě připravuji.</p>";
      const n = list.length;
      const word = n === 1 ? "vůně" : n >= 2 && n <= 4 ? "vůně" : "vůní";
      $("#product-count").textContent =
        // No total count by default: the offer keeps growing.
        filter === "all" && !family
          ? ""
          : filter === "all"
            ? `${n} ${word}`
            : `${n} ${word} ${filter === "pro-ni" ? "pro ni" : "pro něj"}`;
      refreshCards();
    };
    tabs.forEach((t) =>
      t.addEventListener("click", () => {
        filter = t.dataset.filter;
        updateUrl();
        render();
      }),
    );
    $("#sort").addEventListener("change", render);
    render();
  }
  refreshCards();
  if (page === "inquiry") renderInquiry();
  if (page === "review") renderReview();
  if (page === "product") renderProduct();
  if (page === "cart") renderCart();
  if (page === "checkout") renderCheckout();
}
init();
