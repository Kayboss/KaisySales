// The bits both marketing renderers need: a static server that can only reach
// marketing/ and public/, and a headless Chrome driven over CDP.
//
// The allowlist is not decoration — these scripts serve whatever path the page
// asks for, and the repository contains .env files.

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

/** Serves `root` under /marketing and /public only. */
export function startServer(root, { index = '/marketing/flyers/index.html' } = {}) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, 'http://localhost');
      const p = url.pathname === '/' ? index : decodeURIComponent(url.pathname);
      const abs = path.resolve(root, '.' + p);
      const allowed = [path.join(root, 'marketing'), path.join(root, 'public')];
      if (!allowed.some((a) => abs.startsWith(a + path.sep) || abs === a)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      try {
        const buf = await readFile(abs);
        res.writeHead(200, {
          'content-type': MIME[path.extname(abs)] || 'application/octet-stream',
          'cache-control': 'no-store',
        });
        res.end(buf);
      } catch {
        res.writeHead(404).end('not found');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

export function findChrome() {
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

export function kill(proc) {
  if (!proc || proc.killed) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    proc.kill('SIGKILL');
  }
}

export async function launch({ headed = false, portBase = 9800 } = {}) {
  const port = portBase + Math.floor(Math.random() * 400);
  const profile = path.join(os.tmpdir(), 'kaisy-render-' + Date.now());
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--hide-scrollbars',
    '--mute-audio',
    '--force-color-profile=srgb',
    '--font-render-hinting=none',
    '--disable-new-content-rendering-timeout',
    '--run-all-compositor-stages-before-draw',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
  ];
  if (headed) args.push('--start-maximized', '--window-size=1400,1000');
  else args.unshift('--headless=new', '--disable-gpu');
  args.push('about:blank');

  const proc = spawn(findChrome(), args, { stdio: 'ignore' });
  for (let i = 0; i < 150; i++) {
    try {
      const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
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

export async function shutdown({ proc, profile }) {
  kill(proc);
  if (profile) await rm(profile, { recursive: true, force: true }).catch(() => {});
}

export class CDP {
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
