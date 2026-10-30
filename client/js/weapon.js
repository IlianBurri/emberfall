// Waffenwerte (inkl. Aufsätze) und detaillierte Low-Poly-Waffenmodelle (Ego-Ansicht, Menüvorschau, Gegner).
import * as THREE from 'three';
import { WEAPONS, ATTACHMENTS, ATTACH_SLOTS } from './data.js';
import { skinMaterial } from './skins.js';

export function weaponStats(id, build = {}) {
  const s = { ...WEAPONS[id], silent: false, scope: !!WEAPONS[id].scope };
  for (const slot of Object.keys(ATTACH_SLOTS)) {
    const a = ATTACHMENTS[build[slot]];
    if (!a || !a.classes.includes(s.cls)) continue;
    for (const [k, v] of Object.entries(a.mods)) {
      if (k === 'mag') s.mag = Math.round(s.mag * v);
      else if (k === 'zoomAdd') s.zoom += v;
      else if (k === 'zoomSet') s.zoom = Math.max(s.zoom, v);
      else if (k === 'scope') s.scope = true;
      else if (k === 'silent') s.silent = true;
      else s[k] *= v;
    }
  }
  return s;
}

// ---------------------------------------------------------------- Materialien
const phong = (color, shininess, specular) => new THREE.MeshPhongMaterial({ color, shininess, specular });
export const GUN_MATS = {
  dark: phong(0x1c1e22, 30, 0x2a2a2a),
  metal: phong(0x3a3f46, 70, 0x5a5a5a),
  steel: phong(0x7d848d, 110, 0x9a9a9a),
  poly: phong(0x26282b, 12, 0x1a1a1a),
  rubber: new THREE.MeshLambertMaterial({ color: 0x141414 }),
  wood: phong(0x6e4022, 25, 0x2a1a10),
  glass: new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.3, depthWrite: false }),
  lens: phong(0x203a5a, 120, 0xffffff),
  red: new THREE.MeshBasicMaterial({ color: 0xff2020 }),
  dot: new THREE.MeshBasicMaterial({ color: 0xff1010, toneMapped: false }),
  lensTint: new THREE.MeshBasicMaterial({ color: 0xffb070, transparent: true, opacity: 0.12, depthWrite: false }),
  glove: phong(0x2b2a26, 8, 0x111111),
  sleeve: new THREE.MeshLambertMaterial({ color: 0x4d5a3c }),
  cuff: new THREE.MeshLambertMaterial({ color: 0x3a4430 }),
};
const M = GUN_MATS;
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 10); cylGeo.rotateX(Math.PI / 2);
const _up = new THREE.Vector3(0, 1, 0);

