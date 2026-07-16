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
    mobileMenu.classList.toggle('hidden', !isHidden ? true : false);
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

  /* ---------- Cart ---------- */
  let cartCount = 0;
  const cartCountEl = document.getElementById('cartCount');
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

  document.querySelectorAll('.btn-add-cart').forEach((btn) => {
    btn.addEventListener('click', () => {
      cartCount += 1;
      cartCountEl.textContent = String(cartCount);
      cartCountEl.classList.remove('opacity-0', 'scale-0');
      cartCountEl.classList.add('opacity-100', 'scale-100');
      const name = btn.dataset.name || 'Produkt';
      showToast(`„${name}“ přidáno do košíku`);
    });
  });

  /* ---------- B2B modal ---------- */
  const b2bModal = document.getElementById('b2bModal');
  const b2bOpenBtn = document.getElementById('b2bOpenBtn');
  const b2bCloseBtn = document.getElementById('b2bCloseBtn');
  const b2bBackdrop = document.getElementById('b2bBackdrop');

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

  /* ---------- Forms (front-end only) ---------- */
  const contactForm = document.getElementById('contactForm');
  const formSuccess = document.getElementById('formSuccess');
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    formSuccess.classList.remove('hidden');
    contactForm.reset();
    setTimeout(() => formSuccess.classList.add('hidden'), 5000);
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

  /* ---------- Footer year ---------- */
  document.getElementById('year').textContent = new Date().getFullYear();
})();
