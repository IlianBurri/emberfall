// Umland um die Stadt: Höhenkarte (Hügel, Berge als natürliche Grenze, Meer im Norden bei Hafen-Maps),
// Feldwege, flache Plätze für Orte. Wird von der Welt beim Generieren genutzt.
import { mulberry } from './zone.js';

export const OUT = 124;          // Grenze der spielbaren Fläche (±OUT)
export const RING = 94;          // Ringstraße ums Umland
const EXT = OUT + 70;            // Ausdehnung der Höhenkarte (inkl. Berge am Horizont)
const RES = 2;                   // Rasterweite in Metern

const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Wertrauschen mit Oktaven (deterministisch pro Map)
function makeNoise(seed) {
  const r = mulberry(seed);
  const perm = new Float32Array(1024).map(() => r());
  const h = (ix, iz) => perm[(((ix * 73856093) ^ (iz * 19349663)) >>> 0) & 1023];
  const value = (x, z) => {
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    const a = h(ix, iz), b = h(ix + 1, iz), c = h(ix, iz + 1), d = h(ix + 1, iz + 1);
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  };
  return (x, z, oct = 3) => { let s = 0, amp = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += value(x * f, z * f) * amp; n += amp; amp *= 0.5; f *= 2.03; } return s / n; };
}

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz;
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l)) : 0;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

export class Terrain {
  constructor(seed, half, theme, water) {
    this.half = half;
    this.water = water;
    this.noise = makeNoise(seed ^ 0x7e11);
    this.amp = { wueste: 8, schnee: 7, industrie: 4.5, nacht: 5.5, hafen: 5.5 }[theme] || 5.5;
    // Straßennetz: Ringstraße + Torstraßen (bei Hafen-Maps ist der Norden Meer)
    const R = RING, c = 12;
    this.ring = water
      ? [[-R, half - 2], [-R, -R + c], [-R + c, -R], [R - c, -R], [R, -R + c], [R, half - 2]]
      : [[-R + c, -R], [R - c, -R], [R, -R + c], [R, R - c], [R - c, R], [-R + c, R], [-R, R - c], [-R, -R + c], [-R + c, -R]];
    this.gates = { e: 9, w: 9, s: -9, n: water ? null : -9 };
    this.roads = [this.ring,
      [[half, 9], [R, 9]], [[-half, 9], [-R - 14, 9]], [[-9, -half], [-9, -R]]];
    if (!water) this.roads.push([[-9, half], [-9, R]]);
    // Orte im Umland (flache Plätze); h wird aus dem Gelände bestimmt, Funkhügel liegt erhöht
    this.pads = [
      { kind: 'farm', x: 104, z: -42, r: 13 },
      { kind: 'funk', x: 30, z: -106, r: 8, h: 7.5 },
      { kind: 'tanke', x: -106, z: 22, r: 11 },
      { kind: 'tanklager', x: -62, z: -104, r: 11 },
    ];
    if (!water) this.pads.push({ kind: 'depot', x: -36, z: 106, r: 13 }, { kind: 'weiler', x: 70, z: 100, r: 12 });
    else this.pads.push({ kind: 'weiler', x: 104, z: 40, r: 11 });
    for (const p of this.pads) if (p.h === undefined) p.h = this.low(p.x, p.z) * 0.9;
    this.build();
  }

  low(x, z) {
    const d = Math.max(Math.abs(x), Math.abs(z));
    const t = smooth(this.half + 3, this.half + 18, d);
    return t * Math.max(-0.8, (this.noise(x * 0.016 + 11.3, z * 0.016 - 4.1, 3) - 0.42) * 2.2 * this.amp);
  }

  raw(x, z) {
    const half = this.half;
    const d = Math.max(Math.abs(x), Math.abs(z));
    if (d < half + 3) return { h: 0, road: 0 };
    const t = smooth(half + 3, half + 18, d);
    const low = this.low(x, z);
    const hi = (this.noise(x * 0.09 - 7, z * 0.09 + 3, 2) - 0.5) * 1.6 * t;
    const mnt = (smooth(OUT - 13, OUT + 4, d) * 30 + smooth(OUT, OUT + 50, d) * 28) * (0.7 + 0.6 * this.noise(x * 0.025 + 40, z * 0.025, 3));
    let h = low + hi * 0.7 + mnt;
    let rd = 1e9;
    for (const line of this.roads) for (let i = 0; i < line.length - 1; i++) rd = Math.min(rd, segDist(x, z, line[i][0], line[i][1], line[i + 1][0], line[i + 1][1]));
    const road = 1 - smooth(2.8, 4.2, rd);
    h += ((low * 0.85 + mnt * 0.2) - h) * (1 - smooth(3.5, 9, rd));          // Straßen folgen sanft dem Gelände
    for (const p of this.pads) h += (p.h - h) * (1 - smooth(p.r, p.r + (p.kind === 'funk' ? 22 : 10), Math.hypot(x - p.x, z - p.z)));
    if (this.water && z > half + 4) h = Math.min(h, 0) - smooth(half + 4, half + 14, z) * 3; // Ufer → Meer
    return { h, road };
  }

  build() {
    const n = this.n = Math.round(EXT * 2 / RES) + 1;
    this.heights = new Float32Array(n * n);
    this.roadMask = new Float32Array(n * n);
    for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) {
      const x = -EXT + col * RES, z = -EXT + row * RES;
      const { h, road } = this.raw(x, z);
      this.heights[row * n + col] = h;
      this.roadMask[row * n + col] = road;
    }
  }

  // Bilinear interpolierte Höhe
  height(x, z) {
    const n = this.n;
    const fx = (x + EXT) / RES, fz = (z + EXT) / RES;
    const c = Math.max(0, Math.min(n - 2, Math.floor(fx))), r = Math.max(0, Math.min(n - 2, Math.floor(fz)));
    const tx = Math.max(0, Math.min(1, fx - c)), tz = Math.max(0, Math.min(1, fz - r));
    const H = this.heights, i = r * n + c;
    const a = H[i] + (H[i + 1] - H[i]) * tx, b = H[i + n] + (H[i + n + 1] - H[i + n]) * tx;
    return a + (b - a) * tz;
  }
  roadAt(x, z) {
    const n = this.n, c = Math.round((x + EXT) / RES), r = Math.round((z + EXT) / RES);
    if (c < 0 || r < 0 || c >= n || r >= n) return 0;
    return this.roadMask[r * n + c];
  }
  get extent() { return EXT; }
  get res() { return RES; }
}
