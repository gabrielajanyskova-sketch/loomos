import { ORDER_STATUS } from "./orders.mjs";
import { shippingKind, shippingProvider, shippingSummary } from "./pricing.mjs";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (n) =>
  n == null
    ? "Cena bude doplněna"
    : new Intl.NumberFormat("cs-CZ", {
        style: "currency",
        currency: "CZK",
        maximumFractionDigits: 0,
      }).format(n || 0);
const date = (t, time = true) =>
  t
    ? new Date(t * 1000).toLocaleString("cs-CZ", {
        timeZone: "Europe/Prague",
        ...(time
          ? {}
          : { hour: undefined, minute: undefined, second: undefined }),
      })
    : "";
const dayToUnix = (value, end = false) =>
  value
    ? Math.floor(
        new Date(`${value}T${end ? "23:59:59" : "00:00:00"}`).getTime() / 1000,
      )
    : null;
const unixToDay = (t) =>
  t
    ? new Date(t * 1000).toLocaleDateString("sv-SE", {
        timeZone: "Europe/Prague",
      })
    : "";

let tab = "overview";
let config = {};
let orders = [];
let filter = "aktivni";
let category = "svicky";
const CATEGORIES = { svicky: "Svíčky", "lapace-slunce": "Lapače slunce" };
const categoryTabs = (current) =>
  `<div class="filter-tabs admin-cats">${Object.entries(CATEGORIES)
    .map(
      ([id, label]) =>
        `<button type="button" data-category="${id}" class="${id === current ? "active" : ""}">${label}</button>`,
    )
    .join("")}</div>`;

