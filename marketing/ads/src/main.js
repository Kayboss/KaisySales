// Ad entry point.
//   ?ad=retail|services   ?ratio=9x16|16x9   ?t=<seconds>  (freeze a frame)
//
// With no `t` the ad plays on a loop, driven by one seek() call per frame, so
// what you watch is exactly what capture.mjs renders.

import { ADS, schedule } from './ads.js';
import { layoutFor } from './layouts.js';
import { buildScene } from './scene.js';
import { buildTimeline } from './timeline.js';
import { iconSvg } from './icons.js';

const params = new URLSearchParams(location.search);
const ad = ADS[params.get('ad')] || ADS.retail;
const L = layoutFor(params.get('ratio'));
const T = schedule();
const frozen = params.has('t');

function overlay() {
  const cards = ad.features
    .map(
      (f, i) => `
    <div class="card" data-i="${i}">
      <div class="card-accent"></div>
      <div class="card-icon">${iconSvg(f.icon, ad.accent)}</div>
      <div class="card-text">
        <div class="card-title">${f.title}</div>
        <div class="card-line">${f.line}</div>
      </div>
      <div class="card-step">${i + 1}<span>/4</span></div>
    </div>`
    )
    .join('');
  const dots = L.dots
    ? `<div class="dots">${[0, 1, 2, 3].map((i) => `<span class="dot" data-i="${i}"></span>`).join('')}</div>`
    : '';
  return `
  <div class="wordmark">${ad.wordmark}</div>
  <div class="hook">${ad.hook.map((h, i) => `<p class="hook-line" data-i="${i}">${h}</p>`).join('')}</div>
  ${cards}
  ${dots}
  <div id="end">
    <div class="end-logo"><img src="/public/logo2.svg" alt="" /><span class="end-name">${ad.wordmark}</span></div>
    <h2 class="end-head">${ad.end.headline}</h2>
    <div class="end-cta">${ad.end.button}</div>
    <div class="end-url">${ad.end.url}</div>
  </div>`;
}

const stage = document.getElementById('stage');
stage.dataset.ad = ad.id;
stage.dataset.ratio = L.id;
stage.style.width = L.w + 'px';
stage.style.height = L.h + 'px';
stage.style.setProperty('--accent', ad.accent);
stage.style.setProperty('--accent-soft', ad.accentSoft);
stage.innerHTML = buildScene(L, ad) + overlay();

Array.from(stage.querySelectorAll('.card')).forEach((el, i) => {
  const top = L.stack ? L.card.y + i * (L.card.h + L.card.gap) : L.card.y;
  el.style.top = top + 'px';
});

const { animations, duration } = buildTimeline(stage, L, ad, T);

function seek(t) {
  const ms = t * 1000;
  for (const a of animations) a.currentTime = ms;
}

function fitToWindow() {
  if (frozen) {
    stage.style.transform = 'none';
    return;
  }
  const s = Math.min(1, (window.innerWidth - 32) / L.w, (window.innerHeight - 32) / L.h);
  stage.style.transform = 'scale(' + s + ')';
}

if (frozen) {
  seek(parseFloat(params.get('t')) || 0);
  window.addEventListener('resize', fitToWindow);
  fitToWindow();
} else {
  let playing = true;
  let clock = 0;
  let last = performance.now();
  const tick = (now) => {
    const dt = (now - last) / 1000;
    last = now;
    if (playing) clock = (clock + dt) % duration;
    seek(clock);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.addEventListener('resize', fitToWindow);
  fitToWindow();
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      playing = !playing;
      e.preventDefault();
    }
    if (e.code === 'ArrowRight') clock = Math.min(duration, clock + 0.1);
    if (e.code === 'ArrowLeft') clock = Math.max(0, clock - 0.1);
  });
}

const ready = (async () => {
  const img = stage.querySelector('.end-logo img');
  const fonts = document.fonts;
  try {
    await fonts.load('700 100px "Tango Sans"');
  } catch {
    /* surfaced below */
  }
  await fonts.ready;
  if (img && !img.complete) {
    await new Promise((r) => {
      img.addEventListener('load', r, { once: true });
      img.addEventListener('error', r, { once: true });
    });
  }
  return {
    fontsOk: fonts.check('700 100px "Tango Sans"') && fonts.check('400 100px "Work Sans"'),
    logoOk: !img || img.naturalWidth > 0,
  };
})();

window.__ad = { duration, seek, meta: { ad: ad.id, ratio: L.id, w: L.w, h: L.h }, ready };