function box(g, mat, x, y, z, sx, sy, sz, rx = 0) {
  const m = new THREE.Mesh(boxGeo, mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.x = rx;
  g.add(m);
  return m;
}
// Zylinder entlang Z, zentriert bei z
function cyl(g, mat, x, y, z, r, len) {
  const m = new THREE.Mesh(cylGeo, mat);
  m.position.set(x, y, z); m.scale.set(r, r, len);
  g.add(m);
  return m;
}
// Quader zwischen zwei Punkten (Arme, Streben)
export function limb(g, mat, a, b, t, t2 = t) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(boxGeo, mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.scale.set(t, d.length(), t2);
  m.quaternion.setFromUnitVectors(_up, d.normalize());
  g.add(m);
  return m;
}

const RIFLE = {
  ar: { R: 0.3, H: 0.085, W: 0.058, HG: 0.25, HGh: 0.072, BL: 0.17, br: 0.011, mag: 'curve', stock: 'full', SL: 0.25 },
  smg: { R: 0.24, H: 0.095, W: 0.056, HG: 0.11, HGh: 0.068, BL: 0.05, br: 0.011, mag: 'straight', stock: 'wire', SL: 0.21 },
  dmr: { R: 0.31, H: 0.085, W: 0.058, HG: 0.33, HGh: 0.066, BL: 0.22, br: 0.012, mag: 'box', stock: 'full', SL: 0.27, riser: true },
  shotgun: { R: 0.25, H: 0.09, W: 0.064, HG: 0, BL: 0.47, br: 0.019, mag: 'tube', stock: 'full', SL: 0.27 },
  lmg: { R: 0.34, H: 0.11, W: 0.082, HG: 0.28, HGh: 0.09, BL: 0.22, br: 0.016, mag: 'drum', stock: 'full', SL: 0.25, carry: true, bipod: true },
  sniper: { R: 0.3, H: 0.08, W: 0.058, HG: 0.3, HGh: 0.058, BL: 0.4, br: 0.0105, mag: 'box', stock: 'thumb', SL: 0.31, bolt: true },
};

// Modell zeigt nach -Z, Ursprung ungefähr am Pistolengriff.
// opts.hands = Handschuhe + Ärmel für die Ego-Ansicht
export function buildGunModel(id, build = {}, skin, opts = {}) {
  const def = WEAPONS[id];
  const cls = def.cls;
  const g = new THREE.Group();
  const sk = skinMaterial(skin);
  const optic = build.optic && ATTACHMENTS[build.optic]?.classes.includes(cls) ? build.optic : null;
  const mz = build.muzzle && ATTACHMENTS[build.muzzle]?.classes.includes(cls) ? build.muzzle : null;
  const ext = build.mag === 'erweitert';
  let info;
  if (cls === 'pistol') info = buildPistol(g, id, sk, ext);
  else info = buildRifle(g, cls, sk, build, optic, ext);

  // Visier
  const railY = info.railY;
  let sightY = info.ironY;
  const sz = info.opticZ;
  if (optic === 'rotpunkt') {
    // Offenes Gehäuse (Rahmen statt Klotz), getönte Linse vorne, leuchtender Punkt in der Mitte
    const y = railY + 0.032, L = 0.05, o = 0.0165, t = 0.005;
    box(g, M.dark, 0, railY + 0.006, sz, 0.03, 0.012, L);            // Montage
    box(g, M.dark, 0, y - o, sz, 0.036, t, L);                       // unten
    box(g, M.dark, 0, y + o, sz, 0.036, t, L);                       // oben
    box(g, M.dark, o, y, sz, t, 0.038, L);                           // rechts
    box(g, M.dark, -o, y, sz, t, 0.038, L);                          // links
    box(g, M.metal, o + 0.006, y + 0.004, sz + 0.005, 0.006, 0.01, 0.012); // Helligkeitsregler
    box(g, M.metal, 0, y + o + 0.005, sz + 0.005, 0.01, 0.006, 0.012);    // Turm
    box(g, M.lensTint, 0, y, sz - L / 2 + 0.002, 0.029, 0.029, 0.001);
    box(g, M.dot, 0, y, sz - L / 2 + 0.006, 0.0035, 0.0035, 0.0015);
    sightY = y;
  } else if (optic === 'holo') {
    box(g, M.dark, 0, railY + 0.008, sz, 0.036, 0.016, 0.075);
    box(g, M.dark, -0.017, railY + 0.03, sz - 0.02, 0.005, 0.034, 0.02);
    box(g, M.dark, 0.017, railY + 0.03, sz - 0.02, 0.005, 0.034, 0.02);
    box(g, M.dark, 0, railY + 0.048, sz - 0.02, 0.039, 0.005, 0.025);
    box(g, M.glass, 0, railY + 0.03, sz - 0.02, 0.03, 0.028, 0.002);
    box(g, M.red, 0, railY + 0.03, sz - 0.02, 0.006, 0.006, 0.003);
    sightY = railY + 0.03;
  } else if (optic === 'zf4' || cls === 'sniper') {
    const y = railY + 0.035;
    box(g, M.dark, 0, railY + 0.015, sz + 0.04, 0.03, 0.03, 0.02);
    box(g, M.dark, 0, railY + 0.015, sz - 0.06, 0.03, 0.03, 0.02);
    cyl(g, M.dark, 0, y, sz - 0.01, 0.016, 0.2);
    cyl(g, M.dark, 0, y, sz - 0.135, 0.023, 0.06);
    cyl(g, M.dark, 0, y, sz + 0.11, 0.02, 0.05);
    cyl(g, M.lens, 0, y, sz - 0.166, 0.019, 0.004);
    box(g, M.metal, 0, y + 0.02, sz - 0.01, 0.014, 0.012, 0.014);
    box(g, M.metal, 0.02, y, sz - 0.01, 0.012, 0.014, 0.014);
    sightY = y;
  } else if (!info.pistol) {
    // Kimme und Korn
    // Kimme mit Lücke in der Mitte, Korn endet genau auf der Visierlinie
    box(g, M.dark, 0, railY + 0.004, info.rearSightZ, 0.026, 0.008, 0.015);
    box(g, M.dark, 0.009, railY + 0.016, info.rearSightZ, 0.006, 0.02, 0.012);
    box(g, M.dark, -0.009, railY + 0.016, info.rearSightZ, 0.006, 0.02, 0.012);
    box(g, M.dark, 0, railY + 0.008, info.frontSightZ, 0.004, 0.024, 0.004);
    box(g, M.dark, 0, railY + 0.003, info.frontSightZ, 0.024, 0.012, 0.015);
  }

  // Mündung
  let flashZ = info.muzzleZ;
  const my = info.boreY;
  if (mz === 'daempfer') { cyl(g, M.dark, 0, my, flashZ - 0.11, info.br * 2.4, 0.22); flashZ -= 0.22; }
  else if (mz === 'kompensator') { cyl(g, M.metal, 0, my, flashZ - 0.035, info.br * 1.9, 0.07); box(g, M.dark, 0, my + info.br * 1.5, flashZ - 0.035, 0.01, 0.006, 0.05); flashZ -= 0.07; }
  else if (mz === 'bremse') { box(g, M.metal, 0, my, flashZ - 0.035, info.br * 4.2, info.br * 2.2, 0.07); box(g, M.dark, 0, my, flashZ - 0.02, info.br * 4.4, info.br * 1.2, 0.01); box(g, M.dark, 0, my, flashZ - 0.045, info.br * 4.4, info.br * 1.2, 0.01); flashZ -= 0.07; }
  else if (!info.pistol && cls !== 'shotgun') { cyl(g, M.dark, 0, my, flashZ - 0.025, info.br * 1.5, 0.05); flashZ -= 0.05; }

  // Griffe
  if (!info.pistol && info.hgFront !== undefined) {
    const gz = info.hgFront + 0.06;
    if (build.grip === 'vordergriff') { box(g, M.poly, 0, info.hgBottom - 0.045, gz, 0.026, 0.08, 0.03); box(g, M.poly, 0, info.hgBottom - 0.088, gz, 0.03, 0.01, 0.034); }
    if (build.grip === 'winkelgriff') box(g, M.poly, 0, info.hgBottom - 0.018, gz + 0.01, 0.03, 0.03, 0.08, 0.55);
  }

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, my, flashZ);
  g.add(muzzle);
  if (opts.hands) addHands(g, info);
  g.userData = { muzzle, mag: info.magGroup, body: info.body, sightY, info };
  return g;
}

