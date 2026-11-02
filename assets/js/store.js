import { faqs, packeta } from "./site.mjs";
import {
  money,
  esc,
  productCard,
  renderHeader,
  renderFooter,
  renderProductDetail,
  renderFAQ,
} from "./ui.mjs";
import { validateCatalog, readCart } from "./catalog.mjs";
("use strict");
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const page = document.body.dataset.page;
  const storageKey = "loomos_cart_v3";
  let cart = [];
  try {
    cart = readCart(
      localStorage.getItem(storageKey) ||
        localStorage.getItem("loomos_cart_v2"),
    );
  } catch {
    /* Storage can be disabled. */
  }
  const staticSite =
    document.querySelector('meta[name="loomos-runtime"]')?.content === "static";
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
  const lineKey = (i) => i.id + "::" + (i.variant || "mala");
  const lines = () =>
    cart
      .map((i) => {
        const p = products.find((p) => p.id === i.id);
        if (!p) return { ...i, product: null };
        const v = p.variants?.find((v) => v.id === (i.variant || "mala"));
        return {
          ...i,
          variant: v?.id || "",
          product: {
            ...p,
            name: p.name + (v ? " — " + v.name : ""),
            price: v?.price ?? p.price,
          },
        };
      })
      .filter((i) => i.product);
  const subtotal = () =>
    lines().reduce((s, i) => s + i.qty * i.product.price, 0);
  if (!$("#site-header").children.length)
    $("#site-header").innerHTML = renderHeader(page);
  if (!$("#site-footer").children.length)
    $("#site-footer").innerHTML = renderFooter();
  if ($("#otazky") && !$("#otazky").children.length)
    $("#otazky").innerHTML = renderFAQ(faqs);
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
    const product = products.find((p) => p.id === id);
    if (
      !product ||
      !Number.isInteger(product.price) ||
      (product.variants?.length &&
        !product.variants.some((v) => v.id === variant))
    )
      return;
    const item = cart.find(
      (i) => i.id === id && (i.variant || "mala") === variant,
    );
    if (item) item.qty = Math.min(20, item.qty + qty);
    else cart.push({ id, variant, qty: Math.min(20, qty) });
    persist();
    toast("Máte přidáno. Vaše vůně čeká v košíku.");
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-add]");
    if (b)
      add(
        b.dataset.add,
        Number($("#detail-quantity")?.textContent || 1),
        b.closest(".product-card")?.querySelector("[data-card-size]")?.value ||
          $("#size-choice")?.value ||
          "mala",
      );
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
          `<article class="cart-item"><a href="/produkty/${encodeURIComponent(i.id)}.html"><img class="cart-thumb" src="/assets/img/candle-480.webp" width="90" height="105" loading="lazy" decoding="async" alt="${esc(i.product.name)}"></a><div><h3><a href="/produkty/${encodeURIComponent(i.id)}.html">${esc(i.product.name)}</a></h3><p>Sójová svíčka · dřevěný knot</p><div class="quantity"><button data-qty="${esc(lineKey(i))}" data-delta="-1" aria-label="Ubrat ${esc(i.product.name)}" ${i.qty === 1 ? "disabled" : ""}>−</button><output>${i.qty}</output><button data-qty="${esc(lineKey(i))}" data-delta="1" aria-label="Přidat ${esc(i.product.name)}" ${i.qty === 20 ? "disabled" : ""}>＋</button></div></div><div><span class="price">${money(i.qty * i.product.price)}</span><button class="remove" data-remove="${esc(lineKey(i))}" aria-label="Odebrat ${esc(i.product.name)}">Odebrat</button></div></article>`,
      )
      .join(
        "",
      )}<a class="text-link spaced-top" href="/obchod.html">← Zpět ke svíčkám</a></section>${summary()}</div>`;
  }
  $("#cart-content")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-qty],[data-remove]");
    if (!b) return;
    if (b.dataset.remove)
      cart = cart.filter((i) => lineKey(i) !== b.dataset.remove);
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
    $("#product-detail").innerHTML = renderProductDetail(p);
    const size = new URLSearchParams(location.search).get("velikost");
    if (size && p.variants?.some((v) => v.id === size)) {
      $("#size-choice").value = size;
      $("#detail-price").textContent = money(
        p.variants.find((v) => v.id === size).price,
      );
    }
  }
  document.addEventListener("change", (e) => {
    if (e.target.matches("[data-card-size]")) {
      const p = products.find((p) => p.id === e.target.dataset.cardSize);
      const v = p?.variants?.find((v) => v.id === e.target.value);
      if (v)
        e.target
          .closest(".product-card")
          .querySelector("[data-card-price]").textContent = money(v.price);
    }
    if (e.target.id === "size-choice") {
      const p = products.find((p) => p.id === document.body.dataset.product);
      const v = p?.variants?.find((v) => v.id === e.target.value);
      if (v) $("#detail-price").textContent = money(v.price);
    }
  });
  function renderCheckout() {
    const el = $("#checkout-content");
    if (!lines().length) {
      el.innerHTML =
        '<div class="empty-state"><h2>Nejdřív si vyberte svou vůni.</h2><a class="button" href="/obchod.html">Do obchodu →</a></div>';
      return;
    }
    if (staticSite) {
      el.innerHTML = `<div class="checkout-layout"><section class="panel"><h2>Objednávky zatím připravujeme.</h2><p>Košík si můžete vyzkoušet. Platby a odesílání objednávek spustíme po dokončení e-shopu.</p><a class="button" href="mailto:info@loomos.cz">Máte dotaz? Napište nám →</a></section>${summary(true)}</div>`;
      return;
    }
    el.innerHTML = `<div class="checkout-layout"><form id="checkout-form" class="checkout-form"><h2>01 / Kontakt</h2><div class="form-grid"><label>Jméno a příjmení<input name="name" required autocomplete="name" maxlength="120"></label><label>E-mail<input name="email" type="email" required autocomplete="email" maxlength="200"></label><label class="full">Telefon<input name="phone" type="tel" required autocomplete="tel" maxlength="40"></label></div><h2>02 / Doprava</h2><label class="radio"><input type="radio" name="shipping" value="pickup" checked>Osobní odběr<span>Zdarma</span></label><label class="radio"><input type="radio" name="shipping" value="zasilkovna">Zásilkovna — výdejní místo<span>${money(79)}</span></label><div id="pickup-address" class="notice">Přesné místo a čas osobního odběru domluvíme individuálně.</div><div class="form-grid" id="delivery-fields" hidden><div class="full packeta-pick"><button type="button" class="inline-button" id="packeta-pick">Vybrat výdejní místo na mapě →</button><p id="packeta-selected" class="muted" aria-live="polite"></p></div><input type="hidden" name="packeta_point_id"><label class="full">Výdejní místo<input name="pickup_point" maxlength="200" placeholder="Vyberte na mapě nebo napište název"></label></div><h2>03 / Poznámka</h2><label class="muted">Je něco, co bychom měli vědět?<textarea name="note" rows="3" maxlength="1000"></textarea></label><p class="notice">Platební bránu připravujeme. Tímto krokem uložíte pouze zkušební objednávku, bez platby a expedice.</p><label class="check"><input type="checkbox" name="test_ack" required>Rozumím, že jde o zkušební objednávku bez platby a doručení.</label><p id="checkout-error" class="error" role="alert"></p><button id="place-order" class="button">Uložit zkušební objednávku →</button></form>${summary(true)}</div>`;
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
    $("#packeta-pick").addEventListener("click", async () => {
      try {
        const Packeta = await loadPacketa();
        Packeta.Widget.pick(
          packeta.apiKey,
          (point) => {
            if (!point || !/^\d{1,10}$/.test(String(point.id))) return;
            const label = String(
              point.formatedValue || point.name || point.place || "",
            ).slice(0, 200);
            form.elements.packeta_point_id.value = String(point.id);
            form.elements.pickup_point.value = label;
            $("#packeta-selected").textContent = "Vybráno: " + label;
          },
          { country: "cz", language: "cs" },
        );
      } catch {
        $("#packeta-selected").textContent =
          "Mapu výdejních míst se nepodařilo načíst. Napište prosím název výdejního místa.";
      }
    });
    form.elements.pickup_point.addEventListener("input", () => {
      form.elements.packeta_point_id.value = "";
      $("#packeta-selected").textContent = "";
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
            items: lines().map((i) => ({
              id: i.id,
              variant: i.variant,
              qty: i.qty,
            })),
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
            ? "Objednávky nyní nelze odeslat. Zkuste to prosím později."
            : err.message;
        btn.disabled = false;
      }
    });
  }
  async function init() {
    try {
      let res = await fetch(
        staticSite ? "/data/products.json" : "/api/products",
      );
      if (!staticSite && res.status === 404)
        res = await fetch("/data/products.json");
      if (
        !res.ok ||
        !(res.headers.get("content-type") || "").includes("application/json")
      )
        throw Error("Nabídka není dostupná.");
      products = validateCatalog(await res.json()).filter((p) => p.active);
      const valid = new Set(
        products.filter((p) => Number.isInteger(p.price)).map((p) => p.id),
      );
      if (
        cart.some(
          (i) =>
            !valid.has(i.id) ||
            (products.find((p) => p.id === i.id)?.variants?.length &&
              !products
                .find((p) => p.id === i.id)
                .variants.some((v) => v.id === (i.variant || "mala"))),
        )
      ) {
        cart = cart.filter((i) => {
          const p = products.find((p) => p.id === i.id);
          return (
            valid.has(i.id) &&
            (!p.variants?.length ||
              p.variants.some((v) => v.id === (i.variant || "mala")))
          );
        });
        persist();
        toast("Košík byl aktualizován podle aktuální nabídky.");
      }
      if (page === "home")
        $("#home-products").innerHTML = products.map(productCard).join("");
      if (page === "shop") {
        const render = () => {
          let list = [...products];
          const sort = $("#sort").value;
          if (sort === "price-up")
            list.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
          if (sort === "price-down")
            list.sort(
              (a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity),
            );
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
