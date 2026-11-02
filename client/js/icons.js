// Einfarbige Linien-Icons (24×24, SVG-Pfade). Als Inline-SVG fürs Menü (Farbe = currentColor)
// oder per Path2D auf ein Canvas gezeichnet (Embleme, Kleider-Vorschaubilder).

// f: true = gefüllte Form statt Kontur
const I = {
  play: { d: 'M7 4.5v15l12.5-7.5z', f: true },
  helmet: { d: 'M4 15a8 8 0 0 1 16 0 M2.5 15h19v2.5h-19z M12 7v3.5 M7 17.5v2.5 M17 17.5v2.5' },
  cart: { d: 'M2.5 4h2.5l2.4 11h10.4l2-8H6 M9 20h.01 M17 20h.01' },
  star: { d: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z' },
  scroll: { d: 'M8 3h10a2 2 0 0 1 2 2v1h-4 M16 5v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1h10v1a2 2 0 0 0 2 2 M8 3a2 2 0 0 0-2 2v13 M9 8h4 M9 12h4' },
  gear: { d: 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z M12 5.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13z M12 2v3.5 M12 18.5V22 M2 12h3.5 M18.5 12H22 M4.9 4.9l2.5 2.5 M16.6 16.6l2.5 2.5 M4.9 19.1l2.5-2.5 M16.6 7.4l2.5-2.5' },
  joystick: { d: 'M12 3a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z M12 8v7 M4 15h16v5H4z M7 17.5h2' },
  lock: { d: 'M5 11h14v10H5z M8 11V7.5a4 4 0 0 1 8 0V11 M12 15v2' },
  check: { d: 'M4 12.5l5 5L20 6.5' },
  key: { d: 'M7.5 11.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7z M10 13L20 3 M16 7l3 3 M13.5 9.5l2 2' },
  eye: { d: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z' },
  target: { d: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z M12 1v4 M12 19v4 M1 12h4 M19 12h4' },
  run: { d: 'M15 3a1.7 1.7 0 1 0 0 3.4a1.7 1.7 0 1 0 0-3.4z M5 21l4-5.5 3 2.5v4 M13.5 8.5L9.5 11l2.5 4.5 M13.5 8.5l2.5 3.5h4 M9.5 11L6.5 10l-2 2.5' },
  heart: { d: 'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z' },
  parachute: { d: 'M3 11a9 7 0 0 1 18 0z M3 11l8 8 M21 11l-8 8 M12 11v8 M8 11l3.5 8 M16 11l-3.5 8 M10.5 19h3v3h-3z' },
  swords: { d: 'M3 3l12.5 12.5 M13 18l5-5 M16.5 16.5L21 21 M21 3L8.5 15.5 M6 13l5 5 M7.5 16.5L3 21' },
  users: { d: 'M9 6a3 3 0 1 0 0 6a3 3 0 1 0 0-6z M3 20a6 6 0 0 1 12 0 M16 6.5a2.6 2.6 0 1 1 0 5.2 M17.5 14.5a5 5 0 0 1 3.5 5.5' },
  crown: { d: 'M3 18L2 7.5l5 4 5-7 5 7 5-4L21 18z M3 21h18' },
  refresh: { d: 'M20 12a8 8 0 1 1-2.3-5.7L20 8.5 M20 3.5v5h-5' },
  dice: { d: 'M4 4h16v16H4z M8.5 8.5h.01 M15.5 8.5h.01 M12 12h.01 M8.5 15.5h.01 M15.5 15.5h.01' },
  trophy: { d: 'M7 3.5h10V9a5 5 0 0 1-10 0z M7 5.5H4v1.5a3 3 0 0 0 3 3 M17 5.5h3v1.5a3 3 0 0 1-3 3 M12 14v4 M8 21h8 M9 18h6' },
  box: { d: 'M3 7.5l9-4 9 4v9l-9 4-9-4z M3 7.5l9 4 9-4 M12 11.5v9 M7.5 5.5l9 4' },
  medal: { d: 'M8 2.5l4 7 4-7 M12 21.5a5.5 5.5 0 1 0 0-11a5.5 5.5 0 1 0 0 11z M12 13.5l.9 1.8 2 .3-1.45 1.4.35 2-1.8-1-1.8 1 .35-2-1.45-1.4 2-.3z' },
  warn: { d: 'M12 3l10 18H2z M12 10v5 M12 18h.01' },
  timer: { d: 'M12 7a7 7 0 1 0 0 14a7 7 0 1 0 0-14z M12 10.5V14l2.5 2 M9.5 2.5h5 M12 2.5V7' },
  shirt: { d: 'M8 3L3 6l2 5.5 2.5-1V21h9V10.5l2.5 1L21 6l-5-3c-.6 1.6-2 2.5-4 2.5S8.6 4.6 8 3z' },
  // Embleme
  spark: { d: 'M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z', f: true },
  flame: { d: 'M12 22a7 7 0 0 1-7-7c0-4 3-6 4-10.5 2 1.8 3.2 4 3.2 6.2 1-1 1.8-2.2 1.8-4 3 2.6 5 5.3 5 8.3a7 7 0 0 1-7 7z', f: true },
  shield: { d: 'M12 2.5l8 3v6.5c0 5-3.5 8.3-8 9.5-4.5-1.2-8-4.5-8-9.5V5.5z M12 7v10 M7.5 11.5h9' },
  wolf: { d: 'M4 2.5l4.5 5h7L20 2.5V12l-3 5-5 4.5L7 17l-3-5z M9 12.5h.01 M15 12.5h.01 M10.5 17h3', },
  core: { d: 'M12 2l9 10-9 10-9-10z M12 7.5l4 4.5-4 4.5-4-4.5z' },
  phoenix: { d: 'M2 6c4.5 0 7.5 2.5 10 6.5C14.5 8.5 17.5 6 22 6c-2 4.5-5 7.5-8 8.5L12 21l-2-6.5C7 13.5 4 10.5 2 6z', f: true },
};

// Inline-SVG für HTML (übernimmt die Textfarbe)
export function ic(name, cls = '') {
  const s = I[name];
  if (!s) return '';
  const paint = s.f ? 'fill="currentColor" stroke="none"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" ${paint}><path d="${s.d}"/></svg>`;
}

// Icon auf ein Canvas zeichnen (x/y = linke obere Ecke)
export function drawIcon(ctx, name, x, y, size, color = '#ffffff') {
  const s = I[name];
  if (!s) return;
  ctx.save();
  ctx.translate(x, y); ctx.scale(size / 24, size / 24);
  ctx.fillStyle = ctx.strokeStyle = color;
  ctx.lineWidth = 2; ctx.lineCap = ctx.lineJoin = 'round';
  const p = new Path2D(s.d);
  if (s.f) ctx.fill(p); else ctx.stroke(p);
  ctx.restore();
}

// ------------------------------------------------------------ Kleider-Icons in Form des Teils
// Jedes Teil: Liste von Formen. fill: 'item' = Grauton aus der Teil-Farbe, 'skin' = neutrales Grau,
// 'bg' = Hintergrund (Aussparung), 'none' = nur Kontur, 'line'/'lineW' = Detail-Linie (auf dem Teil / immer weiss).
const HEAD = 'M6 11.5a6 7.5 0 1 0 12 0a6 7.5 0 1 0-12 0z';
const HELM = 'M3.5 15a8.5 8.5 0 0 1 17 0v1.8h-17z';
const CLOTH = {
  uniform: [{ d: 'M8 3L3 6l2 5.5 2.5-1V21h9V10.5l2.5 1L21 6l-5-3c-.6 1.6-2 2.5-4 2.5S8.6 4.6 8 3z', fill: 'item' },
    { d: 'M12 5.5V21 M8.5 9.5h2 M13.5 9.5h2', fill: 'line' }],
  pants: [{ d: 'M6 3h12l1.2 18h-5L12 10l-2.2 11h-5z', fill: 'item' },
    { d: 'M6.2 6h11.6 M12 6v4 M7.5 11h2.5 M14 11h2.5', fill: 'line' }],
  vest: [{ d: 'M7 3h3l1 3h2l1-3h3l1.5 4v13.5h-11V7z', fill: 'item' },
    { d: 'M7.8 13.5h2.6v4.5H7.8z M10.7 13.5h2.6v4.5h-2.6z M13.6 13.5h2.6v4.5h-2.6z M6.5 10h11', fill: 'line' }],
  helm: [{ d: HELM, fill: 'item' }, { d: 'M12 6.5v3 M5.5 13h13', fill: 'line' }],
  nvg: [{ d: HELM, fill: 'item' }, { d: 'M10 9h4v4h-4z', fill: 'line' },
    { d: 'M8.6 16.8h2.8v4.4H8.6z M12.6 16.8h2.8v4.4h-2.8z', fill: 'item' }],
  cap: [{ d: 'M5 14a7 7 0 0 1 14 0z', fill: 'item' }, { d: 'M5 14h15.5a1.5 1.5 0 0 1 0 3H5z', fill: 'item' },
    { d: 'M12 7v.01 M12 7v7', fill: 'line' }],
  beret: [{ d: 'M3 14c0-4.2 4.3-7 10-7 5 0 8.5 2.2 8.5 4.8S18 15.5 14 15.5H4z', fill: 'item' },
    { d: 'M4 15.5h11v2.5H4z', fill: 'item' }, { d: 'M13 7l.6-2.2', fill: 'line' }],
  crown: [{ d: 'M3.5 18L2.5 7.5l5 4 4.5-7 4.5 7 5-4-1 10.5z', fill: 'item' }, { d: 'M3.5 20.5h17', fill: 'lineW' },
    { d: 'M12 12h.01 M7.5 15h.01 M16.5 15h.01', fill: 'line' }],
  hair: [{ d: HEAD, fill: 'skin' }, { d: 'M5.5 11.5C5.5 6 8.3 3.5 12 3.5S18.5 6 18.5 11.5C17 9.3 15.3 8 12 8s-5 1.3-6.5 3.5z', fill: 'item' }],
  maskNone: [{ d: HEAD, fill: 'none' }, { d: 'M5 20L19 3', fill: 'lineW' }],
  bala: [{ d: HEAD, fill: 'item' }, { d: 'M8 9.5h8v3.2H8z', fill: 'bg' }, { d: 'M10 10.5h.01 M14 10.5h.01', fill: 'lineW' }],
  bandana: [{ d: HEAD, fill: 'none' }, { d: 'M9.5 9.5h.01 M14.5 9.5h.01', fill: 'lineW' },
    { d: 'M5.7 12.5h12.6l-.8 3.2L12 20.5l-5.5-4.8z', fill: 'item' }],
  eyes: [{ d: 'M3 8.5h18v6a2 2 0 0 1-2 2h-4.3L12 14.5l-2.7 2H5a2 2 0 0 1-2-2z', fill: 'item' },
    { d: 'M1 11h2 M21 11h2', fill: 'lineW' }, { d: 'M12 8.5v5', fill: 'line' }],
  face: [{ d: HEAD, fill: 'item' }, { d: 'M4 22.5c1-3.5 4-5 8-5s7 1.5 8 5', fill: 'item' },
    { d: 'M9.5 10.5h.01 M14.5 10.5h.01 M10.5 14.5h3', fill: 'line' }],
};
function clothShape(item) {
  if (item.slot === 'headgear') return item.shape === 'none' ? CLOTH.hair : CLOTH[item.shape] || CLOTH.helm;
  if (item.slot === 'mask') return item.shape === 'bala' ? CLOTH.bala : item.shape === 'bandana' ? CLOTH.bandana : CLOTH.maskNone;
  return CLOTH[item.slot] || CLOTH.uniform;
}

// Inline-SVG für eine Kleider-Kategorie (Reiter, Überschriften) – Kontur des typischen Teils
const SLOT_SHAPE = { uniform: CLOTH.uniform, pants: CLOTH.pants, vest: CLOTH.vest, headgear: CLOTH.helm, mask: CLOTH.bala, eyes: CLOTH.eyes, face: CLOTH.face };
export function slotIc(slot) {
  const d = (SLOT_SHAPE[slot] || CLOTH.uniform).map(p => p.d).join(' ');
  return `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

// Schwarz-weisses Vorschaubild; die Helligkeit der Teil-Farbe bleibt als Grauton erkennbar
export function drawClothIcon(ctx, item, size) {
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#2e2e2e'); g.addColorStop(1, '#0e0e0e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const h = parseInt((item.color || '#888888').slice(1), 16);
  const lum = (0.2126 * (h >> 16) + 0.7152 * (h >> 8 & 255) + 0.0722 * (h & 255)) / 255;
  const v = Math.round(60 + lum * 180), tone = `rgb(${v},${v},${v})`;
  const line = v > 170 ? '#141414' : '#f2f2f2'; // Details heben sich vom Grauton ab
  const pad = size * 0.14, k = (size - pad * 2) / 24;
  ctx.save();
  ctx.translate(pad, pad); ctx.scale(k, k);
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const part of clothShape(item)) {
    const p = new Path2D(part.d);
    if (part.fill === 'line' || part.fill === 'lineW') { ctx.strokeStyle = part.fill === 'line' ? line : '#f2f2f2'; ctx.lineWidth = 1.3; ctx.stroke(p); continue; }
    if (part.fill !== 'none') { ctx.fillStyle = part.fill === 'item' ? tone : part.fill === 'skin' ? '#4a4a4a' : '#151515'; ctx.fill(p); }
    ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 1.4; ctx.stroke(p);
  }
  ctx.restore();
}
