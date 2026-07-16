(() => {
  'use strict';

  const STORAGE_KEY = 'loomos_theme';
  const root = document.documentElement;

  const applyTheme = (theme) => {
    root.setAttribute('data-theme', theme);
    document.dispatchEvent(new CustomEvent('loomos:themechange', { detail: { theme } }));
  };

  document.querySelectorAll('.theme-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      localStorage.setItem(STORAGE_KEY, next);
      applyTheme(next);
    });
  });
})();
