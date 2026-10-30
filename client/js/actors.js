// Soldaten mit menschlichen Proportionen (Kapseln, Kugeln, abgerundete Ausrüstung), Gegner-KI (läuft beim
// Host/Singleplayer) und "Puppen" für Netzwerk-Figuren.
// Jedes starre Körperteil wird zu EINER Geometrie mit Vertex-Farben verschmolzen (5 Draw Calls pro Soldat).
import * as THREE from 'three';
import { ENEMY_TYPES } from './data.js';
import { buildGunModel } from './weapon.js';
import { Baker, capsule } from './geom.js';

const soldierMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.0 });
function shade(hex, f) { const c = new THREE.Color(hex); c.multiplyScalar(f); return '#' + c.getHexString(); }
const SPH = new THREE.SphereGeometry(1, 12, 8);
const HEMI = new THREE.SphereGeometry(1, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const GUN_SKIN = { base: '#30343a', accent: '#202226', pattern: 'solid' };
const geoCache = new Map();
function soldierGeometries(o) {
  const key = JSON.stringify(o);
  if (geoCache.has(key)) return geoCache.get(key);
  const uni = o.color, vest = o.vest, skin = o.skin, eye = o.eye;
  const boot = '#2a2420', glove = '#262522', helm = o.helmet, pants = o.pants || shade(uni, 0.85);
  const hair = '#2a2018';
  // --- Oberschenkel (Pivot Hüfte): leicht konisch durch zwei Kapseln
  const th = new Baker();
  th.limb(pants, V(0, -0.03, 0), V(0, -0.24, 0.005), 0.092);
  th.limb(pants, V(0, -0.22, 0.005), V(0, -0.44, 0.012), 0.078);
  th.rbox(shade(pants, 0.78), 0.088, -0.25, 0.005, 0.035, 0.12, 0.11, 0, 0, 0, 0.015); // Beintasche
  // --- Unterschenkel + Stiefel (Pivot Knie)
  const sh = new Baker();
  sh.limb(pants, V(0, 0, 0.01), V(0, -0.2, 0.012), 0.072);
  sh.limb(pants, V(0, -0.2, 0.012), V(0, -0.33, 0.0), 0.06);
  sh.rbox('#2f2f2c', 0, -0.025, -0.07, 0.13, 0.12, 0.05, 0, 0, 0, 0.022);               // Knieschoner
  sh.limb(boot, V(0, -0.3, 0), V(0, -0.39, -0.005), 0.07);                              // Stiefelschaft
  sh.rbox(boot, 0, -0.405, -0.04, 0.12, 0.1, 0.26, 0, 0, 0, 0.04);                       // Stiefel
  sh.rbox('#16130f', 0, -0.452, -0.04, 0.128, 0.022, 0.27, 0, 0, 0, 0.009);              // Sohle
  // --- Oberkörper inkl. Kopf, Armen und Waffe (Pivot Taille)
  const tb = new Baker();
  tb.geo(SPH, pants, 0, 0.03, 0, 0.165, 0.11, 0.12);                                      // Becken
  tb.rbox('#2a2622', 0, 0.085, 0, 0.35, 0.05, 0.25, 0, 0, 0, 0.02);                       // Gürtel
  tb.rbox('#8a7a50', 0, 0.085, -0.127, 0.05, 0.035, 0.012, 0, 0, 0, 0.005);
  tb.geo(capsule(0.145, 0.1, 3, 10), uni, 0, 0.19, 0, 1, 1, 0.75);                        // Bauch
  tb.geo(capsule(0.165, 0.13, 3, 10), uni, 0, 0.35, 0, 1.08, 1, 0.74);                    // Brustkorb
  for (const s of [-1, 1]) tb.geo(SPH, uni, s * 0.195, 0.47, 0, 0.078, 0.075, 0.08);       // Schultern
  tb.rbox(vest, 0, 0.31, 0, 0.37, 0.32, 0.285, 0, 0, 0, 0.06);                            // Plattenträger
  tb.rbox(shade(vest, 0.88), 0, 0.33, -0.148, 0.3, 0.25, 0.025, 0, 0, 0, 0.012);           // Frontplatte
  for (const s of [-1, 1]) tb.rbox(vest, s * 0.115, 0.47, 0, 0.065, 0.035, 0.27, 0, 0, 0, 0.012); // Schultergurte
  for (const x of [-0.1, 0, 0.1]) tb.rbox(shade(vest, 0.74), x, 0.2, -0.165, 0.085, 0.1, 0.05, 0, 0, 0, 0.016); // Magazintaschen
  tb.rbox(shade(vest, 0.7), -0.2, 0.28, 0.04, 0.05, 0.12, 0.06, 0, 0, 0, 0.012);          // Funkgerät
  tb.geo(CYL, '#1a1a1a', -0.205, 0.42, 0.05, 0.005, 0.12, 0.005);                         // Antenne
  if (o.pack) {
    tb.rbox(shade(vest, 0.92), 0, 0.31, 0.205, 0.29, 0.33, 0.13, 0, 0, 0, 0.045);
    tb.geo(CYL, shade(vest, 0.7), 0, 0.5, 0.2, 0.05, 0.27, 0.05, 0, 0, Math.PI / 2);       // Schlafsackrolle
  }
  // Hals und Kopf
  tb.geo(capsule(0.048, 0.05, 3, 10), skin, 0, 0.565, 0.005);
  tb.geo(SPH, skin, 0, 0.69, 0, 0.102, 0.122, 0.112);                                     // Schädel
  tb.geo(SPH, skin, 0, 0.628, -0.018, 0.088, 0.058, 0.09);                                 // Kiefer
  tb.rbox(skin, 0, 0.678, -0.112, 0.024, 0.042, 0.032, -0.25, 0, 0, 0.011);                // Nase
  for (const s of [-1, 1]) {
    tb.geo(SPH, skin, s * 0.102, 0.68, 0.008, 0.016, 0.03, 0.022);                         // Ohren
    tb.rbox(hair, s * 0.042, 0.732, -0.103, 0.038, 0.009, 0.012, 0, 0, s * -0.12, 0.004); // Augenbrauen
  }
  const mask = o.mask === true ? 'bala' : o.mask, mc = o.maskColor || '#2a2a2a';
  if (mask === 'bala') tb.geo(SPH, mc, 0, 0.638, -0.004, 0.107, 0.078, 0.116);            // Sturmhaube
  if (mask === 'bandana') { tb.geo(SPH, mc, 0, 0.632, -0.006, 0.108, 0.07, 0.118); tb.geo(SPH, mc, 0, 0.64, 0.115, 0.03, 0.03, 0.02); }
  tb.rbox('#1c1c1c', 0, 0.71, 0, 0.214, 0.026, 0.222, 0, 0, 0, 0.011);                     // Brillenband
  tb.rbox('#1a1a1a', 0, 0.71, -0.1, 0.19, 0.046, 0.03, 0, 0, 0, 0.014);                    // Brillenrahmen
  tb.rbox(eye, 0, 0.71, -0.114, 0.165, 0.034, 0.008, 0, 0, 0, 0.006);                     // Gläser
  const hg = o.headgear || 'helm';
  if (hg === 'helm' || hg === 'nvg') {
    tb.geo(HEMI, helm, 0, 0.72, 0.005, 0.138, 0.128, 0.15);                                 // Gefechtshelm
    tb.geo(HEMI, shade(helm, 0.85), 0, 0.715, 0.005, 0.146, 0.022, 0.158);                   // Helmrand
    for (const s of [-1, 1]) tb.rbox(shade(helm, 0.8), s * 0.13, 0.69, 0.01, 0.025, 0.07, 0.15, 0, 0, s * 0.1, 0.01);
    tb.rbox('#222222', 0, 0.79, -0.13, 0.055, 0.04, 0.03, 0, 0, 0, 0.01);                   // Halterung
    if (hg === 'nvg') {
      tb.rbox('#1a1c1e', 0, 0.765, -0.17, 0.13, 0.05, 0.06, 0, 0, 0, 0.015);
      for (const s of [-1, 1]) tb.geo(CYL, '#3aff5a', s * 0.03, 0.765, -0.205, 0.016, 0.01, 0.016, Math.PI / 2, 0, 0);
    }
  } else if (hg === 'cap') {
    tb.geo(HEMI, helm, 0, 0.735, 0.005, 0.118, 0.085, 0.128);
    tb.rbox(shade(helm, 0.85), 0, 0.742, -0.14, 0.15, 0.012, 0.1, 0.12, 0, 0, 0.006);
  } else if (hg === 'beret') {
    tb.geo(SPH, helm, -0.018, 0.79, 0, 0.125, 0.04, 0.125, 0, 0, 0.18);
    tb.rbox('#ffd23a', 0.06, 0.79, -0.118, 0.03, 0.03, 0.01, 0, 0, 0, 0.005);
  } else if (hg === 'crown') {
    tb.geo(CYL, '#8a1a1a', 0, 0.79, 0, 0.115, 0.05, 0.118);
    tb.geo(CYL, helm, 0, 0.825, 0, 0.12, 0.045, 0.123);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; tb.rbox(helm, Math.sin(a) * 0.11, 0.875, Math.cos(a) * 0.115, 0.04, 0.07, 0.02, 0, a, 0, 0.008); }
    tb.geo(SPH, '#ff2a4a', 0, 0.825, -0.125, 0.018, 0.018, 0.01);
  } else { // Frisur
    tb.geo(HEMI, helm, 0, 0.705, 0.008, 0.11, 0.1, 0.122);
    tb.geo(SPH, helm, 0, 0.69, 0.06, 0.1, 0.09, 0.07);
  }
  if (o.boss) {
    tb.rbox('#ffcc33', 0, 0.83, 0, 0.04, 0.035, 0.26, 0, 0, 0, 0.012);
    for (const s of [-1, 1]) tb.rbox('#ffcc33', s * 0.2, 0.495, -0.01, 0.1, 0.03, 0.13, 0, 0, s * 0.25, 0.012);
  }
  // Waffe (vereinfachte Variante) und Arme, die sie halten
  const gun = buildGunModel(o.gun, {}, GUN_SKIN, { low: true });
  const info = gun.userData.info;
  const gunPos = V(0.09, 0.36, -0.22);
  tb.group(gun, new THREE.Matrix4().makeTranslation(gunPos.x, gunPos.y, gunPos.z));
  const handR = V(gunPos.x + 0.012, gunPos.y + info.gripY, gunPos.z + info.gripZ);
  const handL = info.pistol ? V(gunPos.x - 0.04, gunPos.y + info.gripY, gunPos.z + info.gripZ) : V(gunPos.x - 0.005, gunPos.y + info.supportY - 0.02, gunPos.z + info.supportZ);
  const shR = V(0.2, 0.455, 0.0), shL = V(-0.2, 0.455, 0.0);
  const elR = V(0.23, 0.24, -0.07), elL = info.pistol ? V(-0.18, 0.25, -0.13) : V(-0.15, 0.27, -0.18);
  tb.limb(uni, shR, elR, 0.056); tb.limb(shade(uni, 0.93), elR, handR, 0.047);
  tb.limb(uni, shL, elL, 0.056); tb.limb(shade(uni, 0.93), elL, handL, 0.047);
  for (const h of [handR, handL]) tb.rbox(glove, h.x, h.y, h.z, 0.06, 0.075, 0.085, 0, 0, 0, 0.025);
  const res = { thigh: th.build(), shin: sh.build(), torso: tb.build() };
  geoCache.set(key, res);
  return res;
}

