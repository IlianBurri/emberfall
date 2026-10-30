// Realistische Autos aus extrudierten Seitenprofilen (abgerundete Karosserie, Radkästen, getönte Scheiben,
// Lichter, Räder mit Felgen). Liefert Teile, die die Welt zu wenigen großen Geometrien zusammenbackt.
import * as THREE from 'three';
import { rbox } from './geom.js';

const W_RAD = 0.33; // Reifenradius

// Seitenprofile (x = Länge nach vorne, y = Höhe). body = Karosserie unten, cab = Glas/Kabine.
const VARIANTS = {
  limousine: {
    L: 4.3, W: 1.76, wf: 1.36, wr: -1.3,
    body: [[-2.15, 0.28], [2.12, 0.28], [2.2, 0.45], [2.18, 0.62], [2.0, 0.78], [0.92, 0.87], [-1.58, 0.89], [-2.07, 0.87], [-2.2, 0.7], [-2.18, 0.45]],
    cab: [[0.92, 0.86], [0.18, 1.36], [-0.82, 1.38], [-1.56, 0.88]],
    pillars: [[0.92, 0.87, 0.18, 1.36], [-0.32, 0.88, -0.32, 1.37], [-0.82, 1.37, -1.56, 0.89]],
  },
  kompakt: {
    L: 3.8, W: 1.7, wf: 1.2, wr: -1.18,
    body: [[-1.88, 0.3], [1.85, 0.3], [1.93, 0.46], [1.9, 0.64], [1.72, 0.8], [0.75, 0.9], [-1.82, 0.92], [-1.92, 0.7], [-1.9, 0.46]],
    cab: [[0.75, 0.89], [0.05, 1.42], [-1.55, 1.44], [-1.8, 0.91]],
    pillars: [[0.75, 0.9, 0.05, 1.42], [-0.6, 0.91, -0.6, 1.43], [-1.55, 1.43, -1.8, 0.92]],
  },
  pickup: {
    L: 4.9, W: 1.85, wf: 1.6, wr: -1.5,
    body: [[-2.45, 0.38], [2.4, 0.38], [2.5, 0.55], [2.48, 0.78], [2.25, 0.96], [1.15, 1.0], [-2.4, 1.0], [-2.5, 0.8], [-2.48, 0.55]],
    cab: [[1.15, 0.99], [0.45, 1.55], [-0.5, 1.56], [-0.62, 1.0]],
    pillars: [[1.15, 1.0, 0.45, 1.55], [-0.55, 1.0, -0.55, 1.56]],
    bed: true,
  },
  transporter: {
    L: 5.0, W: 1.95, wf: 1.75, wr: -1.55,
    body: [[-2.5, 0.32], [2.45, 0.32], [2.55, 0.5], [2.52, 0.8], [2.25, 1.0], [1.6, 1.12], [-2.5, 1.12], [-2.55, 0.8], [-2.52, 0.5]],
    cab: [[1.6, 1.11], [0.95, 2.05], [-2.5, 2.08], [-2.5, 1.11]],
    pillars: [[1.6, 1.12, 0.95, 2.05]],
    van: true,
  },
};
export const CAR_VARIANTS = Object.keys(VARIANTS);
export const CAR_SIZE = Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, { L: v.L + 0.1, W: v.W + 0.12, H: v.van ? 2.1 : v.bed ? 1.6 : 1.42 }]));

function shapeFrom(points, v) {
  const s = new THREE.Shape();
  // Unterkante mit Radkästen (Bögen über den Rädern)
  const [x0, y0] = points[0];
  s.moveTo(x0, y0);
  for (const wx of [v.wr, v.wf]) {
    s.lineTo(wx - 0.42, y0);
    s.absarc(wx, W_RAD + 0.02, 0.42, Math.PI, 0, true);
    s.lineTo(wx + 0.42, y0);
  }
  for (let i = 1; i < points.length; i++) s.lineTo(points[i][0], points[i][1]);
  s.closePath();
  return s;
}
function extrude(shape, width, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -width / 2);
  g.computeVertexNormals();
  return g;
}

const geoCache = new Map();
function cached(key, fn) { if (!geoCache.has(key)) geoCache.set(key, fn()); return geoCache.get(key); }
const ID = new THREE.Matrix4();
const M = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));

