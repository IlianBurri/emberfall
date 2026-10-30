// Alle Spieldaten: Waffen, Aufsätze, Skins, Kisten, Missionen, Quests, Maps.

export const CURRENCY = 'Splitter';

// ---------------------------------------------------------------- Waffen
// spread in Grad, recoil in Grad pro Schuss, range = Meter ohne Schadensabfall
export const WEAPONS = {
  falke: {
    id: 'falke', name: 'Falke AR-7', cls: 'ar', clsName: 'Sturmgewehr', slot: 'primary', price: 0,
    desc: 'Zuverlässiges Allround-Sturmgewehr der Einheit Morgenrot.',
    dmg: 24, headMult: 1.6, rpm: 660, mode: 'auto', mag: 30, reserve: 180, reload: 2.1,
    spreadHip: 3.2, spreadAds: 0.55, recoilV: 0.85, recoilH: 0.35, range: 35, minDmg: 0.6, zoom: 1.35, adsTime: 0.22, move: 0.95,
  },
  wespe: {
    id: 'wespe', name: 'Wespe MP-9', cls: 'smg', clsName: 'Maschinenpistole', slot: 'primary', price: 900,
    desc: 'Irre Feuerrate, perfekt für enge Gassen.',
    dmg: 18, headMult: 1.4, rpm: 920, mode: 'auto', mag: 35, reserve: 210, reload: 1.8,
    spreadHip: 3.0, spreadAds: 1.1, recoilV: 0.55, recoilH: 0.45, range: 16, minDmg: 0.55, zoom: 1.2, adsTime: 0.16, move: 1.06,
  },
  kolibri: {
    id: 'kolibri', name: 'Kolibri DMR-15', cls: 'dmr', clsName: 'Präzisionsgewehr', slot: 'primary', price: 1500,
    desc: 'Halbautomatisch, schlägt hart und präzise auf mittlere Distanz.',
    dmg: 46, headMult: 1.9, rpm: 330, mode: 'semi', mag: 15, reserve: 90, reload: 2.4,
    spreadHip: 4.0, spreadAds: 0.15, recoilV: 1.9, recoilH: 0.4, range: 60, minDmg: 0.75, zoom: 2.0, adsTime: 0.27, move: 0.93,
  },
  brecher: {
    id: 'brecher', name: 'Brecher SG-12', cls: 'shotgun', clsName: 'Schrotflinte', slot: 'primary', price: 1200,
    desc: 'Pump-Action. Wer nah rankommt, gewinnt.',
    dmg: 14, pellets: 9, headMult: 1.25, rpm: 75, mode: 'semi', mag: 7, reserve: 42, reload: 2.8,
    spreadHip: 6.5, spreadAds: 4.5, recoilV: 4.5, recoilH: 1.0, range: 9, minDmg: 0.25, zoom: 1.15, adsTime: 0.2, move: 1.0,
  },
  donner: {
    id: 'donner', name: 'Donner LMG-80', cls: 'lmg', clsName: 'Leichtes MG', slot: 'primary', price: 1800,
    desc: 'Riesiges Magazin, lange Feuerstöße, schwer zu bändigen.',
    dmg: 26, headMult: 1.5, rpm: 620, mode: 'auto', mag: 80, reserve: 240, reload: 4.3,
    spreadHip: 4.6, spreadAds: 0.9, recoilV: 0.75, recoilH: 0.55, range: 40, minDmg: 0.65, zoom: 1.35, adsTime: 0.33, move: 0.84,
  },
  langstreck: {
    id: 'langstreck', name: 'Langstreck LR-50', cls: 'sniper', clsName: 'Scharfschützengewehr', slot: 'primary', price: 2200,
    desc: 'Repetierer mit 6-fach-Optik. Ein Schuss, ein Treffer.',
    dmg: 110, headMult: 2.5, rpm: 48, mode: 'bolt', mag: 5, reserve: 30, reload: 3.0,
    spreadHip: 7.0, spreadAds: 0.0, recoilV: 6.0, recoilH: 1.0, range: 140, minDmg: 0.9, zoom: 6, adsTime: 0.38, move: 0.9, scope: true,
  },
  stachel: {
    id: 'stachel', name: 'Stachel P-3', cls: 'pistol', clsName: 'Pistole', slot: 'secondary', price: 0,
    desc: 'Handliche Dienstpistole.',
    dmg: 28, headMult: 1.6, rpm: 420, mode: 'semi', mag: 12, reserve: 72, reload: 1.35,
    spreadHip: 2.0, spreadAds: 0.7, recoilV: 1.6, recoilH: 0.5, range: 20, minDmg: 0.55, zoom: 1.2, adsTime: 0.13, move: 1.1,
  },
  hornisse: {
    id: 'hornisse', name: 'Hornisse MP-2', cls: 'pistol', clsName: 'Reihenfeuerpistole', slot: 'secondary', price: 700,
    desc: 'Vollautomatische Pistole – Sekundärwaffe mit Biss.',
    dmg: 15, headMult: 1.4, rpm: 1050, mode: 'auto', mag: 20, reserve: 120, reload: 1.6,
    spreadHip: 3.2, spreadAds: 1.6, recoilV: 0.7, recoilH: 0.6, range: 12, minDmg: 0.5, zoom: 1.15, adsTime: 0.13, move: 1.1,
  },
  bulle: {
    id: 'bulle', name: 'Bulle .50 Revolver', cls: 'pistol', clsName: 'Revolver', slot: 'secondary', price: 1000,
    desc: 'Laut, langsam, verheerend.',
    dmg: 62, headMult: 1.8, rpm: 140, mode: 'semi', mag: 6, reserve: 36, reload: 2.6,
    spreadHip: 2.5, spreadAds: 0.4, recoilV: 4.2, recoilH: 0.9, range: 28, minDmg: 0.6, zoom: 1.25, adsTime: 0.16, move: 1.08,
  },
};