// Einzelne Waffe als ein Mesh (für Loot am Boden)
export const soldierMaterial = soldierMat;
export function bakedGunGeometry(id, build = {}) {
  const key = 'gun:' + id + JSON.stringify(build);
  if (!geoCache.has(key)) {
    const b = new Baker();
    b.group(buildGunModel(id, build, GUN_SKIN, { low: true }), new THREE.Matrix4());
    geoCache.set(key, b.build());
  }
  return geoCache.get(key);
}

export function makeSoldier(color, opts = {}) {
  const o = {
    color, gun: opts.gun || 'falke', vest: opts.vest || '#3d3c34', skin: opts.skin || '#d9a877', eye: opts.eye || '#2ae0ff',
    helmet: opts.helmet || shade(color, 0.6), mask: opts.mask || false, boss: !!opts.boss, pack: opts.pack !== false,
    pants: opts.pants || null, headgear: opts.headgear || 'helm', maskColor: opts.maskColor || null,
  };
  const geo = soldierGeometries(o);
  const g = new THREE.Group();
  // Ebene 1 = für den Wallhack-Durchblick (wird separat ohne Tiefentest gerendert)
  const mesh = (geo, parent) => { const m = new THREE.Mesh(geo, soldierMat); m.castShadow = true; m.layers.enable(1); parent.add(m); return m; };
  const legs = [-0.12, 0.12].map(x => {
    const hip = new THREE.Group(); hip.position.set(x, 0.92, 0); g.add(hip);
    mesh(geo.thigh, hip);
    const knee = new THREE.Group(); knee.position.y = -0.46; hip.add(knee);
    mesh(geo.shin, knee);
    return { hip, knee };
  });
  const upper = new THREE.Group(); upper.position.y = 0.92; g.add(upper);
  const torso = mesh(geo.torso, upper);
  const s = opts.scale || 1;
  g.scale.setScalar(s);
  g.userData = { legs, upper, torso, phase: 0, s, opts: o };
  return g;
}