// Rad: Reifen mit gerundeten Flanken, Felge mit Speichen, Bremsscheibe, Nabe
function wheelParts(x, z, side, out) {
  const tire = cached('tire', () => {
    const pts = [];
    const r = W_RAD, w = 0.11;
    pts.push(new THREE.Vector2(0.2, -w));
    for (let i = 0; i <= 4; i++) { const a = -Math.PI / 2 + i / 4 * Math.PI; pts.push(new THREE.Vector2(r - 0.05 + Math.cos(a) * 0.05, Math.sin(a) * w)); }
    pts.push(new THREE.Vector2(0.2, w));
    const g = new THREE.LatheGeometry(pts, 14); g.rotateX(Math.PI / 2); return g;
  });
  const rim = cached('rim', () => { const g = new THREE.CylinderGeometry(0.205, 0.205, 0.2, 12); g.rotateX(Math.PI / 2); return g; });
  const hub = cached('hub', () => { const g = new THREE.CylinderGeometry(0.06, 0.07, 0.04, 12); g.rotateX(Math.PI / 2); return g; });
  const disc = cached('disc', () => { const g = new THREE.CylinderGeometry(0.17, 0.17, 0.02, 10); g.rotateX(Math.PI / 2); return g; });
  out.push({ geo: tire, m: M(x, W_RAD, z), color: '#1a1a1a', mat: 'matte' });
  out.push({ geo: disc, m: M(x, W_RAD, z - side * 0.06), color: '#5a5a5a', mat: 'paint' });
  out.push({ geo: rim, m: M(x, W_RAD, z), color: '#b8bcc2', mat: 'paint' });
  out.push({ geo: hub, m: M(x, W_RAD, z + side * 0.105), color: '#d8dadc', mat: 'paint' });
  for (let k = 0; k < 5; k++) out.push({ geo: rbox(0.05, 0.2, 0.025, 0.01, 1), m: M(x, W_RAD, z + side * 0.1, 0, 0, k / 5 * Math.PI * 2).multiply(M(0, 0.08, 0)), color: '#8a8e94', mat: 'paint' });
}