async function api(path, data) {
  const response = await fetch("/api/admin/" + path, {
    method: data ? "POST" : "GET",
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw Error("Server e-shopu neodpovídá. Je nasazený na Cloudflare?");
  }
  if (!response.ok) {
    if (response.status === 401) showLogin();
    throw Error(result.error || "Požadavek se nepodařilo dokončit.");
  }
  return result;
}
function status(msg, error = false) {
  const el = $("#admin-status");
  el.textContent = msg;
  el.className = error ? "notice error" : "notice";
  el.hidden = !msg;
}
function showLogin() {
  $("#login-panel").hidden = false;
  $("#admin-content").hidden = true;
  $("#logout").hidden = true;
}
async function guard(fn) {
  try {
    await fn();
  } catch (err) {
    status(err.message, true);
  }
}

/* ---------- overview ---------- */
async function renderOverview(el) {
  const o = await api("overview");
  const warnings = [
    !config.mail &&
      "E-maily se neposílají: v Cloudflare chybí tajná proměnná RESEND_API_KEY.",
    !config.live &&
      "Zkušební provoz: objednávky jsou označené jako zkušební. Ostrý prodej zapnete proměnnou SHOP_LIVE=1.",
  ].filter(Boolean);
  el.innerHTML = `<div class="stats"><div class="stat">Čeká na platbu<strong>${o.awaiting_payment}</strong></div><div class="stat">Zaplaceno, k odeslání<strong>${o.to_ship}</strong></div><div class="stat">Tržby (zaplacené, ostré)<strong>${esc(o.revenue_label)}</strong></div><div class="stat">Objednávek celkem<strong>${o.orders}</strong></div><div class="stat">Registrovaných zákazníků<strong>${o.customers}</strong></div><div class="stat">Docházející zboží (≤ 2 ks)<strong>${o.low_stock}</strong></div></div>${warnings.map((w) => `<p class="notice">${esc(w)}</p>`).join("")}<div id="withdrawals"></div>`;
  const list = (await api("withdrawals")).filter((w) => !w.resolved);
  if (list.length)
    $("#withdrawals", el).innerHTML =
      `<section class="panel"><h2>Odstoupení od smlouvy k vyřízení</h2><div class="table-wrap"><table><thead><tr><th>Přijato</th><th>Objednávka</th><th>Zákazník</th><th>Zboží / důvod</th><th></th></tr></thead><tbody>${list
        .map(
          (w) =>
            `<tr><td>${date(w.created)}</td><td>${w.matched ? `<button class="inline-button" data-order="${esc(w.order_number)}">${esc(w.order_number)}</button>` : `${esc(w.order_number)} <small class="error">nespárováno</small>`}</td><td>${esc(w.name)}<br><small>${esc(w.email)}</small></td><td>${esc(w.items || "celá objednávka")}${w.reason ? `<br><small>${esc(w.reason)}</small>` : ""}</td><td><button class="inline-button" data-resolve-withdrawal="${w.id}">Vyřízeno</button></td></tr>`,
        )
        .join(
          "",
        )}</tbody></table></div><p class="muted">Zákazník má 14 dní na vrácení zboží. Peníze vraťte do 14 dnů od odstoupení, nejdříve po obdržení zboží. Pak objednávku přepněte na „Zrušeno“ (vrátí zboží na sklad) a odstoupení označte jako vyřízené.</p></section>`;
}

/* ---------- orders ---------- */
const filters = {
  aktivni: [
    "Rozpracované",
    (o) => !["dokoncena", "zrusena"].includes(o.status),
  ],
  nova: ["Čeká na platbu", (o) => o.status === "nova"],
  zaplacena: ["K odeslání", (o) => o.status === "zaplacena"],
  vse: ["Všechny", () => true],
};
async function renderOrders(el) {
  orders = await api("orders");
  const list = orders.filter(filters[filter][1]);
  el.innerHTML = `<div class="admin-toolbar"><h2>Objednávky</h2><div class="chips">${Object.entries(
    filters,
  )
    .map(
      ([k, [label]]) =>
        `<button class="chip ${k === filter ? "active" : ""}" data-filter="${k}">${label}</button>`,
    )
    .join("")}</div></div>${
    list.length
      ? `<div class="table-wrap"><table><thead><tr><th>Číslo</th><th>Zákazník</th><th>Doprava</th><th>Celkem</th><th>Stav</th><th></th></tr></thead><tbody>${list
          .map(
            (o) =>
              `<tr><td><strong>${esc(o.number)}</strong>${o.test ? ' <small class="muted">test</small>' : ""}${o.withdrawals ? ' <small class="error">odstoupení</small>' : ""}<br><small>${date(o.created)}</small></td><td>${esc(o.customer.name)}${o.registered ? ' <small class="muted">· účet</small>' : ""}<br><small>${esc(o.customer.email)}</small></td><td>${esc({ pickup: "Osobně", zasilkovna: "Výdejní místo", zbox: "Z-BOX", domu: "Domů", balikovna: "Balíkovna", balikovna_domu: "Pošta domů" }[o.shipping] || o.shipping)}</td><td>${money(o.pricing.total)}</td><td><span class="status-label">${esc(ORDER_STATUS[o.status])}</span></td><td><button class="inline-button" data-order="${esc(o.number)}">Detail →</button></td></tr>`,
          )
          .join("")}</tbody></table></div>`
      : '<div class="panel">Žádné objednávky v tomto výběru.</div>'
  }`;
}
function orderDetail(number) {
  const o = orders.find((o) => o.number === number);
  if (!o) return;
  const p = o.pricing;
  const packeta =
    shippingKind(o.shipping) === "pickup"
      ? ""
      : shippingProvider(o.shipping) === "balikovna"
        ? '<p class="notice">Zásilku podejte u České pošty (Podání Online nebo na pobočce). Sledovací číslo pak vložte níže.</p>'
        : o.packeta?.barcode
          ? `<p class="notice">Zásilka: <strong>${esc(o.packeta.barcode)}</strong> · <a href="https://tracking.packeta.com/cs/?id=${encodeURIComponent(o.packeta.barcode.replace(/\s/g, ""))}" target="_blank" rel="noopener">sledovat</a> · štítek vytisknete v klientské sekci Zásilkovny.</p>`
          : shippingKind(o.shipping) === "point" && !o.packeta_point_id
            ? '<p class="notice">Zákazník nevybral místo na mapě — zásilku založte ručně v klientské sekci Zásilkovny.</p>'
            : !config.packeta
              ? '<p class="notice">Pro automatické zakládání zásilek nastavte v Cloudflare PACKETA_API_PASSWORD.</p>'
              : '<form id="packet-form" class="inline-form"><label>Hmotnost (kg)<input name="weight" type="number" min="0.01" max="15" step="0.01" required></label><button class="button">Vytvořit zásilku v Zásilkovně</button></form>';
  $("#admin-content").innerHTML =
    `<button id="back" class="text-link">← Zpět na objednávky</button><section class="panel"><h2>Objednávka ${esc(o.number)}</h2>${o.test ? '<p class="notice">Zkušební objednávka.</p>' : ""}${o.withdrawal ? `<p class="notice error">Zákazník odstoupil od smlouvy ${date(o.withdrawal.at)}${o.withdrawal.items ? ` — ${esc(o.withdrawal.items)}` : " — celá objednávka"}${o.withdrawal.reason ? `. Důvod: ${esc(o.withdrawal.reason)}` : ""}.</p>` : ""}<div class="order-actions">${o.invoice ? `<a class="button" href="/api/admin/invoice?order=${encodeURIComponent(o.number)}" target="_blank" rel="noopener">Faktura ${esc(o.invoice)} (PDF)</a>` : o.status !== "zrusena" ? '<button type="button" class="inline-button" id="issue-invoice">Vystavit fakturu</button><small class="muted">Faktura se vystaví a pošle sama při změně na „Zaplaceno“.</small>' : ""}<button type="button" class="inline-button danger" id="delete-order">Smazat objednávku</button></div><div class="detail-columns"><div><h3>Zákazník</h3><p>${esc(o.customer.name)}${o.registered ? " (registrovaný)" : ""}<br><a href="mailto:${esc(o.customer.email)}">${esc(o.customer.email)}</a><br>${esc(o.customer.phone)}</p><h3>Doprava</h3><p>${esc(shippingSummary(o))}${o.packeta_point_id ? ` <small>(ID ${esc(o.packeta_point_id)})</small>` : ""}</p>${o.balikovna ? `<p class="muted">Adresa na štítek (Česká pošta):<br>${esc(o.customer.name)}<br>BALÍKOVNA<br>${esc(o.balikovna.zip)} ${esc(o.balikovna.name)}<br><small>ID Balíkovny ${esc(o.balikovna.id)}</small></p>` : ""}<h3>Poznámka</h3><p>${esc(o.note || "—")}</p></div><div><h3>Položky</h3><div class="table-wrap"><table><tbody>${o.items.map((i) => `<tr><td>${i.qty}× ${esc(i.name)}</td><td>${money(i.total)}</td></tr>`).join("")}${p.memberSavings ? `<tr><td>Sleva s účtem 5 %</td><td>−${money(p.memberSavings)}</td></tr>` : ""}${p.codeDiscount ? `<tr><td>Kód ${esc(p.code)}</td><td>−${money(p.codeDiscount)}</td></tr>` : ""}<tr><td>Doprava</td><td>${money(p.shippingPrice)}</td></tr><tr><td><strong>Celkem (VS ${esc(o.number)})</strong></td><td><strong>${money(p.total)}</strong></td></tr></tbody></table></div><p class="muted">Vytvořeno ${date(o.created)} · <a href="/objednavka.html?t=${esc(o.token)}" target="_blank" rel="noopener">stránka pro zákazníka</a></p></div></div>${packeta}<form id="status-form" class="inline-form"><label>Stav objednávky<select name="status" ${o.status === "zrusena" ? "disabled" : ""}>${Object.entries(
      ORDER_STATUS,
    )
      .map(
        ([k, v]) =>
          `<option value="${k}" ${o.status === k ? "selected" : ""}>${v}</option>`,
      )
      .join(
        "",
      )}</select></label><label>Sledovací číslo zásilky<input name="tracking" maxlength="40" value="${esc(o.tracking || "")}" placeholder="${esc(o.packeta?.barcode || "např. Z 123 456 7890")}"></label><label class="wide">Vzkaz pro zákazníka (nepovinné, uvidí ho v e-mailu i u objednávky)<textarea name="note" rows="2" maxlength="500" placeholder="např. Svíčky jsme zabalili s malým dárkem."></textarea></label><label class="check"><input type="checkbox" name="notify" checked>Poslat zákazníkovi e-mail</label><button class="button" ${o.status === "zrusena" ? "disabled" : ""}>Uložit stav</button></form><p class="muted">Zrušení vrátí zboží zpět na sklad. Při změně na „Zaplaceno“ dostane zákazník potvrzení o přijetí platby.</p>${o.history?.length ? `<h3>Historie</h3><ul class="history">${o.history.map((h) => `<li>${date(h.at)} — ${esc(ORDER_STATUS[h.status] || h.status)}${h.note ? `<br><small>Vzkaz: ${esc(h.note)}</small>` : ""}</li>`).join("")}</ul>` : ""}</section>`;
  $("#back").onclick = () => show("orders");
  $("#issue-invoice")?.addEventListener("click", () =>
    guard(async () => {
      const r = await api("invoice", { number });
      orders = await api("orders");
      orderDetail(number);
      status(`Faktura ${r.number} je vystavená.`);
    }),
  );
  $("#delete-order").addEventListener("click", () => {
    if (
      !confirm(
        `Opravdu trvale smazat objednávku ${number}? Zboží se vrátí na sklad. Tuto akci nelze vrátit.`,
      )
    )
      return;
    guard(async () => {
      await api("order-delete", { number });
      status(`Objednávka ${number} je smazaná.`);
      await show("orders");
    });
  });
  $("#status-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (
      f.elements.status.value === "zrusena" &&
      !confirm("Opravdu objednávku zrušit? Zboží se vrátí na sklad.")
    )
      return;
    guard(async () => {
      await api("order-status", {
        number,
        status: f.elements.status.value,
        tracking: f.elements.tracking.value,
        note: f.elements.note.value,
        notify: f.elements.notify.checked,
      });
      orders = await api("orders");
      orderDetail(number);
      status("Stav objednávky je uložený.");
    });
  });
  $("#packet-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!confirm("Vytvořit skutečnou zásilku v Zásilkovně?")) return;
    f.querySelector("button").disabled = true;
    guard(async () => {
      try {
        const packet = await api("packeta-packet", {
          number,
          weight: Number(f.elements.weight.value),
        });
        orders = await api("orders");
        orderDetail(number);
        status("Zásilka vytvořena: " + (packet.barcode || packet.id));
      } finally {
        f.querySelector("button").disabled = false;
      }
    });
  });
}