// Waffe einer Figur tauschen (z. B. wenn ein Mitspieler wechselt)
export function setSoldierGun(g, gunId) {
  const u = g.userData;
  if (!u.opts || u.opts.gun === gunId) return;
  u.opts = { ...u.opts, gun: gunId };
  u.torso.geometry = soldierGeometries(u.opts).torso;
}

export function animateSoldier(g, speed, dt, pitch = 0, crouch = 0) {
  const u = g.userData;
  u.phase += dt * Math.max(speed, 0.001) * 2.2;
  u.crouch = (u.crouch || 0) + (crouch - (u.crouch || 0)) * Math.min(1, dt * 10);
  const c = u.crouch;
  const amt = Math.min(1, speed / 3);
  const [L, R] = u.legs;
  const sw = Math.sin(u.phase) * 0.65 * amt;
  L.hip.rotation.x = sw - c * 1.2;
  R.hip.rotation.x = -sw - c * 1.0;
  L.knee.rotation.x = Math.max(0, -Math.sin(u.phase)) * 0.9 * amt + c * 2.0;
  R.knee.rotation.x = Math.max(0, Math.sin(u.phase)) * 0.9 * amt + c * 1.8;
  const hipY = 0.92 - c * 0.36 + Math.abs(Math.cos(u.phase)) * 0.03 * amt;
  L.hip.position.y = R.hip.position.y = u.upper.position.y = hipY;
  u.upper.rotation.x = THREE.MathUtils.clamp(pitch, -1, 1) * 0.75 + c * 0.15;
  u.upper.rotation.y = Math.sin(u.phase) * 0.06 * amt;
}

