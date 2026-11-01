"use strict";
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) =>
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
  const money = (n) => n == null ? "Cena chybí" :
    new Intl.NumberFormat("cs-CZ", {
      style: "currency",
      currency: "CZK",
      maximumFractionDigits: 0,
    }).format(n);
  const labels = {
    nova: "Nová",
    "vyrizuje-se": "Vyřizuje se",
    dokoncena: "Dokončená",
    zrusena: "Zrušená",
  };
  let products = [],
    orders = [],
    tab = "overview";
  async function api(path, data) {
    const r = await fetch(
      "/api/admin/" + path,
      data
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          }
        : {},
    );
    let result;
    try {
      result = await r.json();
    } catch {
      throw Error("Spusťte aplikační server příkazem npm run serve.");
    }
    if (!r.ok) {
      if (r.status === 401) {
        $("#login-panel").hidden = false;
        $("#admin-content").hidden = true;
        $("#logout").hidden = true;
      }
      throw Error(result.error || "Požadavek se nepodařilo dokončit.");
    }
    return result;
  }
  function status(msg, error = false) {
    $("#admin-status").textContent = msg;
    $("#admin-status").className = error ? "notice error" : "muted";
  }
  const orderTable = (items) =>
    `<div class="table-wrap"><table><thead><tr><th>Objednávka</th><th>Zákazník</th><th>Celkem</th><th>Stav</th><th>Detail</th></tr></thead><tbody>${items.map((o) => `<tr><td>${esc(o.number)}<br><small>${new Date(o.created * 1000).toLocaleString("cs-CZ", { timeZone: "Europe/Prague" })}</small></td><td>${esc(o.customer.name)}</td><td>${money(o.total)}</td><td><span class="status-label">${labels[o.status]}</span></td><td><button class="inline-button" data-order="${esc(o.number)}">Zobrazit →</button></td></tr>`).join("")}</tbody></table></div>`;
  function render() {
    const el = $("#admin-content");
    document
      .querySelectorAll("[data-tab]")
      .forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    if (tab === "overview")
      el.innerHTML = `<div class="stats"><div class="stat">Viditelné produkty<strong>${products.filter((p) => p.active).length}</strong></div><div class="stat">Zkušební objednávky<strong>${orders.length}</strong></div><div class="stat">Nové objednávky<strong>${orders.filter((o) => o.status === "nova").length}</strong></div></div><div class="notice">Zkušební provoz. Objednávky nejsou placené ani expedované. Produkty a změny cen se ukládají do databáze a zobrazují v obchodě.</div><div class="admin-toolbar"><h2>Poslední objednávky</h2></div>${orders.length ? orderTable(orders.slice(0, 5)) : '<div class="panel"><p>První objednávky najdete právě tady.</p><a href="/obchod.html" class="text-link">Vyzkoušet nákup →</a></div>'}`;
    if (tab === "products")
      el.innerHTML = `<div class="admin-toolbar"><h2>Vaše produkty</h2><button class="button" id="new-product">＋ Přidat svíčku</button></div><div class="table-wrap"><table><thead><tr><th>Produkt</th><th>Cena</th><th>Viditelnost</th><th></th></tr></thead><tbody>${products.map((p) => `<tr><td>${esc(p.name)}<br><small class="muted">${esc(p.id)}</small></td><td>${money(p.price)}</td><td>${p.active ? "V nabídce" : "Skryto"}</td><td><button class="inline-button" data-edit="${esc(p.id)}">Upravit →</button></td></tr>`).join("")}</tbody></table></div><div id="product-editor"></div>`;
    if (tab === "orders")
      el.innerHTML = `<div class="admin-toolbar"><h2>Objednávky</h2><button class="inline-button" id="refresh">Obnovit</button></div>${orders.length ? orderTable(orders) : '<div class="panel">Zatím tu nejsou žádné zkušební objednávky.</div>'}`;
  }
  async function load() {
    [products, orders] = await Promise.all([api("products"), api("orders")]);
    $("#login-panel").hidden = true;
    $("#admin-content").hidden = false;
    $("#logout").hidden = false;
    render();
  }
  function editor(id) {
    const p = products.find((p) => p.id === id) || {
      id: "",
      name: "",
      subtitle: "",
      price: null,
      notes: "",
      description: "",
      active: false,
    };
    $("#product-editor").innerHTML =
      `<section class="panel"><h2>${id ? "Upravit produkt" : "Nová svíčka"}</h2><form id="product-form"><label>ID pro adresu produktu<input name="id" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="70" value="${esc(p.id)}" ${id ? "readonly" : ""} required placeholder="napriklad-vanilka"></label><label>Název<input name="name" value="${esc(p.name)}" maxlength="120" required></label><label>Krátký podtitul<input name="subtitle" value="${esc(p.subtitle)}" maxlength="200"></label>${p.variants?.length ? `<label>Cena malé v Kč<input name="small_price" type="number" min="1" max="100000" value="${p.variants[0].price}" required></label><label>Cena velké v Kč<input name="large_price" type="number" min="1" max="100000" value="${p.variants[1].price}" required></label><label class="check"><input type="checkbox" name="price_provisional" ${p.price_provisional?'checked':''}>Pracovní ceny</label>` : ''}<label ${p.variants?.length?'hidden':''}>Cena v Kč<input name="price" type="number" min="1" max="100000" step="1" value="${p.price ?? ""}" placeholder="Zatím nestanovena"></label><label>Vonné tóny<input name="notes" value="${esc(p.notes)}" maxlength="200"></label><label>Popis<textarea name="description" rows="4" maxlength="3000">${esc(p.description)}</textarea></label><label class="check"><input name="active" type="checkbox" ${p.active ? "checked" : ""}>Zobrazit produkt v e-shopu</label><p class="muted">Fotografie jsou zatím společné ilustrační. Vlastní fotografie zapojíme v další fázi.</p><button class="button">Uložit produkt →</button><p id="editor-status" role="status"></p></form></section>`;
    $("#product-editor").scrollIntoView({ behavior: "smooth", block: "start" });
    $("#product-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const button = f.querySelector("button");
      button.disabled = true;
      try {
        const fields = Object.fromEntries(new FormData(f));
        await api("products", {
          ...fields,
          price: fields.price.trim() === "" ? null : Number(fields.price),
          active: f.elements.active.checked,
          ...(f.elements.small_price ? {variants: [{id:'mala',price:Number(f.elements.small_price.value)},{id:'velka',price:Number(f.elements.large_price.value)}],price_provisional:f.elements.price_provisional.checked} : {}),
        });
        await load();
        status("Produkt je uložený a nabídka aktualizovaná.");
      } catch (err) {
        $("#editor-status").textContent = err.message;
        button.disabled = false;
      }
    });
  }
  function showOrder(number) {
    const o = orders.find((o) => o.number === number);
    if (!o) return;
    $("#admin-content").innerHTML =
      `<button id="back" class="text-link">← Zpět na objednávky</button><section class="panel"><h2>${esc(o.number)}</h2><p class="notice">Zkušební objednávka. Žádná platba neproběhla.</p><p>${esc(o.customer.name)}<br>${esc(o.customer.email)}<br>${esc(o.customer.phone)}</p><p>Doprava: ${o.shipping === "pickup" ? "Osobní odběr" : "Zásilkovna"}<br>${esc(o.pickup_point)}</p><div class="table-wrap"><table><thead><tr><th>Produkt</th><th>Kusy</th><th>Cena za kus</th></tr></thead><tbody>${o.items.map((i) => `<tr><td>${esc(i.name)}</td><td>${i.qty}</td><td>${money(i.price)}</td></tr>`).join("")}</tbody></table></div><p style="margin-top:20px">Doprava: ${money(o.shipping_price)} · Celkem: <strong>${money(o.total)}</strong></p><p>Poznámka: ${esc(o.note || "—")}</p><form id="status-form"><label>Stav objednávky<select name="status">${Object.entries(
        labels,
      )
        .map(
          ([k, v]) =>
            `<option value="${k}" ${o.status === k ? "selected" : ""}>${v}</option>`,
        )
        .join(
          "",
        )}</select></label><button class="button">Uložit stav →</button></form></section>`;
    $("#back").onclick = () => {
      tab = "orders";
      render();
    };
    $("#status-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await api("order-status", {
          number,
          status: e.currentTarget.elements.status.value,
        });
        await load();
        status("Stav objednávky byl uložen.");
      } catch (err) {
        status(err.message, true);
      }
    });
  }
  document.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => {
      tab = b.dataset.tab;
      if (!$("#admin-content").hidden) render();
    }),
  );
  $("#admin-content").addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit]");
    const order = e.target.closest("[data-order]");
    if (edit) editor(edit.dataset.edit);
    if (order) showOrder(order.dataset.order);
    if (e.target.id === "new-product") editor();
    if (e.target.id === "refresh")
      load().catch((err) => status(err.message, true));
  });
  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const b = f.querySelector("button");
    b.disabled = true;
    try {
      await api("login", { password: f.elements.password.value });
      f.reset();
      await load();
      status("Přihlášeno. Vítejte v administraci.");
    } catch (err) {
      status(err.message, true);
    } finally {
      b.disabled = false;
    }
  });
  $("#logout").addEventListener("click", async () => {
    try {
      await api("logout", {});
      products = [];
      orders = [];
      $("#admin-content").innerHTML = "";
      $("#admin-content").hidden = true;
      $("#login-panel").hidden = false;
      $("#logout").hidden = true;
      status("Jste odhlášeni.");
    } catch (err) {
      status(err.message, true);
    }
  });
  api("session")
    .then((s) => {
      if (s.authenticated) return load();
      if (!s.configured)
        status(
          "Pro přihlášení nastavte na serveru proměnnou LOOMOS_ADMIN_PASSWORD a server restartujte. Heslo nepatří do zdrojového kódu.",
          true,
        );
    })
    .catch((err) => status(err.message, true));
})();
