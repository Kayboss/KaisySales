#!/usr/bin/env node
// Renders marketing/og/index.html to public/og-image.png, the 1200x630 card
// every social platform and chat app shows when a KaisySales link is shared.
//
//   node scripts/make-og-image.mjs
//
// The card is generated rather than hand-drawn for the same reason the flyers
// are: the words on it are the homepage's words, and a hand-made PNG silently
// drifts from them. Re-run this after changing the headline.
//
// Concatenation and WhatsApp both prefer a real raster over SVG, which is why
// this writes a PNG and not an .svg.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { startServer, launch, shutdown, CDP } from '../marketing/shared/browser.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'public', 'og-image.png');

// 1200x630 is the size LinkedIn, Facebook, X and WhatsApp all crop from.
const WIDTH = 1200;
const HEIGHT = 630;

const SETTLE = 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { server, port } = await startServer(ROOT, { index: '/marketing/og/index.html' });
  const { proc, profile, wsUrl } = await launch({ headed: false, portBase: 9700 });

  try {
    const cdp = await CDP.connect(wsUrl);
    try {
      await cdp.send('Page.enable');
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: WIDTH,
        height: HEIGHT,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/marketing/og/index.html` });

      for (let i = 0; i < 200; i++) {
        const ready = await cdp.eval('document.readyState === "complete"').catch(() => false);
        if (ready) break;
        await sleep(80);
      }

      // The card is the brand's typeface or it is wrong. A missing webfont falls
      // back to a system sans and nobody notices until the link preview is live,
      // so refuse to write the file instead.
      await cdp.eval('document.fonts.ready.then(() => true)', true);

      const fontsOk = await cdp.eval(`document.fonts.check("700 40px 'Tango Sans'") && document.fonts.check("400 16px 'Work Sans'")`);
      if (!fontsOk) throw new Error('web fonts did not load (Tango Sans / Work Sans) — check the network');

      const logoOk = await cdp.eval(
        '(() => { const i = document.querySelector(".brand img"); return !!i && i.complete && i.naturalWidth > 0; })()'
      );
      if (!logoOk) throw new Error('logo.svg did not load');

      await cdp.eval(SETTLE, true);

      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await mkdir(path.dirname(OUT), { recursive: true });
      await writeFile(OUT, Buffer.from(shot.data, 'base64'));

      console.log(`og-image.png ${WIDTH}x${HEIGHT} -> ${path.relative(ROOT, OUT)}`);
    } finally {
      cdp.close();
    }
  } finally {
    await shutdown({ proc, profile });
    server.close();
  }
}

main().catch((e) => {
  console.error('og image render failed: ' + e.message);
  process.exit(1);
});