// Treffertest: Strahl gegen Körper- und Kopfbox. Gibt {t, head} oder null.
const _b = { x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0 };
function rayBox(o, d, b) {
  let t1 = (b.x0 - o.x) / d.x, t2 = (b.x1 - o.x) / d.x;
  let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
  t1 = (b.y0 - o.y) / d.y; t2 = (b.y1 - o.y) / d.y;
  tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
  t1 = (b.z0 - o.z) / d.z; t2 = (b.z1 - o.z) / d.z;
  tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
  return tmax >= Math.max(0, tmin) ? Math.max(0, tmin) : -1;
}
export function hitTestActor(o, d, p, s = 1, crouch = 0) {
  const top = (1.47 - crouch * 0.36) * s;
  _b.x0 = p.x - 0.17 * s; _b.x1 = p.x + 0.17 * s; _b.z0 = p.z - 0.17 * s; _b.z1 = p.z + 0.17 * s;
  _b.y0 = p.y + top; _b.y1 = p.y + top + 0.4 * s;
  const th = rayBox(o, d, _b);
  _b.x0 = p.x - 0.3 * s; _b.x1 = p.x + 0.3 * s; _b.z0 = p.z - 0.3 * s; _b.z1 = p.z + 0.3 * s;
  _b.y0 = p.y; _b.y1 = p.y + top;
  const tb = rayBox(o, d, _b);
  if (th >= 0 && (tb < 0 || th <= tb + 0.05)) return { t: th, head: true };
  if (tb >= 0) return { t: tb, head: false };
  return null;
}

