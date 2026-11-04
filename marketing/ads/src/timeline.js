// Builds the whole animation as one Animation per element: duration === the
// whole ad, keyframes placed at absolute times, fill 'both'. With exactly one
// animation per element there is no question of which of two overlapping
// effects wins, and `seek(t)` is exact because nothing here uses rAF, setTimeout
// or CSS transitions.

import { BEATS } from './ads.js';

const EASE = 'cubic-bezier(0.25,0.6,0.35,1)';
const EASE_IN = 'cubic-bezier(0.6,0,0.75,0.4)';
const STEPS = 10; // half-steps in the run cycle

const deg = (a) => `rotate(${a.toFixed(2)}deg)`;
const px = (x, y) => `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;

// A run-cycle trace that is always back at 0 by `end`, so the sit pose can be
// appended seamlessly.
function cyc(start, end, amp, phase, offset = 0, wave = Math.sin) {
  const pts = [];
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push({
      t: start + u * (end - start),
      a: offset + amp * wave(Math.PI * STEPS * u + phase),
    });
  }
  return pts;
}

const rot = (pts, to) => pts.map((p) => ({ t: p.t, transform: deg(p.a), ...(to || {}) }));

export function buildTimeline(root, L, ad, T) {
  const anims = [];
  const dur = T.duration;

  function track(sel, pointFn) {
    const els = typeof sel === 'string' ? Array.from(root.querySelectorAll(sel)) : [sel];
    if (!els.length) return;
    const frames = pointFn().map(({ t, easing, ...rest }) => {
      const kf = { offset: Math.min(1, Math.max(0, t / dur)), ...rest };
      if (easing) kf.easing = easing;
      return kf;
    });
    for (const el of els) {
      const a = el.animate(frames, { duration: dur * 1000, fill: 'both' });
      a.pause();
      anims.push(a);
    }
  }

  // ---- character: position, run bob, then the step back onto the chair -----
  track('.char-pos', () => {
    const pts = [];
    const n = 26;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      const x = -170 * (1 - (1 - Math.pow(1 - u, 2.4)));
      const y = -3 * Math.abs(Math.sin(Math.PI * STEPS * u));
      pts.push({ t: u * T.runEnd, transform: px(x, y) });
    }
    pts[pts.length - 1].easing = EASE;
    pts.push({ t: T.sitEnd, transform: px(-6, 24) });
    pts.push({ t: dur, transform: px(-6, 24) });
    return pts;
  });

  // ---- legs ---------------------------------------------------------------
  const legs = [
    ['-a', 0, -90, 90],
    ['-b', Math.PI, -89, 89],
  ];
  for (const [s, phase, sitThigh, sitShin] of legs) {
    track('.thigh' + s, () => {
      const pts = rot(cyc(0, T.runEnd, 26, phase));
      pts[pts.length - 1].easing = EASE;
      pts.push({ t: T.sitEnd, transform: deg(sitThigh) });
      pts.push({ t: dur, transform: deg(sitThigh) });
      return pts;
    });
    track('.shin' + s, () => {
      const pts = cyc(0, T.runEnd, 24, phase, 3, (v) => Math.abs(Math.sin(v))).map((p) => ({
        t: p.t,
        transform: deg(p.a),
      }));
      pts[pts.length - 1].easing = EASE;
      pts.push({ t: T.sitEnd, transform: deg(sitShin) });
      pts.push({ t: dur, transform: deg(sitShin) });
      return pts;
    });
    track('.foot' + s, () => {
      const pts = cyc(0, T.runEnd, 7, phase, 0, (v) => Math.abs(Math.sin(v))).map((p) => ({
        t: p.t,
        transform: deg(p.a),
      }));
      pts[pts.length - 1].easing = EASE;
      pts.push({ t: T.sitEnd, transform: deg(0) });
      pts.push({ t: dur, transform: deg(0) });
      return pts;
    });
  }

  // ---- torso lean and head -----------------------------------------------
  track('.torso', () => {
    const pts = cyc(0, T.runEnd, 2, Math.PI / 2, 6).map((p) => ({ t: p.t, transform: deg(p.a) }));
    pts[pts.length - 1].easing = EASE;
    pts.push({ t: T.sitEnd, transform: deg(4) });
    pts.push({ t: dur, transform: deg(4) });
    return pts;
  });
  track('.head-g', () => {
    const pts = cyc(0, T.runEnd, 1.6, Math.PI / 2, 1).map((p) => ({ t: p.t, transform: deg(p.a) }));
    pts[pts.length - 1].easing = EASE;
    pts.push({ t: T.sitEnd, transform: deg(2) });
    pts.push({ t: T.grabAt + 0.25, transform: deg(9), easing: EASE });
    pts.push({ t: dur, transform: deg(9) });
    return pts;
  });

  // ---- arms: swing in, rest, reach for the phone, bring it up ------------
  track('.arm-a', () => {
    const pts = rot(cyc(0, T.runEnd, 24, Math.PI, -4));
    pts[pts.length - 1].easing = EASE;
    pts.push({ t: T.sitEnd, transform: deg(-16) });
    pts.push({ t: T.grabAt, transform: deg(-74), easing: EASE });
    pts.push({ t: T.holdStart + BEATS.grab + 0.2, transform: deg(-30), easing: EASE });
    pts.push({ t: dur, transform: deg(-26) });
    return pts;
  });
  track('.fore-a', () => {
    const pts = rot(cyc(0, T.runEnd, 11, Math.PI, -14));
    pts[pts.length - 1].easing = EASE;
    pts.push({ t: T.sitEnd, transform: deg(-16) });
    pts.push({ t: T.grabAt, transform: deg(-26), easing: EASE });
    pts.push({ t: T.holdStart + BEATS.grab + 0.2, transform: deg(-86), easing: EASE });
    pts.push({ t: dur, transform: deg(-90) });
    return pts;
  });
  track('.arm-b', () => {
    const pts = rot(cyc(0, T.runEnd, 24, 0, -4));
    pts[pts.length - 1].easing = EASE;
    pts.push({ t: T.sitEnd, transform: deg(-14) });
    pts.push({ t: dur, transform: deg(-22) });
    return pts;
  });
  track('.fore-b', () => {
    const pts = rot(cyc(0, T.runEnd, 11, 0, -14));
    pts[pts.length - 1].easing = EASE;
    pts.push({ t: T.sitEnd, transform: deg(-22) });
    pts.push({ t: dur, transform: deg(-34) });
    return pts;
  });

  // ---- the phone: on the table, then in the hand, screen lit -------------
  track('.prop-phone', () => [
    { t: 0, opacity: '1' },
    { t: T.grabAt, opacity: '1' },
    { t: T.grabAt + 0.04, opacity: '0' },
    { t: dur, opacity: '0' },
  ]);
  track('.dock', () => [
    { t: 0, opacity: '1' },
    { t: T.grabAt + 1.4, opacity: '1' },
    { t: T.grabAt + 2, opacity: '0' },
    { t: dur, opacity: '0' },
  ]);
  track('.hand-phone', () => [
    { t: 0, opacity: '0' },
    { t: T.grabAt, opacity: '0' },
    { t: T.grabAt + 0.04, opacity: '1' },
    { t: dur, opacity: '1' },
  ]);
  track('.phone-tilt', () => [
    { t: 0, transform: deg(104) },
    { t: T.grabAt, transform: deg(104) },
    { t: T.holdStart + BEATS.grab + 0.4, transform: deg(88), easing: EASE },
    { t: dur, transform: deg(88) },
  ]);
  track('.screen', () => [
    { t: 0, opacity: '0.25' },
    { t: T.grabAt, opacity: '0.25' },
    { t: T.grabAt + 0.4, opacity: '0.95', easing: EASE },
    { t: dur, opacity: '0.95' },
  ]);

  const glow = [
    { t: 0, opacity: '0' },
    { t: T.grabAt, opacity: '0' },
    { t: T.grabAt + 0.3, opacity: '0.5', easing: EASE },
  ];
  T.cards.forEach((c) => {
    glow.push({ t: c, opacity: '0.62', easing: EASE });
    glow.push({ t: c + 0.7, opacity: '0.3' });
  });
  glow.push({ t: dur, opacity: '0.34' });
  track('.phone-glow', () => glow);

  // ---- copy: wordmark, the two hook lines --------------------------------
  track('.wordmark', () => [
    { t: 1.1, opacity: '0', transform: 'translateY(14px)' },
    { t: 1.75, opacity: '1', transform: 'translateY(0px)', easing: EASE },
    { t: T.endStart, opacity: '1', transform: 'translateY(0px)' },
    { t: T.endStart + 0.2, opacity: '0', transform: 'translateY(-10px)' },
    { t: dur, opacity: '0' },
  ]);
  const hooks = [
    [0.55, T.cardsStart - 0.55],
    [T.sitEnd + 0.15, T.cardsStart - 0.15],
  ];
  hooks.forEach(([inAt, outAt], i) => {
    track('.hook-line[data-i="' + i + '"]', () => [
      { t: 0, opacity: '0', transform: 'translateY(18px)' },
      { t: inAt, opacity: '0', transform: 'translateY(18px)' },
      { t: inAt + 0.55, opacity: '1', transform: 'translateY(0px)', easing: EASE },
      { t: outAt, opacity: '1', transform: 'translateY(0px)' },
      { t: outAt + 0.4, opacity: '0', transform: 'translateY(-14px)' },
      { t: dur, opacity: '0' },
    ]);
  });

  // ---- the four feature cards -------------------------------------------
  const stacked = !!L.stack;
  T.cards.forEach((c, i) => {
    const inAt = c;
    const out = stacked || i === 3 ? T.endStart : c + BEATS.card - BEATS.cardOut;
    track('.card[data-i="' + i + '"]', () => [
      { t: 0, opacity: '0', transform: 'translateX(80px) scale(0.97)' },
      { t: inAt, opacity: '0', transform: 'translateX(80px) scale(0.97)' },
      { t: inAt + BEATS.cardIn, opacity: '1', transform: 'translateX(0px) scale(1)', easing: EASE },
      { t: out, opacity: '1', transform: 'translateX(0px) scale(1)' },
      { t: out + BEATS.cardOut, opacity: '0', transform: 'translateX(-46px) scale(0.98)', easing: EASE_IN },
      { t: dur, opacity: '0', transform: 'translateX(-46px) scale(0.98)' },
    ]);
  });

  // progress dots (portrait only)
  if (L.dots) {
    for (let i = 0; i < 4; i++) {
      const on = T.cards[i];
      const off = i < 3 ? T.cards[i + 1] : T.endStart;
      track('.dot[data-i="' + i + '"]', () => [
        { t: 0, width: '16px', opacity: '0.35', transform: 'scale(1)' },
        { t: on, width: '16px', opacity: '0.35', transform: 'scale(1)' },
        { t: on + 0.35, width: '44px', opacity: '1', transform: 'scale(1)', easing: EASE },
        { t: off, width: '44px', opacity: '1', transform: 'scale(1)' },
        { t: off + 0.3, width: '16px', opacity: '0.35', transform: 'scale(1)' },
        { t: dur, width: '16px', opacity: '0.35', transform: 'scale(1)' },
      ]);
    }
  }

  // ---- end card ----------------------------------------------------------
  track('#end', () => [
    { t: 0, opacity: '0' },
    { t: T.endStart, opacity: '0' },
    { t: T.endStart + BEATS.endIn, opacity: '1', easing: EASE },
    { t: dur, opacity: '1' },
  ]);
  const stagger = [
    ['#end .end-logo', T.endStart + 0.08],
    ['#end .end-head', T.endStart + 0.26],
    ['#end .end-url', T.endStart + 0.58],
  ];
  stagger.forEach(([sel, at]) => {
    track(sel, () => [
      { t: 0, opacity: '0', transform: 'translateY(22px)' },
      { t: at, opacity: '0', transform: 'translateY(22px)' },
      { t: at + 0.5, opacity: '1', transform: 'translateY(0px)', easing: EASE },
      { t: dur, opacity: '1', transform: 'translateY(0px)' },
    ]);
  });
  // The button gets a single animation: opacity and the settle-pulse together,
  // never two effects fighting over `transform`.
  track('#end .end-cta', () => [
    { t: 0, opacity: '0', transform: 'translateY(22px) scale(1)' },
    { t: T.endStart + 0.44, opacity: '0', transform: 'translateY(22px) scale(1)' },
    { t: T.endStart + 0.94, opacity: '1', transform: 'translateY(0px) scale(1)', easing: EASE },
    { t: T.endStart + 1.5, opacity: '1', transform: 'translateY(0px) scale(1.05)', easing: EASE },
    { t: T.endStart + 2.1, opacity: '1', transform: 'translateY(0px) scale(1)', easing: EASE },
    { t: dur, opacity: '1', transform: 'translateY(0px) scale(1)' },
  ]);
  track('#end .end-logo', () => [
    { t: T.endStart + 0.08, transform: 'translateY(22px) rotate(-14deg) scale(0.7)' },
    { t: T.endStart + 0.72, transform: 'translateY(0px) rotate(0deg) scale(1)', easing: EASE },
    { t: dur, transform: 'translateY(0px) rotate(0deg) scale(1)' },
  ]);

  return { animations: anims, duration: dur };
}
