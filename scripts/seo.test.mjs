// Pins the things a search engine or an AI assistant needs before it can rank
// KaisySales at all. Every check here maps to a failure that is invisible on the
// rendered page: a sitemap pointing at a 404, a page whose og:image is missing,
// a canonical that disagrees with what the host actually serves, or an app shell
// that lets the whole authenticated app be indexed as thin duplicate content.
//
// The sitemap check is the one that earns its keep. `/pricing` was added to the
// sitemap before the page existed, and nothing but a check that resolves each
// <loc> to a file on disk would have noticed.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://www.kaisysales.com';

const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => existsSync(path.join(ROOT, rel));

const PAGES = [
  {
    file: 'public/landing/index.html',
    canonical: `${ORIGIN}/`,
    titleIncludes: 'KaisySales',
  },
  {
    file: 'public/landing/pages/pricing.html',
    canonical: `${ORIGIN}/pricing`,
    titleIncludes: 'Pricing',
  },
  {
    file: 'public/landing/pages/help.html',
    canonical: `${ORIGIN}/pages/help.html`,
    titleIncludes: 'Help',
  },
  {
    file: 'public/landing/pages/privacy.html',
    canonical: `${ORIGIN}/pages/privacy.html`,
    titleIncludes: 'Privacy',
  },
  {
    file: 'public/landing/pages/terms.html',
    canonical: `${ORIGIN}/pages/terms.html`,
    titleIncludes: 'Terms',
  },
];

/** Content of a `<meta name|property="x" content="y">` tag, or null. */
function meta(html, key) {
  const re = new RegExp(`<meta\\s+(?:name|property)=["']${key}["']\\s+content=["']([^"']*)["']`, 'i');
  const alt = new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+(?:name|property)=["']${key}["']`, 'i');
  return (html.match(re) || html.match(alt) || [])[1] ?? null;
}

function title(html) {
  return (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]?.trim() ?? '';
}

function canonical(html) {
  return (html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i) || [])[1] ?? null;
}

/** Every application/ld+json block, parsed. Throws on malformed JSON. */
function structuredData(html) {
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  return blocks.map((b) => JSON.parse(b[1]));
}

/** Resolves a sitemap URL to the file Vercel would serve for it. */
function fileForUrl(url) {
  assert.ok(url.startsWith(ORIGIN), `sitemap entry is not on the canonical origin: ${url}`);
  const pathname = url.slice(ORIGIN.length) || '/';

  if (pathname === '/') return 'public/landing/index.html';
  if (pathname === '/pricing') return 'public/landing/pages/pricing.html';
  if (pathname.startsWith('/pages/')) return `public/landing/${pathname.replace(/^\//, '')}`;
  return null;
}

