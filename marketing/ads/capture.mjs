#!/usr/bin/env node
// Renders marketing/ads to MP4 with headless Chrome (CDP) and ffmpeg.
//
//   node capture.mjs                          all ads x both ratios -> out/*.mp4
//   node capture.mjs --ad retail --ratio 9x16
//   node marketing/ads/capture.mjs --stills 0,4.2,5.2,16.9
//   node marketing/ads/capture.mjs --serve     # open a browser and watch it
//
// Frames are piped straight into ffmpeg, so a render never writes a PNG
// sequence to disk. Every frame is produced by setting the paused WAAPI
// animations' currentTime, so the output is reproducible frame for frame.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { get as httpGet } from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = path.join(HERE, 'out');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

// ---------------------------------------------------------------- cli args
function parseArgs(argv) {
  const out = { ad: 'all', ratio: 'all', fps: 30, stills: null, inspect: null, framesOnly: false, serve: false, keep: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--ad') out.ad = next();
    else if (a === '--ratio') out.ratio = next();
    else if (a === '--fps') out.fps = Number(next());
    else if (a === '--stills') out.stills = next();
    else if (a === '--inspect') out.inspect = next();
    else if (a === '--frames-only') out.framesOnly = true;
    else if (a === '--serve') out.serve = true;
    else if (a === '--keep') out.keep = true;
    else throw new Error('unknown argument: ' + a);
  }
  return out;
}

// ------------------------------------------------------------- http server
function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const p = url.pathname === '/' ? '/marketing/ads/index.html' : decodeURIComponent(url.pathname);
      const abs = path.resolve(ROOT, '.' + p);
      const allowed = [path.join(ROOT, 'marketing'), path.join(ROOT, 'public')];
      if (!allowed.some((a) => abs.startsWith(a + path.sep) || abs === a)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      try {
        const buf = await readFile(abs);
        res.writeHead(200, { 'content-type': MIME[path.extname(abs)] || 'application/octet-stream', 'cache-control': 'no-store' });
        res.end(buf);
      } catch {
        res.writeHead(404).end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function getJson(port, pathname) {
  return fetch(`http://127.0.0.1:${port}${pathname}`).then((r) => r.json());
}

// --------------------------------------------------------------- browser
function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  throw new Error('No Chrome or Edge found. Set CHROME_PATH to the executable.');
}

async function launch({ headed }) {
  const port = 9300 + Math.floor(Math.random() * 400);
  const profile = path.join(os.tmpdir(), 'kaisy-ads-' + Date.now());
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--hide-scrollbars',
    '--mute-audio',
    '--force-color-profile=srgb',
    '--force-device-scale-factor=1',
    '--font-render-hinting=none',
    '--disable-new-content-rendering-timeout',
    '--run-all-compositor-stages-before-draw',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--window-size=1920,1080',
  ];
  if (headed) args.push('--start-maximized');
  else args.unshift('--headless=new', '--disable-gpu');
  args.push('about:blank');

  const proc = spawn(findChrome(), args, { stdio: 'ignore' });
  for (let i = 0; i < 150; i++) {
    try {
      const list = await getJson(port, '/json/list');
      const page = Array.isArray(list) ? list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl) : null;
      if (page) return { proc, port, profile, wsUrl: page.webSocketDebuggerUrl };
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  kill(proc);
  throw new Error('Chrome did not expose a page target');
}

function kill(proc) {
  if (!proc || proc.killed) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    proc.kill('SIGKILL');
  }
}

// -------------------------------------------------------------- cdp client
class CDP {
  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', () => reject(new Error('websocket failed')), { once: true });
    });
    return new CDP(ws);
  }
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.method + ': ' + (msg.error.message || JSON.stringify(msg.error))));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression, awaitPromise = false) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    if (r.exceptionDetails) throw new Error('page error: ' + (r.exceptionDetails.text || ''));
    return r.result.value;
  }
  close() {
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
  }
}

const SETTLE = 'new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))';

