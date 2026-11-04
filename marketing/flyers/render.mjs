#!/usr/bin/env node
// Renders the KaisySales flyers to print-ready PDF (and a PNG preview) with
// headless Chrome.
//
//   node render.mjs                          every mode x every format -> out/*.pdf
//   node render.mjs --format a5              one size
//   node render.mjs --mode services          one mode
//   node render.mjs --placement makola-w1    tag the QR/UTM links for one pile of flyers
//   node render.mjs --serve                  open a browser and look at it
//
// The links matter as much as the layout: a printed URL cannot be measured, so
// each placement gets its own UTM-tagged link behind its own QR code. Print one
// pile per --placement, and Admin -> Growth will attribute the signups to it.

import { mkdir, writeFile } from 'node:fs/promises';
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

// ------------------------------------------------------------------ cli args
function parseArgs(argv) {
  const out = {
    mode: 'all',
    format: 'all',
    placement: 'preview',
    source: 'flyer',
    medium: 'print',
    serve: false,
    png: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--mode') out.mode = next();
    else if (a === '--format') out.format = next();
    else if (a === '--placement') out.placement = next();
    else if (a === '--source') out.source = next();
    else if (a === '--medium') out.medium = next();
    else if (a === '--no-png') out.png = false;
    else if (a === '--serve') out.serve = true;
    else throw new Error('unknown argument: ' + a);
  }
  return out;
}

// --------------------------------------------------------------------- qr
async function writeQr(file, target) {
  // Error correction M survives a crease or a thumbprint; the white padding in
  // the layout is the quiet zone a phone camera needs to find it on paper.
  const svg = await QRCode.toString(target, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 0,
    width: 600,
  });
  await writeFile(file, svg);
}

const qrUrlFor = (mode, format, placement) =>
  `/marketing/flyers/out/qr/${mode.id}-${format.id}-${placement}.svg`;

function pageUrl({ base, mode, format, placement, source, medium }) {
  return (
    `${base}/marketing/flyers/index.html?mode=${mode.id}&format=${format.id}` +
    `&placement=${encodeURIComponent(placement)}` +
    `&source=${encodeURIComponent(source)}&medium=${encodeURIComponent(medium)}` +
    `&qr=${encodeURIComponent(qrUrlFor(mode, format, placement))}`
  );
}

// ------------------------------------------------------------------ render
// Only the fields that describe *what to draw* — never `mode`/`format`, which
// are objects by the time they are spread over a per-flyer call.
const pick = ({ placement, source, medium, png }) => ({ placement, source, medium, png });

async function openFlyer(cdp, url, sheetW, sheetH) {
  await cdp.send('Page.enable');
  // Print media for both artefacts: the PDF obviously, and the PNG too, so the
  // preview is cropped from the same layout the printer receives.
  await cdp.send('Emulation.setEmulatedMedia', { media: 'print' });
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: Math.round(sheetW * CSS_PX_PER_MM),
    height: Math.round(sheetH * CSS_PX_PER_MM),
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send('Page.navigate', { url });
  for (let i = 0; i < 200; i++) {
    const ok = await cdp.eval('document.readyState === "complete" && !!window.__flyer').catch(() => false);
    if (ok) break;
    await new Promise((r) => setTimeout(r, 80));
  }
  const state = JSON.parse(await cdp.eval('window.__flyer.ready.then((r) => JSON.stringify(r))', true));
  if (!state.fontsOk) throw new Error('web fonts did not load (Tango Sans / Work Sans) — check the network');
  if (!state.logoOk) throw new Error('a flyer image did not load (logo2.svg or the QR svg)');
  return JSON.parse(await cdp.eval('JSON.stringify(window.__flyer.meta)'));
}

async function renderOne(cdp, opts) {
  const { base, mode, format, placement, source, medium, png } = opts;
  await writeQr(path.join(OUT, 'qr', `${mode.id}-${format.id}-${placement}.svg`), link({ source, medium, campaign: placement }));

  const sheetW = format.w + 2 * BLEED_MM;
  const sheetH = format.h + 2 * BLEED_MM;
  const meta = await openFlyer(cdp, pageUrl({ base, mode, format, placement, source, medium }), sheetW, sheetH);

  const name = `${mode.id}-${format.id}-${placement}`;
  const pdfFile = path.join(OUT, `${name}.pdf`);
  const pdf = await cdp.send('Page.printToPDF', {
    printBackground: true,
    preferCSSPageSize: true,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    scale: 1,
  });
  await writeFile(pdfFile, Buffer.from(pdf.data, 'base64'));

  let pngFile = null;
  if (png) {
    // Photograph the trim area only — no bleed — at 300 dpi. This is the file
    // for WhatsApp, and the one to look at without a PDF viewer.
    const inset = BLEED_MM * CSS_PX_PER_MM;
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: {
        x: inset,
        y: inset,
        width: format.w * CSS_PX_PER_MM,
        height: format.h * CSS_PX_PER_MM,
        scale: 300 / 96,
      },
    });
    pngFile = path.join(OUT, `${name}.png`);
    await writeFile(pngFile, Buffer.from(shot.data, 'base64'));
  }

  return { name, pdfFile, pngFile, meta };
}

// -------------------------------------------------------------------- main
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const modes = opts.mode === 'all' ? Object.values(MODES) : [MODES[opts.mode]].filter(Boolean);
  const formats = opts.format === 'all' ? Object.values(FORMATS) : [FORMATS[opts.format]].filter(Boolean);
  if (modes.length === 0) throw new Error('unknown mode: ' + opts.mode);
  if (formats.length === 0) throw new Error('unknown format: ' + opts.format);

  const { server, port } = await startServer(ROOT);
  const base = `http://127.0.0.1:${port}`;
  await mkdir(path.join(OUT, 'qr'), { recursive: true });

  if (opts.serve) {
    for (const mode of modes) {
      for (const format of formats) {
        await writeQr(
          path.join(OUT, 'qr', `${mode.id}-${format.id}-${opts.placement}.svg`),
          link({ source: opts.source, medium: opts.medium, campaign: opts.placement })
        );
        console.log(`${mode.id} ${format.id}: ${pageUrl({ base, mode, format, ...pick(opts) })}`);
      }
    }
    await launch({ headed: true });
    await new Promise(() => {});
    return;
  }

  const browser = await launch({ headed: false });
  let cdp;
  try {
    cdp = await CDP.connect(browser.wsUrl);
    for (const mode of modes) {
      for (const format of formats) {
        const started = Date.now();
        const res = await renderOne(cdp, { base, mode, format, ...pick(opts) });
        const secs = ((Date.now() - started) / 1000).toFixed(1);
        const files = [path.relative(ROOT, res.pdfFile), res.pngFile ? path.relative(ROOT, res.pngFile) : null]
          .filter(Boolean)
          .join('  +  ');
        console.log(`${res.meta.mode} ${res.meta.format}: ${files} (${secs}s)`);
        console.log(`   link: ${res.meta.target}`);
      }
    }
  } finally {
    if (cdp) cdp.close();
    await shutdown(browser);
    server.close();
  }
}

main().catch((e) => {
  console.error('render failed: ' + e.message);
  process.exit(1);
});