// ---------------------------------------------------------------- Aufsätze
const LONG = ['ar', 'smg', 'dmr', 'lmg', 'sniper', 'shotgun'];
const ALL = [...LONG, 'pistol'];
export const ATTACH_SLOTS = { optic: 'Visier', muzzle: 'Mündung', mag: 'Magazin', grip: 'Griff', stock: 'Schaft' };
export const ATTACHMENTS = {
  rotpunkt: { id: 'rotpunkt', slot: 'optic', name: 'Rotpunkt-Visier', price: 250, classes: ALL, desc: 'Präziser beim Zielen.', mods: { spreadAds: 0.8 } },
  holo: { id: 'holo', slot: 'optic', name: 'Holo-Visier „Iris“', price: 400, classes: LONG, desc: 'Etwas mehr Zoom, klares Bild.', mods: { zoomAdd: 0.3, spreadAds: 0.85 } },
  zf4: { id: 'zf4', slot: 'optic', name: 'Zielfernrohr 4x', price: 700, classes: ['ar', 'dmr', 'lmg', 'sniper'], desc: '4-fach-Zoom mit Fernrohr. Langsamer ins Ziel.', mods: { zoomSet: 4, adsTime: 1.3, scope: true } },
  daempfer: { id: 'daempfer', slot: 'muzzle', name: 'Schalldämpfer „Flüster“', price: 500, classes: ALL, desc: 'Leise – Gegner bemerken dich schwerer. Etwas weniger Reichweite.', mods: { range: 0.85, recoilV: 0.92, silent: true } },
  kompensator: { id: 'kompensator', slot: 'muzzle', name: 'Kompensator', price: 350, classes: ALL, desc: 'Weniger vertikaler Rückstoß.', mods: { recoilV: 0.72, spreadHip: 1.1 } },
  bremse: { id: 'bremse', slot: 'muzzle', name: 'Mündungsbremse', price: 350, classes: ALL, desc: 'Weniger seitlicher Rückstoß.', mods: { recoilH: 0.55 } },
  erweitert: { id: 'erweitert', slot: 'mag', name: 'Erweitertes Magazin', price: 450, classes: ALL, desc: '+50 % Magazin, langsamer nachladen.', mods: { mag: 1.5, reload: 1.15 } },
  schnell: { id: 'schnell', slot: 'mag', name: 'Schnellwechsel-Magazin', price: 400, classes: ALL, desc: '30 % schneller nachladen.', mods: { reload: 0.7 } },
  vordergriff: { id: 'vordergriff', slot: 'grip', name: 'Vordergriff', price: 300, classes: LONG, desc: 'Weniger Rückstoß, ruhiger beim Zielen.', mods: { recoilV: 0.8, spreadAds: 0.9 } },
  winkelgriff: { id: 'winkelgriff', slot: 'grip', name: 'Winkelgriff', price: 300, classes: LONG, desc: 'Schneller im Anschlag.', mods: { adsTime: 0.75 } },
  leichtschaft: { id: 'leichtschaft', slot: 'stock', name: 'Leichtschaft', price: 300, classes: LONG, desc: 'Schneller laufen und zielen, etwas mehr Rückstoß.', mods: { move: 1.07, adsTime: 0.85, recoilV: 1.1 } },
  stabilschaft: { id: 'stabilschaft', slot: 'stock', name: 'Stabilschaft', price: 300, classes: LONG, desc: 'Weniger Rückstoß, etwas langsamer.', mods: { recoilV: 0.85, recoilH: 0.85, move: 0.96 } },
};

// ---------------------------------------------------------------- Skins
export const RARITY = {
  common: { name: 'Gewöhnlich', color: '#9aa7b4', weight: 60, refund: 40 },
  rare: { name: 'Selten', color: '#4aa3ff', weight: 27, refund: 120 },
  epic: { name: 'Episch', color: '#b660ff', weight: 10, refund: 300 },
  legendary: { name: 'Legendär', color: '#ffb02e', weight: 3, refund: 800 },
};
export const PATTERNS = { solid: 'Einfarbig', stripes: 'Streifen', camo: 'Tarnflecken', digital: 'Digital-Tarn', dots: 'Punkte', tiger: 'Tiger', grid: 'Raster', gradient: 'Verlauf', hex: 'Waben', zigzag: 'Zickzack' };