// ------------------------------------------------------------------ ffmpeg
function ffmpegPath() {
  const local = path.join(HERE, 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (process.env.FFMPEG && existsSync(process.env.FFMPEG)) return process.env.FFMPEG;
  if (existsSync(local)) return local;
  return 'ffmpeg';
}

function writeChunk(stream, buf) {
  return new Promise((resolve, reject) => {
    stream.write(buf, (err) => (err ? reject(err) : resolve()));
  });
}

function startFfmpeg(outFile, fps) {
  const proc = spawn(
    ffmpegPath(),
    [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-f', 'image2pipe',
      '-framerate', String(fps),
      '-i', '-',
      '-an',
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', '17',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      outFile,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] }
  );
  return proc;
}

// ------------------------------------------------------------------ render
async function openPage(cdp, url, w, h) {
  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Page.navigate', { url });
  for (let i = 0; i < 200; i++) {
    const ok = await cdp.eval('document.readyState === "complete" && !!window.__ad').catch(() => false);
    if (ok) break;
    await new Promise((r) => setTimeout(r, 80));
  }
  const info = await cdp.eval('window.__ad.ready.then(r => JSON.stringify(r))', true);
  const state = JSON.parse(info);
  if (!state.fontsOk) throw new Error('web fonts did not load (Tango Sans / Work Sans) — check the network');
  if (!state.logoOk) throw new Error('logo2.svg did not load');
  return state;
}

async function renderOne(cdp, { base, ad, ratio, w, h, fps, framesOnly }) {
  const url = `${base}/marketing/ads/index.html?ad=${ad}&ratio=${ratio}&t=0`;
  await openPage(cdp, url, w, h);
  const meta = JSON.parse(await cdp.eval('JSON.stringify({ duration: window.__ad.duration })'));
  const total = Math.round(meta.duration * fps);

  if (framesOnly) {
    const dir = path.join(OUT, 'frames', `${ad}-${ratio}`);
    await mkdir(dir, { recursive: true });
    for (let i = 0; i < total; i++) {
      const t = i / fps;
      await cdp.eval(`window.__ad.seek(${t})`);
      await cdp.eval(SETTLE, true);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(dir, String(i).padStart(5, '0') + '.png'), Buffer.from(shot.data, 'base64'));
    }
    return { total, file: dir, framesOnly: true };
  }

  const file = path.join(OUT, `${ad}-${ratio}-${w}x${h}.mp4`);
  const ff = startFfmpeg(file, fps);
  const ffDone = new Promise((resolve, reject) => {
    ff.on('error', (e) => reject(new Error('ffmpeg could not start (' + ffmpegPath() + '): ' + e.message)));
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg exited with code ' + code))));
  });
  try {
    for (let i = 0; i < total; i++) {
      const t = i / fps;
      await cdp.eval(`window.__ad.seek(${t})`);
      await cdp.eval(SETTLE, true);
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      await writeChunk(ff.stdin, Buffer.from(shot.data, 'base64'));
    }
    ff.stdin.end();
    await ffDone;
  } catch (e) {
    kill(ff);
    throw e;
  }
  return { total, file };
}

// Measures the page instead of photographing it. The numbers are the ones a
// human eye would otherwise have to check: is the character off-screen at the
// start, does the hand land on the phone it is reaching for, do the feet sit on
// the ground line, does anything spill outside the stage.
const PROBE = `(() => {
  const box = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const st = document.getElementById('stage').getBoundingClientRect();
    return { x: Math.round(b.x - st.x), y: Math.round(b.y - st.y), r: Math.round(b.right - st.x), b: Math.round(b.bottom - st.y) };
  };
  const sel = ['.char-pos', '.foot-a', '.foot-b', '.arm-a .hand-phone', '.prop-phone', '.head-g', '.card[data-i="0"]', '.card[data-i="3"]', '#end', '.hook-line[data-i="0"]'];
  const out = {};
  for (const s of sel) out[s] = box(s);
  out.stage = { w: window.__ad.meta.w, h: window.__ad.meta.h };
  const cs = (s) => { const el = document.querySelector(s); if (!el) return null; const g = getComputedStyle(el); return g.transform + ' | origin ' + g.transformOrigin + ' | box ' + g.transformBox; };
  out._t = {
    pos: cs('.char-pos'),
    arm: cs('.arm-a'),
    fore: cs('.fore-a'),
    anims: document.getAnimations().length,
  };
  return JSON.stringify(out);
})()`;

async function inspectAt(cdp, { base, ad, ratio, w, h, times }) {
  const url = `${base}/marketing/ads/index.html?ad=${ad}&ratio=${ratio}&t=0`;
  await openPage(cdp, url, w, h);
  const rows = [];
  for (const t of times) {
    await cdp.eval(`window.__ad.seek(${t})`);
    await cdp.eval(SETTLE, true);
    const boxes = JSON.parse(await cdp.eval(PROBE));
    const opac = JSON.parse(await cdp.eval(`JSON.stringify({
      hand: getComputedStyle(document.querySelector('.arm-a .hand-phone')).opacity,
      prop: getComputedStyle(document.querySelector('.prop-phone')).opacity,
      card0: getComputedStyle(document.querySelector('.card[data-i="0"]')).opacity,
      card3: getComputedStyle(document.querySelector('.card[data-i="3"]')).opacity,
      end: getComputedStyle(document.getElementById('end')).opacity,
      hook0: getComputedStyle(document.querySelector('.hook-line[data-i="0"]')).opacity
    })`));
    rows.push({ t: Number(t), boxes, opac });
  }
  return rows;
}

async function renderStills(cdp, { base, ad, ratio, w, h, times }) {
  const url = `${base}/marketing/ads/index.html?ad=${ad}&ratio=${ratio}&t=0`;
  await openPage(cdp, url, w, h);
  const dir = path.join(OUT, 'stills');
  await mkdir(dir, { recursive: true });
  const files = [];
  for (const t of times) {
    await cdp.eval(`window.__ad.seek(${t})`);
    await cdp.eval(SETTLE, true);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(dir, `${ad}-${ratio}-${String(t).replace('.', '_')}s.png`);
    await writeFile(file, Buffer.from(shot.data, 'base64'));
    files.push(file);
  }
  return files;
}

// -------------------------------------------------------------------- main
const SIZE = { '9x16': { w: 1080, h: 1920 }, '16x9': { w: 1920, h: 1080 } };

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { server, port } = await startServer();
  const base = `http://127.0.0.1:${port}`;

  const ads = opts.ad === 'all' ? ['retail', 'services'] : [opts.ad];
  const ratios = opts.ratio === 'all' ? ['9x16', '16x9'] : [opts.ratio];
  for (const a of ads) if (!['retail', 'services'].includes(a)) throw new Error('unknown ad: ' + a);
  for (const r of ratios) if (!SIZE[r]) throw new Error('unknown ratio: ' + r);

  if (opts.serve) {
    console.log('Serving ' + base + '/marketing/ads/index.html');
    console.log('  retail 9:16   ' + base + '/marketing/ads/index.html?ad=retail&ratio=9x16');
    console.log('  services 16:9 ' + base + '/marketing/ads/index.html?ad=services&ratio=16x9');
    const { proc } = await launch({ headed: true });
    await new Promise(() => {});
    void proc;
    return;
  }

  const { proc, profile, wsUrl } = await launch({ headed: false });
  try {
    const cdp = await CDP.connect(wsUrl);
    try {
      await mkdir(OUT, { recursive: true });
      const times = opts.inspect || opts.stills ? String(opts.inspect || opts.stills).split(',').map(Number) : null;
      for (const ad of ads) {
        for (const ratio of ratios) {
          const { w, h } = SIZE[ratio];
          const label = `${ad} ${ratio} ${w}x${h}`;
          const started = Date.now();
          if (opts.inspect) {
            const rows = await inspectAt(cdp, { base, ad, ratio, w, h, times });
            console.log('\n=== ' + label + ' ===');
            for (const row of rows) {
              const pct = (v) => (v === null || v === undefined ? '  —  ' : String(v).padStart(5));
              const HAND = '.arm-a .hand-phone';
              console.log(`t=${String(row.t).padEnd(6)} char x=${pct(row.boxes['.char-pos'].x)} foot-b=${pct(row.boxes['.foot-b'].b)} hand=${pct(row.boxes[HAND].x)},${pct(row.boxes[HAND].y)} prop=${pct(row.boxes['.prop-phone'].x)},${pct(row.boxes['.prop-phone'].y)} card0=${pct(row.boxes['.card[data-i="0"]'].y)} card3=${pct(row.boxes['.card[data-i="3"]'].y)} end=${pct(row.boxes['#end'].y)}`);
              console.log(`        opacity hand=${row.opac.hand} prop=${row.opac.prop} card0=${row.opac.card0} card3=${row.opac.card3} end=${row.opac.end} hook0=${row.opac.hook0}`);
              const tn = (m) => (m === 'none' ? 'none' : m);
              console.log(`        transform pos=${tn(row.boxes._t.pos)} arm=${tn(row.boxes._t.arm)} fore=${tn(row.boxes._t.fore)} anims=${row.boxes._t.anims}`);
            }
          } else if (opts.stills) {
            const files = await renderStills(cdp, { base, ad, ratio, w, h, times });
            console.log(`${label}: ${files.length} stills -> ${path.relative(ROOT, files[0])} …`);
          } else {
            const res = await renderOne(cdp, { base, ad, ratio, w, h, fps: opts.fps, framesOnly: opts.framesOnly });
            const secs = ((Date.now() - started) / 1000).toFixed(1);
            console.log(`${label}: ${res.total} frames -> ${path.relative(ROOT, res.file)} (${secs}s)`);
          }
        }
      }
    } finally {
      cdp.close();
    }
  } finally {
    kill(proc);
    server.close();
    if (!opts.keep) await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((e) => {
  console.error('capture failed: ' + e.message);
  process.exit(1);
});
