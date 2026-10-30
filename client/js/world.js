// Prozedurale Low-Poly-Maps. Alles Statische ist EINE InstancedMesh aus Würfeln (1 Draw Call),
// Baumkronen sind zwei weitere InstancedMeshes. Kollision = achsenparallele Boxen in einem Raster.
import * as THREE from 'three';
import { Baker } from './geom.js';
import { carParts, carMaterials, CAR_VARIANTS, CAR_SIZE } from './vehicles.js';
import { Terrain, OUT, RING } from './terrain.js';
import { outskirtsMixin } from './outskirts.js';
export { OUT };

export function mulberry(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const THEMES = {
  hafen: {
    skyTop: '#4fa8ff', skyBot: '#d6efff', fog: '#cfe6f7', street: '#5b6068', block: '#8f948c', curb: '#b5b8b0',
    buildings: ['#e0cba3', '#b9c8cf', '#d1926b', '#a3b9a3', '#e6e1d3'], roof: ['#7a4b36', '#4f6b7a', '#8a3a2a'],
    containers: ['#e04a2f', '#2f72e0', '#2fa85a', '#f2a51f', '#8f42c2', '#1fb5b0'], tree: '#46a03f', trunk: '#7a5134',
    sun: '#fff1d6', sunI: 2.4, hemiI: 1.25, weights: { building: 3, containers: 4, park: 1.5, ruins: 1, tower: 1.2 }, crown: 'blob',
  },
  wueste: {
    skyTop: '#f2b562', skyBot: '#fff0cf', fog: '#f6dfb3', street: '#c7a26b', block: '#ddc18b', curb: '#e9d4a8',
    buildings: ['#eed8ac', '#ddb97f', '#d3a56b', '#f2e4c4', '#c99a5e'], roof: ['#a8653a', '#8f5530', '#c2783f'],
    containers: ['#b85a2e', '#5a7fa0', '#7a8f4a'], tree: '#5fa33f', trunk: '#8a6038',
    sun: '#fff0c8', sunI: 2.8, hemiI: 1.2, weights: { building: 5, containers: 1, park: 1, ruins: 2.5, tower: 1.2 }, crown: 'palm',
  },
  schnee: {
    skyTop: '#86b6e6', skyBot: '#eef5fb', fog: '#e3edf6', street: '#c3ced9', block: '#f3f7fb', curb: '#ffffff',
    buildings: ['#7c8d9c', '#a3604f', '#5f7d6b', '#b8c3cd', '#c9a36b'], roof: ['#f4f8fb', '#e8eef3'],
    containers: ['#c23a2a', '#2a62b8', '#3a8f5a', '#e0a02a'], tree: '#2c5f48', trunk: '#5a3f2a',
    sun: '#ffffff', sunI: 2.0, hemiI: 1.45, weights: { building: 3, containers: 2, park: 2.5, ruins: 1, tower: 1.4 }, crown: 'pine',
  },
  nacht: {
    skyTop: '#060d24', skyBot: '#24345c', fog: '#16213d', street: '#262a33', block: '#363b45', curb: '#4a505b',
    buildings: ['#4a5160', '#5a4a48', '#3f5050', '#5d5a66'], roof: ['#2a2e36', '#3a2a2a'],
    containers: ['#8a2a20', '#20448a', '#20703a', '#9a6a14'], tree: '#1f4a2f', trunk: '#3a2a1c',
    sun: '#a9c4ff', sunI: 0.9, hemiI: 0.75, weights: { building: 3, containers: 4, park: 1, ruins: 1, tower: 1.5 }, crown: 'blob', night: true,
  },
  industrie: {
    skyTop: '#ff8a4a', skyBot: '#ffd9b0', fog: '#f0b88f', street: '#4b4541', block: '#6e655c', curb: '#8a8076',
    buildings: ['#8d8d8d', '#a85c3c', '#6f7c84', '#9c8c6c', '#7a6a5a'], roof: ['#3a3633', '#5a2a1a'],
    containers: ['#c2502a', '#4a6a8a', '#8a8a3a', '#d08a20'], tree: '#6a8a3a', trunk: '#5a4030',
    sun: '#ffe0b8', sunI: 2.2, hemiI: 1.1, weights: { building: 4, containers: 2.5, park: 0.5, ruins: 2, tower: 1.5 }, crown: 'blob', chimneys: true,
  },
};

const N = 7, P = 18, S = 6, B = 12;
export const HALF = (N * P + S) / 2; // 66
const POI_BLOCKS = [[0, 0], [5, 1], [1, 4], [3, 3], [6, 3], [3, 6], [6, 6]];
const blockCenter = j => -HALF + S + B / 2 + j * P;
const inter = i => -HALF + S / 2 + i * P;

export class World {
  constructor(mapDef) {
    this.theme = THEMES[mapDef.theme];
    this.rng = mulberry(mapDef.seed);
    this.boxes = [];
    this.vis = [];      // [cx, y0, cz, sx, sy, sz, color]
    this.crowns = [];   // [x, y, z, sx, sy, sz, color]
    this.cones = [];
    this.cyls = [];     // [x, y0, z, r, h, r, color]
    this.cars = [];     // geparkte Autos {x, z, horiz, variant, color}
    this.rocks = [];    // Felsen mit Drehung [x, y, z, sx, sy, sz, color, rx, ry, rz]
    this.extra = new Baker(); // Sonderformen (Satteldächer, Kuppeln, liegende Zylinder)
    this.outerSpots = []; // Loot-/Spawnpunkte im Umland
    this.yOff = 0;
    this.half = HALF;
    this.themeKey = mapDef.theme;
    this.water = mapDef.theme === 'hafen' || mapDef.theme === 'nacht';
    this.terrain = new Terrain(mapDef.seed, HALF, mapDef.theme, this.water);
    this.wires = [];    // Linienpaare (Stromleitungen)
    this.pois = [];
    this.sniperSpots = [];
    this.intersections = [];
    this.group = new THREE.Group();
    this.cell = 8;
    this.grid = new Map();
    this.stamp = 0;
    this.generate();
    this.buildMeshes();
  }

  // ------------------------------------------------------------ Bausteine
  box(cx, y0, cz, sx, sy, sz, color, collide = true, rx = 0, ry = 0) {
    y0 += this.yOff;
    this.vis.push([cx, y0, cz, sx, sy, sz, color, rx, ry]);
    if (collide) this.boxes.push({ x0: cx - sx / 2, y0, z0: cz - sz / 2, x1: cx + sx / 2, y1: y0 + sy, z1: cz + sz / 2 });
  }
  // Zylinder (Fässer, Masten, Tanks). Kollision als Box, wenn gewünscht.
  cyl(x, y0, z, r, h, color, collide = false) {
    y0 += this.yOff;
    this.cyls.push([x, y0, z, r, h, r, color]);
    if (collide) this.boxes.push({ x0: x - r * 0.85, y0, z0: z - r * 0.85, x1: x + r * 0.85, y1: y0 + h, z1: z + r * 0.85 });
  }
  wire(a, b) { this.wires.push(a.x, a.y, a.z, b.x, b.y, b.z); }

  // Nur Kollision, ohne sichtbaren Würfel (Optik kommt aus einem detaillierten Modell)
  collider(cx, y0, cz, sx, sy, sz) { this.boxes.push({ x0: cx - sx / 2, y0, z0: cz - sz / 2, x1: cx + sx / 2, y1: y0 + sy, z1: cz + sz / 2 }); }
  car(x, z, horiz, variant, color, flip = false, y = this.yOff) {
    const c = CAR_SIZE[variant];
    this.collider(x, y + 0.2, z, horiz ? c.L : c.W, c.H - 0.3, horiz ? c.W : c.L);
    this.cars.push({ x, z, y, ry: (horiz ? 0 : -Math.PI / 2) + (flip ? Math.PI : 0), variant, color });
  }

  // ------------------------------------------------------------ Details
  barrel(x, z, y = 0) {
    const col = this.pick(['#b8402a', '#2a5fa8', '#5a6a3a', '#d0a020', '#3a3a3a']);
    this.cyl(x, y, z, 0.3, 0.9, col, true);
    this.cyl(x, y + 0.28, z, 0.31, 0.05, shadeHex(col, 0.7));
    this.cyl(x, y + 0.6, z, 0.31, 0.05, shadeHex(col, 0.7));
  }
  bench(x, z, along, y = 0.15) {
    const w = along ? 1.6 : 0.5, d = along ? 0.5 : 1.6;
    this.box(x, y + 0.42, z, w, 0.07, d, '#8a6038', false);
    this.box(x + (along ? 0 : 0.22), y + 0.5, z + (along ? 0.22 : 0), along ? 1.6 : 0.06, 0.4, along ? 0.06 : 1.6, '#8a6038', false);
    for (const s of [-0.7, 0.7]) this.box(x + (along ? s : 0), y, z + (along ? 0 : s), 0.08, 0.42, 0.45, '#2e3034', false);
  }
  streetFurniture(x, z, along) {
    const r = this.rng();
    if (r < 0.25) { this.box(x, 0.15, z, 0.5, 0.9, 0.5, '#2f6a3a'); this.box(x, 1.05, z, 0.56, 0.08, 0.56, '#244f2c', false); }        // Mülleimer
    else if (r < 0.45) this.bench(x, z, along);
    else if (r < 0.6) { this.cyl(x, 0.15, z, 0.14, 0.55, '#d0302a', true); this.cyl(x, 0.7, z, 0.1, 0.1, '#e8e0d0'); this.box(x, 0.45, z, 0.42, 0.08, 0.08, '#d0302a', false); } // Hydrant
    else if (r < 0.75) for (const s of [-0.8, 0, 0.8]) this.cyl(x + (along ? s : 0), 0.15, z + (along ? 0 : s), 0.08, 0.8, '#3a3d42', true); // Poller
    else if (r < 0.88) { this.box(x, 0.15, z, 0.45, 1.0, 0.4, this.pick(['#2a5fa8', '#d0302a', '#e0b020'])); this.box(x, 0.85, z, 0.38, 0.18, 0.42, '#c8e4f4', false); } // Zeitungsbox
    else { this.box(x, 0.15, z, 0.35, 0.7, 0.35, '#7a8288'); this.cyl(x, 0.85, z, 0.07, 1.2, '#7a8288'); this.box(x, 2.0, z, 0.6, 0.5, 0.06, '#2a62b8', false); } // Schild
  }
  trafficLight(x, z, dx, dz) {
    this.cyl(x, 0.15, z, 0.08, 3.6, '#3a3d42', true);
    this.box(x + dx * 1.1, 3.55, z + dz * 1.1, Math.abs(dx) * 2.2 + 0.12, 0.12, Math.abs(dz) * 2.2 + 0.12, '#3a3d42', false);
    const lx = x + dx * 2.1, lz = z + dz * 2.1;
    this.box(lx, 2.75, lz, 0.32, 0.8, 0.3, '#1e2024', false);
    this.box(lx, 3.27, lz, 0.2, 0.18, 0.34, '#ff3a2a', false);
    this.box(lx, 3.03, lz, 0.2, 0.18, 0.34, '#4a3a10', false);
    this.box(lx, 2.79, lz, 0.2, 0.18, 0.34, '#1f4a2a', false);
  }
  pick(arr) { return arr[Math.floor(this.rng() * arr.length)]; }
  range(a, b) { return a + this.rng() * (b - a); }

  building(cx, cz, w, d, h) {
    const t = this.theme;
    const col = this.pick(t.buildings);
    this.box(cx, 0, cz, w, h, d, col);
    this.box(cx, h, cz, w + 0.4, 0.35, d + 0.4, this.pick(t.roof), true);
    // Fenster als dünne dunkle Kästen auf den Fassaden
    const win = t.night ? '#ffd76a' : '#2b3440';
    const floors = Math.max(1, Math.floor((h - 1) / 2.6));
    const trim = shadeHex(col, 0.78), sill = shadeHex(col, 1.12);
    this.box(cx, 0, cz, w + 0.12, 0.5, d + 0.12, trim, false); // Sockel
    for (let f = 0; f < floors; f++) {
      const y = 1.3 + f * 2.6;
      if (f > 0) this.box(cx, y - 0.45, cz, w + 0.14, 0.14, d + 0.14, trim, false); // Gesims pro Etage
      const lit = () => t.night ? (this.rng() < 0.55 ? '#ffd76a' : '#1d2230') : win;
      for (let x = -w / 2 + 1.2; x <= w / 2 - 1.2; x += 2.2) {
        for (const s of [1, -1]) {
          const z = cz + s * (d / 2 + 0.03);
          this.box(cx + x, y - 0.06, z, 1.06, 1.22, 0.06, trim, false);           // Rahmen
          this.box(cx + x, y, z + s * 0.02, 0.9, 1.1, 0.06, lit(), false);       // Scheibe
          this.box(cx + x, y + 0.5, z + s * 0.03, 0.06, 1.0, 0.06, trim, false); // Sprosse
          this.box(cx + x, y - 0.1, z + s * 0.1, 1.1, 0.08, 0.2, sill, false);   // Fensterbank
        }
      }
      for (let z = -d / 2 + 1.2; z <= d / 2 - 1.2; z += 2.2) {
        for (const s of [1, -1]) {
          const x = cx + s * (w / 2 + 0.03);
          this.box(x, y - 0.06, cz + z, 0.06, 1.22, 1.06, trim, false);
          this.box(x + s * 0.02, y, cz + z, 0.06, 1.1, 0.9, lit(), false);
          this.box(x + s * 0.03, y + 0.5, cz + z, 0.06, 1.0, 0.06, trim, false);
          this.box(x + s * 0.1, y - 0.1, cz + z, 0.2, 0.08, 1.1, sill, false);
        }
      }
    }
    this.box(cx, 0, cz + d / 2 + 0.04, 1.5, 2.3, 0.08, trim, false);          // Türrahmen
    this.box(cx, 0, cz + d / 2 + 0.07, 1.3, 2.1, 0.1, '#4a3424', false);      // Tür
    this.box(cx, 2.35, cz + d / 2 + 0.5, 2.0, 0.1, 1.0, trim, false);          // Vordach
    // Dachaufbauten
    if (w > 3.5 && d > 3.5) {
      if (this.rng() < 0.7) this.box(cx + this.range(-w / 4, w / 4), h + 0.35, cz + this.range(-d / 4, d / 4), 1.2, 0.8, 0.9, '#a8adb2', false); // Klimagerät
      if (this.rng() < 0.4) this.box(cx - w / 3, h + 0.35, cz + d / 3, 0.08, 2.2, 0.08, '#3a3d42', false);  // Antenne
      if (this.rng() < 0.3) { this.box(cx + w / 4, h + 0.35, cz - d / 4, 1.4, 0.15, 1.4, '#6a6e72', false); this.box(cx + w / 4, h + 0.5, cz - d / 4, 1.1, 1.3, 1.1, '#8a6e52', false); } // Wassertank
      this.box(cx, h + 0.35, cz - d / 2 - 0.05, w + 0.4, 0.4, 0.15, trim, false); // Brüstung
      this.box(cx, h + 0.35, cz + d / 2 + 0.05, w + 0.4, 0.4, 0.15, trim, false);
    }
    if (t.chimneys && this.rng() < 0.5) {
      const ch = h + this.range(4, 9);
      this.box(cx + w / 4, 0, cz - d / 4, 1.4, ch, 1.4, '#7a5a4a');
      this.box(cx + w / 4, ch, cz - d / 4, 1.7, 0.5, 1.7, '#d64a2a', false);
    }
    // Fallrohre an den Ecken
    for (const [sx, sz] of [[1, 1], [-1, 1]]) this.cyl(cx + sx * (w / 2 + 0.06), 0, cz + sz * (d / 2 + 0.06), 0.06, h + 0.3, '#5a5e64');
    // Markise mit Streifen über der Tür + Ladenschild
    const fz = cz + d / 2;
    if (this.rng() < 0.6) {
      const ac = this.pick(['#d0302a', '#2a7ad0', '#2fa35a', '#e0a020', '#8a3ab8']);
      for (let k = 0; k < 4; k++) this.box(cx - 0.75 + k * 0.5 + 0.25, 2.5, fz + 0.05, 0.5, 0.06, 1.1, k % 2 ? '#f2eee4' : ac, false, -0.35);
      this.box(cx, 2.75, fz + 0.06, Math.min(w - 0.6, 3.2), 0.55, 0.08, shadeHex(ac, 0.6), false);
      this.box(cx, 2.83, fz + 0.1, Math.min(w - 0.9, 2.8), 0.38, 0.03, '#f4efe0', false);
    }
    // Balkone mit Geländer an der Front
    for (let f = 1; f < floors; f++) {
      if (this.rng() < 0.55 || w < 4) continue;
      const bx = cx + this.range(-w / 4, w / 4), y = 1.3 + f * 2.6 - 0.62;
      this.box(bx, y, fz + 0.5, 2.4, 0.12, 1.0, trim, false);
      this.box(bx, y + 0.95, fz + 0.98, 2.4, 0.06, 0.06, '#3a3d42', false);
      for (let k = 0; k <= 6; k++) this.box(bx - 1.17 + k * 0.39, y + 0.12, fz + 0.98, 0.04, 0.85, 0.04, '#3a3d42', false);
      this.box(bx - 1.18, y + 0.12, fz + 0.5, 0.04, 0.85, 1.0, '#3a3d42', false);
      this.box(bx + 1.18, y + 0.12, fz + 0.5, 0.04, 0.85, 1.0, '#3a3d42', false);
      if (this.rng() < 0.5) this.box(bx - 0.6, y + 0.12, fz + 0.4, 0.4, 0.4, 0.4, '#b85a3a', false); // Blumentopf
    }
    // Klimageräte an der Seitenwand
    if (this.rng() < 0.6 && floors > 1) this.box(cx + w / 2 + 0.3, 1.3 + 2.6 - 0.2, cz + this.range(-d / 4, d / 4), 0.55, 0.6, 0.9, '#c8ccd0', false);
  }

  crate(x, z, y = 0, s = 1) { this.box(x, y, z, s, s, s, this.rng() < 0.5 ? '#b0814a' : '#9a6c3a'); }

  tree(x, z, y = this.yOff) {
    const t = this.theme;
    const oy = this.yOff; this.yOff = y;
    this.treeAt(x, z, t, y);
    this.yOff = oy;
  }
  treeAt(x, z, t, y) {
    if (t.crown === 'pine') {
      this.box(x, 0, z, 0.4, 1.4, 0.4, t.trunk);
      const h = this.range(4, 6.5);
      this.cones.push([x, y + 1.2, z, 1.6, h, 1.6, t.tree]);
      this.cones.push([x, y + 1.2 + h * 0.55, z, 1.25, h * 0.5, 1.25, '#e8f0f4']); // Schneehaube
    } else if (t.crown === 'palm') {
      const h = this.range(4, 6);
      this.box(x, 0, z, 0.35, h, 0.35, t.trunk);
      this.crowns.push([x, y + h, z, 2.4, 0.5, 2.4, t.tree]);
    } else {
      this.box(x, 0, z, 0.45, 2.2, 0.45, t.trunk);
      const s = this.range(1.5, 2.3);
      this.crowns.push([x, y + 2.2 + s * 0.6, z, s, s * 0.9, s, t.tree]);
    }
  }

  tower(cx, cz) {
    const H = 3.6, W = 4;
    const leg = '#6b4a2f', plank = '#8f6a42';
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.box(cx + dx * (W / 2 - 0.2), 0, cz + dz * (W / 2 - 0.2), 0.3, H, 0.3, leg);
    this.box(cx, H - 0.3, cz, W, 0.3, W, plank);
    // Geländer (halbhoch, Lücke zur Treppe)
    this.box(cx, H, cz - W / 2 + 0.1, W, 1.0, 0.2, plank);
    this.box(cx - W / 2 + 0.1, H, cz, 0.2, 1.0, W, plank);
    this.box(cx + W / 2 - 0.1, H, cz - 0.6, 0.2, 1.0, W - 1.2, plank);
    // Treppe an der Südseite
    const steps = 9;
    for (let i = 0; i < steps; i++) {
      const h = (i + 1) * (H / steps);
      this.box(cx - W / 2 + 0.6 + 0, 0, cz + W / 2 + 0.8 + (steps - 1 - i) * 0.75, 1.2, h, 0.75, '#9a7a52');
    }
    // Dach
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.box(cx + dx * (W / 2 - 0.2), H + 1, cz + dz * (W / 2 - 0.2), 0.2, 1.6, 0.2, leg, false);
    this.box(cx, H + 2.6, cz, W + 0.6, 0.3, W + 0.6, this.pick(this.theme.roof), false);
    this.sniperSpots.push(new THREE.Vector3(cx, H + this.yOff, cz));
  }

  // ------------------------------------------------------------ Generierung
  generate() {
    const t = this.theme;
    const poiSet = new Set(POI_BLOCKS.map(([a, b]) => a + ',' + b));
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) this.intersections.push({ x: inter(i), z: inter(j), i, j });

    // Boden: Straßen = Grundfläche, Blöcke als leicht erhöhte Gehwege
    // (Asphalt-Boden wird als texturierte Fläche in buildMeshes erzeugt)
    this.blockCenters = [];
    // Begrenzung
    // Stadtmauer mit Toren zum Umland
    const wallC = t.night ? '#3a3e46' : '#a89c88';
    const gates = this.terrain.gates;
    for (const side of ['n', 's', 'e', 'w']) {
      const along = side === 'n' || side === 's';
      const fixed = (side === 'n' || side === 'e' ? 1 : -1) * (HALF + 0.6);
      const gap = gates[side];
      const segs = gap === null ? [[-HALF - 1.2, HALF + 1.2]] : [[-HALF - 1.2, gap - 5], [gap + 5, HALF + 1.2]];
      for (const [a, b] of segs) {
        const len = b - a, mid = (a + b) / 2, [x, z] = along ? [mid, fixed] : [fixed, mid];
        this.box(x, 0, z, along ? len : 1.2, 3.4, along ? 1.2 : len, wallC);
        this.box(x, 3.4, z, along ? len : 1.5, 0.3, along ? 1.5 : len, shadeHex(wallC, 0.85), false);
        for (let k = a + 1.5; k < b - 1; k += 3) { const [cx, cz] = along ? [k, fixed] : [fixed, k]; this.box(cx, 3.7, cz, along ? 1.2 : 1.5, 0.5, along ? 1.5 : 1.2, shadeHex(wallC, 0.85), false); } // Zinnen
      }
      if (gap !== null) for (const o of [-5.7, 5.7]) {
        const [x, z] = along ? [gap + o, fixed] : [fixed, gap + o];
        this.box(x, 0, z, 2, 5, 2, shadeHex(wallC, 0.92));
        this.box(x, 5, z, 2.4, 0.45, 2.4, shadeHex(wallC, 0.75), false);
      }
    }
    // Straßenmarkierungen
    for (let i = 0; i < N; i++) for (let j = 0; j <= N; j++) {
      const mid = (inter(i) + inter(i + 1)) / 2;
      const mc = t.night ? '#8a8a6a' : '#e8e2c8';
      for (const o of [-3.5, 0, 3.5]) {   // gestrichelte Mittellinie
        this.box(mid + o, 0.005, inter(j), 1.8, 0.02, 0.18, mc, false);
        this.box(inter(j), 0.005, mid + o, 0.18, 0.02, 1.8, mc, false);
      }
    }
    // Zebrastreifen an einigen Kreuzungen
    for (const it of this.intersections) {
      if (this.rng() < 0.6 || Math.abs(it.x) > HALF - 4 || Math.abs(it.z) > HALF - 4) continue;
      for (let k = -2; k <= 2; k++) this.box(it.x + k * 1.0, 0.006, it.z + 4.2, 0.5, 0.02, 1.6, '#ecebe4', false);
    }

    const types = Object.entries(t.weights);
    const total = types.reduce((s, [, w]) => s + w, 0);
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
      const cx = blockCenter(a), cz = blockCenter(b);
      this.box(cx, 0, cz, B, 0.15, B, t.block, true);
      this.box(cx, 0, cz, B + 0.3, 0.12, B + 0.3, t.curb, false);
      this.blockCenters.push([cx, cz]);
      if (poiSet.has(a + ',' + b)) { this.plaza(cx, cz); continue; }
      let r = this.rng() * total, kind = 'building';
      for (const [k, w] of types) { if ((r -= w) <= 0) { kind = k; break; } }
      this[kind + 'Block'](cx, cz);
    }
    // POIs in definierter Reihenfolge
    for (const [a, b] of POI_BLOCKS) this.pois.push(new THREE.Vector3(blockCenter(a), 0.15, blockCenter(b)));

    // Deckung auf den Straßen
    for (let i = 0; i < N; i++) for (let j = 0; j <= N; j++) {
      for (const horiz of [true, false]) {
        if (this.rng() < 0.45) continue;
        const along = this.range(inter(i) + 5, inter(i + 1) - 5);
        const side = this.rng() < 0.5 ? -1.9 : 1.9;
        const x = horiz ? along : inter(j) + side, z = horiz ? inter(j) + side : along;
        this.streetProp(x, z, horiz);
      }
    }
    // Laternen, Ampeln, Kanaldeckel
    for (const it of this.intersections) {
      const inside = (x, z) => Math.abs(x) < HALF - 1 && Math.abs(z) < HALF - 1;
      if (this.rng() < 0.55) {
        const x = it.x + 2.6, z = it.z + 2.6;
        if (inside(x, z)) {
          this.cyl(x, 0, z, 0.09, 4.4, '#3a3d42', true);
          this.box(x - 0.45, 4.3, z, 0.9, 0.08, 0.08, '#3a3d42', false);
          this.box(x - 0.85, 4.1, z, 0.45, 0.2, 0.3, '#2e3034', false);
          this.box(x - 0.85, 4.05, z, 0.38, 0.06, 0.24, t.night ? '#ffe28a' : '#f4f0dc', false);
        }
      } else if (this.rng() < 0.5) {
        const x = it.x - 2.7, z = it.z - 2.7;
        if (inside(x, z)) this.trafficLight(x, z, 1, 0);
      }
      if (this.rng() < 0.5 && inside(it.x, it.z)) this.cyl(it.x + this.range(-1.5, 1.5), 0, it.z + this.range(-1.5, 1.5), 0.45, 0.025, '#2e3034');
    }
    // Strommasten mit Leitungen entlang einiger Straßen
    for (let j = 1; j < N; j += 2) {
      const z = inter(j) - 2.75;
      let prev = null;
      for (let i = 0; i <= N; i++) {
        const x = inter(i) + 9;
        if (Math.abs(x) > HALF - 2) { prev = null; continue; }
        this.cyl(x, 0, z, 0.13, 7.5, '#6a4a30', true);
        this.box(x, 7.0, z, 0.12, 0.12, 1.8, '#6a4a30', false);
        const tops = [-0.8, 0, 0.8].map(o => new THREE.Vector3(x, 7.12, z + o));
        if (prev) tops.forEach((p, k) => this.wire(prev[k], p));
        prev = tops;
      }
    }
    // Gehweg-Möblierung am Rand jedes Blocks
    for (const [cx, cz] of this.blockCenters) {
      for (let k = 0; k < 3; k++) {
        const side = Math.floor(this.rng() * 4), off = this.range(-4.5, 4.5);
        const x = side < 2 ? cx + off : cx + (side === 2 ? -5.75 : 5.75);
        const z = side < 2 ? cz + (side === 0 ? -5.75 : 5.75) : cz + off;
        this.streetFurniture(x, z, side < 2);
      }
      if (t.crown === 'pine' && this.rng() < 0.6) this.crowns.push([cx + this.range(-5, 5), 0.1, cz + 6.3, 1.6, 0.45, 0.8, '#f4f8fb']); // Schneehaufen
    }
    this.landmarks();
    this.outskirts();
  }

  // Große Kulissen hinter der Mauer, je nach Thema
  landmarks() {
    const t = this.theme, R = HALF + 4;
    if (t === THEMES.hafen || t === THEMES.nacht) {
      this.box(0, -3, HALF + 5.5, OUT * 2 + 60, 3.3, 1.0, '#8a8a86', false); // Kaimauer
      for (const x of [-30, 25]) { // Hafenkräne
        const z = R + 4, c = '#e0a020';
        for (const dx of [-3, 3]) for (const dz of [-3, 3]) this.box(x + dx, 0, z + dz, 0.6, 22, 0.6, c, false);
        this.box(x, 22, z, 7, 1.2, 7, c, false);
        this.box(x, 23.2, z - 12, 2, 1.4, 34, c, false);
        this.box(x, 23.2, z + 8, 4, 4, 5, '#3a3d42', false);
        this.box(x, 12, z - 26, 0.15, 11, 0.15, '#222222', false);
        this.box(x, 10.5, z - 26, 1.6, 1.5, 1.6, '#e04a2f', false);
      }
      for (let k = 0; k < 3; k++) { // Schiff
        const x = -60 + k * 55;
        this.box(x, -1, R + 40, 40, 6, 12, k % 2 ? '#2a4a7a' : '#7a2a2a', false);
        this.box(x + 12, 5, R + 40, 10, 6, 9, '#e8e8e8', false);
        for (let s = 0; s < 4; s++) this.box(x - 14 + s * 6, 5, R + 40, 5, 2.6, 10, this.pick(t.containers), false);
      }
    } else if (t === THEMES.industrie) {
      for (let k = 0; k < 4; k++) this.box(0, 6 + k * 1.2, -R - 4, HALF * 2, 0.5, 0.5, '#7a6a5a', false); // Rohrbrücke
      for (const x of [-R - 2, R + 2]) this.cyl(x, 0, -R - 4, 0.5, 11, '#6a6a6a', true);
    } else if (t === THEMES.wueste) {
      // Dünen entstehen jetzt aus dem Gelände
    } else if (t === THEMES.schnee) {
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2 + this.rng() * 0.3, r = OUT + 60 + this.rng() * 40, h = 60 + this.rng() * 50;
        this.cones.push([Math.cos(a) * r, -1, Math.sin(a) * r, 35 + this.rng() * 20, h, 35, '#8a9aaa']);
        this.cones.push([Math.cos(a) * r, h * 0.55 - 1, Math.sin(a) * r, 16, h * 0.45, 16, '#f4f8fb']);
      }
    }
  }

  streetProp(x, z, horiz) {
    const r = this.rng();
    const sx = horiz ? 1 : 0, sz = horiz ? 0 : 1;
    if (r < 0.35) { // Auto
      const variant = this.pick(['limousine', 'limousine', 'kompakt', 'kompakt', 'pickup', 'transporter']);
      const color = this.pick(['#9a1c20', '#1f3c78', '#d6d6d2', '#1b1c1f', '#5f6368', '#b88a28', '#2b5a36', '#ececec', '#6a1414', '#3a6a8a']);
      this.car(x, z, horiz, variant, color, this.rng() < 0.5);
    } else if (r < 0.6) { // Barriere
      this.box(x, 0, z, horiz ? 3 : 0.7, 1.05, horiz ? 0.7 : 3, '#d8d4c8');
      this.box(x, 0.6, z, horiz ? 3.02 : 0.72, 0.18, horiz ? 0.72 : 3.02, '#e04a2f', false);
    } else if (r < 0.8) { // Kisten
      this.crate(x, z, 0, 1.1);
      this.crate(x + sx * 1.15, z + sz * 1.15, 0, 1.1);
      if (this.rng() < 0.6) this.crate(x + sx * 0.5, z + sz * 0.5, 1.1, 0.9);
    } else { // Sandsäcke
      this.box(x, 0, z, horiz ? 3.4 : 0.9, 0.95, horiz ? 0.9 : 3.4, '#b8a272');
    }
  }

  plaza(cx, cz) {
    // Freie Mitte (r≈3.5), niedrige Deckung am Rand
    const t = this.theme;
    for (const [dx, dz, w, d] of [[-4.2, -4.2, 2.6, 0.6], [4.2, 4.2, 2.6, 0.6], [-4.2, 4.2, 0.6, 2.6], [4.2, -4.2, 0.6, 2.6]]) {
      this.box(cx + dx, 0.15, cz + dz, w, 1.0, d, '#c9c2b0');
    }
    this.crate(cx - 5, cz, 0.15, 1); this.crate(cx + 5, cz + 1.5, 0.15, 1);
    this.box(cx, 0.15, cz, 4.5, 0.06, 4.5, t.curb, false);
    // Fahnenmast, Pflanzkübel, Bänke am Rand (Mitte bleibt frei für Missionsziele)
    this.cyl(cx + 5.2, 0.15, cz - 5.2, 0.07, 7, '#c8ccd0', true);
    this.box(cx + 5.2 + 0.8, 5.6, cz - 5.2, 1.5, 0.9, 0.04, this.pick(['#d0302a', '#2a62b8', '#ff7a1a']), false);
    for (const [dx, dz] of [[-5.2, 5.2], [5.2, 5.2], [-5.2, -5.2]]) {
      this.box(cx + dx, 0.15, cz + dz, 1.1, 0.6, 1.1, '#9a948a');
      this.crowns.push([cx + dx, 0.95, cz + dz, 0.6, 0.45, 0.6, t.tree]);
    }
    this.bench(cx, cz - 5.3, true);
    this.bench(cx - 5.3, cz, false);
  }

  buildingBlock(cx, cz) {
    if (this.rng() < 0.45) {
      this.building(cx, cz, this.range(7, 10.5), this.range(7, 10.5), this.range(4, 11));
    } else {
      for (const [dx, dz] of [[-3, -3], [3, 3], [-3, 3], [3, -3]]) {
        if (this.rng() < 0.3) { this.crate(cx + dx, cz + dz, 0.15); continue; }
        this.building(cx + dx, cz + dz, this.range(3.6, 5), this.range(3.6, 5), this.range(3, 7));
      }
    }
  }

  containersBlock(cx, cz) {
    const t = this.theme;
    const rot = this.rng() < 0.5;
    for (let k = -1; k <= 1; k++) {
      if (this.rng() < 0.2) continue;
      const off = k * 3.6;
      const x = rot ? cx + off : cx, z = rot ? cz : cz + off;
      const len = 6.2;
      const stacks = this.rng() < 0.4 ? 2 : 1;
      for (let s = 0; s < stacks; s++) {
        const col = this.pick(t.containers);
        const shift = (this.rng() - 0.5) * 2;
        this.box(x + (rot ? 0 : shift), 0.15 + s * 2.6, z + (rot ? shift : 0), rot ? 2.4 : len, 2.6, rot ? len : 2.4, col);
        // Rippen
        for (let q = -2; q <= 2; q++) this.box(x + (rot ? 0 : q * 1.2 + shift), 0.25 + s * 2.6, z + (rot ? q * 1.2 + shift : 0), rot ? 2.46 : 0.12, 2.4, rot ? 0.12 : 2.46, col, false);
        // Türen an der Stirnseite + Verriegelungsstangen
        const ex = x + (rot ? 0 : len / 2 + shift + 0.02), ez = z + (rot ? len / 2 + shift + 0.02 : 0);
        this.box(ex, 0.3 + s * 2.6, ez, rot ? 2.2 : 0.04, 2.3, rot ? 0.04 : 2.2, shadeHex(col, 0.8), false);
        for (const o of [-0.5, 0.5]) this.box(ex + (rot ? o : 0.03), 0.3 + s * 2.6, ez + (rot ? 0.03 : o), 0.06, 2.3, 0.06, '#6a6e72', false);
      }
    }
    // Paletten, Fässer und manchmal ein Gabelstapler in den Gängen
    const lane = rot ? [cx + 1.8, cz] : [cx, cz + 1.8];
    for (let k = 0; k < 3; k++) {
      const a = this.range(-4.5, 4.5);
      const px = rot ? cx + (this.rng() < 0.5 ? -5.3 : 5.3) : cx + a, pz = rot ? cz + a : cz + (this.rng() < 0.5 ? -5.3 : 5.3);
      if (this.rng() < 0.5) { this.box(px, 0.15, pz, 1.2, 0.15, 1.0, '#a8865a'); this.crate(px, pz, 0.3, 0.8); }
      else { this.barrel(px, pz, 0.15); if (this.rng() < 0.6) this.barrel(px + 0.65, pz + 0.1, 0.15); }
    }
    if (this.rng() < 0.35) {
      const [fx, fz] = lane;
      this.box(fx, 0.35, fz, 1.2, 1.0, 2.0, '#f0b020');
      this.box(fx, 1.35, fz + 0.3, 1.1, 1.0, 0.9, '#2e3034', false);
      this.box(fx, 2.35, fz + 0.3, 1.2, 0.1, 1.0, '#f0b020', false);
      this.box(fx, 0.2, fz - 1.15, 1.0, 2.6, 0.12, '#3a3d42', false);
      for (const o of [-0.3, 0.3]) this.box(fx + o, 0.2, fz - 1.6, 0.12, 0.06, 0.9, '#3a3d42', false);
      for (const o of [-0.6, 0.6]) for (const q of [-0.6, 0.6]) this.cyl(fx + o, 0.15, fz + q, 0.25, 0.25, '#1e1e1e');
    }
  }

  parkBlock(cx, cz) {
    const t = this.theme;
    for (let k = 0; k < 5; k++) this.tree(cx + this.range(-4.5, 4.5), cz + this.range(-4.5, 4.5));
    this.box(cx + this.range(-3, 3), 0.15, cz + this.range(-3, 3), 3.5, 0.8, 0.8, t.night ? '#1f3a26' : '#3f8a3a');
    this.bench(cx, cz + 4, true);
    // Rasen, Grasbüschel, Blumen
    const grass = t.crown === 'pine' ? '#e6eef4' : t.crown === 'palm' ? '#b8a46a' : '#5a9a45';
    this.box(cx, 0.15, cz, B - 1.2, 0.03, B - 1.2, grass, false);
    for (let k = 0; k < 26; k++) this.cones.push([cx + this.range(-5.2, 5.2), 0.15, cz + this.range(-5.2, 5.2), 0.12, 0.35, 0.12, shadeHex(t.tree, 0.8 + this.rng() * 0.4)]);
    if (t.crown !== 'pine') for (let k = 0; k < 14; k++) this.box(cx + this.range(-5, 5), 0.18, cz + this.range(-5, 5), 0.15, 0.15, 0.15, this.pick(['#ff5a7a', '#ffd23a', '#ffffff', '#b06aff']), false);
    // Niedriger Zaun mit Durchgang in der Mitte jeder Seite
    for (const s of [-1, 1]) for (const half of [-1, 1]) {
      const o = half * 3.3;
      this.box(cx + o, 0.15, cz + s * 5.8, 4.4, 0.5, 0.06, '#e8e2d0');
      this.box(cx + s * 5.8, 0.15, cz + o, 0.06, 0.5, 4.4, '#e8e2d0');
      for (let p = -2; p <= 2; p++) {
        this.box(cx + o + p, 0.15, cz + s * 5.8, 0.1, 0.65, 0.1, '#d8d2c0', false);
        this.box(cx + s * 5.8, 0.15, cz + o + p, 0.1, 0.65, 0.1, '#d8d2c0', false);
      }
    }
  }

  ruinsBlock(cx, cz) {
    const col = this.pick(this.theme.buildings);
    for (let k = 0; k < 7; k++) {
      const horiz = this.rng() < 0.5;
      const len = this.range(2, 5.5), h = this.range(1, 2.8);
      const x = cx + this.range(-4.5, 4.5), z = cz + this.range(-4.5, 4.5);
      this.box(x, 0.15, z, horiz ? len : 0.6, h, horiz ? 0.6 : len, col);
      // abgebrochene Kanten
      this.box(x + (horiz ? len / 2 - 0.3 : 0), 0.15 + h, z + (horiz ? 0 : len / 2 - 0.3), 0.6, this.range(0.3, 0.8), 0.6, col, false);
    }
    for (let k = 0; k < 3; k++) this.crate(cx + this.range(-5, 5), cz + this.range(-5, 5), 0.15, 0.8);
    // Schutt (gekippte Brocken) und umgestürzte Säulen
    for (let k = 0; k < 16; k++) {
      const s = this.range(0.2, 0.6);
      this.box(cx + this.range(-5.5, 5.5), 0.1, cz + this.range(-5.5, 5.5), s, s * 0.7, s, shadeHex(col, 0.7 + this.rng() * 0.3), false, this.range(-0.6, 0.6), this.range(0, 3));
    }
    if (this.rng() < 0.5) this.box(cx + this.range(-3, 3), 0.15, cz + this.range(-3, 3), 0.7, 0.7, 3.5, shadeHex(col, 0.9), true, 0, 0);
  }

  towerBlock(cx, cz) {
    this.tower(cx - 1, cz - 3);
    for (let k = 0; k < 2; k++) this.crate(cx + this.range(2, 5), cz + this.range(-5, 5), 0.15);
    this.tree(cx + 4, cz + 4);
    // Sandsack-Stellung und Fässer
    this.box(cx + 3.5, 0.15, cz - 1, 2.6, 0.9, 0.8, '#b8a272');
    this.box(cx + 3.5, 1.05, cz - 1, 2.4, 0.3, 0.7, '#a8925f', false);
    this.barrel(cx - 4.5, cz + 2, 0.15); this.barrel(cx - 4.0, cz + 2.7, 0.15);
  }

  // ------------------------------------------------------------ Meshes
  buildMeshes() {
    const t = this.theme;
    // Asphalt
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 7, HALF * 2 + 7), new THREE.MeshStandardMaterial({ map: groundTexture(t.street, 'asphalt', 14), roughness: 0.92 }));
    this.group.add(this.terrainMesh());
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);
    // Gehwegplatten auf allen Blöcken (ein Draw Call)
    const pg = [];
    for (const [cx, cz] of this.blockCenters) {
      const p = new THREE.PlaneGeometry(B, B); p.rotateX(-Math.PI / 2); p.translate(cx, 0.152, cz); pg.push(p);
    }
    const walk = new THREE.Mesh(mergePlanes(pg), new THREE.MeshLambertMaterial({ map: groundTexture(t.block, 'tiles', 4) }));
    walk.receiveShadow = true;
    this.group.add(walk);
    // Wolken
    const cl = [];
    const crng = mulberry(77);
    for (let k = 0; k < 22; k++) {
      const a = crng() * Math.PI * 2, r = 90 + crng() * 160, y = 70 + crng() * 40;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, s = 6 + crng() * 8;
      for (let b = 0; b < 4; b++) cl.push([x + (b - 1.5) * s * 0.9, y + crng() * 3, z + (crng() - 0.5) * s, s * (0.7 + crng() * 0.5), s * 0.45, s * 0.7, t.night ? '#3a4560' : '#ffffff']);
    }
    this.clouds = new THREE.Group();
    this.group.add(this.clouds);

    const unit = new THREE.BoxGeometry(1, 1, 1);
    unit.translate(0, 0.5, 0);
    // weiche Abdunklung nach unten (billige Umgebungsverdeckung)
    const ao = [];
    for (let i = 0; i < unit.attributes.position.count; i++) { const y = unit.attributes.position.getY(i); ao.push(...Array(3).fill(0.68 + 0.32 * y)); }
    unit.setAttribute('color', new THREE.Float32BufferAttribute(ao, 3));
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.88, metalness: 0.0 });
    const mesh = new THREE.InstancedMesh(unit, mat, this.vis.length);
    const m = new THREE.Matrix4(), c = new THREE.Color();
    const q = new THREE.Quaternion(), qr = new THREE.Quaternion(), eul = new THREE.Euler();
    this.vis.forEach((v, i) => {
      if (v[7] || v[8]) qr.setFromEuler(eul.set(v[7] || 0, v[8] || 0, 0)); else qr.identity();
      m.compose(new THREE.Vector3(v[0], v[1], v[2]), qr, new THREE.Vector3(v[3], v[4], v[5]));
      mesh.setMatrixAt(i, m);
      c.set(v[6]);
      const jitter = 0.93 + ((i * 7919) % 100) / 100 * 0.12;
      c.multiplyScalar(jitter);
      mesh.setColorAt(i, c);
    });
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.group.add(mesh);

    const addInst = (geo, list) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9 }), list.length);
      list.forEach((v, i) => {
        m.compose(new THREE.Vector3(v[0], v[1], v[2]), q, new THREE.Vector3(v[3], v[4], v[5]));
        im.setMatrixAt(i, m);
        im.setColorAt(i, c.set(v[6]));
      });
      im.castShadow = true;
      this.group.add(im);
    };
    addInst(new THREE.IcosahedronGeometry(1, 0), this.crowns);
    const cone = new THREE.ConeGeometry(1, 1, 6); cone.translate(0, 0.5, 0);
    addInst(cone, this.cones);
    const cylG = new THREE.CylinderGeometry(1, 1, 1, 12); cylG.translate(0, 0.5, 0);
    addInst(cylG, this.cyls);
    if (this.rocks.length) {
      const im = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.95 }), this.rocks.length);
      this.rocks.forEach((v, i) => { m.compose(new THREE.Vector3(v[0], v[1], v[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(v[7], v[8], v[9])), new THREE.Vector3(v[3], v[4], v[5])); im.setMatrixAt(i, m); im.setColorAt(i, c.set(v[6])); });
      im.castShadow = true; im.receiveShadow = true;
      this.group.add(im);
    }
    if (!this.extra.empty) {
      const em = new THREE.Mesh(this.extra.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
      em.castShadow = true; em.receiveShadow = true;
      this.group.add(em);
    }
    if (this.cars.length) {
      const bakers = { paint: new Baker(false), matte: new Baker(false), light: new Baker(false), glass: new Baker(false) };
      for (const car of this.cars) {
        const cm = new THREE.Matrix4().compose(new THREE.Vector3(car.x, car.y, car.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, car.ry, 0)), new THREE.Vector3(1, 1, 1));
        for (const p of carParts(car.variant, car.color)) bakers[p.mat].add(p.geo, new THREE.Matrix4().multiplyMatrices(cm, p.m), p.color);
      }
      const mats = carMaterials();
      for (const [k, b] of Object.entries(bakers)) {
        if (b.empty) continue;
        const mesh = new THREE.Mesh(b.build(), mats[k]);
        mesh.castShadow = k !== 'glass'; mesh.receiveShadow = true;
        this.group.add(mesh);
      }
    }
    // Stromleitungen (ein Draw Call)
    if (this.wires.length) {
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(this.wires, 3));
      this.group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x1a1a1a })));
    }
    // Hafenwasser hinter der Nordmauer
    if (this.water) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(500, 200), new THREE.MeshPhongMaterial({ color: t.night ? 0x0a1830 : 0x2a6a9a, shininess: 90, specular: 0x88aacc, transparent: true, opacity: 0.92 }));
      w.rotation.x = -Math.PI / 2;
      w.position.set(0, -0.35, HALF + 106);
      this.group.add(w);
    }
    // Wolken (eigene Gruppe, dreht sich langsam)
    if (cl.length) {
      const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, fog: false, emissive: t.night ? 0x000000 : 0x606870 }), cl.length);
      cl.forEach((v, i) => { m.compose(new THREE.Vector3(v[0], v[1], v[2]), q, new THREE.Vector3(v[3], v[4], v[5])); im.setMatrixAt(i, m); im.setColorAt(i, c.set(v[6])); });
      this.clouds.add(im);
    }

    // Kollisionsraster
    this.boxes.forEach((b, idx) => {
      for (let gx = Math.floor(b.x0 / this.cell); gx <= Math.floor(b.x1 / this.cell); gx++)
        for (let gz = Math.floor(b.z0 / this.cell); gz <= Math.floor(b.z1 / this.cell); gz++) {
          const k = gx * 1000 + gz;
          if (!this.grid.has(k)) this.grid.set(k, []);
          this.grid.get(k).push(idx);
        }
      b.s = 0;
    });
  }

  // ------------------------------------------------------------ Abfragen
  query(x0, z0, x1, z1) {
    const out = [];
    this.stamp++;
    for (let gx = Math.floor(x0 / this.cell); gx <= Math.floor(x1 / this.cell); gx++)
      for (let gz = Math.floor(z0 / this.cell); gz <= Math.floor(z1 / this.cell); gz++) {
        const l = this.grid.get(gx * 1000 + gz);
        if (!l) continue;
        for (const i of l) { const b = this.boxes[i]; if (b.s !== this.stamp) { b.s = this.stamp; out.push(b); } }
      }
    return out;
  }

  // Bewegt einen Zylinder (Radius r, Höhe h) mit Treppensteigen. Gibt "steht auf Boden" zurück.
  move(p, v, dt, r, h, grounded, gravity = 24) {
    // Stufen dürfen auch im leichten Fallen genommen werden (z. B. Treppe runter, Kante hoch)
    const canStep = grounded || v.y <= 0;
    const sx0 = p.x, sz0 = p.z, sy0 = p.y;
    p.x += v.x * dt; this.resolve(p, r, h, 0, canStep);
    p.z += v.z * dt; this.resolve(p, r, h, 2, canStep);
    // Gelände: steiler als ~48° geht nicht hoch (Berge sind eine natürliche Grenze)
    const th = this.terrainH(p.x, p.z), moved = Math.hypot(p.x - sx0, p.z - sz0);
    if (th > sy0 + 0.05 && moved > 1e-4 && (th - Math.max(sy0, this.terrainH(sx0, sz0))) / moved > 1.1) { p.x = sx0; p.z = sz0; }
    // Höhe NACH dem Hochsteigen merken, sonst "fällt" man in die Stufe und wird zurückgeschoben
    const prevY = p.y;
    v.y -= gravity * dt;
    p.y += v.y * dt;
    let g = false, floor = this.terrainH(p.x, p.z);
    for (const b of this.query(p.x - r, p.z - r, p.x + r, p.z + r)) {
      if (p.x + r <= b.x0 || p.x - r >= b.x1 || p.z + r <= b.z0 || p.z - r >= b.z1) continue;
      if (b.y1 <= prevY + 0.02) floor = Math.max(floor, b.y1);
      else if (v.y > 0 && p.y + h > b.y0 && prevY + h <= b.y0 + 0.08) { p.y = b.y0 - h; v.y = 0; }
    }
    if (p.y <= floor) { p.y = floor; v.y = 0; g = true; }
    else if (grounded && v.y <= 0 && prevY - floor < 0.55) { p.y = floor; v.y = 0; g = true; } // sanft Stufe runter
    const lim = OUT - 2 - r;
    p.x = Math.max(-lim, Math.min(lim, p.x));
    p.z = Math.max(-lim, Math.min(this.water ? HALF + 4.5 : lim, p.z));
    return g;
  }

  resolve(p, r, h, axis, canStep) {
    const list = this.query(p.x - r, p.z - r, p.x + r, p.z + r);
    for (const b of list) {
      if (p.x + r <= b.x0 || p.x - r >= b.x1 || p.z + r <= b.z0 || p.z - r >= b.z1) continue;
      if (p.y >= b.y1 - 0.001 || p.y + h <= b.y0) continue;
      if (canStep && b.y1 - p.y <= 0.55 && this.headroom(list, p, r, h, b.y1)) { p.y = b.y1; continue; } // Stufe hoch
      if (axis === 0) { const a = p.x + r - b.x0, c = b.x1 - (p.x - r); if (a < c) p.x -= a; else p.x += c; }
      else { const a = p.z + r - b.z0, c = b.z1 - (p.z - r); if (a < c) p.z -= a; else p.z += c; }
    }
  }

  terrainH(x, z) { return this.terrain.height(x, z); }

  floorAt(x, z, maxY = 999) {
    let f = this.terrainH ? this.terrainH(x, z) : 0;
    for (const b of this.query(x, z, x, z)) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && b.y1 <= maxY && b.y1 > f) f = b.y1;
    return f;
  }

  // Ist über der Stufe genug Platz für den Körper?
  headroom(list, p, r, h, y) {
    for (const o of list) {
      if (p.x + r <= o.x0 || p.x - r >= o.x1 || p.z + r <= o.z0 || p.z - r >= o.z1) continue;
      if (o.y1 > y + 0.02 && o.y0 < y + h) return false;
    }
    return true;
  }

  // Strahl gegen Welt: Distanz oder maxD. this.hitNormal wird gesetzt.
  raycast(o, d, maxD = 300) {
    let best = maxD;
    const n = this.hitNormal || (this.hitNormal = new THREE.Vector3());
    if (d.y < -1e-6) { const t = -o.y / d.y; if (t > 0 && t < best) { best = t; n.set(0, 1, 0); } }
    const ix = 1 / d.x, iy = 1 / d.y, iz = 1 / d.z;
    for (const b of this.boxes) {
      let t1 = (b.x0 - o.x) * ix, t2 = (b.x1 - o.x) * ix;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2), ax = 0;
      t1 = (b.y0 - o.y) * iy; t2 = (b.y1 - o.y) * iy;
      let a = Math.min(t1, t2), c = Math.max(t1, t2);
      if (a > tmin) { tmin = a; ax = 1; }
      if (c < tmax) tmax = c;
      t1 = (b.z0 - o.z) * iz; t2 = (b.z1 - o.z) * iz;
      a = Math.min(t1, t2); c = Math.max(t1, t2);
      if (a > tmin) { tmin = a; ax = 2; }
      if (c < tmax) tmax = c;
      if (tmax < 0 || tmin > tmax || tmin >= best) continue;
      if (tmin < 0) continue; // Start in der Box
      best = tmin;
      n.set(ax === 0 ? -Math.sign(d.x) : 0, ax === 1 ? -Math.sign(d.y) : 0, ax === 2 ? -Math.sign(d.z) : 0);
    }
    const lim = HALF + 2;
    for (let t = 0.3; t < best; t += 1.2) {
      const x = o.x + d.x * t, z = o.z + d.z * t;
      if (Math.abs(x) < lim && Math.abs(z) < lim) continue;
      if (o.y + d.y * t >= this.terrainH(x, z)) continue;
      let a = Math.max(0, t - 1.2), b = t;
      for (let i = 0; i < 6; i++) { const m = (a + b) / 2; if (o.y + d.y * m < this.terrainH(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; }
      if (b < best) {
        best = b;
        const hx = o.x + d.x * b, hz = o.z + d.z * b;
        n.set(this.terrainH(hx - 0.5, hz) - this.terrainH(hx + 0.5, hz), 1, this.terrainH(hx, hz - 0.5) - this.terrainH(hx, hz + 0.5)).normalize();
      }
      break;
    }
    return best;
  }

  lineOfSight(a, b) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    d.divideScalar(len);
    return this.raycast(a, d, len) >= len - 0.05;
  }

  nearestIntersection(x, z) {
    const i = Math.max(0, Math.min(N, Math.round((x - inter(0)) / P)));
    const j = Math.max(0, Math.min(N, Math.round((z - inter(0)) / P)));
    return { i, j, x: inter(i), z: inter(j) };
  }
  interPos(i, j) { return new THREE.Vector3(inter(i), 0, inter(j)); }

  // Weg über das Straßenraster (Manhattan) von a nach b
  path(a, b) {
    const s = this.nearestIntersection(a.x, a.z), e = this.nearestIntersection(b.x, b.z);
    const pts = [this.interPos(s.i, s.j)];
    let i = s.i, j = s.j;
    const xFirst = Math.abs(e.i - s.i) > Math.abs(e.j - s.j);
    const stepI = () => { while (i !== e.i) { i += Math.sign(e.i - i); pts.push(this.interPos(i, j)); } };
    const stepJ = () => { while (j !== e.j) { j += Math.sign(e.j - j); pts.push(this.interPos(i, j)); } };
    if (xFirst) { stepI(); stepJ(); } else { stepJ(); stepI(); }
    pts.push(new THREE.Vector3(b.x, 0, b.z));
    return pts;
  }

  randomStreetPoint(rng = Math.random) {
    const it = this.intersections[Math.floor(rng() * this.intersections.length)];
    return new THREE.Vector3(it.x, 0, it.z);
  }
}

