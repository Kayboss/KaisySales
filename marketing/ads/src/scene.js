// The illustration layer: one SVG string, built from the layout geometry.
// Every animated group is addressed by class and rotated around its own local
// origin (the joint), which is why each joint is its own nested <g> whose
// local (0,0) is the pivot.

import { P, SKIN, SKIN_DARK, TROUSER, SHOE } from './palette.js';

const WRAP = P.ochre;
const GOLD = P.gold;

function leg(side, x) {
  return `
  <g transform="translate(${x},-48)">
    <g class="thigh-${side}">
      <rect x="-3.4" y="-2" width="6.8" height="26" rx="3.4" fill="${TROUSER}"/>
      <g transform="translate(0,24)">
        <g class="shin-${side}">
          <rect x="-2.8" y="-1" width="5.6" height="23" rx="2.8" fill="${TROUSER}"/>
          <g transform="translate(0,22)">
            <g class="foot-${side}">
              <path d="M-2.8,-2 h7.2 q3.2,0 3.2,3.2 v0.8 h-10.4 z" fill="${SHOE}"/>
            </g>
          </g>
        </g>
      </g>
    </g>
  </g>`;
}

function arm(side) {
  const skin = side === 'b' ? SKIN_DARK : SKIN;
  const sleeve = side === 'b' ? P.deepTerracotta : P.terracotta;
  return `
  <g class="arm-${side}">
    <rect x="-2.4" y="-2" width="4.8" height="9" rx="2.4" fill="${sleeve}"/>
    <rect x="-2.1" y="5" width="4.2" height="16" rx="2.1" fill="${skin}"/>
    <g transform="translate(0,20)">
      <g class="fore-${side}">
        <rect x="-2" y="-1" width="4" height="17" rx="2" fill="${skin}"/>
        <g class="hand-phone" transform="translate(0.6,17)">
          <g class="phone-tilt">
            <rect x="-3" y="-9.6" width="6" height="12" rx="1.7" fill="${P.charcoal}"/>
            <rect class="screen" x="-2.1" y="-8.4" width="4.2" height="9.8" rx="0.9" fill="${GOLD}" opacity="0.35"/>
          </g>
        </g>
        <circle cx="0.4" cy="18.2" r="3.4" fill="${skin}"/>
      </g>
    </g>
  </g>`;
}

function head() {
  return `
  <g transform="translate(0,-31)">
    <g class="head-g">
      <rect x="-2.3" y="-2" width="4.6" height="7" rx="2" fill="${SKIN_DARK}"/>
      <circle cx="0.4" cy="-11" r="6.4" fill="${SKIN}"/>
      <circle cx="-5.3" cy="-10.6" r="1.7" fill="${SKIN_DARK}"/>
      <circle cx="1.4" cy="-11.6" r="0.78" fill="${P.charcoal}"/>
      <circle cx="4.5" cy="-11.4" r="0.78" fill="${P.charcoal}"/>
      <path d="M2.1,-8.4 q1.6,1.5 3.3,0" fill="none" stroke="${P.charcoal}" stroke-width="0.7" stroke-linecap="round"/>
      <path d="M-6.6,-10.6 a6.6,6.6 0 0 1 13.1,-1.3 q-2.4,2.2 -6.5,2.2 q-4,0 -6.6,-0.9 z" fill="${WRAP}"/>
      <path d="M-6.3,-13.6 a6.6,6.6 0 0 1 12.3,-1.4" fill="none" stroke="${GOLD}" stroke-width="1.1" stroke-linecap="round"/>
      <circle cx="-6.9" cy="-13.2" r="2.5" fill="${GOLD}"/>
    </g>
  </g>`;
}

function torso() {
  return `
  <g class="torso-shape">
    <path d="M-7.4,-8 L7.4,-8 L11.6,22 q-11.6,4 -23.2,0 z" fill="${P.forest}"/>
    <path d="M-11.2,19 q11.2,3.8 22.4,0" fill="none" stroke="${GOLD}" stroke-width="0.9"/>
    <path d="M-7.2,-31 q7.2,-2.8 14.4,0 L6.8,-7 q-6.8,2.4 -13.6,0 z" fill="${P.terracotta}"/>
    <path d="M-7,-9.4 h14 v3.2 q-7,2.2 -14,0 z" fill="${GOLD}" opacity="0.9"/>
  </g>`;
}