export const SKINS = {
  werk: { id: 'werk', name: 'Werkszustand', rarity: 'common', base: '#3a3f47', accent: '#2a2e33', pattern: 'solid' },
  sand: { id: 'sand', name: 'Wüstensand', rarity: 'common', base: '#c9a86b', accent: '#a8874f', pattern: 'camo' },
  wald: { id: 'wald', name: 'Waldläufer', rarity: 'common', base: '#4f6b3a', accent: '#2f4425', pattern: 'camo' },
  schnee: { id: 'schnee', name: 'Schneetreiben', rarity: 'common', base: '#e8eef2', accent: '#9fb0bd', pattern: 'digital' },
  asphalt: { id: 'asphalt', name: 'Asphalt', rarity: 'common', base: '#55585e', accent: '#3b3d41', pattern: 'digital' },
  marine: { id: 'marine', name: 'Marineblau', rarity: 'common', base: '#264a73', accent: '#1a3350', pattern: 'stripes' },
  ziegel: { id: 'ziegel', name: 'Ziegelrot', rarity: 'common', base: '#a5452f', accent: '#7c2f20', pattern: 'grid' },
  minze: { id: 'minze', name: 'Minzbonbon', rarity: 'rare', base: '#7fe3c4', accent: '#ffffff', pattern: 'stripes' },
  bonbon: { id: 'bonbon', name: 'Kaugummi', rarity: 'rare', base: '#ff7eb6', accent: '#ffd1e6', pattern: 'dots' },
  tigerfell: { id: 'tigerfell', name: 'Tigerfell', rarity: 'rare', base: '#ff9a1f', accent: '#1d1306', pattern: 'tiger' },
  arktis: { id: 'arktis', name: 'Arktis-Digital', rarity: 'rare', base: '#bfe6ff', accent: '#4c86b5', pattern: 'digital' },
  bienenstock: { id: 'bienenstock', name: 'Bienenstock', rarity: 'rare', base: '#ffd23a', accent: '#3a2c00', pattern: 'hex' },
  limette: { id: 'limette', name: 'Limettenblitz', rarity: 'rare', base: '#9dff3a', accent: '#245c00', pattern: 'zigzag' },
  sonnenuntergang: { id: 'sonnenuntergang', name: 'Sonnenuntergang', rarity: 'epic', base: '#ff5e3a', accent: '#6a2cff', pattern: 'gradient' },
  ozean: { id: 'ozean', name: 'Tiefsee', rarity: 'epic', base: '#00c2c7', accent: '#06246b', pattern: 'gradient' },
  zebra: { id: 'zebra', name: 'Zebra-Remix', rarity: 'epic', base: '#ffffff', accent: '#111111', pattern: 'tiger' },
  neonraster: { id: 'neonraster', name: 'Neonraster', rarity: 'epic', base: '#160a2e', accent: '#ff2bd6', pattern: 'grid', glow: 0.6 },
  giftgruen: { id: 'giftgruen', name: 'Giftmüll', rarity: 'epic', base: '#1d2b10', accent: '#7dff2b', pattern: 'hex', glow: 0.5 },
  glutkern: { id: 'glutkern', name: 'Glutkern', rarity: 'legendary', base: '#2b0a00', accent: '#ff6a00', pattern: 'hex', glow: 1.0 },
  polarlicht: { id: 'polarlicht', name: 'Polarlicht', rarity: 'legendary', base: '#2bffb8', accent: '#7a2bff', pattern: 'gradient', glow: 0.9 },
  goldrausch: { id: 'goldrausch', name: 'Goldrausch', rarity: 'legendary', base: '#ffcc33', accent: '#b37400', pattern: 'zigzag', glow: 0.5 },
  galaxie: { id: 'galaxie', name: 'Galaxie', rarity: 'legendary', base: '#0b0630', accent: '#c8b6ff', pattern: 'dots', glow: 0.9 },
  // Battle Pass „Glutfunken“ (nur über den Pass, nicht in Kisten)
  bp_asche: { id: 'bp_asche', name: 'Aschegrau', rarity: 'common', base: '#5a5c60', accent: '#2c2d30', pattern: 'digital', bp: true },
  bp_funkenflug: { id: 'bp_funkenflug', name: 'Funkenflug', rarity: 'rare', base: '#2a2420', accent: '#ff8a2a', pattern: 'dots', glow: 0.3, bp: true },
  bp_morgenrot: { id: 'bp_morgenrot', name: 'Morgenrot', rarity: 'epic', base: '#ff6a3a', accent: '#3a1a5a', pattern: 'gradient', bp: true },
  bp_schmiede: { id: 'bp_schmiede', name: 'Schmiedeglut', rarity: 'legendary', base: '#1a0e08', accent: '#ff7a1a', pattern: 'zigzag', glow: 0.9, bp: true },
  bp_obsidian: { id: 'bp_obsidian', name: 'Obsidian', rarity: 'rare', base: '#121318', accent: '#4a3a6a', pattern: 'hex', bp: true, premium: true },
  bp_lavastrom: { id: 'bp_lavastrom', name: 'Lavastrom', rarity: 'epic', base: '#2a0a04', accent: '#ffb02e', pattern: 'tiger', glow: 0.7, bp: true, premium: true },
  bp_phoenix: { id: 'bp_phoenix', name: 'Phönixfeder', rarity: 'legendary', base: '#ffd23a', accent: '#c8301a', pattern: 'gradient', glow: 0.8, bp: true, premium: true },
};

