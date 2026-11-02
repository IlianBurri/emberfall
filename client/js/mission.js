// Missionsablauf (Ziele nacheinander). Der Host/Singleplayer rechnet, Koop-Clients übernehmen nur den Zustand.
// Zieltypen: kill, reach, collect (optional mit Halten = Entschärfen), destroy, defend, hold, rescue, escort, boss.
import * as THREE from 'three';
import { makeSoldier, animateSoldier } from './actors.js';

const beamGeo = new THREE.CylinderGeometry(1.6, 1.6, 40, 12, 1, true);
const ringGeo = new THREE.RingGeometry(6.6, 7, 40); ringGeo.rotateX(-Math.PI / 2);
const smallRing = new THREE.RingGeometry(3.2, 3.5, 40); smallRing.rotateX(-Math.PI / 2);
const coreGeo = new THREE.OctahedronGeometry(0.4, 0);
const unit = new THREE.BoxGeometry(1, 1, 1); unit.translate(0, 0.5, 0);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class MissionRuntime {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.st = { o: -1, prog: 0, items: [], itemProg: [], thp: [], timer: null, elapsed: 0, wave: 0, done: false, failed: false, boss: null, hostage: null };
    this.visuals = new THREE.Group();
    game.scene.add(this.visuals);
    this.targetsMeta = [];
    this.pulse = 0;
    this.hostage = null;
  }
  get obj() { return this.def.objectives[this.st.o]; }
  // Zahl = Platz in der Stadt, Text = Ort im Umland
  poi(i) {
    if (typeof i === 'string') {
      const p = this.game.world.terrain.pads.find(p => p.kind === i);
      return V(p.x, p.h + 0.05, p.z);
    }
    return this.game.world.pois[i];
  }

  start() {
    this.def.radio?.forEach((r, i) => setTimeout(() => this.game.radio(r), 1500 + i * 4200));
    if (this.game.isHost) this.begin(0);
  }

  begin(i) {
    const st = this.st;
    st.o = i; st.prog = 0; st.elapsed = 0; st.wave = 0;
    const obj = this.obj;
    st.items = obj.type === 'collect' ? obj.pois.map(() => false) : [];
    st.itemProg = obj.type === 'collect' ? obj.pois.map(() => 0) : [];
    st.thp = obj.type === 'destroy' ? obj.pois.map(() => obj.hp) : [];
    st.timer = obj.timer ?? null;
    if (obj.type === 'rescue') { st.hostage = 'captive'; this.placeHostage(this.poi(obj.poi)); }
    if (obj.radio) this.game.radio(obj.radio);
    if (this.game.isHost && obj.spawn) for (const s of obj.spawn) for (let k = 0; k < s.n; k++) this.game.spawnEnemy(s.type, s.at, obj);
    this.build();
    this.game.broadcastMission(true);
  }

  // ---------------------------------------------------------------- Geisel
  placeHostage(pos) {
    if (!this.hostage) {
      const look = { color: '#7a6a52', pants: '#355a8a', vest: '#5a4a3a', skin: '#d9a877', eye: '#ffd23a', gun: 'stachel' };
      const model = makeSoldier(look.color, look);
      this.game.scene.add(model);
      this.hostage = { model, pos: pos.clone(), vel: V(0, 0, 0), grounded: true, speed: 0, yaw: 0 };
    }
    this.hostage.pos.copy(pos);
    this.hostage.model.position.copy(pos);
  }
  updateHostage(dt) {
    const h = this.hostage, st = this.st;
    if (!h) return;
    if (this.game.isHost && st.hostage === 'free') {
      // folgt dem nächsten Spieler mit etwas Abstand
      const players = this.game.targets().filter(t => t.alive);
      let best = null, bd = Infinity;
      for (const t of players) { const d = Math.hypot(t.pos.x - h.pos.x, t.pos.z - h.pos.z); if (d < bd) { bd = d; best = t; } }
      let mx = 0, mz = 0;
      if (best && bd > 2.6) { mx = (best.pos.x - h.pos.x) / bd; mz = (best.pos.z - h.pos.z) / bd; h.yaw = Math.atan2(-mx, -mz); }
      const sp = bd > 8 ? 5.6 : 4.2;
      h.vel.x += (mx * sp - h.vel.x) * Math.min(1, dt * 8);
      h.vel.z += (mz * sp - h.vel.z) * Math.min(1, dt * 8);
      const ox = h.pos.x, oz = h.pos.z;
      h.grounded = this.game.world.move(h.pos, h.vel, dt, 0.35, 1.75, h.grounded);
      if (bd > 25 && best) { h.pos.copy(best.pos); } // nicht verloren gehen
      h.speed = Math.hypot(h.pos.x - ox, h.pos.z - oz) / Math.max(dt, 1e-3);
    } else if (!this.game.isHost && st.hx !== undefined) {
      const tx = st.hx, tz = st.hz, ty = st.hy;
      const ox = h.pos.x, oz = h.pos.z;
      h.pos.x += (tx - h.pos.x) * Math.min(1, dt * 10); h.pos.z += (tz - h.pos.z) * Math.min(1, dt * 10); h.pos.y = ty;
      h.speed = Math.hypot(h.pos.x - ox, h.pos.z - oz) / Math.max(dt, 1e-3);
      if (h.speed > 0.3) h.yaw = Math.atan2(-(h.pos.x - ox), -(h.pos.z - oz));
    }
    h.model.position.copy(h.pos);
    h.model.rotation.y = h.yaw;
    animateSoldier(h.model, h.speed, dt, 0, st.hostage === 'captive' ? 1 : 0);
  }

  build() {
    this.visuals.clear();
    this.targetsMeta = [];
    const obj = this.obj;
    if (!obj) return;
    const mk = (color, op) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide });
    const beam = (p, color = 0x3affd0) => { const b = new THREE.Mesh(beamGeo, mk(color, 0.22)); b.position.copy(p).add(V(0, 20, 0)); this.visuals.add(b); };
    if (obj.type === 'reach' || obj.type === 'escort') beam(this.poi(obj.poi));
    if (obj.type === 'defend') { const r = new THREE.Mesh(ringGeo, mk(0x3affd0, 0.6)); r.position.copy(this.poi(obj.poi)).add(V(0, 0.25, 0)); this.visuals.add(r); }
    if (obj.type === 'hold') {
      const p = this.poi(obj.poi);
      const r = new THREE.Mesh(smallRing, mk(0xffd23a, 0.7)); r.position.copy(p).add(V(0, 0.25, 0)); this.visuals.add(r);
      // Funkgerät-Koffer mit Antenne
      const box = new THREE.Mesh(unit, new THREE.MeshStandardMaterial({ color: 0x3a4430, roughness: 0.7 })); box.scale.set(0.7, 0.45, 0.5); box.position.copy(p); this.visuals.add(box);
      const ant = new THREE.Mesh(unit, new THREE.MeshStandardMaterial({ color: 0x222222 })); ant.scale.set(0.03, 1.4, 0.03); ant.position.copy(p).add(V(0.25, 0.45, 0)); this.visuals.add(ant);
      const led = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ color: 0x3aff6a })); led.scale.set(0.08, 0.06, 0.02); led.position.copy(p).add(V(-0.15, 0.3, -0.26)); led.userData.led = true; this.visuals.add(led);
      beam(p, 0xffd23a);
    }
    if (obj.type === 'rescue' && this.hostage) beam(this.hostage.pos, 0x7ab8ff);
    if (obj.type === 'collect') {
      obj.pois.forEach((p, i) => {
        const base = this.poi(p);
        let m;
        if (obj.bombs) {
          m = new THREE.Group();
          const b = new THREE.Mesh(unit, new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5, metalness: 0.4 })); b.scale.set(0.8, 0.5, 0.5); m.add(b);
          for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(unit, new THREE.MeshStandardMaterial({ color: 0xc8a050 })); c.scale.set(0.16, 0.42, 0.16); c.position.set(-0.25 + k * 0.25, 0.5, 0); m.add(c); }
          const l = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ color: 0xff2a2a })); l.scale.set(0.14, 0.06, 0.02); l.position.set(0, 0.3, -0.26); m.add(l);
          m.userData.lamp = l;
          m.position.copy(base);
        } else {
          m = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0x3ad8ff }));
          m.position.copy(base).add(V(0, 1.3, 0));
          m.userData.core = true;
        }
        m.userData.idx = i;
        m.userData.baseY = m.position.y;
        m.visible = !this.st.items[i];
        this.visuals.add(m);
      });
    }
    if (obj.type === 'destroy') {
      obj.pois.forEach((p, i) => {
        const g = new THREE.Group();
        const base = this.poi(p);
        g.position.copy(base);
        const body = new THREE.Mesh(unit, new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.5, metalness: 0.5 }));
        body.scale.set(1.2, 2.4, 1.2); g.add(body);
        const stripe = new THREE.Mesh(unit, new THREE.MeshStandardMaterial({ color: 0xffc020 }));
        stripe.scale.set(1.25, 0.25, 1.25); stripe.position.y = 1.4; g.add(stripe);
        const ant = new THREE.Mesh(unit, new THREE.MeshStandardMaterial({ color: 0x30343a }));
        ant.scale.set(0.12, 1.4, 0.12); ant.position.y = 2.4; g.add(ant);
        const lamp = new THREE.Mesh(unit, new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
        lamp.scale.set(0.35, 0.35, 0.35); lamp.position.y = 3.8; g.add(lamp);
        g.userData = { lamp, body, idx: i };
        this.visuals.add(g);
        this.targetsMeta.push({ g, pos: base, box: { x0: base.x - 0.6, y0: base.y, z0: base.z - 0.6, x1: base.x + 0.6, y1: base.y + 2.4, z1: base.z + 0.6 } });
      });
      this.refreshTargets();
    }
  }

  refreshTargets() {
    this.targetsMeta.forEach((t, i) => {
      const dead = this.st.thp[i] <= 0;
      if (dead && !t.dead) {
        t.dead = true;
        this.game.fx.explosion(t.pos.clone().add(V(0, 1.5, 0)), 4);
        this.game.boom(t.pos);
        t.g.rotation.z = 0.35;
        t.g.userData.body.material.color.set(0x222222);
        t.g.userData.lamp.visible = false;
      }
    });
  }

  // Treffer auf Zerstörungsziele
  hitTest(o, d) {
    let best = null;
    this.targetsMeta.forEach((t, i) => {
      if (this.st.thp[i] <= 0) return;
      const b = t.box;
      let t1 = (b.x0 - o.x) / d.x, t2 = (b.x1 - o.x) / d.x;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
      t1 = (b.y0 - o.y) / d.y; t2 = (b.y1 - o.y) / d.y;
      tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      t1 = (b.z0 - o.z) / d.z; t2 = (b.z1 - o.z) / d.z;
      tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
      if (tmax >= Math.max(0, tmin) && (!best || tmin < best.t)) best = { t: Math.max(0, tmin), i };
    });
    return best;
  }
  damageTarget(i, dmg) {
    if (!this.game.isHost) return;
    if (this.st.thp[i] <= 0) return;
    this.st.thp[i] = Math.max(0, this.st.thp[i] - dmg);
    this.refreshTargets();
    this.game.broadcastMission(true);
  }
  targetsInRadius(p, r) {
    return this.targetsMeta.map((t, i) => ({ i, d: t.pos.distanceTo(p) })).filter(x => x.d < r && this.st.thp[x.i] > 0);
  }

  onKill(enemy) {
    const obj = this.obj;
    if (!obj || !this.game.isHost) return;
    if (obj.type === 'kill' && (!obj.only || obj.only === enemy.type)) { this.st.prog++; this.game.broadcastMission(true); }
  }

  waves(obj, dt) {
    const g = this.game, st = this.st;
    while (obj.waves && st.wave < obj.waves.length && st.elapsed >= obj.waves[st.wave].t) {
      const w = obj.waves[st.wave++];
      for (let k = 0; k < w.n; k++) g.spawnEnemy(w.type, 'wave', obj);
      g.radio('Funk: Feindkontakt – sie kommen!');
    }
  }

  update(dt) {
    this.pulse += dt;
    for (const c of this.visuals.children) {
      if (c.userData.core) { c.rotation.y += dt * 2; c.position.y = c.userData.baseY + Math.sin(this.pulse * 3 + c.userData.idx) * 0.15; }
      if (c.userData.idx !== undefined && this.obj?.type === 'collect') c.visible = !this.st.items[c.userData.idx];
      if (c.userData.lamp) c.userData.lamp.material.color.setHex(Math.sin(this.pulse * (this.obj?.bombs ? 14 : 8)) > 0 ? 0xff2a2a : 0x551010);
      if (c.userData.led) c.material.color.setHex(Math.sin(this.pulse * 10) > 0 ? 0x3aff6a : 0x0a3a1a);
      if (c.geometry === beamGeo) c.material.opacity = 0.16 + Math.sin(this.pulse * 3) * 0.06;
    }
    this.updateHostage(dt);
    const g = this.game, st = this.st, obj = this.obj;
    if (this.hostage && g.isHost) { st.hx = +this.hostage.pos.x.toFixed(2); st.hy = +this.hostage.pos.y.toFixed(2); st.hz = +this.hostage.pos.z.toFixed(2); }
    if (!g.isHost || !obj || st.done || st.failed) return;
    const players = g.targets().filter(t => t.alive);
    const near = (p, r) => players.some(t => Math.hypot(t.pos.x - p.x, t.pos.z - p.z) < r && Math.abs(t.pos.y - p.y) < 3);
    let complete = false;
    if (st.timer !== null) {
      st.timer -= dt;
      if (st.timer <= 0) { st.failed = true; g.broadcastMission(true); g.missionFailed(obj.bombs ? 'Die Sprengsätze sind detoniert!' : 'Die Zeit ist abgelaufen!'); return; }
    }
    switch (obj.type) {
      case 'kill':
        if (obj.remaining) { st.prog = g.aliveEnemies(); complete = st.prog === 0; }
        else complete = st.prog >= obj.count;
        break;
      case 'reach':
        complete = near(this.poi(obj.poi), 4.5);
        break;
      case 'collect':
        obj.pois.forEach((p, i) => {
          if (st.items[i]) return;
          if (near(this.poi(p), obj.hold ? 2.2 : 1.8)) st.itemProg[i] += dt; else if (obj.hold) st.itemProg[i] = Math.max(0, st.itemProg[i] - dt * 0.5);
          if (st.itemProg[i] >= (obj.hold || 0)) {
            st.items[i] = true; g.pickupSound();
            g.radio(obj.bombs ? `Echo: Sprengsatz ${st.items.filter(Boolean).length} entschärft!` : 'Datenkern gesichert!');
            g.broadcastMission(true);
          }
        });
        complete = st.items.every(Boolean);
        break;
      case 'destroy':
        complete = st.thp.every(h => h <= 0);
        break;
      case 'defend': {
        const inZone = near(this.poi(obj.poi), 7);
        st.inZone = inZone;
        if (inZone) st.elapsed += dt;
        this.waves(obj, dt);
        complete = st.elapsed >= obj.time;
        break;
      }
      case 'hold': {
        const inZone = near(this.poi(obj.poi), 3.5);
        st.inZone = inZone;
        if (inZone) st.elapsed += dt;
        this.waves(obj, dt);
        complete = st.elapsed >= obj.time;
        break;
      }
      case 'rescue':
        if (near(this.hostage.pos, 2.6)) st.elapsed += dt; else st.elapsed = Math.max(0, st.elapsed - dt);
        if (st.elapsed >= 3) { st.hostage = 'free'; complete = true; g.radio('Jonas: Danke! Ich bleibe hinter dir.'); }
        break;
      case 'escort':
        complete = !!this.hostage && this.hostage.pos.distanceTo(this.poi(obj.poi)) < 5;
        if (complete) st.hostage = 'safe';
        break;
      case 'boss':
        complete = st.bossDead === true;
        break;
    }
    if (complete) {
      if (st.o + 1 < this.def.objectives.length) this.begin(st.o + 1);
      else { st.done = true; g.broadcastMission(true); g.missionComplete(); }
    }
  }

  // Für Clients
  apply(ms) {
    const changed = ms.o !== this.st.o;
    const prevThp = this.st.thp;
    Object.assign(this.st, ms);
    if (ms.hx !== undefined && !this.hostage) this.placeHostage(V(ms.hx, ms.hy, ms.hz));
    if (changed) { if (this.obj?.radio) this.game.radio(this.obj.radio); this.build(); }
    else if (this.obj?.type === 'destroy' && prevThp.join() !== ms.thp.join()) this.refreshTargets();
  }

  text() {
    const obj = this.obj, st = this.st;
    if (!obj) return '';
    let t = obj.text;
    if (obj.type === 'kill') t += obj.remaining ? ` (noch ${st.prog})` : ` (${Math.min(st.prog, obj.count)}/${obj.count})`;
    if (obj.type === 'collect') {
      t += ` (${st.items.filter(Boolean).length}/${st.items.length})`;
      if (obj.hold) { const p = Math.max(0, ...st.itemProg.map((v, i) => st.items[i] ? 0 : v)); if (p > 0) t += ` – ${Math.round(p / obj.hold * 100)} %`; }
    }
    if (obj.type === 'destroy') t += ` (${st.thp.filter(h => h <= 0).length}/${st.thp.length})`;
    if (obj.type === 'defend') t += ` – ${Math.max(0, Math.ceil(obj.time - st.elapsed))} s` + (st.inZone === false ? '  ⚠ Zurück in die Zone!' : '');
    if (obj.type === 'hold') t += ` – ${Math.min(100, Math.round(st.elapsed / obj.time * 100))} %` + (st.inZone === false ? '  ⚠ Zurück an die Stellung!' : '');
    if (obj.type === 'rescue') t += st.elapsed > 0 ? ` – ${Math.min(100, Math.round(st.elapsed / 3 * 100))} %` : ' (bleib bei ihm)';
    if (obj.type === 'escort' && this.hostage) t += ` – noch ${Math.round(this.hostage.pos.distanceTo(this.poi(obj.poi)))} m`;
    if (st.timer !== null && st.timer !== undefined) t += `  ⏱ ${Math.max(0, Math.ceil(st.timer))} s`;
    return `Ziel ${st.o + 1}/${this.def.objectives.length}: ${t}`;
  }

  markers() {
    const obj = this.obj, out = [];
    if (!obj) return out;
    const up = (p, y) => p.clone().add(V(0, y, 0));
    if (obj.type === 'reach' || obj.type === 'defend' || obj.type === 'boss' || obj.type === 'hold') out.push({ pos: up(this.poi(obj.poi), 2), label: obj.type === 'boss' ? 'Boss' : obj.type === 'hold' ? 'Stellung' : 'Ziel' });
    if (obj.type === 'escort') out.push({ pos: up(this.poi(obj.poi), 2), label: 'Abholung' });
    if ((obj.type === 'rescue' || obj.type === 'escort') && this.hostage) out.push({ pos: up(this.hostage.pos, 2.2), label: 'Jonas' });
    if (obj.type === 'collect') obj.pois.forEach((p, i) => { if (!this.st.items[i]) out.push({ pos: up(this.poi(p), 1.6), label: obj.bombs ? 'Bombe' : 'Daten' }); });
    if (obj.type === 'destroy') obj.pois.forEach((p, i) => { if (this.st.thp[i] > 0) out.push({ pos: up(this.poi(p), 3), label: 'Zerstören' }); });
    return out;
  }

  serialize() {
    const s = this.st;
    return { o: s.o, prog: s.prog, items: s.items, itemProg: s.itemProg, thp: s.thp, timer: s.timer, elapsed: s.elapsed, done: s.done, failed: s.failed, inZone: s.inZone, bossDead: s.bossDead, hostage: s.hostage, hx: s.hx, hy: s.hy, hz: s.hz };
  }
  dispose() {
    this.game.scene.remove(this.visuals);
    if (this.hostage) this.game.scene.remove(this.hostage.model);
  }
}