function buildRifle(g, cls, sk, build, optic, ext) {
  const p = RIFLE[cls];
  const z0 = 0.08, H = p.H, W = p.W;
  const zF = z0 - p.R; // Vorderkante Gehäuse
  const body = box(g, sk, 0, -H * 0.22, z0 - p.R / 2, W, H * 0.56, p.R);          // Unteres Gehäuse
  box(g, sk, 0, H * 0.27, z0 - p.R / 2, W * 0.94, H * 0.46, p.R);                  // Oberes Gehäuse
  box(g, M.dark, W / 2 + 0.001, H * 0.18, z0 - p.R * 0.45, 0.003, H * 0.25, p.R * 0.22); // Auswurffenster
  box(g, M.metal, 0, H / 2 + 0.004, z0 - 0.015, 0.03, 0.01, 0.03);                 // Ladehebel
  box(g, M.dark, -W / 2 - 0.001, -H * 0.1, z0 - p.R * 0.55, 0.003, 0.012, 0.03);    // Magazinlöser
  const boreY = H * 0.22;
  let hgFront = zF, hgBottom = -H * 0.3;
  // Handschutz mit Lüftungsschlitzen
  if (p.HG) {
    const hz = zF - p.HG / 2;
    box(g, sk, 0, boreY - 0.005, hz, W * 1.02, p.HGh, p.HG);
    for (let i = 0; i < Math.floor(p.HG / 0.05); i++) {
      const z = zF - 0.03 - i * 0.05;
      box(g, M.dark, W * 0.52, boreY - 0.005, z, 0.004, p.HGh * 0.35, 0.025);
      box(g, M.dark, -W * 0.52, boreY - 0.005, z, 0.004, p.HGh * 0.35, 0.025);
    }
    hgFront = zF - p.HG;
    hgBottom = boreY - 0.005 - p.HGh / 2;
    if (cls === 'lmg') box(g, M.metal, 0, boreY + p.HGh / 2 + 0.006, hz, W * 0.8, 0.008, p.HG * 0.9);
  }
  // Schiene oben
  const railY = H / 2 + 0.006;
  const railLen = p.R + p.HG * 0.95;
  box(g, M.metal, 0, railY, z0 - railLen / 2 - 0.01, 0.026, 0.012, railLen);
  for (let i = 0; i < Math.floor(railLen / 0.03); i++) box(g, M.dark, 0, railY + 0.007, z0 - 0.025 - i * 0.03, 0.03, 0.004, 0.008);
  // Lauf
  const barrelStart = cls === 'shotgun' ? zF : hgFront;
  cyl(g, M.steel, 0, boreY, barrelStart - p.BL / 2 + (cls === 'shotgun' ? 0 : 0.02), p.br, p.BL + 0.04);
  const muzzleZ = barrelStart - p.BL;
  if (!optic && cls !== 'sniper') box(g, M.metal, 0, boreY + p.br + 0.008, hgFront + 0.015, 0.02, 0.016, 0.022); // Gasblock
  // Shotgun: Röhrenmagazin + Pumpe
  if (cls === 'shotgun') {
    cyl(g, M.metal, 0, boreY - 0.035, zF - 0.19, 0.015, 0.38);
    const pump = box(g, M.poly, 0, boreY - 0.035, zF - 0.13, 0.048, 0.042, 0.15);
    for (let i = 0; i < 5; i++) box(g, M.dark, 0, boreY - 0.035, zF - 0.07 - i * 0.03, 0.05, 0.044, 0.006);
    hgFront = zF - 0.06; hgBottom = boreY - 0.056;
    pump.userData.pump = true;
  }
  // Pistolengriff + Abzug
  const grip = box(g, M.poly, 0, -H * 0.5 - 0.045, z0 - 0.07, 0.032, 0.1, 0.042, 0.28);
  box(g, M.poly, 0, -H * 0.5 - 0.1, z0 - 0.083, 0.034, 0.01, 0.046, 0.28);
  box(g, M.dark, 0, -H * 0.5 - 0.027, z0 - 0.135, 0.01, 0.005, 0.06);
  box(g, M.dark, 0, -H * 0.5 - 0.014, z0 - 0.163, 0.01, 0.028, 0.005);
  box(g, M.metal, 0, -H * 0.5 - 0.013, z0 - 0.125, 0.005, 0.022, 0.006, -0.3);
  // Magazin
  const magGroup = new THREE.Group();
  g.add(magGroup);
  const mz = z0 - 0.17 - (cls === 'lmg' ? 0.03 : 0);
  const mE = ext ? 1.45 : 1;
  if (p.mag === 'curve') {
    box(magGroup, M.poly, 0, -H / 2 - 0.05 * mE, mz, 0.03, 0.1 * mE, 0.065);
    box(magGroup, M.poly, 0, -H / 2 - 0.1 * mE - 0.035, mz - 0.025, 0.03, 0.08 * mE, 0.06, -0.35);
    box(magGroup, M.dark, 0, -H / 2 - 0.1 * mE - 0.075 * mE, mz - 0.045, 0.034, 0.012, 0.064, -0.35);
  } else if (p.mag === 'straight') {
    box(magGroup, M.poly, 0, -H / 2 - 0.11 * mE, mz + 0.03, 0.026, 0.22 * mE, 0.045);
    box(magGroup, M.dark, 0, -H / 2 - 0.22 * mE - 0.004, mz + 0.03, 0.03, 0.01, 0.05);
  } else if (p.mag === 'box') {
    box(magGroup, M.poly, 0, -H / 2 - 0.045 * mE, mz + 0.01, 0.03, 0.09 * mE, 0.07);
    box(magGroup, M.dark, 0, -H / 2 - 0.09 * mE - 0.004, mz + 0.01, 0.034, 0.01, 0.074);
  } else if (p.mag === 'drum') {
    box(magGroup, M.poly, -0.01, -H / 2 - 0.065 * mE, mz, 0.1, 0.13 * mE, 0.11);
    box(magGroup, M.dark, -0.01, -H / 2 - 0.13 * mE - 0.004, mz, 0.104, 0.01, 0.114);
    box(magGroup, M.metal, -0.062, -H / 2 - 0.05, mz, 0.006, 0.04, 0.06);
  }
  magGroup.userData.baseY = 0;
  // Schaft
  if (p.stock === 'full' || p.stock === 'thumb') {
    cyl(g, M.metal, 0, H * 0.12, z0 + 0.04, 0.016, 0.08);
    const sL = p.SL, st = build.stock;
    const thick = st === 'stabilschaft' ? 1.2 : st === 'leichtschaft' ? 0.75 : 1;
    if (p.stock === 'thumb') {
      box(g, sk, 0, H * 0.05, z0 + 0.06 + sL / 2, 0.045, 0.05, sL);
      box(g, sk, 0, -0.06, z0 + 0.1 + sL * 0.6, 0.045, 0.06, sL * 0.6);
      box(g, sk, 0, -0.03, z0 + 0.07, 0.04, 0.09, 0.03);
    } else {
      box(g, st ? M.poly : sk, 0, H * 0.02, z0 + 0.06 + sL / 2, 0.044, 0.075 * thick, sL);
      box(g, st ? M.poly : sk, 0, -0.035, z0 + 0.08 + sL * 0.6, 0.04, 0.05 * thick, sL * 0.55);
    }
    if (p.riser || p.stock === 'thumb') box(g, M.poly, 0, H * 0.02 + 0.045, z0 + 0.06 + sL * 0.55, 0.035, 0.018, sL * 0.4);
    box(g, M.rubber, 0, -0.01, z0 + 0.065 + sL, 0.05, 0.115 * thick, 0.016);
  } else if (p.stock === 'wire') {
    box(g, M.metal, 0.018, 0.0, z0 + 0.1, 0.008, 0.008, 0.2);
    box(g, M.metal, -0.018, 0.0, z0 + 0.1, 0.008, 0.008, 0.2);
    box(g, M.rubber, 0, -0.01, z0 + 0.205, 0.05, 0.08, 0.014);
  }
  if (p.carry) {
    box(g, M.metal, 0, H / 2 + 0.05, z0 - p.R * 0.55, 0.012, 0.012, 0.12);
    box(g, M.metal, 0, H / 2 + 0.027, z0 - p.R * 0.55 - 0.055, 0.012, 0.045, 0.012);
    box(g, M.metal, 0, H / 2 + 0.027, z0 - p.R * 0.55 + 0.055, 0.012, 0.045, 0.012);
  }
  if (p.bipod) {
    box(g, M.metal, 0.012, hgBottom - 0.006, hgFront + 0.12, 0.008, 0.008, 0.2);
    box(g, M.metal, -0.012, hgBottom - 0.006, hgFront + 0.12, 0.008, 0.008, 0.2);
  }
  if (p.bolt) {
    box(g, M.steel, W / 2 + 0.025, H * 0.2, z0 - 0.05, 0.05, 0.008, 0.008);
    const knob = box(g, M.steel, W / 2 + 0.052, H * 0.12, z0 - 0.05, 0.018, 0.018, 0.018);
    knob.rotation.y = 0.7;
  }
  return {
    body, railY: railY + 0.006, ironY: railY + 0.02, opticZ: z0 - p.R * 0.4, rearSightZ: z0 - 0.03, frontSightZ: hgFront + 0.02,
    muzzleZ, boreY, br: p.br, hgFront, hgBottom, magGroup, gripZ: z0 - 0.07, gripY: -H * 0.5 - 0.045,
    supportZ: cls === 'shotgun' ? zF - 0.13 : hgFront + Math.min(0.12, p.HG * 0.45), supportY: hgBottom,
  };
}

