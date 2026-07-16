(() => {
  'use strict';

  const picker = document.querySelector('[data-jar-picker]');
  if (!picker) return;

  const visual = document.querySelector('.product-detail-visual');
  const product = picker.closest('[data-id]') || document.querySelector('[data-id]');
  const baseName = product ? product.dataset.name : '';

  const applySelection = (btn) => {
    picker.querySelectorAll('.jar-swatch').forEach((el) => el.classList.remove('active'));
    btn.classList.add('active');

    if (visual) visual.setAttribute('data-jar-color', btn.dataset.jarValue);
    if (product) {
      product.dataset.name = `${baseName} — ${btn.dataset.jarLabel}`;
    }
  };

  picker.querySelectorAll('.jar-swatch').forEach((btn) => {
    btn.addEventListener('click', () => applySelection(btn));
  });

  const initial = picker.querySelector('.jar-swatch.active') || picker.querySelector('.jar-swatch');
  if (initial) applySelection(initial);
})();