function shadeHex(hex, f) { const c = new THREE.Color(hex); c.multiplyScalar(f); return '#' + c.getHexString(); }

function mergePlanes(list) {
  const pos = [], uv = [], nor = [];
  for (const g of list) {
    const ng = g.toNonIndexed();
    pos.push(...ng.attributes.position.array); uv.push(...ng.attributes.uv.array); nor.push(...ng.attributes.normal.array);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return out;
}

// Prozedurale Bodentexturen: Asphalt mit Körnung/Rissen oder Gehwegplatten
const texCache = new Map();
function groundTexture(color, kind, repeat) {
  const key = color + kind;
  if (!texCache.has(key)) {
    const S = 256, c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    const base = new THREE.Color(color);
    x.fillStyle = '#' + base.getHexString();
    x.fillRect(0, 0, S, S);
    const r = mulberry(kind === 'tiles' ? 5 : 9);
    const tone = f => { const k = base.clone().multiplyScalar(f); return `rgb(${k.r * 255 | 0},${k.g * 255 | 0},${k.b * 255 | 0})`; };
    if (kind === 'tiles') {
      const n = 4, s = S / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { x.fillStyle = tone(0.92 + r() * 0.14); x.fillRect(i * s + 2, j * s + 2, s - 4, s - 4); }
      for (let k = 0; k < 1500; k++) { x.fillStyle = tone(0.85 + r() * 0.3); x.fillRect(r() * S, r() * S, 1.5, 1.5); }
      x.fillStyle = tone(0.7);
      for (let i = 0; i <= n; i++) { x.fillRect(i * s - 2, 0, 4, S); x.fillRect(0, i * s - 2, S, 4); }
    } else {
      for (let k = 0; k < 7000; k++) { x.fillStyle = tone(0.9 + r() * 0.2); const sz = r() < 0.9 ? 1 : 2; x.fillRect(r() * S, r() * S, sz, sz); }
      for (let k = 0; k < 14; k++) { // Flecken
        x.fillStyle = tone(0.88 + r() * 0.1); x.globalAlpha = 0.35;
        x.beginPath(); x.arc(r() * S, r() * S, 10 + r() * 30, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1;
      }
      x.strokeStyle = tone(0.6); x.lineWidth = 1;
      for (let k = 0; k < 4; k++) { // Risse
        let px = r() * S, py = r() * S;
        x.beginPath(); x.moveTo(px, py);
        for (let q = 0; q < 8; q++) { px += (r() - 0.5) * 30; py += (r() - 0.5) * 30; x.lineTo(px, py); }
        x.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    texCache.set(key, tex);
  }
  const tex = texCache.get(key).clone();
  tex.needsUpdate = true;
  tex.repeat.set(repeat, repeat);
  if (kind === 'tiles') tex.repeat.set(3, 3);
  return tex;
}

// Sonnenscheibe als additiver Sprite
export function makeSun(theme, dir) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, theme.night ? 'rgba(230,240,255,1)' : 'rgba(255,250,230,1)');
  g.addColorStop(0.18, theme.night ? 'rgba(200,215,255,0.9)' : 'rgba(255,240,200,0.85)');
  g.addColorStop(1, 'rgba(255,220,160,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, fog: false, depthWrite: false, transparent: true }));
  s.position.copy(dir).normalize().multiplyScalar(350);
  s.scale.setScalar(theme.night ? 28 : 60);
  s.renderOrder = -1;
  return s;
}

// Himmelskuppel mit Farbverlauf
export function makeSky(theme) {
  const geo = new THREE.SphereGeometry(400, 16, 10);
  const top = new THREE.Color(theme.skyTop), bot = new THREE.Color(theme.skyBot);
  const cols = [];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, pos.getY(i) / 250 + 0.15));
    const c = bot.clone().lerp(top, t);
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  mesh.renderOrder = -1;
  return mesh;
}

Object.assign(World.prototype, outskirtsMixin);