function buildPistol(g, id, sk, ext) {
  const magGroup = new THREE.Group();
  g.add(magGroup);
  magGroup.userData.baseY = 0;
  if (id === 'bulle') {
    const body = box(g, sk, 0, 0.012, -0.03, 0.026, 0.05, 0.1);
    cyl(g, M.steel, 0, 0.012, -0.04, 0.024, 0.05);                               // Trommel
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; cyl(g, M.dark, Math.cos(a) * 0.014, 0.012 + Math.sin(a) * 0.014, -0.064, 0.005, 0.002); }
    cyl(g, M.steel, 0, 0.024, -0.15, 0.01, 0.16);                                 // Lauf
    box(g, sk, 0, 0.036, -0.15, 0.012, 0.01, 0.16);                               // Laufschiene
    box(g, M.dark, 0, 0.046, -0.225, 0.004, 0.012, 0.008);                         // Korn
    box(g, M.metal, 0, 0.038, 0.025, 0.008, 0.02, 0.012, -0.5);                    // Hahn
    box(g, M.wood, 0, -0.045, 0.022, 0.028, 0.09, 0.04, 0.35);
    box(g, M.dark, 0, -0.022, -0.035, 0.008, 0.004, 0.04);
    return { body, pistol: true, railY: 0.04, ironY: 0.05, opticZ: -0.05, muzzleZ: -0.23, boreY: 0.024, br: 0.01, magGroup, gripZ: 0.02, gripY: -0.045 };
  }
  const slide = box(g, sk, 0, 0.022, -0.06, 0.028, 0.034, 0.19);
  box(g, M.poly, 0, -0.004, -0.055, 0.026, 0.022, 0.16);                          // Rahmen
  for (let i = 0; i < 4; i++) box(g, M.dark, 0, 0.026, 0.02 - i * 0.008, 0.03, 0.022, 0.003);
  box(g, M.dark, 0.0145, 0.024, -0.075, 0.002, 0.012, 0.035);                     // Auswurf
  cyl(g, M.steel, 0, 0.018, -0.156, 0.007, 0.008);
  box(g, M.dark, 0, 0.043, -0.14, 0.004, 0.008, 0.006);                            // Korn
  box(g, M.dark, 0, 0.043, 0.02, 0.022, 0.008, 0.008);                             // Kimme
  box(g, M.poly, 0, -0.055, 0.01, 0.026, 0.095, 0.042, 0.25);                      // Griff
  box(g, M.dark, 0, -0.025, -0.05, 0.008, 0.004, 0.045);
  box(g, M.metal, 0, -0.018, -0.035, 0.004, 0.018, 0.005, -0.2);
  if (id === 'hornisse' || ext) {
    box(magGroup, M.poly, 0, -0.12 - (ext ? 0.03 : 0), 0.0, 0.022, 0.07 + (ext ? 0.06 : 0), 0.034, 0.25);
    if (id === 'hornisse') box(g, M.poly, 0, -0.035, -0.105, 0.02, 0.045, 0.025);
  } else box(magGroup, M.dark, 0, -0.105, 0.025, 0.028, 0.01, 0.044, 0.25);
  return { body: slide, pistol: true, railY: 0.039, ironY: 0.047, opticZ: -0.03, muzzleZ: -0.16, boreY: 0.018, br: 0.007, magGroup, gripZ: 0.01, gripY: -0.055 };
}