/* ---------- stock ---------- */
async function renderStock(el) {
  const rows = (await api("stock")).filter((r) => r.category === category);
  el.innerHTML = `<div class="admin-toolbar"><h2>Sklad a ceny</h2>${categoryTabs(category)}</div><p class="muted">Ceny v Kč můžete měnit přímo zde. Prázdná běžná cena znamená, že produkt nelze objednat. Prázdný sklad se nehlídá, 0 znamená vyprodáno. Prázdná zlevněná cena ukončí slevu.</p><p class="muted">Nejnižší cenu za 30 dní před začátkem slevy počítám z historie. Dokud není úplných 30 dní záznamů, při první slevě vyplňte ověřenou nejnižší cenu za předchozích 30 dní. Nejde o libovolnou původní cenu. Při postupném zlevňování v jedné akci se reference zachová.</p><div class="table-wrap"><table class="stock-price-table"><thead><tr><th>Produkt</th><th>Běžná cena Kč</th><th>Zlevněná cena Kč</th><th>Nejnižší cena před slevou Kč</th><th>Kusů skladem</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr data-revision="${r.revision}" class="${r.quantity === 0 ? "sold-out" : r.quantity !== null && r.quantity <= 2 ? "low" : ""}"><td>${esc(r.name)}${r.active ? "" : ' <small class="muted">(není v e-shopu)</small>'}<br><small>Aktuálně: ${money(r.price)}</small></td><td><input class="regular-price-input" type="number" min="1" max="100000" step="1" value="${r.regular_price ?? ""}" placeholder="neprodává se" aria-label="Běžná cena ${esc(r.name)}"></td><td><input class="sale-price-input" type="number" min="1" max="100000" step="1" value="${r.sale_price ?? ""}" placeholder="bez slevy" aria-label="Zlevněná cena ${esc(r.name)}"></td><td><input class="reference-price-input" type="number" min="1" max="100000" step="1" value="${r.lowest_30 ?? ""}" placeholder="při neúplné historii" aria-label="Ověřená nejnižší cena za 30 dní ${esc(r.name)}"><small>Historie od ${unixToDay(r.tracked_since)}</small></td><td><input class="stock-input" type="number" min="0" max="100000" step="1" value="${r.quantity ?? ""}" placeholder="nehlídá se" data-product="${esc(r.product_id)}" data-variant="${esc(r.variant_id)}" aria-label="Počet kusů ${esc(r.name)}"></td><td><button class="inline-button" data-save-stock>Uložit</button></td></tr>`).join("")}</tbody></table></div>`;
}
async function saveStock(row) {
  const inputs = [...row.querySelectorAll("input")];
  if (inputs.some((i) => !i.reportValidity())) return;
  const input = $(".stock-input", row);
  const number = (selector) => {
    const value = $(selector, row).value.trim();
    return value === "" ? null : Number(value);
  };
  const button = $("[data-save-stock]", row);
  if (button.disabled) return;
  button.disabled = true;
  try {
    await api("prices", {
      product_id: input.dataset.product,
      variant_id: input.dataset.variant,
      revision: Number(row.dataset.revision),
      quantity: number(".stock-input"),
      regular_price: number(".regular-price-input"),
      sale_price: number(".sale-price-input"),
      confirmed_lowest_30: number(".reference-price-input"),
    });
    status("Sklad i ceny jsou uložené.");
    await show("stock");
  } finally {
    button.disabled = false;
  }
}

/* ---------- products ---------- */
const lines = (v) =>
  String(v || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
const intOrNull = (v) => (String(v).trim() === "" ? null : Number(v));
let products = [];
async function renderProducts(el) {
  products = await api("products");
  const list = products.filter((p) => p.category === category);
  el.innerHTML = `<div class="admin-toolbar"><h2>Produkty</h2>${categoryTabs(category)}<button type="button" class="button" data-product-new>＋ Nový produkt</button></div><p class="muted">Změny se v e-shopu projeví hned. Stránky produktů z původní nabídky se pro vyhledávače aktualizují při příštím nasazení webu.</p><div class="table-wrap"><table><thead><tr><th>Produkt</th><th>Cena</th><th>V e-shopu</th><th></th></tr></thead><tbody>${
    list
      .map(
        (p) =>
          `<tr><td><strong>${esc(p.name)}</strong>${p.badge ? ` <small class="status-label">${esc(p.badge)}</small>` : ""}<br><small class="muted">${esc(p.id)}${p.edited ? " · upraveno v adminu" : ""}</small></td><td>${p.variants?.length ? p.variants.map((v) => `${esc(v.name)} ${money(v.price)}`).join("<br>") : money(p.price)}${p.bulk || p.variants?.some((v) => v.bulk) ? '<br><small class="muted">s množstevní cenou</small>' : ""}</td><td>${p.deleted ? '<span class="status-label">Smazáno</span>' : p.active ? "Ano" : "Ne"}</td><td>${p.deleted ? `<button type="button" class="inline-button" data-product-restore="${esc(p.id)}">Obnovit</button>` : `<button type="button" class="inline-button" data-product-edit="${esc(p.id)}">Upravit</button> <button type="button" class="inline-button danger" data-product-delete="${esc(p.id)}">Smazat</button>`}</td></tr>`,
      )
      .join("") ||
    '<tr><td colspan="4">V této kategorii zatím nic není.</td></tr>'
  }</tbody></table></div><section class="panel" id="product-editor" hidden></section>`;
}
function productForm(p, isNew) {
  const candle = (p.category || category) === "svicky";
  const variant = (id) => p.variants?.find((v) => v.id === id) || {};
  const bulk = p.bulk || {};
  const v = (x) => esc(x ?? "");
  const variantFields = (id, label) => {
    const x = variant(id);
    return `<fieldset class="variant-fields"><legend>${label}</legend><label>${isNew ? "Výchozí cena (Kč)" : "Cena (Kč) — mění se v Sklad a ceny"}<input name="${id}_price" type="number" min="1" value="${v(x.regular_price ?? x.price)}" ${isNew ? "required" : "readonly"}></label><label>Popis velikosti<input name="${id}_detail" maxlength="120" value="${v(x.detail)}"></label><label>Hoří (hodin)<input name="${id}_burn" type="number" min="1" max="500" value="${v(x.burn_hours)}"></label></fieldset>`;
  };
  const editor = $("#product-editor");
  editor.hidden = false;
  editor.innerHTML = `<h3>${isNew ? "Nový produkt" : "Upravit: " + esc(p.name)}</h3><form id="product-form" class="product-admin" data-new="${isNew ? "1" : ""}" data-category="${candle ? "svicky" : "lapace-slunce"}">
    <label>Kód produktu (do adresy)<input name="product_id" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="60" value="${v(p.id)}" ${isNew ? "" : "readonly"} placeholder="např. lapac-slunce-kocka"><small>malá písmena bez diakritiky a pomlčky; později nejde změnit</small></label>
    <label>Název<input name="name" required maxlength="120" value="${v(p.name)}"></label>
    <label>Podnadpis<input name="subtitle" maxlength="160" value="${v(p.subtitle)}"></label>
    <label>Krátký popis na kartě<input name="notes" maxlength="160" value="${v(p.notes)}" placeholder="${candle ? "např. Vanilka · santal · pačuli" : "např. Kruh Ø 15 cm · kočička"}"></label>
    <label class="wide">Popis<textarea name="description" rows="4" maxlength="2000">${v(p.description)}</textarea></label>
    ${
      candle
        ? `${variantFields("mala", "Malá svíčka")}${variantFields("velka", "Velká svíčka")}
    <label>Hlava (vonné tóny)<input name="top" maxlength="160" value="${v(p.pyramid?.top)}"></label>
    <label>Srdce<input name="heart" maxlength="160" value="${v(p.pyramid?.heart)}"></label>
    <label>Základ<input name="base" maxlength="160" value="${v(p.pyramid?.base)}"></label>
    <label>Charakter (oddělte čárkou, max. 4)<input name="character" maxlength="100" value="${v((p.character || []).join(", "))}" placeholder="sladká, hřejivá"></label>
    <fieldset class="variant-fields"><legend>Dárek</legend><label class="check"><input type="checkbox" name="pro_ni" ${p.gift?.includes("pro-ni") ? "checked" : ""}>Pro ni</label><label class="check"><input type="checkbox" name="pro_nej" ${p.gift?.includes("pro-nej") ? "checked" : ""}>Pro něj</label></fieldset>`
        : `<label>${isNew ? "Výchozí cena za kus (Kč, prázdné = cenu připravuji)" : "Cena za kus (Kč) — mění se v Sklad a ceny"}<input name="price" type="number" min="1" value="${v(p.regular_price ?? p.price)}" ${isNew ? "" : "readonly"}></label>
    <label>Množstevní cena od (ks)<input name="bulk_min" type="number" min="2" max="100" value="${v(bulk.min_qty)}" placeholder="např. 2"></label>
    <label>Množstevní cena za kus (Kč)<input name="bulk_price" type="number" min="1" value="${v(bulk.price)}" placeholder="např. 175"></label>`
    }
    <label>Štítek (nepovinné)<input name="badge" maxlength="40" value="${v(p.badge)}" placeholder="např. Nejoblíbenější vůně, Novinka"></label>
    <label class="check"><input type="checkbox" name="active" ${p.active ? "checked" : ""}>Zobrazit v e-shopu</label>
    <div class="wide product-actions"><button class="button">Uložit produkt</button>${!isNew && p.edited ? `<button type="button" class="inline-button danger" data-product-reset="${v(p.id)}">${p.bundled ? "Vrátit původní údaje" : "Smazat produkt"}</button>` : ""}<button type="button" class="inline-button" data-product-close>Zavřít</button></div>
  </form>`;
  editor.scrollIntoView({ behavior: "smooth" });
}
function productFromForm(form) {
  const f = form.elements;
  const candle = form.dataset.category === "svicky";
  const product = {
    id: f.product_id.value.trim(),
    name: f.name.value.trim(),
    subtitle: f.subtitle.value.trim(),
    notes: f.notes.value.trim(),
    description: f.description.value.trim(),
    category: form.dataset.category,
    active: f.active.checked,
  };
  if (f.badge.value.trim()) product.badge = f.badge.value.trim();
  if (candle) {
    product.variants = [
      ["mala", "Malá"],
      ["velka", "Velká"],
    ].map(([id, name]) => {
      const value = f[id + "_price"].value;
      const variant = { id, name, price: value === "" ? null : Number(value) };
      if (f[id + "_detail"].value.trim())
        variant.detail = f[id + "_detail"].value.trim();
      if (f[id + "_burn"].value)
        variant.burn_hours = Number(f[id + "_burn"].value);
      return variant;
    });
    product.price = product.variants[0].price;
    if (f.top.value.trim() || f.heart.value.trim())
      product.pyramid = {
        top: f.top.value.trim(),
        heart: f.heart.value.trim(),
        ...(f.base.value.trim() ? { base: f.base.value.trim() } : {}),
      };
    const character = lines(f.character.value).slice(0, 4);
    if (character.length) product.character = character;
    const gift = [
      f.pro_ni.checked && "pro-ni",
      f.pro_nej.checked && "pro-nej",
    ].filter(Boolean);
    if (gift.length) product.gift = gift;
  } else {
    product.price = f.price.value === "" ? null : Number(f.price.value);
    const min = intOrNull(f.bulk_min.value);
    const price = intOrNull(f.bulk_price.value);
    if (min !== null || price !== null) {
      if (min === null || price === null)
        throw new Error("Vyplňte u množstevní ceny počet kusů i cenu.");
      product.bulk = { min_qty: min, price };
    }
  }
  return product;
}

/* ---------- inquiries ---------- */
async function renderInquiries(el) {
  const list = await api("inquiries");
  el.innerHTML = `<div class="admin-toolbar"><h2>Lapače na přání — poptávky</h2><span class="muted">${((n) => (n === 1 ? "1 nová" : n >= 2 && n <= 4 ? `${n} nové` : `${n} nových`))(list.filter((i) => i.status === "nova").length)}</span></div>${
    list.length
      ? list
          .map(
            (i) =>
              `<section class="panel inquiry ${i.status}"><div class="admin-toolbar"><h3>č. ${i.id} · ${esc(i.type_label)}${i.status === "nova" ? ' <span class="status-label">Nová</span>' : ""}</h3><small class="muted">${date(i.created)}</small></div><p><strong>${esc(i.name)}</strong> · <a href="mailto:${esc(i.email)}?subject=${encodeURIComponent("Vaše poptávka č. " + i.id + " — LOOMOS")}">${esc(i.email)}</a>${i.phone ? " · " + esc(i.phone) : ""}</p><p class="muted">Velikost: ${esc(i.size || "—")} · Počet: ${i.quantity} ks · Fólie: ${esc(i.material || "nevím")} · Termín: ${esc(i.deadline || "—")}</p><p class="pre">${esc(i.motif)}</p><div class="order-actions">${i.file_name ? `<a class="inline-button" href="/api/admin/inquiry-file?id=${i.id}">Stáhnout přílohu (${esc(i.file_name)})</a>` : '<span class="muted">Bez přílohy</span>'}<button type="button" class="inline-button" data-inquiry="${i.id}" data-status="${i.status === "nova" ? "vyrizena" : "nova"}">${i.status === "nova" ? "Označit jako vyřízenou" : "Vrátit mezi nové"}</button><button type="button" class="inline-button danger" data-inquiry="${i.id}" data-delete>Smazat</button></div></section>`,
          )
          .join("")
      : '<div class="panel">Zatím žádné poptávky. Formulář je na stránce <a href="/poptavka.html" target="_blank" rel="noopener">Lapač na přání</a>.</div>'
  }<p class="muted">Poptávka vám přijde i e-mailem (s přílohou); odpovědět můžete přímo na něj.</p>`;
}

/* ---------- customers ---------- */
async function renderCustomers(el) {
  const list = await api("customers");
  el.innerHTML = `<div class="admin-toolbar"><h2>Registrovaní zákazníci</h2><span class="muted">${list.length} celkem</span></div>${
    list.length
      ? `<div class="table-wrap"><table><thead><tr><th>Zákazník</th><th>Registrace</th><th>Objednávky</th><th>Utraceno</th><th>Stav</th><th></th></tr></thead><tbody>${list
          .map(
            (c) =>
              `<tr><td>${esc(c.name)}<br><small><a href="mailto:${esc(c.email)}">${esc(c.email)}</a>${c.phone ? " · " + esc(c.phone) : ""}</small></td><td>${unixToDay(c.created)}</td><td>${c.orders}</td><td>${money(c.spent)}</td><td>${c.blocked ? '<span class="status-label">Zablokovaný</span>' : "Aktivní"}</td><td><button class="inline-button" data-customer="${c.id}" data-action="${c.blocked ? "unblock" : "block"}">${c.blocked ? "Odblokovat" : "Zablokovat"}</button> <button class="inline-button danger" data-customer="${c.id}" data-action="delete">Smazat</button></td></tr>`,
          )
          .join("")}</tbody></table></div>`
      : '<div class="panel">Zatím se nikdo nezaregistroval.</div>'
  }<p class="muted">Hesla nevidíte ani vy — zákazník si je obnoví sám přes „Zapomněli jste heslo?“. Smazáním účtu objednávky zůstanou kvůli účetnictví.</p>`;
}

/* ---------- discount codes ---------- */
async function renderCodes(el) {
  const list = await api("codes");
  el.innerHTML = `<div class="admin-toolbar"><h2>Slevové kódy</h2></div><section class="panel"><h3>Nový kód / úprava</h3><form id="code-form" class="code-admin"><label>Kód<input name="code" required maxlength="40" pattern="[A-Za-z0-9_\-]{3,40}" placeholder="např. VANOCE10"></label><label>Typ<select name="type"><option value="percent">Procenta (%)</option><option value="fixed">Částka (Kč)</option></select></label><label>Hodnota<input name="value" type="number" min="1" max="100000" required></label><label>Minimální nákup (Kč)<input name="min_total" type="number" min="0" placeholder="bez limitu"></label><label>Max. počet použití<input name="max_uses" type="number" min="1" placeholder="neomezeně"></label><label>Platí od<input name="valid_from" type="date"></label><label>Platí do<input name="valid_to" type="date"></label><label>Poznámka<input name="note" maxlength="200"></label><label class="check"><input type="checkbox" name="active" checked>Aktivní</label><button class="button">Uložit kód</button></form><p class="muted">Kód se počítá ze zboží po slevě 5 % pro registrované; na dopravu se nevztahuje.</p></section>${
    list.length
      ? `<div class="table-wrap"><table><thead><tr><th>Kód</th><th>Sleva</th><th>Podmínky</th><th>Použito</th><th>Stav</th><th></th></tr></thead><tbody>${list
          .map(
            (c) =>
              `<tr><td><strong>${esc(c.code)}</strong>${c.note ? `<br><small>${esc(c.note)}</small>` : ""}</td><td>${c.type === "percent" ? c.value + " %" : money(c.value)}</td><td>${[c.min_total ? `od ${money(c.min_total)}` : "", c.valid_from ? `od ${unixToDay(c.valid_from)}` : "", c.valid_to ? `do ${unixToDay(c.valid_to)}` : ""].filter(Boolean).join(", ") || "—"}</td><td>${c.uses}${c.max_uses ? " / " + c.max_uses : ""}</td><td>${c.active ? "Aktivní" : "Vypnutý"}</td><td><button class="inline-button" data-edit-code="${esc(c.code)}">Upravit</button> <button class="inline-button danger" data-delete-code="${esc(c.code)}">Smazat</button></td></tr>`,
          )
          .join("")}</tbody></table></div>`
      : ""
  }`;
  const form = $("#code-form");
  el.addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit-code]");
    if (!edit) return;
    const c = list.find((c) => c.code === edit.dataset.editCode);
    form.elements.code.value = c.code;
    form.elements.type.value = c.type;
    form.elements.value.value = c.value;
    form.elements.min_total.value = c.min_total || "";
    form.elements.max_uses.value = c.max_uses ?? "";
    form.elements.valid_from.value = unixToDay(c.valid_from);
    form.elements.valid_to.value = unixToDay(c.valid_to);
    form.elements.note.value = c.note;
    form.elements.active.checked = c.active;
    form.scrollIntoView({ behavior: "smooth" });
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const num = (v) => (v === "" ? null : Number(v));
    guard(async () => {
      await api("codes", {
        code: form.elements.code.value,
        type: form.elements.type.value,
        value: num(form.elements.value.value),
        min_total: num(form.elements.min_total.value),
        max_uses: num(form.elements.max_uses.value),
        valid_from: dayToUnix(form.elements.valid_from.value),
        valid_to: dayToUnix(form.elements.valid_to.value, true),
        note: form.elements.note.value,
        active: form.elements.active.checked,
      });
      status("Slevový kód je uložený.");
      await show("codes");
    });
  });
}

/* ---------- navigation ---------- */
const views = {
  overview: renderOverview,
  orders: renderOrders,
  products: renderProducts,
  inquiries: renderInquiries,
  stock: renderStock,
  customers: renderCustomers,
  codes: renderCodes,
};
async function show(next) {
  tab = next;
  document
    .querySelectorAll("[data-tab]")
    .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  const el = $("#admin-content");
  el.hidden = false;
  $("#login-panel").hidden = true;
  $("#logout").hidden = false;
  el.replaceWith(el.cloneNode(false));
  const fresh = $("#admin-content");
  fresh.innerHTML = '<p class="muted">Načítám…</p>';
  await guard(() => views[tab](fresh));
}

document.querySelectorAll("[data-tab]").forEach((b) =>
  b.addEventListener("click", () => {
    status("");
    show(b.dataset.tab);
  }),
);
document.addEventListener("click", (e) => {
  if (!e.target.closest("#admin-content")) return;
  const order = e.target.closest("[data-order]");
  if (order)
    guard(async () => {
      if (!orders.some((o) => o.number === order.dataset.order))
        orders = await api("orders");
      orderDetail(order.dataset.order);
    });
  const resolve = e.target.closest("[data-resolve-withdrawal]");
  if (resolve)
    guard(async () => {
      await api("withdrawal-resolved", {
        id: Number(resolve.dataset.resolveWithdrawal),
      });
      await show("overview");
    });
  const chip = e.target.closest("[data-filter]");
  if (chip) {
    filter = chip.dataset.filter;
    show("orders");
  }
  const inq = e.target.closest("[data-inquiry]");
  if (inq) {
    if (inq.hasAttribute("data-delete") && !confirm("Smazat poptávku?")) return;
    guard(async () => {
      await api("inquiry", {
        id: Number(inq.dataset.inquiry),
        ...(inq.hasAttribute("data-delete")
          ? { action: "delete" }
          : { status: inq.dataset.status }),
      });
      await show("inquiries");
    });
    return;
  }
  const cat = e.target.closest("[data-category]");
  if (cat && cat.tagName === "BUTTON") {
    category = cat.dataset.category;
    show(tab);
    return;
  }
  if (e.target.closest("[data-product-new]"))
    productForm({ category, active: false }, true);
  const edit = e.target.closest("[data-product-edit]");
  if (edit)
    productForm(
      products.find((p) => p.id === edit.dataset.productEdit),
      false,
    );
  const productDelete = e.target.closest("[data-product-delete]");
  if (productDelete) {
    const product = products.find(
      (p) => p.id === productDelete.dataset.productDelete,
    );
    if (
      !confirm(
        `Smazat produkt „${product?.name}“? Zmizí z e-shopu i ze skladu.${product?.bundled ? " Půjde ho obnovit." : ""}`,
      )
    )
      return;
    guard(async () => {
      await api("product-delete", { id: productDelete.dataset.productDelete });
      status(`Produkt „${product?.name}“ je smazaný.`);
      await show("products");
    });
    return;
  }
  const restore = e.target.closest("[data-product-restore]");
  if (restore) {
    guard(async () => {
      await api("product-reset", { id: restore.dataset.productRestore });
      status("Produkt je obnovený (v e-shopu ho zapnete v Upravit).");
      await show("products");
    });
    return;
  }
  if (e.target.closest("[data-product-close]"))
    $("#product-editor").hidden = true;
  const reset = e.target.closest("[data-product-reset]");
  if (reset) {
    if (!confirm(reset.textContent + "?")) return;
    guard(async () => {
      await api("product-reset", { id: reset.dataset.productReset });
      status("Hotovo.");
      await show("products");
    });
  }
  if (e.target.closest("[data-save-stock]"))
    guard(() => saveStock(e.target.closest("tr")));
  const customer = e.target.closest("[data-customer]");
  if (customer) {
    const action = customer.dataset.action;
    const question = {
      block: "Zablokovat zákazníka? Nebude se moci přihlásit.",
      unblock: "Odblokovat zákazníka?",
      delete: "Trvale smazat účet zákazníka? Objednávky zůstanou.",
    }[action];
    if (confirm(question))
      guard(async () => {
        await api("customer", {
          id: Number(customer.dataset.customer),
          action,
        });
        status("Hotovo.");
        await show("customers");
      });
  }
  const del = e.target.closest("[data-delete-code]");
  if (del && confirm(`Smazat kód ${del.dataset.deleteCode}?`))
    guard(async () => {
      await api("codes/delete", { code: del.dataset.deleteCode });
      await show("codes");
    });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.matches(".stock-price-table input")) {
    e.preventDefault();
    guard(() => saveStock(e.target.closest("tr")));
  }
});
$("#login-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const b = f.querySelector("button");
  b.disabled = true;
  guard(async () => {
    try {
      await api("login", { password: f.elements.password.value });
      f.reset();
      status("");
      await show("overview");
    } finally {
      b.disabled = false;
    }
  });
});
$("#logout").addEventListener("click", () =>
  guard(async () => {
    await api("logout", {});
    $("#admin-content").innerHTML = "";
    showLogin();
    status("Jste odhlášeni.");
  }),
);
guard(async () => {
  config = await api("session");
  if (config.authenticated) return show("overview");
  showLogin();
  if (!config.configured)
    status(
      "Administrace ještě nemá heslo. V Cloudflare nastavte tajnou proměnnou ADMIN_PASSWORD (alespoň 12 znaků) a web znovu nasaďte.",
      true,
    );
});

document.addEventListener("submit", (e) => {
  // Not e.target.id: a form field named "id" would shadow it.
  if (!e.target.matches("#product-form")) return;
  e.preventDefault();
  const form = e.target;
  guard(async () => {
    const product = productFromForm(form);
    await api("product", { product, new: Boolean(form.dataset.new) });
    status(`Produkt „${product.name}“ je uložený.`);
    category = product.category;
    await show("products");
  });
});
