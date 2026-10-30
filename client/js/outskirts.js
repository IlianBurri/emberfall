// Umland-Inhalte und Geländenetz. Wird als Methoden in die Welt-Klasse eingemischt.
import * as THREE from 'three';
import { OUT } from './terrain.js';

const TERRAIN_PAL = {
  hafen: { grass: '#5d8a3c', dry: '#80894a', dirt: '#7a6246', rock: '#7c7a72', peak: '#9a9890', sand: '#c8b88a' },
  nacht: { grass: '#2e4a2c', dry: '#3e4a2e', dirt: '#4a3e30', rock: '#4a4a50', peak: '#5c5c64', sand: '#5a5444' },
  wueste: { grass: '#d8b67c', dry: '#caa66a', dirt: '#b48c58', rock: '#a07a52', peak: '#c8a070', sand: '#d8b67c' },
  schnee: { grass: '#eef3f8', dry: '#e1e8ef', dirt: '#9aa4ae', rock: '#6c7682', peak: '#ffffff', sand: '#d8dee4' },
  industrie: { grass: '#7f7f4c', dry: '#8e7c52', dirt: '#6e5a44', rock: '#6c645c', peak: '#8a8278', sand: '#9a8a68' },
};
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function shade(hex, f) { const c = new THREE.Color(hex); c.multiplyScalar(f); return '#' + c.getHexString(); }

// Satteldach als Prisma (Firstrichtung entlang x)
function gableGeo(len, width, rise) {
  const s = new THREE.Shape();
  s.moveTo(-width / 2, 0); s.lineTo(width / 2, 0); s.lineTo(0, rise); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
  g.translate(0, 0, -len / 2);
  g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}
const HEMI = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
const CYLX = new THREE.CylinderGeometry(1, 1, 1, 14); CYLX.rotateZ(Math.PI / 2);

