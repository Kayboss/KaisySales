// Flyer entry point.
//   ?mode=retail|services  &format=a5|a4  &placement=<campaign>
//   &qr=<path to the generated QR svg>  &source=flyer &medium=print
//
// render.mjs owns the geometry: it sets the page box, waits for window.__flyer,
// then either prints a PDF or photographs the trim area. This file only builds
// the markup, so what you see in --serve is what gets printed.

import { MODES, FORMATS, link } from './content.js';
import { iconSvg } from '../../ads/src/icons.js';

const params = new URLSearchParams(location.search);
const mode = MODES[params.get('mode')] || MODES.retail;
const format = FORMATS[params.get('format')] || FORMATS.a5;
const placement = params.get('placement') || 'preview';
const source = params.get('source') || 'flyer';
const medium = params.get('medium') || 'print';
const qrPath = params.get('qr');

const sheet = document.getElementById('sheet');
const page = document.getElementById('page');

sheet.dataset.format = format.id;
sheet.dataset.mode = mode.id;
sheet.style.width = format.w + 6 + 'mm';
sheet.style.height = format.h + 6 + 'mm';
sheet.style.setProperty('--accent', mode.accent);
sheet.style.setProperty('--accent-soft', mode.accentSoft);

const target = link({ source, medium, campaign: placement });

const features = mode.features
  .map(
    (f) => `
    <li class="feature">
      <span class="ico">${iconSvg(f.icon, mode.accent)}</span>
      <span class="txt">
        <span class="name">${f.title}</span>
        <span class="line">${f.line}</span>
      </span>
    </li>`
  )
  .join('');

page.innerHTML = `
  <header class="brand">
    <img class="mark" src="/public/logo2.svg" alt="" />
    <span class="wordmark">KaisySales</span>
    <span class="chip">${mode.label}</span>
  </header>

  <h1 class="hook">${mode.hook.map((h) => `<span>${h}</span>`).join('')}</h1>
  <p class="sub">${mode.sub}</p>

  <ul class="features">${features}</ul>

  <div class="cta">
    <img class="qr" alt="" ${qrPath ? `src="${qrPath}"` : ''} />
    <div class="cta-text">
      <div class="cta-title">${mode.cta}</div>
      <div class="cta-line">${mode.ctaLine}</div>
    </div>
  </div>

  <footer class="foot">
    <span class="url">${target.replace(/^https?:\/\//, '').split('/login')[0]}</span>
    <span class="sep">·</span>
    <span>Built in Accra</span>
  </footer>`;

// The print box: trim size plus 3 mm bleed on every edge. Chrome honours this
// with preferCSSPageSize, so the PDF arrives at an exact physical size.
const style = document.createElement('style');
style.textContent = `@page { size: ${format.w + 6}mm ${format.h + 6}mm; margin: 0; }
  body { width: ${format.w + 6}mm; height: ${format.h + 6}mm; }`;
document.head.appendChild(style);

const imgs = Array.from(document.querySelectorAll('img'));

window.__flyer = {
  meta: { mode: mode.id, format: format.id, placement, target, w: format.w, h: format.h },
  ready: (async () => {
    try {
      await document.fonts.load('700 100px "Tango Sans"');
    } catch {
      /* surfaced below */
    }
    await document.fonts.ready;
    await Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((r) => {
              img.addEventListener('load', r, { once: true });
              img.addEventListener('error', r, { once: true });
            })
      )
    );
    return {
      fontsOk:
        document.fonts.check('700 100px "Tango Sans"') && document.fonts.check('400 100px "Work Sans"'),
      logoOk: imgs.every((img) => img.naturalWidth > 0),
      qrOk: Boolean(qrPath),
    };
  })(),
};
