#!/usr/bin/env node
// Checks a rendered flyer the way a printer would: is the page the size we
// asked for, does anything run past the trim edge, and does anything overlap.
//
//   node check.mjs                       every mode x format, from out/
//   node check.mjs --placement makola-w1
//
// The measurement is taken in the browser (real layout boxes), the file sizes
// are read from the bytes on disk (PNG IHDR, PDF MediaBox).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

import { MODES, FORMATS, link } from './src/content.js';
import { startServer, launch, shutdown, CDP } from '../shared/browser.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(HERE, 'out');

const MM_PER_INCH = 25.4;
const CSS_PX_PER_MM = 96 / MM_PER_INCH;
const BLEED_MM = 3;

const args = process.argv.slice(2);
const placement = args.includes('--placement') ? args[args.indexOf('--placement') + 1] : 'accra-test';
const modeFilter = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'all';
const formatFilter = args.includes('--format') ? args[args.indexOf('--format') + 1] : 'all';

const modes = modeFilter === 'all' ? Object.values(MODES) : [MODES[modeFilter]];
const formats = formatFilter === 'all' ? Object.values(FORMATS) : [FORMATS[formatFilter]];

async function writeQr(file, target) {
  const svg = await QRCode.toString(target, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 600,
  });
  await writeFile(file, svg);
}

const pngSize = (buf) => {  if (buf.toString('ascii', 1, 4) !== 'PNG') throw new Error('not a PNG');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
};

const pdfMediaBox = (buf) => {
  const text = buf.toString('latin1');
  const match = /\/MediaBox\s*\[\s*([\d.\s-]+)\]/.exec(text);
  if (!match) throw new Error('no MediaBox in PDF');
  return match[1].trim().split(/\s+/).map(Number);
};

// Measured in the page: every landmark's box, plus whether the page box
// overflows at all.
const PROBE = `(() => {
  const page = document.getElementById('page');
  const sheet = document.getElementById('sheet');
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const p = page.getBoundingClientRect();
    return { top: +(b.top - p.top).toFixed(1), bottom: +(b.bottom - p.top).toFixed(1), left: +(b.left - p.left).toFixed(1), right: +(b.right - p.left).toFixed(1) };
  };
  const overflow = [];
  for (const el of document.querySelectorAll('#page *')) {
    if (el.scrollWidth > el.clientWidth + 1) overflow.push({ cls: el.className || el.tagName, w: el.scrollWidth, box: el.clientWidth });
  }
  return JSON.stringify({
    page: { w: page.clientWidth, h: page.clientHeight, scrollW: page.scrollWidth, scrollH: page.scrollHeight },
    sheetMm: { w: +(sheet.getBoundingClientRect().width / ${CSS_PX_PER_MM}).toFixed(2), h: +(sheet.getBoundingClientRect().height / ${CSS_PX_PER_MM}).toFixed(2) },
    boxes: {
      brand: box('.brand'), hook: box('.hook'), sub: box('.sub'), features: box('.features'),
      cta: box('.cta'), foot: box('.foot'), qr: box('.qr'),
    },
    overflow,
    printPageRule: [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules]; } catch { return []; } })
      .filter((r) => r.type === CSSRule.PAGE_RULE).map((r) => r.cssText).join(' '),
  });
})()`;

const failures = [];
const note = (ok, text) => {
  if (!ok) failures.push(text);
  return ok ? 'ok  ' : 'FAIL';
};

const { server, port } = await startServer(ROOT);
const base = `http://127.0.0.1:${port}`;
await mkdir(path.join(OUT, 'qr'), { recursive: true });

