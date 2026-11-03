/**
 * Google Analytics 4, loaded only after the visitor consents (GDPR / ePrivacy).
 * The measurement ID comes from <meta name="ga-id">, set at build time from GA_MEASUREMENT_ID.
 */
const KEY = "loomos_consent";
const id = document.querySelector('meta[name="ga-id"]')?.content || "";
let loaded = false;

function read() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function save(value) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* Without storage the banner simply shows again next time. */
  }
}
function gtag() {
  window.dataLayer.push(arguments);
}
function load() {
  if (loaded || !id) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = gtag;
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "granted",
  });
  gtag("js", new Date());
  gtag("config", id, { anonymize_ip: true });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.append(script);
}
function banner() {
  if (document.getElementById("consent")) return;
  const el = document.createElement("section");
  el.id = "consent";
  el.className = "consent";
  el.setAttribute("aria-label", "Souhlas s cookies");
  el.innerHTML =
    '<p>Rádi bychom pomocí Google Analytics anonymně měřili návštěvnost, abychom e-shop mohli zlepšovat. Nezbytné funkce (košík, přihlášení) fungují i bez souhlasu. <a href="/ochrana-osobnich-udaju.html#cookies">Více informací</a></p><div><button type="button" class="inline-button" data-consent="denied">Jen nezbytné</button><button type="button" class="button" data-consent="granted">Povolit měření</button></div>';
  el.addEventListener("click", (e) => {
    const choice = e.target.closest("[data-consent]")?.dataset.consent;
    if (!choice) return;
    save(choice);
    el.remove();
    if (choice === "granted") load();
    else if (loaded) location.reload();
  });
  document.body.append(el);
}

export function initAnalytics() {
  if (!id) return;
  document.querySelectorAll("[data-cookie-settings]").forEach((b) => {
    b.hidden = false;
    b.addEventListener("click", banner);
  });
  const choice = read();
  if (choice === "granted") load();
  else if (choice !== "denied") banner();
}

const item = (product, variant, qty) => ({
  item_id: product.id + (variant ? `-${variant.id}` : ""),
  item_name: product.name,
  item_variant: variant?.name,
  price: variant?.price ?? product.price,
  quantity: qty,
});
/** E-commerce events; silently ignored until consent is given. */
export function track(event, a, b, c) {
  if (!loaded) return;
  if (event === "view_item" || event === "add_to_cart") {
    const it = item(a, b, c);
    gtag("event", event, {
      currency: "CZK",
      value: it.price * it.quantity,
      items: [it],
    });
  } else if (event === "purchase")
    gtag("event", "purchase", {
      transaction_id: a.number,
      currency: "CZK",
      value: a.pricing.total,
      shipping: a.pricing.shippingPrice,
      items: a.items.map((i) => ({
        item_id: `${i.id}-${i.variant}`,
        item_name: i.name,
        price: i.unit,
        quantity: i.qty,
      })),
    });
  else gtag("event", event);
}