// Handschuhe + Ärmel, so gehalten, dass sie unten/seitlich aus dem Bild laufen
function addHands(g, info) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const gz = info.gripZ, gy = info.gripY;
  // rechte Hand am Griff
  box(g, M.glove, 0.012, gy + 0.005, gz + 0.005, 0.05, 0.07, 0.07, 0.28);
  box(g, M.glove, -0.012, gy + 0.02, gz - 0.03, 0.04, 0.025, 0.035);              // Finger am Abzug
  limb(g, M.glove, V(0.02, gy - 0.02, gz + 0.03), V(0.04, gy - 0.07, gz + 0.1), 0.05);
  limb(g, M.cuff, V(0.04, gy - 0.07, gz + 0.1), V(0.06, gy - 0.1, gz + 0.14), 0.07);
  limb(g, M.sleeve, V(0.06, gy - 0.1, gz + 0.14), V(0.14, gy - 0.28, gz + 0.48), 0.085);
  if (info.pistol) {
    // linke Hand stützt den Griff
    box(g, M.glove, -0.03, gy - 0.005, gz, 0.04, 0.07, 0.065, 0.28);
    limb(g, M.glove, V(-0.035, gy - 0.03, gz + 0.03), V(-0.06, gy - 0.08, gz + 0.1), 0.05);
    limb(g, M.cuff, V(-0.06, gy - 0.08, gz + 0.1), V(-0.08, gy - 0.11, gz + 0.14), 0.07);
    limb(g, M.sleeve, V(-0.08, gy - 0.11, gz + 0.14), V(-0.2, gy - 0.3, gz + 0.46), 0.085);
  } else {
    const sz = info.supportZ, sy = info.supportY;
    box(g, M.glove, -0.006, sy - 0.012, sz, 0.06, 0.03, 0.08);
    box(g, M.glove, 0.026, sy + 0.012, sz - 0.005, 0.012, 0.04, 0.06);              // Finger seitlich
    box(g, M.glove, -0.034, sy + 0.008, sz, 0.012, 0.035, 0.07);                    // Daumen
    limb(g, M.glove, V(-0.02, sy - 0.025, sz + 0.03), V(-0.05, sy - 0.07, sz + 0.09), 0.05);
    limb(g, M.cuff, V(-0.05, sy - 0.07, sz + 0.09), V(-0.07, sy - 0.1, sz + 0.13), 0.07);
    limb(g, M.sleeve, V(-0.07, sy - 0.1, sz + 0.13), V(-0.22, sy - 0.36, sz + 0.5), 0.07);
  }
}
