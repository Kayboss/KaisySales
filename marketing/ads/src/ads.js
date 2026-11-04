// Per-ad copy and layout-independent content.
// The character and the four card beats are identical in shape between ads;
// only the words, the icons and the accent colour change.

import { P } from './palette.js';

export const ADS = {
  retail: {
    id: 'retail',
    accent: P.terracotta,
    accentSoft: P.deepTerracotta,
    wordmark: 'KaisySales',
    hook: ['Your shop never sits still.', 'Neither should your books.'],
    intro: 'Retail',
    features: [
      { icon: 'box', title: 'Inventory', line: 'Know what is left on the shelf' },
      { icon: 'cart', title: 'Daily Sales', line: 'Record every sale in seconds' },
      { icon: 'receipt', title: 'Expenses', line: 'See exactly where money goes' },
      { icon: 'bars', title: 'Reporting', line: 'Know your real profit' },
    ],
    end: {
      headline: 'Know your Business,\nStay in Control',
      button: 'Start free today',
      url: 'kaisysales.com',
    },
  },
  services: {
    id: 'services',
    accent: P.forest,
    accentSoft: P.ochre,
    wordmark: 'KaisySales',
    hook: ['Your clients never wait.', 'Neither should your work.'],
    intro: 'Services',
    features: [
      { icon: 'coins', title: 'Income Tracking', line: 'One-off and recurring, in one place' },
      { icon: 'people', title: 'Customers', line: 'Every client and what they owe' },
      { icon: 'invoice', title: 'Invoices', line: 'Send them, then get paid' },
      { icon: 'bars', title: 'Reporting', line: 'See your most profitable work' },
    ],
    end: {
      headline: 'Know your Business,\nStay in Control',
      button: 'Start free today',
      url: 'kaisysales.com',
    },
  },
};

// The single timeline, in seconds. Everything in timeline.js is derived from
// these beats so the two ads and both ratios stay frame-identical in timing.
export const BEATS = {
  run: 2.6,
  sit: 1.0,
  reach: 0.65,
  grab: 0.6,
  hold: 0.85,
  setup: 0.25,
  card: 2.6,
  cardIn: 0.55,
  cardOut: 0.4,
  endIn: 0.5,
  endHold: 2.6,
};

export function schedule() {
  const t = {};
  t.runEnd = BEATS.run;
  t.sitEnd = t.runEnd + BEATS.sit;
  // Phone beat runs from sitEnd.
  t.reachStart = t.sitEnd;
  t.grabAt = t.reachStart + BEATS.reach;
  t.holdStart = t.grabAt + BEATS.grab;
  t.holdEnd = t.holdStart + BEATS.hold;
  t.cardsStart = t.holdEnd + BEATS.setup;
  t.cards = [0, 1, 2, 3].map((i) => t.cardsStart + i * BEATS.card);
  t.endStart = t.cardsStart + 4 * BEATS.card;
  t.duration = t.endStart + BEATS.endIn + BEATS.endHold;
  return t;
}