// Alle Teile eines Autos (lokal: Länge entlang +x, Mitte bei 0)
export function carParts(variant, paint) {
  const v = VARIANTS[variant];
  const out = [];
  const W = v.W;
  out.push({ geo: cached('body:' + variant, () => extrude(shapeFrom(v.body, v), W, 0.07)), m: ID, color: paint, mat: 'paint' });
  // Kabine/Scheiben
  const cab = cached('cab:' + variant, () => {
    const s = new THREE.Shape(); s.moveTo(v.cab[0][0], v.cab[0][1]);
    for (let i = 1; i < v.cab.length; i++) s.lineTo(v.cab[i][0], v.cab[i][1]);
    s.closePath();
    return extrude(s, W - 0.2, 0.05);
  });
  out.push({ geo: cab, m: ID, color: '#ffffff', mat: 'glass' });
  // Dach (lackiert) als dünne Platte über der Kabine
  const [, roofA] = [0, v.cab[1]], roofB = v.cab[2];
  const roofLen = roofA[0] - roofB[0];
  out.push({ geo: rbox(roofLen + 0.1, 0.06, W - 0.1, 0.03, 1), m: M((roofA[0] + roofB[0]) / 2, Math.max(roofA[1], roofB[1]) + 0.03, 0, 0, 0, Math.atan2(roofA[1] - roofB[1], roofLen) * 0.6), color: paint, mat: 'paint' });
  // Säulen (A/B/C) links und rechts
  for (const [x1, y1, x2, y2] of v.pillars) {
    const len = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1);
    for (const s of [-1, 1]) out.push({ geo: rbox(len + 0.05, 0.07, 0.08, 0.02, 1), m: M((x1 + x2) / 2, (y1 + y2) / 2, s * (W / 2 - 0.08), 0, 0, ang), color: paint, mat: 'paint' });
  }
  const front = v.body[1][0] + 0.08, rear = v.body[0][0] - 0.06;
  const zl = W / 2 - 0.28;
  // Front: Grill, Scheinwerfer, Blinker, Stoßstange, Kennzeichen
  out.push({ geo: rbox(0.05, 0.16, W * 0.42, 0.02, 1), m: M(front + 0.02, v.van ? 0.62 : 0.52, 0), color: '#151515', mat: 'matte' });
  for (const s of [-1, 1]) {
    out.push({ geo: rbox(0.07, 0.11, 0.34, 0.035, 1), m: M(front, v.van ? 0.78 : 0.63, s * zl), color: '#fbf8ea', mat: 'light' });
    out.push({ geo: rbox(0.06, 0.05, 0.1, 0.02, 1), m: M(front - 0.01, v.van ? 0.66 : 0.52, s * (zl + 0.17)), color: '#ff9a1a', mat: 'light' });
    out.push({ geo: rbox(0.06, 0.12, 0.3, 0.03, 1), m: M(rear, v.van ? 0.95 : 0.73, s * (zl + 0.02)), color: '#c81a14', mat: 'light' });
  }
  out.push({ geo: rbox(0.16, 0.17, W + 0.04, 0.06, 1), m: M(front + 0.04, 0.38, 0), color: '#26282b', mat: 'matte' });
  out.push({ geo: rbox(0.16, 0.17, W + 0.04, 0.06, 1), m: M(rear - 0.02, 0.38, 0), color: '#26282b', mat: 'matte' });
  out.push({ geo: rbox(0.02, 0.11, 0.48, 0.008, 1), m: M(front + 0.13, 0.4, 0), color: '#f2f2ea', mat: 'paint' });
  out.push({ geo: rbox(0.02, 0.11, 0.48, 0.008, 1), m: M(rear - 0.11, 0.42, 0), color: '#f2f2ea', mat: 'paint' });
  // Spiegel, Türgriffe, Türfugen
  const mirrorX = v.cab[0][0] - 0.12;
  for (const s of [-1, 1]) {
    out.push({ geo: rbox(0.14, 0.09, 0.11, 0.035, 1), m: M(mirrorX, v.cab[0][1] + 0.09, s * (W / 2 + 0.12)), color: paint, mat: 'paint' });
    out.push({ geo: rbox(0.04, 0.03, 0.12, 0.012, 1), m: M(mirrorX + 0.02, v.cab[0][1] + 0.05, s * (W / 2 + 0.05)), color: '#1a1a1a', mat: 'matte' });
    const doors = v.van ? [v.cab[0][0] - 0.1, -0.3] : v.bed ? [v.cab[0][0] - 0.1, v.cab[3][0] + 0.1] : [v.cab[0][0] - 0.05, (v.cab[0][0] + v.cab[3][0]) / 2, v.cab[3][0] + 0.15];
    for (const dx of doors) out.push({ geo: rbox(0.012, v.van ? 0.75 : 0.5, 0.01, 0.004, 1), m: M(dx, v.van ? 0.75 : 0.6, s * (W / 2 + 0.065)), color: '#111111', mat: 'matte' });
    for (let k = 0; k < doors.length - 1; k++) out.push({ geo: rbox(0.13, 0.03, 0.03, 0.012, 1), m: M(doors[k] - 0.25, v.van ? 1.0 : 0.78, s * (W / 2 + 0.075)), color: '#9a9ea4', mat: 'paint' });
  }
  // Ladefläche beim Pickup
  if (v.bed) {
    const bx0 = v.body[0][0] + 0.05, bx1 = v.cab[3][0] - 0.1, bl = bx1 - bx0;
    out.push({ geo: rbox(bl, 0.05, W - 0.1, 0.02, 1), m: M((bx0 + bx1) / 2, 1.02, 0), color: '#222326', mat: 'matte' });
    for (const s of [-1, 1]) out.push({ geo: rbox(bl, 0.32, 0.07, 0.03, 1), m: M((bx0 + bx1) / 2, 1.16, s * (W / 2 - 0.02)), color: paint, mat: 'paint' });
    out.push({ geo: rbox(0.07, 0.32, W, 0.03, 1), m: M(bx0, 1.16, 0), color: paint, mat: 'paint' });
  }
  // Räder
  for (const wx of [v.wf, v.wr]) for (const s of [-1, 1]) wheelParts(wx, s * (W / 2 - 0.05), s, out);
  return out;
}

export const carMaterials = () => ({
  paint: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.45 }),
  matte: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0 }),
  light: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.15, metalness: 0.0, emissive: 0x332a20 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x16202c, roughness: 0.04, metalness: 0.75, transparent: true, opacity: 0.86 }),
});
