(() => {
  'use strict';

  /* ---------- Navbar scroll state ---------- */
  const navbar = document.getElementById('navbar');
  const onScroll = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile menu ---------- */
  const menuBtn = document.getElementById('menuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  menuBtn.addEventListener('click', () => {
    const isHidden = mobileMenu.classList.contains('hidden');
    mobileMenu.classList.toggle('hidden', !isHidden);
    mobileMenu.classList.toggle('flex', isHidden);
  });
  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileMenu.classList.add('hidden');
      mobileMenu.classList.remove('flex');
    });
  });

  /* ---------- Reveal on scroll ---------- */
  const revealEls = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  revealEls.forEach((el) => io.observe(el));

  /* ---------- Cart (persisted in localStorage) ---------- */
  const CART_KEY = 'loomos_cart_v1';

  const readCart = () => {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || {};
    } catch {
      return {};
    }
  };

  const writeCart = (cart) => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  };

  const cartTotalQty = (cart) =>
    Object.values(cart).reduce((sum, item) => sum + item.qty, 0);

  const addToCart = (id, name, price, qty) => {
    const cart = readCart();
    if (cart[id]) {
      cart[id].qty += qty;
    } else {
      cart[id] = { name, price, qty };
    }
    writeCart(cart);
    renderCartBadge();
  };

  const cartCountEl = document.getElementById('cartCount');
  const renderCartBadge = () => {
    const total = cartTotalQty(readCart());
    cartCountEl.textContent = String(total);
    const visible = total > 0;
    cartCountEl.classList.toggle('opacity-0', !visible);
    cartCountEl.classList.toggle('scale-0', !visible);
    cartCountEl.classList.toggle('opacity-100', visible);
    cartCountEl.classList.toggle('scale-100', visible);
  };
  renderCartBadge();

  /* ---------- Toast ---------- */
  const toast = document.getElementById('toast');
  const toastText = document.getElementById('toastText');
  let toastTimer = null;

  const showToast = (text) => {
    toastText.textContent = text;
    toast.classList.remove('translate-y-24', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.add('translate-y-24', 'opacity-0');
      toast.classList.remove('translate-y-0', 'opacity-100');
    }, 2600);
  };

  /* ---------- Quantity steppers ---------- */
  const MAX_QTY = 20;

  document.querySelectorAll('.qty-stepper').forEach((stepper) => {
    const valueEl = stepper.querySelector('.qty-value');
    stepper.querySelectorAll('.qty-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        let qty = parseInt(valueEl.textContent, 10) || 1;
        qty = btn.dataset.action === 'increase' ? qty + 1 : qty - 1;
        qty = Math.min(MAX_QTY, Math.max(1, qty));
        valueEl.textContent = String(qty);
      });
    });
  });

  /* ---------- Add to cart buttons ---------- */
  document.querySelectorAll('.btn-add-cart').forEach((btn) => {
    btn.addEventListener('click', () => {
      const product = btn.closest('[data-id]');
      if (!product) return;
      const { id, name, price } = product.dataset;
      const qtyEl = product.querySelector('.qty-value');
      const qty = qtyEl ? parseInt(qtyEl.textContent, 10) || 1 : 1;

      addToCart(id, name, Number(price), qty);
      showToast(`${qty}× „${name}“ přidáno do košíku`);

      if (qtyEl) qtyEl.textContent = '1';
    });
  });

  /* ---------- B2B modal ---------- */
  const b2bModal = document.getElementById('b2bModal');
  const b2bOpenBtn = document.getElementById('b2bOpenBtn');
  const b2bCloseBtn = document.getElementById('b2bCloseBtn');
  const b2bBackdrop = document.getElementById('b2bBackdrop');

  if (b2bModal && b2bOpenBtn) {
    const openB2b = () => {
      b2bModal.classList.remove('hidden');
      b2bModal.classList.add('open');
      document.body.style.overflow = 'hidden';
    };
    const closeB2b = () => {
      b2bModal.classList.add('hidden');
      b2bModal.classList.remove('open');
      document.body.style.overflow = '';
    };

    b2bOpenBtn.addEventListener('click', openB2b);
    b2bCloseBtn.addEventListener('click', closeB2b);
    b2bBackdrop.addEventListener('click', closeB2b);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && b2bModal.classList.contains('open')) closeB2b();
    });

    const b2bForm = document.getElementById('b2bForm');
    const b2bSuccess = document.getElementById('b2bSuccess');
    b2bForm.addEventListener('submit', (e) => {
      e.preventDefault();
      b2bSuccess.classList.remove('hidden');
      b2bForm.reset();
      setTimeout(() => {
        closeB2b();
        b2bSuccess.classList.add('hidden');
      }, 2200);
    });
  }

  /* ---------- Contact form (front-end only) ---------- */
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    const formSuccess = document.getElementById('formSuccess');
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      formSuccess.classList.remove('hidden');
      contactForm.reset();
      setTimeout(() => formSuccess.classList.add('hidden'), 5000);
    });
  }

  /* ---------- Footer year ---------- */
  document.getElementById('year').textContent = new Date().getFullYear();
})();
