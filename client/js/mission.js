// Missionsablauf (Ziele nacheinander). Der Host/Singleplayer rechnet, Koop-Clients übernehmen nur den Zustand.
import * as THREE from 'three';

const beamGeo = new THREE.CylinderGeometry(1.6, 1.6, 40, 12, 1, true);
const ringGeo = new THREE.RingGeometry(6.6, 7, 40); ringGeo.rotateX(-Math.PI / 2);
const coreGeo = new THREE.OctahedronGeometry(0.4, 0);
const unit = new THREE.BoxGeometry(1, 1, 1); unit.translate(0, 0.5, 0);

export class MissionRuntime {
  constructor(game, def) {
    this.game = game;
    this.def = def;
    this.st = { o: -1, prog: 0, items: [], thp: [], timer: null, elapsed: 0, wave: 0, done: false, failed: false, boss: null };
    this.visuals = new THREE.Group();
    game.scene.add(this.visuals);
    this.targetsMeta = [];
    this.bossRef = null;
    this.pulse = 0;
  }
  get obj() { return this.def.objectives[this.st.o]; }
  poi(i) { return this.game.world.pois[i]; }

  start() {
    this.def.radio?.forEach((r, i) => setTimeout(() => this.game.radio(r), 800 + i * 4200));
    if (this.game.isHost) this.begin(0);
  }

  begin(i) {
    const st = this.st;
    st.o = i; st.prog = 0; st.elapsed = 0; st.wave = 0;
    const obj = this.obj;
    st.items = obj.type === 'collect' ? obj.pois.map(() => false) : [];
    st.thp = obj.type === 'destroy' ? obj.pois.map(() => obj.hp) : [];
    st.timer = obj.timer ?? null;
    if (obj.radio) this.game.radio(obj.radio);
    if (this.game.isHost && obj.spawn) for (const s of obj.spawn) for (let k = 0; k < s.n; k++) this.game.spawnEnemy(s.type, s.at, obj);
    this.build();
    this.game.broadcastMission(true);
  }

  build() {
    this.visuals.clear();
    this.targetsMeta = [];
    const obj = this.obj;
    if (!obj) return;
    const mk = (color, op) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide });
    if (obj.type === 'reach') {
      const b = new THREE.Mesh(beamGeo, mk(0x3affd0, 0.22));
      b.position.copy(this.poi(obj.poi)).setY(20);
      this.visuals.add(b);
    }
    if (obj.type === 'defend') {
      const r = new THREE.Mesh(ringGeo, mk(0x3affd0, 0.6));
      r.position.copy(this.poi(obj.poi)).setY(0.25);
      this.visuals.add(r);
    }
    if (obj.type === 'collect') {
      obj.pois.forEach((p, i) => {
        const m = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0x3ad8ff }));
        m.position.copy(this.poi(p)).setY(1.3);
        m.userData.idx = i;
        m.visible = !this.st.items[i];
        this.visuals.add(m);
      });
    }
    if (obj.type === 'destroy') {
      obj.pois.forEach((p, i) => {
        const g = new THREE.Group();
        const base = this.poi(p);
        g.position.copy(base);
        const body = new THREE.Mesh(unit, new THREE.MeshLambertMaterial({ color: 0x5a6068 }));
        body.scale.set(1.2, 2.4, 1.2); g.add(body);
        const stripe = new THREE.Mesh(unit, new THREE.MeshLambertMaterial({ color: 0xffc020 }));
        stripe.scale.set(1.25, 0.25, 1.25); stripe.position.y = 1.4; g.add(stripe);
        const ant = new THREE.Mesh(unit, new THREE.MeshLambertMaterial({ color: 0x30343a }));
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
        this.game.fx.explosion(t.pos.clone().setY(1.5), 4);
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

  update(dt) {
    this.pulse += dt;
    for (const c of this.visuals.children) {
      if (c.geometry === coreGeo) { c.rotation.y += dt * 2; c.position.y = 1.3 + Math.sin(this.pulse * 3 + c.userData.idx) * 0.15; c.visible = !this.st.items[c.userData.idx]; }
      if (c.userData.lamp) c.userData.lamp.material.color.setHex(Math.sin(this.pulse * 8) > 0 ? 0xff2a2a : 0x551010);
      if (c.geometry === beamGeo) c.material.opacity = 0.16 + Math.sin(this.pulse * 3) * 0.06;
    }
    const g = this.game, st = this.st, obj = this.obj;
    if (!g.isHost || !obj || st.done || st.failed) return;
    const players = g.targets().filter(t => t.alive);
    const near = (p, r) => players.some(t => Math.hypot(t.pos.x - p.x, t.pos.z - p.z) < r);
    let complete = false;
    if (st.timer !== null) {
      st.timer -= dt;
      if (st.timer <= 0) { st.failed = true; g.broadcastMission(true); g.missionFailed('Die Zeit ist abgelaufen!'); return; }
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
          if (!st.items[i] && near(this.poi(p), 1.8)) { st.items[i] = true; g.pickupSound(); g.radio('Datenkern gesichert!'); g.broadcastMission(true); }
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
        while (st.wave < obj.waves.length && st.elapsed >= obj.waves[st.wave].t) {
          const w = obj.waves[st.wave++];
          for (let k = 0; k < w.n; k++) g.spawnEnemy(w.type, 'wave', obj);
          g.radio('Funk: Neue Angriffswelle!');
        }
        complete = st.elapsed >= obj.time;
        break;
      }
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
    if (changed) { if (this.obj?.radio) this.game.radio(this.obj.radio); this.build(); }
    else if (this.obj?.type === 'destroy' && prevThp.join() !== ms.thp.join()) this.refreshTargets();
  }

  text() {
    const obj = this.obj, st = this.st;
    if (!obj) return '';
    let t = obj.text;
    if (obj.type === 'kill') t += obj.remaining ? ` (noch ${st.prog})` : ` (${Math.min(st.prog, obj.count)}/${obj.count})`;
    if (obj.type === 'collect') t += ` (${st.items.filter(Boolean).length}/${st.items.length})`;
    if (obj.type === 'destroy') t += ` (${st.thp.filter(h => h <= 0).length}/${st.thp.length})`;
    if (obj.type === 'defend') t += ` – ${Math.max(0, Math.ceil(obj.time - st.elapsed))} s` + (st.inZone === false ? '  ⚠ Zurück in die Zone!' : '');
    if (st.timer !== null && st.timer !== undefined) t += `  ⏱ ${Math.max(0, Math.ceil(st.timer))} s`;
    return `Ziel ${st.o + 1}/${this.def.objectives.length}: ${t}`;
  }

  markers() {
    const obj = this.obj, out = [];
    if (!obj) return out;
    if (obj.type === 'reach' || obj.type === 'defend' || obj.type === 'boss') out.push({ pos: this.poi(obj.poi).clone().setY(2), label: obj.type === 'boss' ? 'Boss' : 'Ziel' });
    if (obj.type === 'collect') obj.pois.forEach((p, i) => { if (!this.st.items[i]) out.push({ pos: this.poi(p).clone().setY(1.6), label: 'Daten' }); });
    if (obj.type === 'destroy') obj.pois.forEach((p, i) => { if (this.st.thp[i] > 0) out.push({ pos: this.poi(p).clone().setY(3), label: 'Zerstören' }); });
    return out;
  }

  serialize() { const s = this.st; return { o: s.o, prog: s.prog, items: s.items, thp: s.thp, timer: s.timer, elapsed: s.elapsed, done: s.done, failed: s.failed, inZone: s.inZone, bossDead: s.bossDead }; }
  dispose() { this.game.scene.remove(this.visuals); }
}
