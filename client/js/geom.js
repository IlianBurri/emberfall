// Gemeinsame Geometrie-Helfer: abgerundete Quader (gecacht), Kapseln zwischen zwei Punkten,
// Zusammenbacken vieler Teile zu einer Geometrie mit Vertex-Farben (wenige Draw Calls).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const rboxCache = new Map();
// Abgerundeter Quader in echten Maßen (kein Skalieren, damit die Rundung überall gleich groß bleibt)
export function rbox(w, h, d, radius = null, segments = 2) {
  const r = Math.min(radius ?? Math.min(w, h, d) * 0.22, Math.min(w, h, d) * 0.49);
  const key = [w, h, d, r, segments].map(v => v.toFixed(4)).join('|');
  if (!rboxCache.has(key)) rboxCache.set(key, new RoundedBoxGeometry(w, h, d, segments, r));
  return rboxCache.get(key);
}

const capCache = new Map();
export function capsule(r, len, cap = 4, radial = 10) {
  const key = r.toFixed(4) + '|' + len.toFixed(4) + '|' + cap + '|' + radial;
  if (!capCache.has(key)) capCache.set(key, new THREE.CapsuleGeometry(r, Math.max(0.001, len), cap, radial));
  return capCache.get(key);
}

const _up = new THREE.Vector3(0, 1, 0);
// Matrix, die ein entlang Y ausgerichtetes Objekt von a nach b legt
export function between(a, b) {
  const d = new THREE.Vector3().subVectors(b, a);
  const q = new THREE.Quaternion().setFromUnitVectors(_up, d.clone().normalize());
  return { m: new THREE.Matrix4().compose(a.clone().addScaledVector(d, 0.5), q, new THREE.Vector3(1, 1, 1)), len: d.length() };
}

// Sammelt Geometrien mit Farbe und backt sie zu einer BufferGeometry
export class Baker {
  constructor(ao = true) { this.pos = []; this.nor = []; this.col = []; this.uv = []; this.ao = ao; this.c = new THREE.Color(); }
  add(geo, matrix, color, light = 1) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position, n = g.attributes.normal;
    const nm = new THREE.Matrix3().getNormalMatrix(matrix);
    const v = new THREE.Vector3();
    this.c.set(color).multiplyScalar(light);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix); this.pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); this.nor.push(v.x, v.y, v.z);
      const ao = this.ao ? 0.84 + 0.16 * Math.max(0, v.y) : 1;
      this.col.push(this.c.r * ao, this.c.g * ao, this.c.b * ao);
    }
  }
  // Abgerundeter Quader an Position mit optionaler Drehung
  rbox(color, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0, radius = null, seg = 1) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
    this.add(rbox(w, h, d, radius, seg), m, color);
  }
  // Beliebige Geometrie mit Position/Drehung/Skalierung
  geo(geo, color, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
    this.add(geo, m, color);
  }
  // Kapsel (Arm, Bein) zwischen zwei Punkten
  limb(color, a, b, r) {
    const { m, len } = between(a, b);
    this.add(capsule(r, Math.max(0.001, len - 0.0), 3, 8), m, color);
  }
  group(obj, parentMatrix = new THREE.Matrix4()) {
    obj.updateMatrixWorld(true);
    obj.traverse(o => {
      if (!o.isMesh || o.material.transparent) return;
      const mat = o.material;
      const color = mat.userData?.baseColor || '#' + mat.color.getHexString();
      this.add(o.geometry, new THREE.Matrix4().multiplyMatrices(parentMatrix, o.matrixWorld), color);
    });
  }
  get empty() { return this.pos.length === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

// Umgebungs-Reflexionen aus dem eigenen Himmel erzeugen (für realistische Metalle/Glas)
export function skyEnvironment(renderer, top, bottom, ground) {
  const s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const cols = [];
  const t = new THREE.Color(top), b = new THREE.Color(bottom), g = new THREE.Color(ground);
  for (let i = 0; i < geo.attributes.position.count; i++) {
    const y = geo.attributes.position.getY(i) / 10;
    const c = y >= 0 ? b.clone().lerp(t, Math.pow(y, 0.6)) : b.clone().lerp(g, Math.min(1, -y * 3));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  sun.position.set(5, 8, 3);
  s.add(sun);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(s, 0.04).texture;
  pm.dispose();
  s.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return tex;
}