// Chair, side table and the phone waiting on its dock. Drawn in unit space, so
// the table sits a full arm's reach in front of the seat.
function props() {
  return `
  <ellipse class="chair-shadow" cx="4" cy="3" rx="46" ry="6" fill="${P.charcoal}" opacity="0.07"/>
  <g class="chair">
    <rect x="-17" y="-24" width="27" height="9" rx="3" fill="${P.deepTerracotta}"/>
    <rect x="-15.5" y="-24" width="2.6" height="24" fill="${P.ochre}"/>
    <rect x="3" y="-24" width="2.6" height="24" fill="${P.ochre}"/>
    <rect x="-17" y="-46" width="6" height="24" rx="2.6" fill="${P.ochre}"/>
    <rect x="-19.6" y="-47" width="9.6" height="4" rx="2" fill="${P.deepTerracotta}"/>
  </g>
  <g class="table">
    <path d="M18.5,-45.5 h18 v45.5 h-18 z" fill="${P.ochre}"/>
    <rect x="18.5" y="-45.5" width="18" height="5" fill="${GOLD}" opacity="0.4"/>
    <rect x="22" y="-40" width="1.6" height="40" fill="${P.charcoal}" opacity="0.12"/>
    <rect x="31.4" y="-40" width="1.6" height="40" fill="${P.charcoal}" opacity="0.12"/>
  </g>
  <g class="dock">
    <rect x="23.7" y="-45.5" width="7.6" height="3.6" rx="1.4" fill="${P.charcoal}" opacity="0.75"/>
  </g>
  <g class="prop-phone">
    <rect x="23.9" y="-58.8" width="7.2" height="13.3" rx="1.9" fill="${P.charcoal}"/>
    <rect x="24.7" y="-58" width="5.6" height="11.7" rx="1.1" fill="${GOLD}" opacity="0.55"/>
  </g>`;
}

function background(L, ad) {
  const { w, h, groundY } = L;
  const arcs = [340, 470, 610]
    .map((r) => `<circle cx="${L.charGroundX + 40}" cy="${groundY - 250}" r="${r}" fill="none" stroke="${ad.accent}" stroke-width="${Math.max(2, w / 540)}" opacity="0.07"/>`)
    .join('');
  return `
  <rect width="${w}" height="${h}" fill="${P.cream}"/>
  <circle cx="${w * 0.88}" cy="${h * 0.1}" r="${w * 0.17}" fill="${GOLD}" opacity="0.16"/>
  <circle cx="${-w * 0.06}" cy="${h * 0.86}" r="${w * 0.3}" fill="${P.forest}" opacity="0.06"/>
  ${arcs}
  <rect y="${groundY - 2}" width="${w}" height="${h - groundY + 2}" fill="${P.ochre}" opacity="0.07"/>
  <line x1="0" y1="${groundY}" x2="${w}" y2="${groundY}" stroke="${P.outline}" stroke-width="2" opacity="0.7"/>`;
}

export function buildScene(L, ad) {
  const t = `translate(${L.charGroundX},${L.groundY}) scale(${L.scale})`;
  return `
<svg class="art" width="${L.w}" height="${L.h}" viewBox="0 0 ${L.w} ${L.h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow">
      <stop offset="0%" stop-color="${GOLD}" stop-opacity="0.85"/>
      <stop offset="45%" stop-color="${GOLD}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  ${background(L, ad)}
  <g class="props" transform="${t}">${props()}</g>
  <g class="char-wrap" transform="${t}">
    <g class="char-pos">
      <ellipse class="char-shadow" cx="0" cy="3" rx="24" ry="4.4" fill="${P.charcoal}" opacity="0.1"/>
      ${leg('b', -3.6)}
      <g transform="translate(0,-48)">
        <g class="torso">
          <g transform="translate(-1.6,-31)">${arm('b')}</g>
          ${torso()}
          ${head()}
          <g transform="translate(1.6,-31)">${arm('a')}</g>
        </g>
      </g>
      ${leg('a', 3.6)}
    </g>
  </g>
  <g class="glow-layer" transform="${t}">
    <circle class="phone-glow" cx="17" cy="-44" r="46" fill="url(#glow)" opacity="0"/>
  </g>
</svg>`;
}
