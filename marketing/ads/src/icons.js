// Feather-style stroke icons, 24x24, drawn as path data so they inherit colour.

export const ICONS = {
  box: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z M3 7.5 12 12l9-4.5 M12 12v9',
  cart: 'M3 4h2l2.4 10.2A2 2 0 0 0 9.4 16h7.6a2 2 0 0 0 2-1.6L20.5 8H6 M9.5 20h.01 M17.5 20h.01',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Z M9.5 8h5 M9.5 12h5',
  bars: 'M4 20V10 M10 20V4 M16 20v-7 M2 20h20',
  coins: 'M12 7c4.4 0 8-1.2 8-2.6S16.4 1.8 12 1.8 4 3 4 4.4 7.6 7 12 7Z M4 4.4v7.2c0 1.4 3.6 2.6 8 2.6s8-1.2 8-2.6V4.4',
  people: 'M16 20v-1.8a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20 M9 10.4a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2 M22 20v-1.8a4 4 0 0 0-3-3.9 M15 3.4a4 4 0 0 1 0 7',
  invoice: 'M6 3h9l4 4v14H6V3Z M15 3v4h4 M9.5 11h6 M9.5 15h6',
  wallet: 'M3 7.5A2.5 2.5 0 0 1 5.5 5H18a3 3 0 0 1 3 3v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5Z M18 12h3',
};

export function iconSvg(name, colour) {
  const d = (ICONS[name] || ICONS.bars).split(' M').join(' M');
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="' + colour + '" ' +
    'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="' + d + '" /></svg>'
  );
}