// ---------------------------------------------------------------- Gegner-KI
const TYPE_LIST = Object.keys(ENEMY_TYPES);
let nextEnemyId = 1;
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();

export class Enemy {
  constructor(game, type, pos, opts = {}) {
    this.game = game;
    this.id = opts.id || nextEnemyId++;
    this.type = type;
    this.typeIdx = TYPE_LIST.indexOf(type);
    this.T = ENEMY_TYPES[type];
    this.pos = pos.clone();
    this.home = pos.clone();
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.maxHp = this.T.hp * (game.diff.hp || 1);
    this.hp = opts.hp ?? this.maxHp;
    this.scale = this.T.scale || 1;
    this.state = opts.alert ? 'hunt' : 'idle';
    this.target = null;
    this.lastSeen = opts.alert ? opts.alertPos?.clone() || null : null;
    this.path = [];
    this.pathT = 0;
    this.thinkT = Math.random() * 0.3;
    this.visible = false;
    this.reactT = 0;
    this.cool = 0;
    this.burst = 0;
    this.pauseT = 0;
    this.strafe = Math.random() < 0.5 ? -1 : 1;
    this.strafeT = 0;
    this.stuckT = 0;
    this.grounded = true;
    this.dead = false;
    this.deadT = 0;
    this.aimT = 0; // Scharfschützen-Laser
    this.nadeT = 5;
    this.wanderT = 0;
    this.wanderTo = null;
    this.speedNow = 0;
    this.firing = 0;
    this.stationary = !!opts.stationary;
    this.model = makeSoldier(this.T.color, enemyLook(type));
    this.pitch = 0;
    this.model.position.copy(this.pos);
    game.scene.add(this.model);
  }

