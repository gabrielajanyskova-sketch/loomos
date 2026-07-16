(() => {
  'use strict';

  const STORAGE_KEY = 'loomos_cart_v2';
  const DISCOUNT_KEY = 'loomos_discount';
  const ORDER_EMAIL = 'info@loomos.cz';

  const SHIPPING = {
    pickup: { label: 'Osobní odběr (Starojická Lhota)', price: 0 },
    zasilkovna: { label: 'Zásilkovna', price: 79 },
  };

  // Klientský fallback slevových kódů — bez backendu, uprav/doplň dle potřeby.
  const DISCOUNT_CODES = {
    LOOMOS10: { type: 'percent', value: 10 },
  };

  const readCart = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  };

  const writeCart = (cart) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    renderDrawer();
    renderCheckoutPage();
  };

  const addToCart = (id, name, price, qty) => {
    qty = Math.max(1, parseInt(qty, 10) || 1);
    const cart = readCart();
    const item = cart.find((i) => i.id === id);
    if (item) {
      item.qty += qty;
    } else {
      cart.push({ id, name, price, qty });
    }
    writeCart(cart);
    openDrawer();
  };

  const removeFromCart = (id) => {
    writeCart(readCart().filter((i) => i.id !== id));
  };

  const setQty = (id, qty) => {
    const cart = readCart();
    const item = cart.find((i) => i.id === id);
    if (!item) return;
    if (qty < 1) {
      removeFromCart(id);
      return;
    }
    item.qty = qty;
    writeCart(cart);
  };

  const cartCount = (cart) => cart.reduce((sum, i) => sum + i.qty, 0);
  const cartSubtotal = (cart) => cart.reduce((sum, i) => sum + i.qty * i.price, 0);
  const formatPrice = (n) => `${n.toLocaleString('cs-CZ')} Kč`;

  const getDiscountCode = () => (localStorage.getItem(DISCOUNT_KEY) || '').toUpperCase();
  const setDiscountCode = (code) => {
    if (code) {
      localStorage.setItem(DISCOUNT_KEY, code.toUpperCase());
    } else {
      localStorage.removeItem(DISCOUNT_KEY);
    }
    renderCheckoutPage();
  };
  const discountAmount = (subtotal) => {
    const entry = DISCOUNT_CODES[getDiscountCode()];
    if (!entry) return 0;
    if (entry.type === 'percent') return Math.round((subtotal * entry.value) / 100);
    return Math.min(entry.value, subtotal);
  };

  /* ---------- Quantity steppers (product cards & detail pages) ---------- */
  const MAX_QTY = 20;

  document.querySelectorAll('.qty-stepper').forEach((stepper) => {
    const valueEl = stepper.querySelector('.qty-value');
    if (!valueEl) return;
    stepper.querySelectorAll('.qty-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        let qty = parseInt(valueEl.textContent, 10) || 1;
        qty = btn.dataset.action === 'increase' ? qty + 1 : qty - 1;
        qty = Math.min(MAX_QTY, Math.max(1, qty));
        valueEl.textContent = String(qty);
      });
    });
  });

  document.querySelectorAll('.btn-add-cart').forEach((btn) => {
    btn.addEventListener('click', () => {
      const product = btn.closest('[data-id]');
      if (!product) return;
      const { id, name, price } = product.dataset;
      const qtyEl = product.querySelector('.qty-value');
      const qty = qtyEl ? parseInt(qtyEl.textContent, 10) || 1 : 1;
      addToCart(id, name, Number(price), qty);
      if (qtyEl) qtyEl.textContent = '1';
    });
  });

  /* ---------- Shared cart item row (drawer + full page) ---------- */
  const buildCartItemEl = (item) => {
    const li = document.createElement('li');
    li.className = 'cart-item';
    li.innerHTML = `
      <div class="cart-item-info">
        <span class="cart-item-name">${item.name}</span>
        <span class="cart-item-price">${formatPrice(item.price)} / ks</span>
      </div>
      <div class="cart-item-controls">
        <div class="qty-stepper">
          <button type="button" class="qty-btn" data-action="dec" aria-label="Ubrat kus">−</button>
          <span class="qty-value">${item.qty}</span>
          <button type="button" class="qty-btn" data-action="inc" aria-label="Přidat kus">+</button>
        </div>
        <button type="button" class="cart-remove-btn" aria-label="Odebrat z košíku">×</button>
      </div>`;
    li.querySelector('[data-action="dec"]').addEventListener('click', () => setQty(item.id, item.qty - 1));
    li.querySelector('[data-action="inc"]').addEventListener('click', () => setQty(item.id, item.qty + 1));
    li.querySelector('.cart-remove-btn').addEventListener('click', () => removeFromCart(item.id));
    return li;
  };

  const renderCartItems = (listEl, cart) => {
    listEl.innerHTML = '';
    cart.forEach((item) => listEl.appendChild(buildCartItemEl(item)));
  };

  /* ---------- Drawer ---------- */
  const cartCountEl = document.getElementById('cartCount');

  const renderDrawer = () => {
    const cart = readCart();

    if (cartCountEl) {
      const count = cartCount(cart);
      cartCountEl.textContent = String(count);
      const visible = count > 0;
      cartCountEl.classList.toggle('opacity-0', !visible);
      cartCountEl.classList.toggle('scale-0', !visible);
      cartCountEl.classList.toggle('opacity-100', visible);
      cartCountEl.classList.toggle('scale-100', visible);
    }

    const itemsEl = document.getElementById('cartPanelItems');
    if (!itemsEl) return;
    const emptyEl = document.getElementById('cartPanelEmpty');
    const footerEl = document.getElementById('cartPanelFooter');
    const totalEl = document.getElementById('cartPanelTotal');

    if (cart.length === 0) {
      itemsEl.innerHTML = '';
      if (emptyEl) emptyEl.hidden = false;
      if (footerEl) footerEl.hidden = true;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    if (footerEl) footerEl.hidden = false;
    renderCartItems(itemsEl, cart);
    if (totalEl) totalEl.textContent = formatPrice(cartSubtotal(cart));
  };

  const openDrawer = () => document.body.classList.add('cart-open');
  const closeDrawer = () => document.body.classList.remove('cart-open');

  const cartBtn = document.getElementById('cartBtn');
  const cartCloseBtn = document.getElementById('cartPanelCloseBtn');
  const cartOverlay = document.getElementById('cartOverlay');

  if (cartBtn) cartBtn.addEventListener('click', openDrawer);
  if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeDrawer);
  if (cartOverlay) cartOverlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  /* ---------- Full checkout page (kosik.html) ---------- */
  const selectedShippingKey = () => {
    const checked = document.querySelector('input[name="shipping"]:checked');
    return checked ? checked.value : 'pickup';
  };
  const selectedPaymentKey = () => {
    const checked = document.querySelector('input[name="payment"]:checked');
    return checked ? checked.value : 'transfer';
  };
  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };
  const valueOf = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };
  const billingDetails = () => ({
    name: `${valueOf('cFirstName')} ${valueOf('cLastName')}`.trim(),
    street: valueOf('cStreet'),
    zip: valueOf('cZip'),
    city: valueOf('cCity'),
    email: valueOf('cEmail'),
    phone: valueOf('cPhone'),
  });

  const renderCheckoutPage = () => {
    const pageRoot = document.getElementById('cartPage');
    if (!pageRoot) return;

    const cart = readCart();
    const empty = document.getElementById('cartPageEmpty');
    const content = document.getElementById('cartPageContent');

    if (cart.length === 0) {
      if (empty) empty.hidden = false;
      if (content) content.hidden = true;
      return;
    }
    if (empty) empty.hidden = true;
    if (content) content.hidden = false;

    const itemsEl = document.getElementById('cartPageItems');
    if (itemsEl) renderCartItems(itemsEl, cart);

    const subtotal = cartSubtotal(cart);
    const discount = discountAmount(subtotal);
    const shippingKey = selectedShippingKey();
    const shipping = SHIPPING[shippingKey] || SHIPPING.pickup;
    const total = Math.max(0, subtotal - discount) + shipping.price;

    const discountInput = document.getElementById('discountCode');
    const discountMsg = document.getElementById('discountMessage');
    const code = getDiscountCode();
    if (discountInput && !discountInput.value) discountInput.value = code;
    if (discountMsg) {
      if (code && DISCOUNT_CODES[code]) {
        discountMsg.hidden = false;
        discountMsg.textContent = `Kód ${code} uplatněn.`;
        discountMsg.className = 'discount-message discount-message--ok';
      } else if (code) {
        discountMsg.hidden = false;
        discountMsg.textContent = `Kód „${code}“ neplatí.`;
        discountMsg.className = 'discount-message discount-message--error';
      } else {
        discountMsg.hidden = true;
      }
    }

    setText('summarySubtotal', formatPrice(subtotal));
    const discountRow = document.getElementById('summaryDiscountRow');
    if (discountRow) discountRow.hidden = discount === 0;
    setText('summaryDiscount', `−${formatPrice(discount)}`);
    setText('summaryShipping', shipping.price === 0 ? 'Zdarma' : formatPrice(shipping.price));
    setText('summaryTotal', formatPrice(total));

    const cashOption = document.getElementById('paymentCashOption');
    if (cashOption) {
      const cashRadio = cashOption.querySelector('input[name="payment"]');
      if (shippingKey === 'zasilkovna') {
        cashOption.hidden = true;
        if (cashRadio && cashRadio.checked) {
          const transferRadio = document.querySelector('input[name="payment"][value="transfer"]');
          if (transferRadio) transferRadio.checked = true;
        }
      } else {
        cashOption.hidden = false;
      }
    }

    const addressFields = document.getElementById('addressFields');
    if (addressFields) addressFields.hidden = shippingKey !== 'zasilkovna';
  };

  const buildOrderMailto = () => {
    const cart = readCart();
    const subtotal = cartSubtotal(cart);
    const discount = discountAmount(subtotal);
    const shippingKey = selectedShippingKey();
    const shipping = SHIPPING[shippingKey] || SHIPPING.pickup;
    const paymentKey = selectedPaymentKey();
    const paymentLabel = paymentKey === 'cash' ? 'Hotově při osobním odběru' : 'Bankovním převodem';
    const total = Math.max(0, subtotal - discount) + shipping.price;

    const customer = billingDetails();
    const address = valueOf('cAddress');
    const note = valueOf('cNote');

    const lines = cart.map((i) => `- ${i.name} — ${i.qty} ks × ${formatPrice(i.price)}`);
    lines.push('');
    lines.push(`Mezisoučet: ${formatPrice(subtotal)}`);
    if (discount > 0) lines.push(`Sleva (${getDiscountCode()}): −${formatPrice(discount)}`);
    lines.push(`Doprava (${shipping.label}): ${shipping.price === 0 ? 'zdarma' : formatPrice(shipping.price)}`);
    lines.push(`Celkem: ${formatPrice(total)}`);
    lines.push('');
    lines.push(`Platba: ${paymentLabel}`);
    lines.push('');
    lines.push(`Jméno: ${customer.name}`);
    lines.push(`Adresa: ${customer.street}, ${customer.zip} ${customer.city}`);
    lines.push(`E-mail: ${customer.email}`);
    if (customer.phone) lines.push(`Telefon: ${customer.phone}`);
    if (shippingKey === 'zasilkovna' && address) lines.push(`Výdejní místo Zásilkovny: ${address}`);
    if (note) lines.push(`Poznámka: ${note}`);

    return `mailto:${ORDER_EMAIL}?subject=${encodeURIComponent('Objednávka z webu LOOMOS')}&body=${encodeURIComponent(lines.join('\n'))}`;
  };

  const showOrderSuccess = () => {
    const content = document.getElementById('cartPageContent');
    if (!content) return;
    content.innerHTML = `
      <div class="text-center max-w-xl mx-auto py-10">
        <p class="uppercase tracking-[0.4em] text-gold/80 text-xs mb-4">Děkujeme</p>
        <h2 class="font-serif text-3xl md:text-4xl mb-6">Objednávka odeslána</h2>
        <p class="text-ink/60 mb-8 leading-relaxed">
          Otevřel se váš e-mailový klient s kompletní objednávkou. Po odeslání zprávy se vám ozveme
          s potvrzením a platebními údaji.
        </p>
        <a href="obchod.html" class="btn-gold-outline">Zpět na produkty</a>
      </div>`;
  };

  document.addEventListener('DOMContentLoaded', () => {
    renderDrawer();
    renderCheckoutPage();

    const discountForm = document.getElementById('discountForm');
    if (discountForm) {
      discountForm.addEventListener('submit', (e) => {
        e.preventDefault();
        setDiscountCode(valueOf('discountCode').toUpperCase());
      });
    }

    document.querySelectorAll('input[name="shipping"], input[name="payment"]').forEach((input) => {
      input.addEventListener('change', renderCheckoutPage);
    });

    const submitOrderBtn = document.getElementById('submitOrderBtn');
    if (submitOrderBtn) {
      submitOrderBtn.addEventListener('click', () => {
        const form = document.getElementById('checkoutForm');
        if (form && !form.reportValidity()) return;
        window.location.href = buildOrderMailto();
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(DISCOUNT_KEY);
        showOrderSuccess();
        renderDrawer();
      });
    }
  });
})();