export const outskirtsMixin = {
  terrainMesh() {
    const T = this.terrain, n = T.n, E = T.extent, key = this.themeKey;
    const pal = TERRAIN_PAL[key] || TERRAIN_PAL.hafen;
    const geo = new THREE.PlaneGeometry(E * 2, E * 2, n - 1, n - 1);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const lim = this.half + 2.5;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, Math.abs(x) < lim && Math.abs(z) < lim ? -0.08 : T.heights[i]);
    }
    geo.computeVertexNormals();
    const nor = geo.attributes.normal, cols = new Float32Array(pos.count * 3);
    const C = k => new THREE.Color(pal[k]);
    const grass = C('grass'), dry = C('dry'), dirt = C('dirt'), rock = C('rock'), peak = C('peak'), sand = C('sand');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const slope = 1 - nor.getY(i);
      const v = this.terrain.noise(x * 0.05, z * 0.05, 2);
      c.copy(grass).lerp(dry, smooth(0.35, 0.7, v));
      c.lerp(rock, smooth(0.12, 0.32, slope));
      c.lerp(peak, smooth(16, 30, y) * 0.8);
      c.lerp(dirt, T.roadMask[i] * 0.95);
      if (y < -0.1) c.lerp(sand, smooth(-0.1, -0.6, y));
      c.multiplyScalar(0.92 + this.terrain.noise(x * 0.3, z * 0.3, 1) * 0.16);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    // Feine Körnung als Detail-Textur
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x2 = cv.getContext('2d');
    x2.fillStyle = '#d0d0d0'; x2.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 2500; k++) { const g = 170 + Math.random() * 85; x2.fillStyle = `rgb(${g},${g},${g})`; x2.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1 + Math.random() * 2); }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(E / 2, E / 2); tex.anisotropy = 8;
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, map: tex }));
    mesh.receiveShadow = true;
    return mesh;
  },

  outskirts() {
    const T = this.terrain, t = this.theme, r = this.rng;
    const H = (x, z) => T.height(x, z);
    const band = (x, z) => { const d = Math.max(Math.abs(x), Math.abs(z)); return d > this.half + 7 && d < OUT - 5 && (!this.water || z < this.half + 2); };
    const free = (x, z, pad = 3) => band(x, z) && T.roadAt(x, z) < 0.01 && !T.pads.some(p => Math.hypot(x - p.x, z - p.z) < p.r + pad);
    const rnd = (a, b) => a + r() * (b - a);
    const spot = () => { const a = r() * Math.PI * 2; const d = rnd(this.half + 8, OUT - 6); return [Math.cos(a) * d * 1.2, Math.sin(a) * d * 1.2].map(v => Math.max(-OUT + 6, Math.min(OUT - 6, v))); };
    // Orte
    for (const p of T.pads) {
      this.yOff = p.h;
      this['poi_' + p.kind](p, H);
      this.yOff = 0;
      for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; this.outerSpots.push(new THREE.Vector3(p.x + Math.cos(a) * p.r * 0.6, p.h + 0.05, p.z + Math.sin(a) * p.r * 0.6)); }
    }
    // Waldstücke und einzelne Bäume (gemischt, natürlich gruppiert)
    const treeHere = (x, z) => {
      const y = H(x, z) - 0.1;
      const kind = t.crown === 'pine' ? 'pine' : t.crown === 'palm' ? (r() < 0.6 ? 'palm' : 'dry') : t.chimneys ? (r() < 0.35 ? 'dead' : 'blob') : (r() < 0.3 ? 'fir' : 'blob');
      const s = rnd(0.75, 1.35);
      if (kind === 'fir') {
        this.yOff = y; this.box(x, 0, z, 0.35 * s, 1.6 * s, 0.35 * s, t.trunk); this.yOff = 0;
        const col = shade('#2f5a38', rnd(0.85, 1.15));
        this.cones.push([x, y + 1.0 * s, z, 1.7 * s, 3.2 * s, 1.7 * s, col], [x, y + 2.6 * s, z, 1.25 * s, 2.6 * s, 1.25 * s, col], [x, y + 3.9 * s, z, 0.8 * s, 2 * s, 0.8 * s, col]);
      } else if (kind === 'dead') {
        this.yOff = y; this.box(x, 0, z, 0.3, 3.6 * s, 0.3, '#4a3c30'); this.box(x + 0.5, 2.2 * s, z, 1.2, 0.14, 0.14, '#4a3c30', false, 0, 0.5); this.yOff = 0;
      } else if (kind === 'dry') {
        this.crowns.push([x, y + 0.4, z, 1.0 * s, 0.6 * s, 1.0 * s, shade('#9a8a4a', rnd(0.8, 1.1))]);
      } else {
        const oy = this.yOff; this.yOff = y;
        this.treeAt(x, z, { ...t, tree: shade(t.tree, rnd(0.8, 1.2)) }, y);
        if (kind === 'blob' && r() < 0.6) this.crowns.push([x + rnd(-0.6, 0.6), y + 3.4 * s, z + rnd(-0.6, 0.6), 1.3 * s, 1.1 * s, 1.3 * s, shade(t.tree, rnd(0.75, 1.1))]);
        this.yOff = oy;
      }
    };
    for (let k = 0; k < 38; k++) {
      const [cx, cz] = spot();
      if (!free(cx, cz)) continue;
      const cnt = 3 + Math.floor(r() * 8);
      for (let q = 0; q < cnt; q++) { const x = cx + rnd(-8, 8), z = cz + rnd(-8, 8); if (free(x, z)) treeHere(x, z); }
    }
    for (let k = 0; k < 70; k++) { const [x, z] = spot(); if (free(x, z)) treeHere(x, z); }
    // Felsen (große mit Kollision)
    for (let k = 0; k < 95; k++) {
      const [x, z] = spot();
      if (!free(x, z, 1)) continue;
      const s = r() < 0.2 ? rnd(1.4, 2.8) : rnd(0.3, 1.1), y = H(x, z);
      this.rocks.push([x, y + s * 0.2, z, s * rnd(0.9, 1.4), s * rnd(0.55, 0.9), s * rnd(0.9, 1.3), shade(TERRAIN_ROCK[this.themeKey] || '#7c7a72', rnd(0.8, 1.15)), r() * 3, r() * 3, r() * 3]);
      if (s > 1) this.boxes.push({ x0: x - s * 0.8, y0: y - 0.5, z0: z - s * 0.8, x1: x + s * 0.8, y1: y + s * 0.85, z1: z + s * 0.8 });
    }
    // Büsche und Gras
    const bushC = t.crown === 'palm' ? '#8a8a4a' : t.crown === 'pine' ? '#3c5a46' : t.tree;
    for (let k = 0; k < 160; k++) { const [x, z] = spot(); if (free(x, z, 1)) this.crowns.push([x, H(x, z) + 0.25, z, rnd(0.5, 1.2), rnd(0.4, 0.8), rnd(0.5, 1.2), shade(bushC, rnd(0.75, 1.15))]); }
    if (t.crown !== 'pine') for (let k = 0; k < 900; k++) { const [x, z] = spot(); if (free(x, z, 0)) this.cones.push([x, H(x, z) - 0.02, z, 0.09, rnd(0.25, 0.5), 0.09, shade(t.crown === 'palm' ? '#b8a060' : '#6a9a48', rnd(0.75, 1.2))]); }
    // Strommasten entlang der Torstraßen
    for (const line of T.roads.slice(1)) {
      const [[ax, az], [bx, bz]] = line, len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len;
      let prev = null;
      for (let d = 8; d < len; d += 15) {
        const x = ax + (bx - ax) * d / len + nx * 4.5, z = az + (bz - az) * d / len + nz * 4.5, y = H(x, z);
        this.yOff = y; this.cyl(x, 0, z, 0.13, 7.5, '#6a4a30', true); this.box(x, 7.0, z, 0.12, 0.12, 1.6, '#6a4a30', false); this.yOff = 0;
        const tops = [-0.7, 0, 0.7].map(o => new THREE.Vector3(x + nz * o * 0, y + 7.12, z + o));
        if (prev) tops.forEach((p, i) => this.wire(prev[i], p));
        prev = tops;
      }
    }
    // Loot-Punkte entlang der Ringstraße
    const ring = T.ring;
    for (let i = 0; i < ring.length - 1; i++) {
      const [ax, az] = ring[i], [bx, bz] = ring[i + 1], len = Math.hypot(bx - ax, bz - az);
      for (let d = 10; d < len; d += 28) { const x = ax + (bx - ax) * d / len, z = az + (bz - az) * d / len; this.outerSpots.push(new THREE.Vector3(x, H(x, z) + 0.05, z)); }
    }
  },

  // ---------------------------------------------------------------- Orte (yOff = Höhe des Platzes)
  poi_farm(p) {
    const bx = p.x - 2, bz = p.z - 4, w = 10, d = 7, h = 4.4;
    this.box(bx, 0, bz, w, h, d, '#8a2e22');
    this.extra.geo(gableGeo(w + 0.8, d + 0.8, 2.6), '#3a3a3e', bx, this.yOff + h, bz);
    this.box(bx, 0, bz + d / 2 + 0.05, 3.2, 3.4, 0.12, '#5a2018', false);
    this.box(bx, 1.6, bz + d / 2 + 0.12, 3.4, 0.16, 0.06, '#efe8dc', false);
    for (const s of [-1, 1]) this.box(bx + s * 1.6, 0, bz + d / 2 + 0.12, 0.16, 3.4, 0.06, '#efe8dc', false);
    this.cyl(p.x + 6.5, 0, p.z - 5, 1.9, 9.5, '#c8c8c0', true);
    this.extra.geo(HEMI, '#9aa0a6', p.x + 6.5, this.yOff + 9.5, p.z - 5, 1.95, 1.4, 1.95);
    for (let k = 0; k < 4; k++) this.cyl(p.x + 6.5, 1.5 + k * 2.2, p.z - 5, 1.93, 0.12, '#8a8a84');
    // Strohballen
    for (let k = 0; k < 5; k++) {
      const x = p.x - 6 + k * 1.4, z = p.z + 3 + (k % 2) * 1.5;
      this.extra.geo(CYLX, '#d8b85a', x, this.yOff + 0.6, z, 0.6, 1.2, 0.6);
      this.boxes.push({ x0: x - 0.6, y0: this.yOff, z0: z - 0.6, x1: x + 0.6, y1: this.yOff + 1.2, z1: z + 0.6 });
    }
    // Feld mit Reihen + Zaun
    for (let k = 0; k < 7; k++) this.box(p.x + 3, 0.02, p.z + 3 + k * 1.2, 8, 0.35, 0.5, k % 2 ? '#4a7a2e' : '#5a8a34', false);
    for (let k = -4; k <= 4; k++) { this.box(p.x + 3 + k, 0, p.z + 2, 0.1, 1.0, 0.1, '#8a6a42', false); this.box(p.x + 3 + k, 0, p.z + 11.5, 0.1, 1.0, 0.1, '#8a6a42', false); }
    this.box(p.x + 3, 0.7, p.z + 2, 9, 0.08, 0.06, '#8a6a42'); this.box(p.x + 3, 0.7, p.z + 11.5, 9, 0.08, 0.06, '#8a6a42');
    this.car(p.x - 8, p.z + 8, false, 'pickup', '#8a1a14');
    this.barrel(p.x - 7, p.z - 2); this.barrel(p.x - 6.4, p.z - 1.6);
  },
  poi_funk(p, H) {
    const y0 = this.yOff;
    this.cyl(p.x, 0, p.z, 0.28, 24, '#d8d8d8', true);
    for (let k = 0; k < 6; k++) this.cyl(p.x, 2 + k * 4, p.z, 0.3, 1.6, '#d0302a');
    this.box(p.x, 24, p.z, 0.4, 0.4, 0.4, '#ff3a2a', false);
    for (let k = 0; k < 3; k++) {
      const a = k / 3 * Math.PI * 2, ax = p.x + Math.cos(a) * 10, az = p.z + Math.sin(a) * 10;
      this.wire(new THREE.Vector3(p.x, y0 + 20, p.z), new THREE.Vector3(ax, H(ax, az), az));
      this.wire(new THREE.Vector3(p.x, y0 + 12, p.z), new THREE.Vector3(ax, H(ax, az), az));
    }
    this.building(p.x + 4.5, p.z + 3.5, 4.5, 3.5, 3);
    this.extra.geo(HEMI, '#e8e8e8', p.x - 3.5, y0 + 2.2, p.z + 3, 1.3, 0.5, 1.3, -1.0, 0.6, 0); // Satellitenschüssel
    this.cyl(p.x - 3.5, 0, p.z + 3, 0.12, 2.0, '#8a8a8a');
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; this.box(p.x + Math.cos(a) * 6.5, 0, p.z + Math.sin(a) * 6.5, 2.4, 0.9, 0.8, '#b8a272', true, 0, -a); }
  },
  poi_tanke(p) {
    const cx = p.x + 1, cz = p.z - 4;
    for (const [dx, dz] of [[-4.5, -2.6], [4.5, -2.6], [-4.5, 2.6], [4.5, 2.6]]) this.cyl(cx + dx, 0, cz + dz, 0.22, 4.4, '#d8d8d4', true);
    this.box(cx, 4.4, cz, 11.5, 0.5, 7, '#efefea', false);
    this.box(cx, 4.5, cz, 11.7, 0.28, 7.2, '#d0302a', false);
    for (const dx of [-2, 2]) {
      this.box(cx + dx, 0, cz, 0.9, 0.2, 2.6, '#9a9a96');
      this.box(cx + dx, 0.2, cz, 0.6, 1.5, 0.45, '#e8e8e4');
      this.box(cx + dx, 1.4, cz - 0.24, 0.45, 0.25, 0.02, '#1a2a3a', false);
      this.box(cx + dx + 0.32, 0.7, cz, 0.06, 0.6, 0.12, '#1a1a1a', false);
    }
    this.building(p.x - 1, p.z + 5.5, 8, 4.5, 3.4);
    this.cyl(p.x + 7.5, 0, p.z + 6, 0.15, 6, '#8a8a8a', true);
    this.box(p.x + 7.5, 6, p.z + 6, 0.3, 2.4, 1.8, '#d0302a', false);
    this.box(p.x + 7.66, 6.3, p.z + 6, 0.02, 1.8, 1.5, '#f4f0e0', false);
    this.car(cx - 2, cz + 4.6, true, 'kompakt', '#1f3c78');
    this.car(p.x - 7, p.z - 6, false, 'limousine', '#d6d6d2');
    this.barrel(p.x + 6, p.z - 6); this.barrel(p.x + 6.6, p.z - 5.6);
  },
  poi_tanklager(p) {
    for (const [dx, dz] of [[-4.6, -4.6], [4.6, -4.6], [-4.6, 4.6], [4.6, 4.6]]) {
      this.cyl(p.x + dx, 0, p.z + dz, 3.2, 7.5, '#d8d4cc', true);
      this.extra.geo(HEMI, '#b8b4ac', p.x + dx, this.yOff + 7.5, p.z + dz, 3.25, 0.8, 3.25);
      this.box(p.x + dx + 3.2, 0, p.z + dz, 0.1, 7.6, 0.5, '#5a5a5a', false); // Leiter
    }
    this.box(p.x, 1.2, p.z, 9.2, 0.35, 0.35, '#6a6a6a', false);
    this.box(p.x, 1.2, p.z, 0.35, 0.35, 9.2, '#6a6a6a', false);
    for (const s of [-1, 1]) { this.box(p.x + s * 9.5, 0, p.z, 0.08, 1.8, 19, '#8a8e92'); this.box(p.x, 0, p.z + s * 9.5, s > 0 ? 6 : 19, 1.8, 0.08, '#8a8e92'); }
    this.barrel(p.x - 8, p.z + 7); this.barrel(p.x - 7.4, p.z + 7.4); this.crate(p.x + 7.5, p.z + 7, 0, 1.1);
  },
  poi_depot(p) {
    const cols = this.theme.containers;
    for (let k = 0; k < 4; k++) {
      const x = p.x - 6 + k * 3.2, z = p.z - 3;
      this.box(x, 0, z, 2.4, 2.6, 6.1, this.pick(cols));
      if (k % 2) this.box(x, 2.6, z + 0.4, 2.4, 2.6, 6.1, this.pick(cols));
    }
    for (let k = 0; k < 3; k++) this.cones.push([p.x + 4 + k * 3, this.yOff, p.z + 6, 2.2, 2.2, 2.2, shade('#9a948a', 0.9 + k * 0.05)]);
    this.tower(p.x + 7, p.z - 6);
    this.car(p.x - 5, p.z + 7, true, 'transporter', '#d6d6d2');
  },
  poi_weiler(p) {
    const roofs = ['#7a3a2a', '#4a4a50', '#6a4a30'];
    [[-5, -4, 5.5, 4.5], [5, -3, 5, 4.2], [0, 5, 6, 4.5]].forEach(([dx, dz, w, d], i) => {
      const h = 3;
      this.building(p.x + dx, p.z + dz, w, d, h);
      this.extra.geo(gableGeo(w + 0.6, d + 0.6, 1.8), roofs[i], p.x + dx, this.yOff + h + 0.35, p.z + dz);
    });
    this.cyl(p.x + 0.5, 0, p.z - 0.5, 0.9, 0.8, '#8a8478', true); // Brunnen
    this.box(p.x + 0.5, 0.8, p.z - 0.5, 1.6, 0.1, 0.2, '#6a4a30', false);
    this.car(p.x - 7, p.z + 1, false, 'kompakt', '#2b5a36');
  },
};
const TERRAIN_ROCK = Object.fromEntries(Object.entries(TERRAIN_PAL).map(([k, v]) => [k, v.rock]));