  eye(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 1.6 * this.scale, this.pos.z); }

  alert(pos) {
    if (this.dead) return;
    if (this.state === 'idle') { this.state = 'hunt'; this.reactT = 0.4 + Math.random() * 0.4; }
    if (!this.visible) { this.lastSeen = pos.clone(); this.pathT = 0; }
  }

  damage(dmg, from) {
    if (this.dead) return false;
    this.hp -= dmg;
    if (from) this.alert(from);
    if (this.hp <= 0) { this.die(); return true; }
    return false;
  }

  die() {
    this.dead = true;
    this.hp = 0;
    this.deadT = 0;
  }

  think() {
    const g = this.game;
    const targets = g.targets();
    const eye = this.eye(tmpA);
    let best = null, bestD = Infinity;
    const fwdX = -Math.sin(this.yaw), fwdZ = -Math.cos(this.yaw);
    for (const t of targets) {
      if (!t.alive) continue;
      const dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      const range = this.state === 'idle' ? (this.T.sniper ? 80 : 38) : 90;
      if (d > range || d > bestD) continue;
      const dot = (dx * fwdX + dz * fwdZ) / (d || 1);
      if (this.state === 'idle' && dot < -0.1 && d > 6) continue; // hinter dem Rücken
      if (!g.world.lineOfSight(eye, t.eye)) continue;
      best = t; bestD = d;
    }
    const wasVisible = this.visible;
    this.visible = !!best;
    if (best) {
      if (this.state === 'idle' || !wasVisible) this.reactT = Math.max(this.reactT, (0.35 + Math.random() * 0.35) * g.diff.react);
      if (this.state !== 'combat') g.alertNear(this.pos, best.pos, 22);
      this.state = 'combat';
      this.target = best;
      this.lastSeen = best.pos.clone();
      this.lastSeenT = g.time;
    } else if (this.state === 'combat') {
      if (g.time - (this.lastSeenT || 0) > 1.0) { this.state = 'hunt'; this.pathT = 0; }
    }
    if (this.state === 'hunt' && this.lastSeen) {
      if (this.pathT <= 0) { this.path = g.world.path(this.pos, this.lastSeen); this.pathT = 3; }
      if (this.pos.distanceTo(this.lastSeen) < 2) { this.state = 'idle'; this.lastSeen = null; this.home.copy(this.pos); }
    }
  }

  update(dt) {
    if (this.dead) {
      this.deadT += dt;
      this.model.rotation.x = Math.max(-Math.PI / 2, -this.deadT * 6);
      this.model.position.y = this.pos.y - Math.max(0, this.deadT - 1.2) * 1.2;
      return this.deadT > 2.4;
    }
    const g = this.game;
    this.thinkT -= dt; this.pathT -= dt; this.strafeT -= dt; this.reactT -= dt; this.cool -= dt; this.pauseT -= dt; this.nadeT -= dt;
    this.firing = Math.max(0, this.firing - dt);
    if (this.thinkT <= 0) { this.think(); this.thinkT = 0.22 + Math.random() * 0.12; }

    const T = this.T;
    let mx = 0, mz = 0, speed = T.speed;
    if (this.state === 'combat' && this.target) {
      const t = this.target;
      const dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      this.yaw = Math.atan2(-dx, -dz);
      this.pitch = Math.atan2(t.eye.y - 0.3 - (this.pos.y + 1.5 * this.scale), d);
      if (!T.sniper && !this.stationary) {
        const nx = dx / d, nz = dz / d;
        let f = 0;
        if (d > T.pref + 4) f = 1; else if (d < T.pref - 3) f = -0.7;
        if (this.strafeT <= 0) { this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeT = 0.9 + Math.random() * 1.6; if (Math.random() < 0.25) this.strafe = 0; }
        mx = nx * f + -nz * this.strafe * 0.7;
        mz = nz * f + nx * this.strafe * 0.7;
        speed *= f > 0 ? 1 : 0.65;
      }
      this.combat(dt, t, d);
    } else if (this.state === 'hunt' && this.path.length && !T.sniper && !this.stationary) {
      const wp = this.path[0];
      const dx = wp.x - this.pos.x, dz = wp.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.4) this.path.shift();
      else { mx = dx / d; mz = dz / d; this.yaw = Math.atan2(-dx, -dz); }
      this.aimT = 0;
    } else {
      this.aimT = 0;
      // Patrouille um den Startpunkt
      this.wanderT -= dt;
      if (!this.stationary && !T.sniper) {
        if (this.wanderT <= 0) {
          this.wanderT = 2 + Math.random() * 4;
          this.wanderTo = Math.random() < 0.5 ? null : this.home.clone().add(tmpB.set((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10));
        }
        if (this.wanderTo) {
          const dx = this.wanderTo.x - this.pos.x, dz = this.wanderTo.z - this.pos.z, d = Math.hypot(dx, dz);
          if (d > 0.8) { mx = dx / d; mz = dz / d; speed *= 0.4; this.yaw = Math.atan2(-dx, -dz); } else this.wanderTo = null;
        }
      } else if (this.wanderT <= 0) { this.wanderT = 2 + Math.random() * 3; this.yaw += (Math.random() - 0.5) * 2.5; }
    }

    const len = Math.hypot(mx, mz);
    if (len > 0.01) { mx /= Math.max(1, len); mz /= Math.max(1, len); }
    const wantX = mx * speed, wantZ = mz * speed;
    this.vel.x += (wantX - this.vel.x) * Math.min(1, dt * 8);
    this.vel.z += (wantZ - this.vel.z) * Math.min(1, dt * 8);
    const px = this.pos.x, pz = this.pos.z;
    this.grounded = g.world.move(this.pos, this.vel, dt, 0.35 * this.scale, 1.75 * this.scale, this.grounded);
    const moved = Math.hypot(this.pos.x - px, this.pos.z - pz) / dt;
    this.speedNow = moved;
    const want = Math.hypot(wantX, wantZ);
    if (want > 0.8 && moved < want * 0.3) {
      this.stuckT += dt;
      if (this.stuckT > 0.5) {
        this.stuckT = 0;
        this.strafe = -this.strafe || 1;
        this.strafeT = 1.2;
        const ni = g.world.nearestIntersection(this.pos.x, this.pos.z);
        if (this.state === 'hunt') this.path.unshift(new THREE.Vector3(ni.x, 0, ni.z));
        else if (this.state === 'idle') this.wanderTo = new THREE.Vector3(ni.x, 0, ni.z);
        // kleiner Hüpfer über niedrige Hindernisse
        if (this.grounded && Math.random() < 0.5) this.vel.y = 7.5;
      }
    } else this.stuckT = 0;

    const my = this.model.position.y;
    this.model.position.copy(this.pos);
    if (this.pos.y > my && this.pos.y - my < 0.6) this.model.position.y = my + (this.pos.y - my) * Math.min(1, dt * 14);
    this.model.rotation.y = this.yaw;
    if (this.state !== 'combat') this.pitch *= 0.9;
    animateSoldier(this.model, moved, dt, this.pitch);
    return false;
  }

  combat(dt, t, d) {
    const g = this.game, T = this.T;
    if (!this.visible || this.reactT > 0 || d > T.range * 1.1) { this.aimT = 0; return; }
    if (T.sniper) {
      this.aimT += dt;
      if (this.aimT < 1.5) return;
      this.aimT = -0.6 - Math.random();
      g.enemyFire(this, t, d);
      return;
    }
    if (T.grenades && this.nadeT <= 0 && d > 7 && d < 26) {
      this.nadeT = 6 + Math.random() * 4;
      g.enemyGrenade(this, t);
    }
    if (this.pauseT > 0) return;
    if (this.burst <= 0) {
      this.burst = T.burst[0] + Math.floor(Math.random() * (T.burst[1] - T.burst[0] + 1));
    }
    if (this.cool <= 0) {
      this.cool = 60 / T.rpm;
      this.burst--;
      this.firing = 0.12;
      g.enemyFire(this, t, d);
      if (this.burst <= 0) this.pauseT = 0.5 + Math.random() * 0.9;
    }
  }

  remove() { this.game.scene.remove(this.model); }
}
export { TYPE_LIST };