export const CASES = {
  feld: { id: 'feld', name: 'Feldkiste', price: 250, color: '#6b8f4e', desc: 'Solide Grundausstattung.', pool: ['sand', 'wald', 'schnee', 'asphalt', 'marine', 'ziegel', 'minze', 'bonbon', 'tigerfell', 'arktis', 'sonnenuntergang', 'zebra', 'goldrausch'], odds: { common: 70, rare: 24, epic: 5, legendary: 1 } },
  elite: { id: 'elite', name: 'Elitekiste', price: 600, color: '#3d6fd6', desc: 'Bessere Chancen auf seltene Skins.', pool: ['minze', 'bonbon', 'tigerfell', 'arktis', 'bienenstock', 'limette', 'sonnenuntergang', 'ozean', 'zebra', 'neonraster', 'giftgruen', 'polarlicht', 'goldrausch'], odds: { common: 0, rare: 62, epic: 30, legendary: 8 } },
  glut: { id: 'glut', name: 'Glutkern-Kiste', price: 1200, color: '#ff6a00', desc: 'Nur Episch und Legendär.', pool: ['sonnenuntergang', 'ozean', 'zebra', 'neonraster', 'giftgruen', 'glutkern', 'polarlicht', 'goldrausch', 'galaxie'], odds: { common: 0, rare: 0, epic: 75, legendary: 25 } },
};

