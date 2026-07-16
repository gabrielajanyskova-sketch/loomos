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

  /* ---------- Contact form ---------- */
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = contactForm.name.value.trim();
      const email = contactForm.email.value.trim();
      const message = contactForm.message.value.trim();
      const body = [`Jméno: ${name}`, `E-mail: ${email}`, '', message].join('\n');
      window.location.href = `mailto:info@loomos.cz?subject=${encodeURIComponent('Dotaz z webu LOOMOS')}&body=${encodeURIComponent(body)}`;
    });
  }

  /* ---------- Footer year ---------- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();
