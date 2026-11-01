"use strict";
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const money = (n) => n == null ? "Cena bude doplněna" :
    new Intl.NumberFormat("cs-CZ", {
      style: "currency",
      currency: "CZK",
      maximumFractionDigits: 0,
    }).format(n);
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
  const page = document.body.dataset.page;
  const storageKey = "loomos_cart_v3";
  let cart = [];
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || localStorage.getItem("loomos_cart_v2") || "[]");
    if (Array.isArray(saved))
      cart = saved.filter(
        (i) =>
          i &&
          typeof i.id === "string" &&
          Number.isInteger(i.qty) &&
          i.qty > 0 &&
          i.qty <= 20,
      );
  } catch {}
  let products = [];
  let toastTimer;
  const toast = (msg) => {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3500);
  };
  const persist = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {
      toast("Prohlížeč nepovoluje uložení košíku.");
    }
    updateCount();
  };
  const updateCount = () =>
    document.querySelectorAll(".cart-count").forEach((el) => {
      el.textContent = cart.reduce((s, i) => s + i.qty, 0);
    });
  const lineKey = i => i.id + '::' + (i.variant || 'mala');
  const lines = () =>
    cart
      .map(i => { const p = products.find(p => p.id === i.id); if(!p) return {...i, product:null}; const v = p.variants?.find(v => v.id === (i.variant || 'mala')); return {...i, variant: v?.id || '', product: {...p, name: p.name + (v ? ' — '+v.name : ''), price: v?.price ?? p.price}}; })
      .filter((i) => i.product);
  const subtotal = () =>
    lines().reduce((s, i) => s + i.qty * i.product.price, 0);
  const picture = (p, tag = "") =>
    `<a class="product-image" href="/produkty/${encodeURIComponent(p.id)}.html"><img src="/assets/img/candle-editorial.png" alt="${esc(p.name)} — ilustrační fotografie čirého skla s dřevěným knotem" loading="lazy">${tag ? `<span class="product-tag">${tag}</span>` : ""}<span class="photo-note">Ilustrační fotografie</span></a>`;
  const productCard = (p, i) =>
    `<article class="product-card">${picture(p, i === 0 ? "RUČNĚ VYROBENÉ" : "SÓJOVÁ SVÍČKA")}<div class="product-meta"><small>SÓJOVÝ VOSK · DŘEVĚNÝ KNOT</small><div class="product-title-row"><h3><a href="/produkty/${encodeURIComponent(p.id)}.html">${esc(p.name)}</a></h3><span class="price">${p.variants?.length ? "od " : ""}${money(p.price)}</span></div><p class="product-notes">${esc(p.notes)}</p><button class="add-button" data-add="${esc(p.id)}" ${p.price == null ? "disabled" : ""}>${p.price == null ? "Cenu připravujeme" : "Přidat do košíku"} <span>${p.price == null ? "" : "＋"}</span></button></div></article>`;
  $("#site-header").innerHTML =
    `<div class="announcement">RUČNĚ VYRÁBĚNÉ SÓJOVÉ SVÍČKY &nbsp; ✧ &nbsp; MALÉ RADOSTI OD LOOMOS</div><header class="site-header"><div class="container header-inner"><a href="/" class="brand brand-logo" aria-label="Loomos — úvodní stránka"><img src="/assets/img/loomos-logo-preview.png" alt="Loomos" width="90" height="80"></a><nav id="navigation" class="main-nav" aria-label="Hlavní navigace"><a href="/obchod.html" class="${["shop", "product"].includes(page) ? "active" : ""}">Svíčky</a><a href="/#dalsi-tvorba">Vůně do auta</a><a href="/#dalsi-tvorba">Tvorba na míru</a><a href="/#pribeh">Náš příběh</a></nav><div class="header-actions"><a class="cart-link" href="/kosik.html" aria-label="Zobrazit košík"><svg viewBox="0 0 24 26" aria-hidden="true"><path d="M4 8h16l1 16H3L4 8Z M8 9V6a4 4 0 0 1 8 0v3"/></svg><span>Košík</span><span class="cart-count">0</span></a><button class="menu-toggle" aria-expanded="false" aria-controls="navigation" aria-label="Otevřít menu">☰</button></div></div></header>`;
  $("#site-footer").innerHTML =
    `<footer class="site-footer"><div class="container"><div class="footer-grid"><div><a href="/" class="brand brand-logo"><img src="/assets/img/loomos-logo-preview.png" alt="Loomos" width="90" height="80"></a><p>Malé věci, které tvoří atmosféru.<br>Ručně vyráběné svíčky a prostor pro další nápady.</p></div><div><h3>Objevte LOOMOS</h3><a href="/obchod.html">Sójové svíčky</a><a href="/#dalsi-tvorba">Co připravujeme</a><a href="/velkoobchod.html">Spolupráce</a></div><div><h3>Jsme tu pro vás</h3><a href="mailto:info@loomos.cz">info@loomos.cz →</a><a href="/kosik.html">Váš košík</a><a href="/#pribeh">Náš příběh</a></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} LOOMOS. S péčí o každý detail.</span><span>Pracovní návrh e-shopu · ilustrační fotografie · <a href="/admin/">Administrace →</a></span></div></div></footer>`;
  updateCount();
  $(".menu-toggle").addEventListener("click", (e) => {
    const open = e.currentTarget.getAttribute("aria-expanded") !== "true";
    e.currentTarget.setAttribute("aria-expanded", String(open));
    $("#navigation").classList.toggle("open", open);
  });
  $("#navigation").addEventListener("click", (e) => {
    if (e.target.closest("a")) {
      $("#navigation").classList.remove("open");
      $(".menu-toggle").setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      $("#navigation").classList.remove("open");
      $(".menu-toggle").setAttribute("aria-expanded", "false");
    }
  });
  const add = (id, qty = 1, variant = "mala") => {
    if (!products.some((p) => p.id === id && Number.isInteger(p.price))) return;
    const item = cart.find((i) => i.id === id && (i.variant || "mala") === variant);
    if (item) item.qty = Math.min(20, item.qty + qty);
    else cart.push({ id, variant, qty: Math.min(20, qty) });
    persist();
    toast("Máte přidáno. Vaše vůně čeká v košíku.");
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-add]");
    if (b) add(b.dataset.add, Number($("#detail-quantity")?.textContent || 1), $("#size-choice")?.value || "mala");
    const q = e.target.closest("[data-detail-qty]");
    if (q) {
      const output = $("#detail-quantity");
      output.textContent = Math.max(
        1,
        Math.min(20, Number(output.textContent) + Number(q.dataset.detailQty)),
      );
    }
  });
  const summary = (checkout = false) =>
    `<aside class="summary"><h2>Vaše objednávka</h2>${
      checkout
        ? lines()
            .map(
              (i) =>
                `<div class="summary-row"><span>${esc(i.product.name)} × ${i.qty}</span><span>${money(i.product.price * i.qty)}</span></div>`,
            )
            .join("")
        : ""
    }<div class="summary-row"><span>Produkty</span><span>${money(subtotal())}</span></div><div class="summary-row"><span>Doprava</span><span id="shipping-price">${checkout ? "Zdarma" : "Dle výběru"}</span></div><div class="summary-row summary-total"><span>Celkem</span><span id="order-total">${money(subtotal())}</span></div>${checkout ? "" : `<a href="/pokladna.html" class="button">Pokračovat k údajům →</a><p class="muted">Dopravu si vyberete v dalším kroku. E-shop je ve zkušebním režimu.</p>`}</aside>`;
  function renderCart() {
    const el = $("#cart-content");
    if (!lines().length) {
      el.innerHTML =
        '<div class="empty-state"><span class="tiny-star">✧</span><h2>Vaše chvíle teprve čeká.</h2><p>Košík je zatím prázdný. Najděte si vůni, která vám sedne.</p><a class="button" href="/obchod.html">Prohlédnout svíčky →</a></div>';
      return;
    }
    el.innerHTML = `<div class="cart-layout"><section aria-label="Položky košíku">${lines()
      .map(
        (i) =>
          `<article class="cart-item"><a href="/produkty/${encodeURIComponent(i.id)}.html"><img class="cart-thumb" src="/assets/img/candle-editorial.png" alt="${esc(i.product.name)}"></a><div><h3><a href="/produkty/${encodeURIComponent(i.id)}.html">${esc(i.product.name)}</a></h3><p>Sójová svíčka · dřevěný knot</p><div class="quantity"><button data-qty="${esc(lineKey(i))}" data-delta="-1" aria-label="Ubrat ${esc(i.product.name)}" ${i.qty === 1 ? "disabled" : ""}>−</button><output>${i.qty}</output><button data-qty="${esc(lineKey(i))}" data-delta="1" aria-label="Přidat ${esc(i.product.name)}" ${i.qty === 20 ? "disabled" : ""}>＋</button></div></div><div><span class="price">${money(i.qty * i.product.price)}</span><button class="remove" data-remove="${esc(lineKey(i))}" aria-label="Odebrat ${esc(i.product.name)}">Odebrat</button></div></article>`,
      )
      .join(
        "",
      )}<a class="text-link" href="/obchod.html" style="margin-top:25px">← Zpět ke svíčkám</a></section>${summary()}</div>`;
  }
  $("#cart-content")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-qty],[data-remove]");
    if (!b) return;
    if (b.dataset.remove) cart = cart.filter((i) => lineKey(i) !== b.dataset.remove);
    else {
      const i = cart.find((i) => lineKey(i) === b.dataset.qty);
      if (i) i.qty = Math.max(1, Math.min(20, i.qty + Number(b.dataset.delta)));
    }
    persist();
    renderCart();
  });
  function renderProduct() {
    const id = document.body.dataset.product;
    const p = products.find((p) => p.id === id);
    if (!p) {
      $("#product-detail").innerHTML =
        '<div class="empty-state"><h2>Tahle vůně právě není v nabídce.</h2><a class="button" href="/obchod.html">Zpět do obchodu</a></div>';
      return;
    }
    document.title = p.name + " — LOOMOS";
    $("#product-breadcrumb").textContent = p.name;
    $("#product-detail").innerHTML =
      `<div class="detail-grid"><div>${picture(p, "RUČNĚ VYROBENÉ")}</div><section class="detail-copy"><div class="eyebrow">SÓJOVÁ SVÍČKA · LOOMOS</div><h1>${esc(p.name)}</h1><p class="lead">${esc(p.subtitle)}</p><p>${esc(p.description)}</p>${p.variants?.length ? `<label class="size-label">Velikost svíčky<select id="size-choice">${p.variants.map(v=>`<option value="${esc(v.id)}">${esc(v.name)} — ${money(v.price)}</option>`).join('')}</select></label>` : ''}<span class="price" id="detail-price">${money(p.variants?.[0]?.price ?? p.price)}</span>${p.price_provisional ? '<p class="muted">Pracovní ceny — finální cenu a objem ještě upřesníme.</p>' : ''}<div class="buy-row"><div class="quantity"><button data-detail-qty="-1" aria-label="Ubrat kus">−</button><output id="detail-quantity">1</output><button data-detail-qty="1" aria-label="Přidat kus">＋</button></div><button class="button" data-add="${esc(p.id)}" ${p.price == null ? "disabled" : ""}>${p.price == null ? "Cenu připravujeme" : "Přidat do košíku ＋"}</button></div><div class="detail-facts"><span>✧ Ruční výroba</span><span>◒ Sójový vosk</span><span>⌁ Oleje z Anglie bez ftalátů</span><span>♧ Dřevěný knot · čiré sklo</span></div><p><strong>Vonné tóny</strong><br>${esc(p.notes)}</p><div class="detail-notice">Malý rituál, velká radost. Svíčku pokládejte na nehořlavý povrch a nenechávejte ji hořet bez dozoru. Fotografie je ilustrační.</div></section></div>`;
  }
  document.addEventListener('change', e => { if(e.target.id === 'size-choice') { const p=products.find(p=>p.id===document.body.dataset.product); const v=p?.variants?.find(v=>v.id===e.target.value); if(v) $('#detail-price').textContent=money(v.price); } });
  function renderCheckout() {
    const el = $("#checkout-content");
    if (!lines().length) {
      el.innerHTML =
        '<div class="empty-state"><h2>Nejdřív si vyberte svou vůni.</h2><a class="button" href="/obchod.html">Do obchodu →</a></div>';
      return;
    }
    el.innerHTML = `<div class="checkout-layout"><form id="checkout-form" class="checkout-form"><h2>01 / Kontakt</h2><div class="form-grid"><label>Jméno a příjmení<input name="name" required autocomplete="name" maxlength="120"></label><label>E-mail<input name="email" type="email" required autocomplete="email" maxlength="200"></label><label class="full">Telefon<input name="phone" type="tel" required autocomplete="tel" maxlength="40"></label></div><h2>02 / Doprava</h2><label class="radio"><input type="radio" name="shipping" value="pickup" checked>Osobní odběr<span>Zdarma</span></label><label class="radio"><input type="radio" name="shipping" value="zasilkovna">Zásilkovna — výdejní místo<span>${money(79)}</span></label><div id="pickup-address" class="notice">Přesné místo a čas osobního odběru domluvíme individuálně.</div><div class="form-grid" id="delivery-fields" hidden><label class="full">Název nebo ID výdejního místa<input name="pickup_point" maxlength="200" placeholder="Zatím ruční výběr výdejního místa"></label></div><h2>03 / Poznámka</h2><label class="muted">Je něco, co bychom měli vědět?<textarea name="note" rows="3" maxlength="1000"></textarea></label><p class="notice">Platební bránu připravujeme. Tímto krokem uložíte pouze zkušební objednávku, bez platby a expedice.</p><label class="check"><input type="checkbox" name="test_ack" required>Rozumím, že jde o zkušební objednávku bez platby a doručení.</label><p id="checkout-error" class="error" role="alert"></p><button id="place-order" class="button">Uložit zkušební objednávku →</button></form>${summary(true)}</div>`;
    const form = $("#checkout-form");
    form.addEventListener("change", () => {
      const shipping = form.elements.shipping.value;
      $("#shipping-price").textContent =
        shipping === "pickup" ? "Zdarma" : money(79);
      $("#order-total").textContent = money(
        subtotal() + (shipping === "pickup" ? 0 : 79),
      );
      $("#delivery-fields").hidden = shipping !== "zasilkovna";
      $("#pickup-address").hidden = shipping !== "pickup";
      form.elements.pickup_point.required = shipping === "zasilkovna";
    });
    let key = crypto.randomUUID();
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const btn = $("#place-order");
      btn.disabled = true;
      $("#checkout-error").textContent = "";
      try {
        const f = Object.fromEntries(new FormData(form));
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...f,
            items: lines().map((i) => ({ id: i.id, variant: i.variant, qty: i.qty })),
            request_id: key,
          }),
        });
        const result = await res.json();
        if (!res.ok)
          throw Error(result.error || "Objednávku se nepodařilo uložit.");
        cart = [];
        persist();
        el.innerHTML = `<div class="success-panel"><span class="tiny-star">✧</span><h2>Zkušební objednávka je uložená.</h2><p>Číslo objednávky: <strong>${esc(result.number)}</strong></p><p>Najdete ji v administraci. Neproběhla platba ani odeslání potvrzovacího e-mailu.</p><a href="/obchod.html" class="button">Zpět ke svíčkám →</a></div>`;
        el.scrollIntoView({ behavior: "smooth" });
      } catch (err) {
        $("#checkout-error").textContent =
          err instanceof SyntaxError
            ? "Pro objednávky spusťte aplikační server: npm run serve."
            : err.message;
        btn.disabled = false;
      }
    });
  }
  async function init() {
    try {
      let res = await fetch("/api/products");
      if (
        !res.ok ||
        !(res.headers.get("content-type") || "").includes("application/json")
      )
        res = await fetch("/data/products.json");
      if (!res.ok) throw Error();
      products = (await res.json()).filter((p) => p.active);
      const valid = new Set(products.filter(p => Number.isInteger(p.price)).map((p) => p.id));
      if (cart.some((i) => !valid.has(i.id))) {
        cart = cart.filter((i) => valid.has(i.id));
        persist();
        toast("Košík byl aktualizován podle aktuální nabídky.");
      }
      if (page === "home")
        $("#home-products").innerHTML = products

          .map(productCard)
          .join("");
      if (page === "shop") {
        const render = () => {
          let list = [...products];
          const sort = $("#sort").value;
          if (sort === "price-up") list.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
          if (sort === "price-down") list.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
          if (sort === "name")
            list.sort((a, b) => a.name.localeCompare(b.name, "cs"));
          $("#shop-products").innerHTML = list.length
            ? list.map(productCard).join("")
            : "<p>Nové vůně právě připravujeme.</p>";
          $("#product-count").textContent =
            `${list.length} vůně ve vaší nabídce`;
        };
        $("#sort").addEventListener("change", render);
        render();
      }
      if (page === "product") renderProduct();
      if (page === "cart") renderCart();
      if (page === "checkout") renderCheckout();
    } catch {
      const target =
        $("#home-products") ||
        $("#shop-products") ||
        $("#product-detail") ||
        $("#cart-content") ||
        $("#checkout-content");
      if (target)
        target.innerHTML =
          '<p class="notice">Nabídku se nepodařilo načíst. Zkuste stránku obnovit.</p>';
    }
  }
  init();
})();