// ---------------------------------------------------------------- Charakter-Ausrüstung
// Freischalten über: price (Shop), mission (Story-Mission geschafft), case (nur Ausrüstungskiste), free (von Anfang an)
export const CHAR_SLOTS = { uniform: 'Uniform', pants: 'Hose', vest: 'Weste', headgear: 'Kopfbedeckung', mask: 'Maske', eyes: 'Brille', face: 'Hautton' };
export const CHAR_ITEMS = {
  // Uniform (Oberteil + Ärmel)
  u_oliv: { slot: 'uniform', name: 'Morgenrot-Oliv', rarity: 'common', color: '#4d5a3c', free: true },
  u_wald: { slot: 'uniform', name: 'Waldgrün', rarity: 'common', color: '#3f6a3a', price: 200 },
  u_urban: { slot: 'uniform', name: 'Urban-Grau', rarity: 'common', color: '#6a6e74', price: 200 },
  u_hafen: { slot: 'uniform', name: 'Hafen-Blau', rarity: 'rare', color: '#2c4f78', mission: 'm1' },
  u_sand: { slot: 'uniform', name: 'Wüstensand', rarity: 'rare', color: '#b89a68', mission: 'm2' },
  u_schnee: { slot: 'uniform', name: 'Schneetarn', rarity: 'rare', color: '#dfe7ee', mission: 'm3' },
  u_nacht: { slot: 'uniform', name: 'Nachtschatten', rarity: 'epic', color: '#1e2230', mission: 'm4' },
  u_glut: { slot: 'uniform', name: 'Glutkern-Veteran', rarity: 'legendary', color: '#7a2a10', mission: 'm5' },
  u_marine: { slot: 'uniform', name: 'Marineweiß', rarity: 'rare', color: '#e8ecf0', price: 450 },
  u_pink: { slot: 'uniform', name: 'Flamingo', rarity: 'epic', color: '#ff7eb6', case: true },
  u_neon: { slot: 'uniform', name: 'Neon-Grün', rarity: 'epic', color: '#7dff2b', case: true },
  u_gold: { slot: 'uniform', name: 'Goldjunge', rarity: 'legendary', color: '#e8b830', case: true },
  u_lila: { slot: 'uniform', name: 'Königslila', rarity: 'rare', color: '#6a3ab8', case: true },
  // Hose
  p_oliv: { slot: 'pants', name: 'Oliv', rarity: 'common', color: '#3f4a32', free: true },
  p_schwarz: { slot: 'pants', name: 'Schwarz', rarity: 'common', color: '#22252a', price: 150 },
  p_sand: { slot: 'pants', name: 'Khaki', rarity: 'common', color: '#9a8458', price: 150 },
  p_jeans: { slot: 'pants', name: 'Jeans', rarity: 'rare', color: '#355a8a', case: true },
  p_tarn: { slot: 'pants', name: 'Grau-Tarn', rarity: 'common', color: '#5a5e5a', mission: 'm1' },
  p_rot: { slot: 'pants', name: 'Signalrot', rarity: 'epic', color: '#c8302a', case: true },
  // Weste
  v_oliv: { slot: 'vest', name: 'Plattenträger Oliv', rarity: 'common', color: '#3a4430', free: true },
  v_schwarz: { slot: 'vest', name: 'Taktisch Schwarz', rarity: 'common', color: '#202226', price: 250 },
  v_coyote: { slot: 'vest', name: 'Coyote', rarity: 'common', color: '#8a7048', mission: 'm2' },
  v_blau: { slot: 'vest', name: 'Polizeiblau', rarity: 'rare', color: '#1f3a6a', price: 400 },
  v_orange: { slot: 'vest', name: 'Warnweste', rarity: 'rare', color: '#ff7a1a', case: true },
  v_weiss: { slot: 'vest', name: 'Arktis-Weste', rarity: 'rare', color: '#d8e0e6', mission: 'm3' },
  v_gold: { slot: 'vest', name: 'Gold-Panzer', rarity: 'legendary', color: '#d8a820', case: true },
  // Kopfbedeckung (Form + Farbe)
  h_helm: { slot: 'headgear', name: 'Gefechtshelm', rarity: 'common', shape: 'helm', color: '#4d5a3c', free: true },
  h_helmschwarz: { slot: 'headgear', name: 'Helm Schwarz', rarity: 'common', shape: 'helm', color: '#25282c', price: 200 },
  h_cap: { slot: 'headgear', name: 'Basecap', rarity: 'common', shape: 'cap', color: '#3a4a6a', price: 250 },
  h_beret: { slot: 'headgear', name: 'Rotes Barett', rarity: 'rare', shape: 'beret', color: '#a8202a', mission: 'm2' },
  h_none: { slot: 'headgear', name: 'Ohne (Frisur)', rarity: 'common', shape: 'none', color: '#3a2a1a', price: 100 },
  h_blond: { slot: 'headgear', name: 'Ohne (Blond)', rarity: 'common', shape: 'none', color: '#d8b860', price: 100 },
  h_nachtsicht: { slot: 'headgear', name: 'Helm mit Nachtsicht', rarity: 'epic', shape: 'nvg', color: '#2a2e34', mission: 'm4' },
  h_goldhelm: { slot: 'headgear', name: 'Goldhelm', rarity: 'legendary', shape: 'helm', color: '#e8b830', case: true },
  h_capschwarz: { slot: 'headgear', name: 'Cap Schwarz', rarity: 'rare', shape: 'cap', color: '#18191c', case: true },
  h_krone: { slot: 'headgear', name: 'Krone des Glutkerns', rarity: 'legendary', shape: 'crown', color: '#ffcc33', mission: 'm5' },
  // Maske
  m_none: { slot: 'mask', name: 'Keine', rarity: 'common', shape: 'none', color: '#000000', free: true },
  m_bala: { slot: 'mask', name: 'Sturmhaube', rarity: 'common', shape: 'bala', color: '#2a2a2a', price: 150 },
  m_bandana: { slot: 'mask', name: 'Bandana Rot', rarity: 'rare', shape: 'bandana', color: '#c8302a', case: true },
  m_bandanagr: { slot: 'mask', name: 'Bandana Oliv', rarity: 'common', shape: 'bandana', color: '#4a5a3a', mission: 'm1' },
  m_schaedel: { slot: 'mask', name: 'Totenkopf', rarity: 'epic', shape: 'bandana', color: '#e8e4d8', case: true },
  // Brille
  e_blau: { slot: 'eyes', name: 'Taktikbrille Blau', rarity: 'common', color: '#2ae0ff', free: true },
  e_orange: { slot: 'eyes', name: 'Orange', rarity: 'common', color: '#ff8a1a', price: 120 },
  e_gruen: { slot: 'eyes', name: 'Nachtgrün', rarity: 'rare', color: '#5dff5a', mission: 'm4' },
  e_pink: { slot: 'eyes', name: 'Pink', rarity: 'rare', color: '#ff4ac8', case: true },
  e_gold: { slot: 'eyes', name: 'Gold verspiegelt', rarity: 'epic', color: '#ffd23a', case: true },
  e_schwarz: { slot: 'eyes', name: 'Sonnenbrille', rarity: 'common', color: '#111111', price: 120 },
  // Hautton (gratis)
  f_1: { slot: 'face', name: 'Hell', rarity: 'common', color: '#f1c8a0', free: true },
  f_2: { slot: 'face', name: 'Mittel', rarity: 'common', color: '#d9a877', free: true },
  f_3: { slot: 'face', name: 'Oliv', rarity: 'common', color: '#b88a5a', free: true },
  f_4: { slot: 'face', name: 'Braun', rarity: 'common', color: '#8a5a3a', free: true },
  f_5: { slot: 'face', name: 'Dunkel', rarity: 'common', color: '#5a3a24', free: true },
  // Battle Pass „Glutfunken“ (bp = Stufe im Pass)
  u_funke: { slot: 'uniform', name: 'Funkenträger', rarity: 'rare', color: '#5a3424', bp: 8 },
  p_asche: { slot: 'pants', name: 'Asche-Cargo', rarity: 'common', color: '#3c3e42', bp: 3 },
  m_asche: { slot: 'mask', name: 'Ascheschal', rarity: 'rare', shape: 'bandana', color: '#4a4c50', bp: 18 },
  e_glut: { slot: 'eyes', name: 'Glutglas', rarity: 'rare', color: '#ff6a1a', bp: 25 },
  h_glutbarett: { slot: 'headgear', name: 'Glutbarett', rarity: 'epic', shape: 'beret', color: '#c84a14', bp: 35 },
  v_schmied: { slot: 'vest', name: 'Schmiedepanzer', rarity: 'epic', color: '#4a3a2c', bp: 42 },
  u_obsidian: { slot: 'uniform', name: 'Obsidian-Uniform', rarity: 'epic', color: '#16171c', bp: 10, premium: true },
  h_phoenix: { slot: 'headgear', name: 'Phönixhelm', rarity: 'legendary', shape: 'nvg', color: '#c8301a', bp: 50, premium: true },
};

