// What each flyer says. The two modes never share a flyer: a retail shop has no
// income-tracking screen and a service business has no shelf to count, so a
// single "do everything" flyer would promise each of them a screen they do not
// have. Only the words, the icons and the accent colour change between them.
//
// Links: a printed URL cannot be measured, so every placement gets its own
// UTM-tagged link behind its own QR code. Admin -> Growth then shows which pile
// of flyers produced signups, and how many of those recorded anything.

import { P } from '../../ads/src/palette.js';

/**
 * Where a flyer sends people. Points at the live deployment: `kaisysales.com`
 * is printed on the video ads but does not resolve, and a dead URL cannot be
 * attributed. Change this one line once the domain is live.
 */
export const SITE = 'https://www.kaisysales.com';

/** utm_source / utm_medium per placement. One flyer pile must be one key. */
export const MEDIUMS = {
  print: 'print',
  social: 'social',
};

export function link({ source, medium, campaign }) {
  const params = new URLSearchParams({
    utm_source: source,
    utm_medium: medium,
    utm_campaign: campaign,
  });
  return `${SITE}/login?${params.toString()}`;
}

export const MODES = {
  retail: {
    id: 'retail',
    accent: P.terracotta,
    accentSoft: P.deepTerracotta,
    label: 'For retail shops',
    hook: ['Your shop never sits still.', 'Neither should your books.'],
    sub: 'Know what is on the shelf, what left it, and what you actually kept.',
    features: [
      { icon: 'box', title: 'Inventory', line: 'Know what is left on the shelf' },
      { icon: 'cart', title: 'Daily Sales', line: 'Record every sale in seconds' },
      { icon: 'receipt', title: 'Expenses', line: 'See exactly where money goes' },
      { icon: 'bars', title: 'Reporting', line: 'Know your real profit' },
    ],
    cta: 'Scan to start free',
    ctaLine: 'Set up in one sitting. Works on the phone in your pocket.',
  },
  services: {
    id: 'services',
    accent: P.forest,
    accentSoft: P.ochre,
    label: 'For service businesses',
    hook: ['Your clients never wait.', 'Neither should your work.'],
    sub: 'Track one-off and recurring income, send invoices, and see what you are owed.',
    features: [
      { icon: 'coins', title: 'Income Tracking', line: 'One-off and recurring, in one place' },
      { icon: 'people', title: 'Customers', line: 'Every client and what they owe' },
      { icon: 'invoice', title: 'Invoices', line: 'Send them, then get paid' },
      { icon: 'bars', title: 'Reporting', line: 'See your most profitable work' },
    ],
    cta: 'Scan to start free',
    ctaLine: 'Built for freelancers, studios and small teams in Ghana.',
  },
};

/** Trim size in millimetres (the PDF adds 3 mm bleed on every edge). */
export const FORMATS = {
  a5: { id: 'a5', w: 148, h: 210 },
  a4: { id: 'a4', w: 210, h: 297 },
};
