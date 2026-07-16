(() => {
  'use strict';

  const canvas = document.getElementById('flameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let isLight = document.documentElement.getAttribute('data-theme') === 'light';
  document.addEventListener('loomos:themechange', (e) => {
    isLight = e.detail.theme === 'light';
    if (prefersReducedMotion) {
      ctx.clearRect(0, 0, width, height);
      drawGlow();
    }
  });

  let width = 0;
  let height = 0;
  let dpr = 1;

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  /* ---------- Rising embers ---------- */
  const EMBER_COUNT = 55;
  const embers = [];

  const spawnEmber = (initial) => ({
    x: width * (0.28 + Math.random() * 0.44),
    y: initial ? height * Math.random() : height * (0.62 + Math.random() * 0.1),
    vy: 0.25 + Math.random() * 0.55,
    sway: Math.random() * Math.PI * 2,
    swaySpeed: 0.006 + Math.random() * 0.014,
    swayAmp: 8 + Math.random() * 26,
    radius: 0.8 + Math.random() * 2.2,
    life: initial ? Math.random() * 200 : 0,
    maxLife: 260 + Math.random() * 260,
    hue: 32 + Math.random() * 26,
  });

  for (let i = 0; i < EMBER_COUNT; i++) embers.push(spawnEmber(true));

  /* ---------- Draw loop ---------- */
  let t = 0;

  const drawGlow = () => {
    const cx = width * 0.5;
    const baseY = height * 0.66;

    const glowMult = isLight ? 0.5 : 1;
    const glowRgb = isLight ? '150, 108, 32' : '197, 160, 89';
    for (let i = 0; i < 3; i++) {
      const flicker = Math.sin(t * 0.02 + i * 2.1) * 0.5 + Math.sin(t * 0.031 + i) * 0.5;
      const r = (Math.min(width, height) * (0.28 + i * 0.14)) * (1 + flicker * 0.06);
      const offsetX = Math.sin(t * 0.014 + i * 1.7) * 18;
      const grad = ctx.createRadialGradient(cx + offsetX, baseY, 0, cx + offsetX, baseY, r);
      grad.addColorStop(0, `rgba(${glowRgb}, ${(0.16 - i * 0.035) * glowMult})`);
      grad.addColorStop(1, `rgba(${glowRgb}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx + offsetX, baseY, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawEmbers = () => {
    embers.forEach((p) => {
      p.life += 1;
      p.y -= p.vy;
      p.sway += p.swaySpeed;
      const lifeRatio = Math.min(p.life / p.maxLife, 1);
      const opacity = Math.sin(Math.PI * lifeRatio);
      const drawX = p.x + Math.sin(p.sway) * p.swayAmp * lifeRatio;

      const lightness = isLight ? 42 : 62;
      const emberMult = isLight ? 0.55 : 0.85;
      ctx.beginPath();
      ctx.shadowColor = `hsla(${p.hue}, 85%, ${lightness}%, 0.9)`;
      ctx.shadowBlur = 6;
      ctx.fillStyle = `hsla(${p.hue}, 75%, ${lightness}%, ${Math.max(opacity, 0) * emberMult})`;
      ctx.arc(drawX, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      if (p.life >= p.maxLife || p.y < -20) {
        Object.assign(p, spawnEmber(false));
      }
    });
    ctx.shadowBlur = 0;
  };

  const render = () => {
    ctx.clearRect(0, 0, width, height);
    drawGlow();
    drawEmbers();
    t += 1;
    if (!prefersReducedMotion) requestAnimationFrame(render);
  };

  if (prefersReducedMotion) {
    drawGlow();
  } else {
    requestAnimationFrame(render);
  }
})();