// ---------------------------------------------------------------- Battle Pass
// Konfigurierbar: Stufenzahl und XP pro Stufe. Belohnungen stehen in battlepass.js.
// premiumPrice: Preis in Splittern (Ingame-Währung). Kaufbar erst, wenn alle Stufen erreicht sind.
export const BATTLE_PASS = { id: 's1', name: 'Saison 1 – Glutfunken', levels: 50, xpPerLevel: 1000, premiumPrice: 10000 };
export const DEFAULT_CHAR = { uniform: 'u_oliv', pants: 'p_oliv', vest: 'v_oliv', headgear: 'h_helm', mask: 'm_none', eyes: 'e_blau', face: 'f_2' };
export const CHAR_CASE = {
  id: 'ausruestung', name: 'Ausrüstungskiste', price: 500, color: '#c8a050', desc: 'Outfits für deinen Soldaten – manche gibt es nur hier.',
  pool: Object.keys(CHAR_ITEMS).filter(k => CHAR_ITEMS[k].case || (CHAR_ITEMS[k].price && !CHAR_ITEMS[k].free)),
  odds: { common: 55, rare: 30, epic: 11, legendary: 4 },
};

// Code-Einlösung im Shop
export const CHEAT_CODE = 'EliaIstArschinDiesemGameUndBracuhtCheats';

// ---------------------------------------------------------------- Maps
export const MAPS = {
  hafen: { id: 'hafen', name: 'Rostbucht-Hafen', seed: 101, theme: 'hafen' },
  wueste: { id: 'wueste', name: 'Dorf Sandkorn', seed: 202, theme: 'wueste' },
  schnee: { id: 'schnee', name: 'Station Frostzahn', seed: 303, theme: 'schnee' },
  nacht: { id: 'nacht', name: 'Hafen bei Nacht', seed: 404, theme: 'nacht' },
  industrie: { id: 'industrie', name: 'Glutkern-Werk', seed: 505, theme: 'industrie' },
};