const ENEMY_GUN = { rekrut: 'falke', stuermer: 'brecher', schuetze: 'langstreck', brocken: 'donner', boss: 'donner' };
export function enemyLook(type) {
  const T = ENEMY_TYPES[type];
  return { scale: T.scale || 1, gun: ENEMY_GUN[type], eye: '#ff3a2a', mask: !T.boss, boss: !!T.boss, vest: T.boss ? '#2a1a14' : '#4a4232', helmet: T.boss ? '#2a2a2a' : '#5a4e3a', pack: type !== 'stuermer' };
}

// ---------------------------------------------------------------- Puppen (vom Netz gesteuert)
export function nameSprite(text, color = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = 'bold 30px system-ui, sans-serif';
  x.textAlign = 'center';
  x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,0.7)';
  x.strokeText(text, 128, 42);
  x.fillStyle = color; x.fillText(text, 128, 42);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(1.6, 0.4, 1);
  s.renderOrder = 10;
  return s;
}

export class Puppet {
  constructor(scene, color, opts = {}) {
    this.scene = scene;
    this.model = makeSoldier(color, opts);
    this.pos = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.yaw = 0; this.targetYaw = 0; this.pitch = 0;
    this.crouch = 0;
    this.alive = true;
    this.scale = opts.scale || 1;
    this.first = true;
    this.speed = 0;
    if (opts.name) {
      this.tag = nameSprite(opts.name, opts.tagColor);
      this.tag.position.y = 2.15;
      this.model.add(this.tag);
    }
    scene.add(this.model);
  }
  set(p, yaw, pitch, crouch) {
    this.target.set(p[0], p[1], p[2]);
    this.targetYaw = yaw; this.pitch = pitch || 0; this.crouch = crouch ? 1 : 0;
    if (this.first) { this.pos.copy(this.target); this.yaw = yaw; this.first = false; }
  }
  update(dt) {
    const k = Math.min(1, dt * 14);
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.lerp(this.target, k);
    let dy = this.targetYaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy * k;
    this.speed = this.speed * 0.8 + (Math.hypot(this.pos.x - ox, this.pos.z - oz) / Math.max(dt, 1e-3)) * 0.2;
    this.model.position.copy(this.pos);
    this.model.rotation.y = this.yaw;
    this.model.visible = this.alive;
    animateSoldier(this.model, this.speed, dt, this.pitch, this.crouch);
  }
  remove() { this.scene.remove(this.model); }
}