test('robots.txt exists and points at the sitemap', () => {
  assert.ok(exists('public/robots.txt'), 'public/robots.txt is missing');
  const robots = read('public/robots.txt');
  assert.match(robots, /^User-agent: \*/m, 'robots.txt has no wildcard user-agent block');
  assert.ok(
    robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`),
    'robots.txt does not declare the absolute sitemap URL'
  );
});

test('robots.txt does not block the stylesheet the marketing pages need to render', () => {
  const robots = read('public/robots.txt');
  const disallows = [...robots.matchAll(/^Disallow:\s*(\S+)/gm)].map((m) => m[1]);

  // A renderer that is refused the CSS draws an unstyled page. `Disallow: /landing/`
  // looks like it only hides the duplicate HTML, and takes the stylesheet with it.
  for (const asset of ['/landing/css/style.css', '/landing/js/main.js']) {
    const blocked = disallows.find((d) => asset.startsWith(d));
    assert.ok(!blocked, `${asset} is blocked by "Disallow: ${blocked}"`);
  }
});

test('llms.txt answers what it is, who it is for and what it costs', () => {
  assert.ok(exists('public/llms.txt'), 'public/llms.txt is missing');
  const txt = read('public/llms.txt');

  assert.match(txt, /^# KaisySales/, 'llms.txt must open with the product name as an H1');
  assert.match(txt, /\bfree\b/i, 'llms.txt never says the product is free');
  assert.ok(txt.includes(`${ORIGIN}/pricing`), 'llms.txt does not link to the pricing page');

  for (const country of ['Ghana', 'Nigeria', 'Kenya', 'South Africa']) {
    assert.ok(txt.includes(country), `llms.txt does not mention ${country}`);
  }
});

test('the app shell is noindex so app routes cannot be indexed', () => {
  const shell = read('index.html');
  assert.match(
    shell,
    /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i,
    'index.html (the React shell served for every unmatched path) must carry a noindex robots tag'
  );
});

test('the sitemap parses, is canonical, and every entry resolves to a real file', () => {
  assert.ok(exists('public/sitemap.xml'), 'public/sitemap.xml is missing');
  const xml = read('public/sitemap.xml');

  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  assert.ok(locs.length >= 5, `expected at least 5 sitemap URLs, found ${locs.length}`);
  assert.equal(new Set(locs).size, locs.length, 'sitemap contains duplicate URLs');

  for (const loc of locs) {
    assert.ok(!loc.includes('/landing/'), `sitemap must not list the raw on-disk path: ${loc}`);
    const file = fileForUrl(loc);
    assert.ok(file, `no route mapping for sitemap URL ${loc}`);
    assert.ok(exists(file), `sitemap lists ${loc} but ${file} does not exist (soft 404)`);
  }

  assert.ok(locs.includes(`${ORIGIN}/`), 'sitemap is missing the homepage');
  assert.ok(locs.includes(`${ORIGIN}/pricing`), 'sitemap is missing /pricing');
});

test('every marketing page has a title, description, canonical, icon and og:image', () => {
  for (const page of PAGES) {
    const html = read(page.file);

    const t = title(html);
    assert.ok(t.length >= 15 && t.length <= 75, `${page.file}: title is ${t.length} chars ("${t}")`);
    assert.ok(t.includes(page.titleIncludes), `${page.file}: title does not mention ${page.titleIncludes}`);

    const description = meta(html, 'description');
    assert.ok(description, `${page.file}: no meta description`);
    assert.ok(
      description.length >= 50 && description.length <= 165,
      `${page.file}: meta description is ${description.length} chars`
    );

    assert.equal(canonical(html), page.canonical, `${page.file}: wrong canonical`);

    const robots = meta(html, 'robots');
    assert.ok(robots && /index/i.test(robots), `${page.file}: should be indexable`);

    assert.ok(
      /<link\s+rel=["']icon["'][^>]*href=["']\/favicon\.svg["']/i.test(html),
      `${page.file}: no favicon link`
    );

    assert.equal(meta(html, 'theme-color'), '#6F240A', `${page.file}: missing brand theme-color`);

    const image = meta(html, 'og:image');
    assert.ok(image, `${page.file}: no og:image`);
    assert.ok(image.startsWith(`${ORIGIN}/`), `${page.file}: og:image must be an absolute URL`);

    assert.equal(meta(html, 'og:image:width'), '1200', `${page.file}: og:image:width must be 1200`);
    assert.equal(meta(html, 'og:image:height'), '630', `${page.file}: og:image:height must be 630`);

    assert.equal(
      meta(html, 'twitter:card'),
      'summary_large_image',
      `${page.file}: twitter card must be summary_large_image`
    );
  }
});

test('the og:image it advertises is a real 1200x630 PNG', () => {
  assert.ok(exists('public/og-image.png'), 'public/og-image.png is missing');
  const png = readFileSync(path.join(ROOT, 'public/og-image.png'));

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(png.subarray(0, 8).equals(signature), 'public/og-image.png is not a PNG');
  assert.equal(png.readUInt32BE(16), 1200, 'og image width is not 1200');
  assert.equal(png.readUInt32BE(20), 630, 'og image height is not 630');
});

test('structured data on every page is valid JSON and names the product', () => {
  for (const page of PAGES) {
    const blocks = structuredData(read(page.file));
    assert.ok(blocks.length > 0, `${page.file}: no JSON-LD block`);

    const text = JSON.stringify(blocks);
    assert.ok(text.includes('KaisySales'), `${page.file}: JSON-LD does not name KaisySales`);
  }
});

test('the homepage declares the free offer and the countries it serves', () => {
  const blocks = structuredData(read('public/landing/index.html'));
  const graph = blocks.flatMap((b) => (Array.isArray(b['@graph']) ? b['@graph'] : [b]));

  const app = graph.find((n) => n['@type'] === 'SoftwareApplication');
  assert.ok(app, 'homepage JSON-LD has no SoftwareApplication');
  assert.equal(app.isAccessibleForFree, true, 'SoftwareApplication must say it is accessible for free');
  assert.equal(app.offers?.price, '0', 'the free offer must carry price "0"');

  const served = (app.areaServed || []).map((c) => c.name);
  for (const country of ['Ghana', 'Nigeria', 'Kenya', 'South Africa']) {
    assert.ok(served.includes(country), `areaServed is missing ${country}`);
  }

  const faq = graph.find((n) => n['@type'] === 'FAQPage');
  assert.ok(faq, 'homepage JSON-LD has no FAQPage');
  assert.ok(faq.mainEntity.length >= 3, 'homepage FAQPage should answer more than two questions');
});

test('the pricing page states the free price and backs it with a FAQ', () => {
  const html = read('public/landing/pages/pricing.html');
  const blocks = structuredData(html);
  const graph = blocks.flatMap((b) => (Array.isArray(b['@graph']) ? b['@graph'] : [b]));

  const app = graph.find((n) => n['@type'] === 'SoftwareApplication');
  assert.ok(app, 'pricing page JSON-LD has no SoftwareApplication');
  assert.equal(app.offers?.price, '0', 'pricing page offer must carry price "0"');

  const faq = graph.find((n) => n['@type'] === 'FAQPage');
  assert.ok(faq && faq.mainEntity.length >= 3, 'pricing page needs a FAQPage with real answers');

  // The schema must match what a visitor can actually read, or the answer engines
  // quote a page that says something else.
  const visible = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  for (const entry of faq.mainEntity) {
    assert.ok(
      visible.includes(entry.name),
      `pricing FAQ schema question is not visible on the page: "${entry.name}"`
    );
  }
});

test('no marketing page links to a placeholder anchor', () => {
  for (const page of PAGES) {
    const html = read(page.file);
    assert.ok(!/href=["']#["']/.test(html), `${page.file}: contains a dead href="#" link`);
  }
});

test('vercel.json serves / and /pricing by rewrite, not by redirect', () => {
  const config = JSON.parse(read('vercel.json'));

  const redirects = config.redirects || [];
  assert.ok(
    !redirects.some((r) => r.source === '/'),
    'a redirect on / makes the homepage and its own canonical disagree — use a rewrite'
  );

  const rewrites = config.rewrites || [];
  const sources = rewrites.map((r) => r.source);
  assert.ok(sources.includes('/pricing'), 'vercel.json has no /pricing rewrite');
  assert.ok(
    !sources.includes('/'),
    'do not rewrite / — the postbuild copies the landing page to dist/index.html so / is served from the filesystem'
  );

  const catchAll = rewrites.find((r) => r.source === '/:path*');
  assert.ok(catchAll, 'vercel.json has no catch-all rewrite');
  assert.equal(catchAll.destination, '/app.html', 'SPA catch-all must serve the postbuild app shell');
  assert.ok(
    sources.indexOf('/pricing') < sources.indexOf('/:path*'),
    '/pricing rewrite must come before the catch-all or the app shell answers it'
  );
});