// ---------------------------------------------------------------- Story
// Ziele: kill {count}, reach {poi}, collect {pois}, destroy {pois, hp}, defend {poi, time}, boss {}
// Gegnerspawns: {type, n, at: 'spawn'|'near'|poi-Index}
export const MISSIONS = [
  {
    id: 'm1', name: 'Erstkontakt', map: 'hafen', reward: 300, xp: 400,
    brief: 'Das Rost-Syndikat hat den Hafen von Rostbucht besetzt und schmuggelt Teile für eine geheimnisvolle Maschine – den „Glutkern“. Säubere den Hafen und sichere den Funkturm, damit Kommando Morgenrot Kontakt halten kann.',
    radio: ['Funk: Hier Kommando Morgenrot. Willkommen im Einsatz, Rekrut.', 'Funk: Das Syndikat hat Wachen im ganzen Hafen. Halt die Augen offen.'],
    objectives: [
      { type: 'kill', count: 8, text: 'Eliminiere Syndikat-Wachen', spawn: [{ type: 'rekrut', n: 8, at: 'spread' }] },
      { type: 'reach', poi: 3, text: 'Erreiche den Funkturm', radio: 'Funk: Gut gemacht! Jetzt ab zum Funkturm.', spawn: [{ type: 'rekrut', n: 3, at: 3 }, { type: 'stuermer', n: 1, at: 3 }] },
    ],
  },
  {
    id: 'm2', name: 'Funkstille', map: 'wueste', reward: 450, xp: 550,
    brief: 'Im Dorf Sandkorn stören Sender des Syndikats unseren Funk. Außerdem lagern dort Datenkerne mit Bauplänen des Glutkerns. Hol die Daten und schalte die Störsender aus.',
    radio: ['Funk: Die Störsender blinken rot – schieß sie einfach kaputt.'],
    objectives: [
      { type: 'collect', pois: [1, 4, 6], text: 'Sammle Datenkerne', spawn: [{ type: 'rekrut', n: 7, at: 'spread' }, { type: 'stuermer', n: 3, at: 'spread' }] },
      { type: 'destroy', pois: [2, 5], hp: 250, text: 'Zerstöre die Störsender', radio: 'Funk: Daten gesichert. Jetzt die Störsender!', spawn: [{ type: 'rekrut', n: 3, at: 2 }, { type: 'rekrut', n: 3, at: 5 }, { type: 'schuetze', n: 1, at: 'spread' }] },
      { type: 'reach', poi: 0, text: 'Zurück zum Landepunkt', radio: 'Funk: Funk ist wieder frei! Komm zum Landepunkt.', spawn: [{ type: 'stuermer', n: 3, at: 'near' }] },
    ],
  },
  {
    id: 'm3', name: 'Halte die Linie', map: 'schnee', reward: 600, xp: 700,
    brief: 'Station Frostzahn ist unser letzter Außenposten im Norden. Das Syndikat greift in Wellen an. Halte die Funkbaracke, bis die Verstärkung eintrifft.',
    radio: ['Funk: Sie kommen aus allen Richtungen. Bleib in der Zone!'],
    objectives: [
      { type: 'reach', poi: 3, text: 'Begib dich zur Funkbaracke', spawn: [{ type: 'rekrut', n: 3, at: 'spread' }] },
      { type: 'defend', poi: 3, time: 90, text: 'Halte die Zone', waves: [{ t: 0, type: 'rekrut', n: 4 }, { t: 15, type: 'stuermer', n: 3 }, { t: 30, type: 'rekrut', n: 5 }, { t: 45, type: 'brocken', n: 1 }, { t: 55, type: 'stuermer', n: 3 }, { t: 70, type: 'rekrut', n: 4 }, { t: 75, type: 'brocken', n: 1 }] },
      { type: 'kill', count: 0, text: 'Erledige die letzten Angreifer', remaining: true },
    ],
  },
  {
    id: 'm4', name: 'Schattenkonvoi', map: 'nacht', reward: 750, xp: 850,
    brief: 'Nachts verlädt das Syndikat den Glutkern-Zünder auf einen Konvoi. Scharfschützen sichern die Dächer. Schalte sie aus und markiere die Fracht.',
    radio: ['Funk: Achte auf rote Laserpunkte – das sind Scharfschützen!'],
    objectives: [
      { type: 'kill', count: 4, only: 'schuetze', text: 'Schalte die Scharfschützen aus', spawn: [{ type: 'schuetze', n: 4, at: 'spread' }, { type: 'rekrut', n: 6, at: 'spread' }] },
      { type: 'destroy', pois: [4], hp: 400, text: 'Sabotiere den Konvoi-Generator', radio: 'Funk: Die Dächer sind frei. Jetzt der Generator!', spawn: [{ type: 'brocken', n: 1, at: 4 }, { type: 'rekrut', n: 4, at: 4 }] },
      { type: 'reach', poi: 6, text: 'Erreiche die Extraktion', spawn: [{ type: 'stuermer', n: 4, at: 'near' }] },
    ],
  },
  {
    id: 'm5', name: 'Glutkern', map: 'industrie', reward: 1200, xp: 1200,
    brief: 'Im Glutkern-Werk baut Kommandant Rostzahn die Maschine zusammen. Zerstöre die drei Kühlpumpen, damit der Kern instabil wird – und stell dich Rostzahn persönlich.',
    radio: ['Funk: Das ist es, Rekrut. Alles oder nichts.'],
    objectives: [
      { type: 'destroy', pois: [1, 4, 6], hp: 300, text: 'Zerstöre die Kühlpumpen', spawn: [{ type: 'rekrut', n: 8, at: 'spread' }, { type: 'stuermer', n: 3, at: 'spread' }, { type: 'brocken', n: 2, at: 'spread' }, { type: 'schuetze', n: 2, at: 'spread' }] },
      { type: 'boss', poi: 3, text: 'Besiege Kommandant Rostzahn', radio: 'Rostzahn: Du willst MEINEN Kern? Komm und hol ihn dir!', spawn: [{ type: 'boss', n: 1, at: 3 }, { type: 'rekrut', n: 4, at: 3 }] },
      { type: 'reach', poi: 0, text: 'Raus hier, bevor alles explodiert!', radio: 'Funk: Der Kern wird instabil! Sofort zur Extraktion!', timer: 60 },
    ],
  },
];

export const ENEMY_TYPES = {
  rekrut: { name: 'Syndikat-Söldner', hp: 100, speed: 3.2, dmg: 7, rpm: 420, burst: [3, 6], acc: 0.42, range: 45, pref: 15, color: '#c4622d', score: 10 },
  stuermer: { name: 'Stürmer', hp: 130, speed: 4.8, dmg: 5, pellets: 5, rpm: 70, burst: [1, 1], acc: 0.7, range: 12, pref: 3, color: '#d63a2a', score: 15 },
  schuetze: { name: 'Scharfschütze', hp: 80, speed: 2.4, dmg: 38, rpm: 22, burst: [1, 1], acc: 0.85, range: 95, pref: 40, color: '#5d4a3a', score: 25, sniper: true },
  brocken: { name: 'Brocken', hp: 420, speed: 2.1, dmg: 6, rpm: 600, burst: [8, 14], acc: 0.32, range: 40, pref: 12, color: '#3b3030', score: 40, scale: 1.3 },
  boss: { name: 'Kommandant Rostzahn', hp: 2600, speed: 2.7, dmg: 8, rpm: 700, burst: [10, 18], acc: 0.35, range: 50, pref: 12, color: '#7a1f12', score: 300, scale: 1.65, boss: true, grenades: true },
};

