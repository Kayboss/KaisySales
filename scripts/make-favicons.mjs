#!/usr/bin/env node
// Renders marketing/icons/index.html into the raster icons the site and Google
// Search need, and writes the multi-size /favicon.ico.
//
//   node scripts/make-favicons.mjs
//
// Why this exists: Google Search lists its supported favicon formats as BMP,
// GIF, ICO, PNG, JPEG, PPM and TIFF. **SVG is not one of them**, and the site
// previously declared only `type="image/svg+xml"`, so Google had nothing it
// could draw and search results showed a generic globe. The Organization
// `logo` had the same problem: `logo.svg` is an SVG.
//
// The sizes are the ones the guidelines name: at least 48x48 (recommended over
// 48), 180x180 for iOS, 192/512 for Android and install prompts, and 512x512
// for the structured-data logo (minimum 112x112). Every icon is square, which
// is a hard requirement, and every one is drawn at its own size rather than
// downscaled from a master.
//
// Re-run this after changing logo.svg; the PNGs are generated, not hand-made.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startServer, launch, shutdown, CDP } from '../marketing/shared/browser.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PUBLIC = path.join(ROOT, 'public');

// The mark takes more of the canvas as the canvas gets smaller, so a 16px tab
// icon is still the logo and not a terracotta square with a smudge on it.
const scaleFor = (size) => (size <= 32 ? 0.94 : size <= 96 ? 0.82 : 0.76);

const FAVICONS = [16, 32, 48, 96, 192, 512];
const APPLE_TOUCH = 180;
const LOGO = 512;
const ICO_SIZES = [16, 32, 48];

const SETTLE = 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngSize(buf, name) {
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error(`${name} is not a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// An ICO holding PNG-compressed entries (Vista and later, and every browser and
// crawler that matters). Google accepts ICO, and /favicon.ico is the path a lot
// of software asks for without ever reading the HTML.
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + 16 * images.length;
  const entries = [];
  for (const { size, buf } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width, 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height, 0 means 256
    entry.writeUInt8(0, 2); // palette size
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += buf.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.buf)]);
}

async function main() {
  const { server, port } = await startServer(ROOT, { index: '/marketing/icons/index.html' });
  const { proc, profile, wsUrl } = await launch({ headed: false, portBase: 9600 });

  try {
    const cdp = await CDP.connect(wsUrl);
    try {
      await cdp.send('Page.enable');
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/marketing/icons/index.html` });

      for (let i = 0; i < 200; i++) {
        const ready = await cdp.eval('document.readyState === "complete"').catch(() => false);
        if (ready) break;
        await sleep(80);
      }

      // The mark, not a broken-image glyph: an icon is drawn from logo.svg.
      const logoOk = await cdp.eval(
        '(() => { const i = document.querySelector("img"); return !!i && i.complete && i.naturalWidth > 0; })()'
      );
      if (!logoOk) throw new Error('public/logo.svg did not load');

      const rendered = new Map();

      for (const size of [...new Set([...FAVICONS, APPLE_TOUCH, LOGO])]) {
        await cdp.send('Emulation.setDeviceMetricsOverride', {
          width: size,
          height: size,
          deviceScaleFactor: 1,
          mobile: false,
        });
        await cdp.eval(`document.documentElement.style.setProperty('--mark', '${scaleFor(size)}')`);
        await cdp.eval(SETTLE, true);

        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        const buf = Buffer.from(shot.data, 'base64');

        const { width, height } = pngSize(buf, `icon ${size}`);
        if (width !== size || height !== size) {
          throw new Error(`icon came back ${width}x${height}, expected ${size}x${size} (it must be square)`);
        }

        rendered.set(size, buf);
      }

      await mkdir(PUBLIC, { recursive: true });

      for (const size of FAVICONS) {
        await writeFile(path.join(PUBLIC, `favicon-${size}x${size}.png`), rendered.get(size));
      }
      await writeFile(path.join(PUBLIC, 'apple-touch-icon.png'), rendered.get(APPLE_TOUCH));
      // Structured data: Google wants at least 112x112 and a raster format.
      await writeFile(path.join(PUBLIC, 'logo-512.png'), rendered.get(LOGO));

      const ico = buildIco(ICO_SIZES.map((size) => ({ size, buf: rendered.get(size) })));
      await writeFile(path.join(PUBLIC, 'favicon.ico'), ico);

      console.log(`favicons: ${FAVICONS.map((s) => `${s}x${s}`).join(', ')}`);
      console.log(`apple-touch-icon.png ${APPLE_TOUCH}x${APPLE_TOUCH}, logo-512.png ${LOGO}x${LOGO}`);
      console.log(`favicon.ico holds ${ICO_SIZES.join(', ')}`);
    } finally {
      cdp.close();
    }
  } finally {
    await shutdown({ proc, profile });
    server.close();
  }
}

main().catch((e) => {
  console.error('favicon render failed: ' + e.message);
  process.exit(1);
});
