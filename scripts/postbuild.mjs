#!/usr/bin/env node
/**
 * Post-build step: make `/` serve the static landing page on Vercel.
 *
 * Vite outputs the SPA shell as `dist/index.html` and copies `public/landing/*`
 * to `dist/landing/*`. A vercel.json rewrite from `/` to `/landing/index.html`
 * is not reliable when `dist/index.html` exists at the filesystem root, so we:
 *   1. Move the SPA shell to `dist/app.html`
 *   2. Copy the landing page to `dist/index.html`
 *
 * `vercel.json` rewrites `/:path*` to `/app.html` so client-side routes still
 * load the SPA shell. Marketing rewrites (`/pricing`, `/pages/*`, `/landing/*`)
 * and static assets take precedence because they are listed first.
 */
import { copyFileSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const spa = join(dist, 'index.html');
const app = join(dist, 'app.html');
const landing = join(dist, 'landing', 'index.html');

if (!existsSync(spa)) {
  console.error('[postbuild] dist/index.html not found — run vite build first');
  process.exit(1);
}
if (!existsSync(landing)) {
  console.error('[postbuild] dist/landing/index.html not found — landing page missing from build output');
  process.exit(1);
}

renameSync(spa, app);
copyFileSync(landing, spa);
console.log('[postbuild] / -> landing page, SPA shell -> /app.html');