// ---------------------------------------------------------------- Quests
export const QUESTS = [
  { id: 'q_m1', name: 'Erste Schritte', desc: 'Schließe die Mission „Erstkontakt“ ab.', event: 'mission', match: { id: 'm1' }, goal: 1, reward: 200 },
  { id: 'q_kills', name: 'Säuberung', desc: 'Eliminiere 50 Gegner (beliebiger Modus).', event: 'kill', goal: 50, reward: 400 },
  { id: 'q_heads', name: 'Kopfsache', desc: 'Erziele 15 Kopfschuss-Kills.', event: 'kill', match: { head: true }, goal: 15, reward: 350 },
  { id: 'q_smg', name: 'Nahkampfprofi', desc: '25 Kills mit einer Maschinenpistole.', event: 'kill', match: { cls: 'smg' }, goal: 25, reward: 400 },
  { id: 'q_sniper', name: 'Adlerauge', desc: '15 Kills mit dem Scharfschützengewehr.', event: 'kill', match: { cls: 'sniper' }, goal: 15, reward: 500 },
  { id: 'q_nade', name: 'Bumm!', desc: '8 Kills mit Granaten.', event: 'kill', match: { cls: 'grenade' }, goal: 8, reward: 300 },
  { id: 'q_coop', name: 'Gemeinsam stark', desc: 'Schließe eine Koop-Mission ab.', event: 'mission', match: { coop: true }, goal: 1, reward: 500 },
  { id: 'q_pvpk', name: 'Duellant', desc: 'Erziele 25 Kills im LAN-PvP.', event: 'kill', match: { mode: 'pvp' }, goal: 25, reward: 400 },
  { id: 'q_pvpw', name: 'Champion', desc: 'Gewinne ein PvP-Match.', event: 'pvpWin', goal: 1, reward: 500 },
  { id: 'q_brwin', name: 'Letzter Überlebender', desc: 'Gewinne eine Battle Royale im LAN.', event: 'brWin', goal: 1, reward: 600 },
  { id: 'q_brplay', name: 'Fallschirmspringer', desc: 'Spiele 3 Battle-Royale-Runden.', event: 'brPlayed', goal: 3, reward: 300 },
  { id: 'q_case', name: 'Sammler', desc: 'Öffne 3 Waffenkisten.', event: 'case', goal: 3, reward: 300 },
  { id: 'q_skin', name: 'Künstler', desc: 'Erstelle einen eigenen Skin im Editor.', event: 'skin', goal: 1, reward: 150 },
  { id: 'q_boss', name: 'Rostzahn gefallen', desc: 'Besiege Kommandant Rostzahn.', event: 'kill', match: { boss: true }, goal: 1, reward: 800 },
  { id: 'q_story', name: 'Glutkern erloschen', desc: 'Schließe alle 5 Story-Missionen ab.', event: 'storyDone', goal: 5, reward: 2000 },
];

// Tagesaufträge: aus diesen Vorlagen werden täglich 3 gezogen
export const DAILY_TEMPLATES = [
  { name: 'Tagesauftrag: Feuerprobe', desc: 'Eliminiere 20 Gegner.', event: 'kill', goal: 20, reward: 200 },
  { name: 'Tagesauftrag: Scharfes Auge', desc: 'Erziele 6 Kopfschuss-Kills.', event: 'kill', match: { head: true }, goal: 6, reward: 200 },
  { name: 'Tagesauftrag: Sturmangriff', desc: '12 Kills mit einem Sturmgewehr.', event: 'kill', match: { cls: 'ar' }, goal: 12, reward: 180 },
  { name: 'Tagesauftrag: Schrotladung', desc: '8 Kills mit einer Schrotflinte.', event: 'kill', match: { cls: 'shotgun' }, goal: 8, reward: 220 },
  { name: 'Tagesauftrag: Seitenwaffe', desc: '6 Kills mit einer Pistole.', event: 'kill', match: { cls: 'pistol' }, goal: 6, reward: 200 },
  { name: 'Tagesauftrag: Einsatzbereit', desc: 'Schließe 2 Missionen ab (Story oder Koop).', event: 'mission', goal: 2, reward: 250 },
  { name: 'Tagesauftrag: Arena', desc: 'Spiele ein LAN-PvP-Match zu Ende.', event: 'pvpPlayed', goal: 1, reward: 200 },
  { name: 'Tagesauftrag: Überlebenskünstler', desc: 'Spiele eine Battle-Royale-Runde zu Ende.', event: 'brPlayed', goal: 1, reward: 220 },
  { name: 'Tagesauftrag: Dauerfeuer', desc: '10 Kills mit dem LMG.', event: 'kill', match: { cls: 'lmg' }, goal: 10, reward: 220 },
];

export const RANKS = ['Rekrut', 'Gefreiter', 'Obergefreiter', 'Korporal', 'Unteroffizier', 'Feldwebel', 'Leutnant', 'Hauptmann', 'Major', 'Oberst', 'General'];
export function levelInfo(xp) {
  let lvl = 1, need = 500, rest = xp;
  while (rest >= need) { rest -= need; lvl++; need = Math.round(need * 1.15); }
  return { lvl, rest, need, rank: RANKS[Math.min(RANKS.length - 1, Math.floor((lvl - 1) / 3))] };
}