const browser = await launch({ headed: false });
const cdp = await CDP.connect(browser.wsUrl);
try {
  for (const mode of modes) {
    for (const format of formats) {
      const name = `${mode.id}-${format.id}-${placement}`;
      const pdfFile = path.join(OUT, `${name}.pdf`);
      const pngFile = path.join(OUT, `${name}.png`);
      if (!existsSync(pdfFile)) {
        failures.push(`${name}: no PDF — run render.mjs first`);
        continue;
      }

      // --- file geometry
      const pdf = pdfMediaBox(await readFile(pdfFile));
      const expectWpt = ((format.w + 2 * BLEED_MM) / MM_PER_INCH) * 72;
      const expectHpt = ((format.h + 2 * BLEED_MM) / MM_PER_INCH) * 72;
      const pdfOk = Math.abs(pdf[2] - expectWpt) < 1 && Math.abs(pdf[3] - expectHpt) < 1;

      let pngLine = 'png: (none)';
      if (existsSync(pngFile)) {
        const size = pngSize(await readFile(pngFile));
        const expected = { w: Math.round((format.w / MM_PER_INCH) * 300), h: Math.round((format.h / MM_PER_INCH) * 300) };
        const pngOk = Math.abs(size.w - expected.w) <= 2 && Math.abs(size.h - expected.h) <= 2;
        pngLine = `png ${size.w}x${size.h} ${note(pngOk, `${name}: PNG is ${size.w}x${size.h}, expected ${expected.w}x${expected.h}`)}`;
      }

      // --- layout geometry
      await writeQr(
        path.join(OUT, 'qr', `${name}.svg`),
        link({ source: 'flyer', medium: 'print', campaign: placement })
      );
      const sheetW = format.w + 2 * BLEED_MM;
      const sheetH = format.h + 2 * BLEED_MM;
      await cdp.send('Page.enable');
      await cdp.send('Emulation.setEmulatedMedia', { media: 'print' });
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: Math.round(sheetW * CSS_PX_PER_MM),
        height: Math.round(sheetH * CSS_PX_PER_MM),
        deviceScaleFactor: 1,
        mobile: false,
      });
      const url =
        `${base}/marketing/flyers/index.html?mode=${mode.id}&format=${format.id}&placement=${placement}` +
        `&source=flyer&medium=print&qr=${encodeURIComponent(`/marketing/flyers/out/qr/${name}.svg`)}`;
      await cdp.send('Page.navigate', { url });
      for (let i = 0; i < 200; i++) {
        const ready = await cdp.eval('document.readyState === "complete" && !!window.__flyer').catch(() => false);
        if (ready) break;
        await new Promise((r) => setTimeout(r, 80));
      }
      await cdp.eval('window.__flyer.ready.then(() => 1)', true);
      const m = JSON.parse(await cdp.eval(PROBE));
      const b = m.boxes;

      const sheetOk =
        Math.abs(m.sheetMm.w - sheetW) < 0.5 && Math.abs(m.sheetMm.h - sheetH) < 0.5;
      const fits = m.page.scrollH <= m.page.h + 1 && m.page.scrollW <= m.page.w + 1;
      const order = [
        ['brand', 'hook'],
        ['hook', 'sub'],
        ['sub', 'features'],
        ['features', 'cta'],
        ['cta', 'foot'],
      ];
      const overlaps = order
        .filter(([a, c]) => b[a] && b[c] && b[c].top < b[a].bottom - 0.5)
        .map(([a, c]) => `${a}.bottom ${b[a].bottom} > ${c}.top ${b[c].top}`);
      const inside =
        b.foot && b.foot.bottom <= m.page.h + 0.5 && b.cta && b.cta.bottom <= m.page.h + 0.5;

      console.log(`\n${name}`);
      console.log(
        `  pdf ${pdf[2].toFixed(1)}x${pdf[3].toFixed(1)}pt ${note(pdfOk, `${name}: PDF is ${pdf[2]}x${pdf[3]}pt, expected ${expectWpt.toFixed(1)}x${expectHpt.toFixed(1)}`)}   ${pngLine}`
      );
      console.log(
        `  sheet ${m.sheetMm.w}x${m.sheetMm.h}mm ${note(sheetOk, `${name}: sheet measured ${m.sheetMm.w}x${m.sheetMm.h}mm, expected ${sheetW}x${sheetH}`)}   fits ${note(fits, `${name}: content overflows the trim box (${m.page.scrollH} > ${m.page.h})`)}   inside ${note(inside, `${name}: a block runs past the bottom of the trim box`)}`
      );
      console.log(
        `  print rule: ${m.printPageRule || '(none)'}`
      );
      console.log(
        `  stack: brand ${b.brand?.bottom} -> hook ${b.hook?.top}..${b.hook?.bottom} -> sub ${b.sub?.top}..${b.sub?.bottom} -> features ${b.features?.top}..${b.features?.bottom} -> cta ${b.cta?.top}..${b.cta?.bottom} -> foot ${b.foot?.top}..${b.foot?.bottom} (page h ${m.page.h})`
      );
      console.log(
        `  overlap ${note(overlaps.length === 0, `${name}: ${overlaps.join('; ')}`)}   qr ${b.qr ? `${b.qr.right - b.qr.left}px` : 'MISSING'}   text overflow ${note(m.overflow.length === 0, `${name}: text clipped — ${JSON.stringify(m.overflow)}`)}`
      );
    }
  }
} finally {
  cdp.close();
  await shutdown(browser);
  server.close();
}

if (failures.length > 0) {
  console.log('\nFAILED:');
  for (const f of failures) console.log('  - ' + f);
  process.exitCode = 1;
} else {
  console.log('\nAll flyers pass: page size, trim fit, stack order, no clipped text.');
}
