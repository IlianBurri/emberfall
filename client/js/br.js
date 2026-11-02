// Battle Royale im Browser: Loot am Boden, schrumpfende Zone, Fallschirmsprung, Zuschauen nach dem Ausscheiden.
import { ic } from './icons.js';
import * as THREE from 'three';
import { WEAPONS, ATTACHMENTS, ATTACH_SLOTS } from './data.js';
import { mulberry, zoneAt } from './zone.js';
import { bakedGunGeometry, soldierMaterial } from './actors.js';
import { net } from './net.js';
import * as sfx from './audio.js';

const LOOT_WEAPONS = [['falke', 4], ['wespe', 4], ['brecher', 3], ['kolibri', 2], ['donner', 2], ['langstreck', 1], ['hornisse', 2], ['bulle', 2]];
const KIND_WEIGHTS = [['weapon', 40], ['ammo', 26], ['med', 15], ['armor', 11], ['nades', 8]];
const RARITY = ['#c8d0d8', '#5dff8a', '#4aa3ff', '#c070ff']; // nach Anzahl Aufsätze
const KIND_NAME = { ammo: 'Munition', med: 'Medikit (+50 Leben)', armor: 'Schutzweste (+50 Panzerung)', nades: '2 Granaten' };

function weighted(r, list) {
  let x = r() * list.reduce((s, [, w]) => s + w, 0);
  for (const [v, w] of list) if ((x -= w) <= 0) return v;
  return list[0][0];
}

// Für alle Spieler gleich, weil aus derselben Welt und demselben Seed erzeugt
export function generateLoot(world, seed) {
  const r = mulberry(seed ^ 0x5eed);
  const spots = [];
  for (const it of world.intersections) if (r() < 0.5) spots.push(new THREE.Vector3(it.x + (r() - 0.5) * 3, 0, it.z + (r() - 0.5) * 3));
  for (const p of world.pois) for (let k = 0; k < 3; k++) spots.push(new THREE.Vector3(p.x + (r() - 0.5) * 5, 0.15, p.z + (r() - 0.5) * 5));
  for (const s of world.sniperSpots) spots.push(s.clone());
  for (const s of world.outerSpots || []) if (r() < 0.75) spots.push(s.clone()); // Umland
  for (const [cx, cz] of world.blockCenters) if (r() < 0.45) spots.push(new THREE.Vector3(cx + (r() < 0.5 ? -7.6 : 7.6), 0, cz + (r() - 0.5) * 6));
  return spots.map((pos, i) => {
    const kind = weighted(r, KIND_WEIGHTS);
    const item = { i, kind, pos, taken: false };
    if (kind === 'weapon') {
      item.id = weighted(r, LOOT_WEAPONS);
      const cls = WEAPONS[item.id].cls;
      item.build = {};
      for (const slot of Object.keys(ATTACH_SLOTS)) {
        const opts = Object.values(ATTACHMENTS).filter(a => a.slot === slot && a.classes.includes(cls));
        if (opts.length && r() < 0.35) item.build[slot] = opts[Math.floor(r() * opts.length)].id;
      }
      item.rarity = Math.min(3, Object.keys(item.build).length);
    }
    return item;
  });
}

const ringGeo = new THREE.RingGeometry(0.45, 0.6, 24); ringGeo.rotateX(-Math.PI / 2);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const lam = c => new THREE.MeshLambertMaterial({ color: c });
const M = { ammo: lam(0x4a5a2a), ammoBand: lam(0xd8b030), med: lam(0xf2f2f2), cross: lam(0xe02a2a), armor: lam(0x2a4a8a), nade: lam(0x3f5a2a) };

function lootMesh(item) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: item.kind === 'weapon' ? RARITY[item.rarity] : '#ffffff', transparent: true, opacity: 0.7, depthWrite: false }));
  ring.position.y = 0.03;
  g.add(ring);
  const inner = new THREE.Group();
  inner.position.y = 0.55;
  g.add(inner);
  const add = (mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(boxGeo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); inner.add(m); };
  if (item.kind === 'weapon') {
    const m = new THREE.Mesh(bakedGunGeometry(item.id, item.build), soldierMaterial);
    m.scale.setScalar(1.5);
    m.rotation.z = Math.PI / 2 * 0; m.rotation.y = Math.PI / 2;
    inner.add(m);
  } else if (item.kind === 'ammo') { add(M.ammo, 0, 0, 0, 0.5, 0.3, 0.3); add(M.ammoBand, 0, 0, 0, 0.52, 0.06, 0.32); }
  else if (item.kind === 'med') { add(M.med, 0, 0, 0, 0.45, 0.3, 0.3); add(M.cross, 0, 0, 0.16, 0.25, 0.07, 0.01); add(M.cross, 0, 0, 0.16, 0.07, 0.25, 0.01); }
  else if (item.kind === 'armor') { add(M.armor, 0, 0, 0, 0.45, 0.5, 0.15); add(M.armor, -0.15, 0.3, 0, 0.12, 0.12, 0.15); add(M.armor, 0.15, 0.3, 0, 0.12, 0.12, 0.15); }
  else { add(M.nade, -0.1, 0, 0, 0.16, 0.22, 0.16); add(M.nade, 0.12, 0, 0, 0.16, 0.22, 0.16); }
  g.userData.inner = inner;
  g.position.copy(item.pos);
  return g;
}

export class BattleRoyale {
  constructor(game, opts) {
    this.game = game;
    this.offset = Date.now() - (opts.serverNow || Date.now());
    this.zone = opts.zone;
    this.alive = opts.room?.players.length || 1;
    this.loot = generateLoot(game.world, opts.seed || 1);
    for (const i of opts.taken || []) if (this.loot[i]) this.loot[i].taken = true;
    this.group = new THREE.Group();
    game.scene.add(this.group);
    for (const it of this.loot) { it.mesh = lootMesh(it); it.mesh.visible = !it.taken; this.group.add(it.mesh); }
    // Zonenwand
    const wallGeo = new THREE.CylinderGeometry(1, 1, 1, 72, 1, true); wallGeo.translate(0, 0.5, 0);
    this.wall = new THREE.Mesh(wallGeo, new THREE.MeshBasicMaterial({ color: 0x3a8aff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    this.wall.renderOrder = 5;
    game.scene.add(this.wall);
    this.nextRing = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, fog: false }));
    this.nextRing.position.y = 0.2;
    game.scene.add(this.nextRing);
    this.near = null;
    this.specIdx = 0;
    this.t = 0;
    const hud = document.getElementById('hud');
    hud.insertAdjacentHTML('beforeend', '<div id="brinfo"></div><div id="lootprompt"></div><div id="zonewarn">' + ic('warn') + ' Außerhalb der Zone – lauf zum blauen Kreis!</div>');
    this.h = { info: hud.querySelector('#brinfo'), prompt: hud.querySelector('#lootprompt'), warn: hud.querySelector('#zonewarn') };
  }

  now() { return Date.now() - this.offset; }

  update(dt) {
    const g = this.game, p = g.p;
    this.t += dt;
    const z = zoneAt(this.zone, this.now());
    this.current = z;
    this.wall.position.set(z.x, -1, z.z);
    this.wall.scale.set(Math.max(0.1, z.r), 140, Math.max(0.1, z.r));
    if (z.next) { this.nextRing.visible = true; this.nextRing.position.set(z.next.x, 0.2, z.next.z); this.nextRing.scale.setScalar(Math.max(0.1, z.next.r)); }
    else this.nextRing.visible = false;
    // Loot animieren + nächsten Gegenstand finden
    this.near = null;
    let best = 2.2;
    for (const it of this.loot) {
      if (it.taken) continue;
      const d = it.pos.distanceTo(p.pos);
      it.mesh.visible = d < 90;
      if (!it.mesh.visible) continue;
      const inner = it.mesh.userData.inner;
      inner.rotation.y += dt * 1.2;
      inner.position.y = 0.55 + Math.sin(this.t * 2 + it.i) * 0.08;
      if (p.alive && d < best) { best = d; this.near = it; }
    }
    const outside = Math.hypot(p.pos.x - z.x, p.pos.z - z.z) > z.r;
    const h = this.h;
    h.warn.style.display = outside && p.alive ? 'block' : 'none';
    const mm = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    const zoneTxt = z.next ? (z.shrinking ? `Zone schrumpft! ${mm(z.nextIn)}` : `Zone schrumpft in ${mm(z.nextIn)}`) : 'Letzte Zone';
    h.info.innerHTML = `<b>${this.alive}</b> Spieler übrig · ${zoneTxt}${p.chute ? '<br>' + ic('parachute') + ' Fallschirm – mit WASD steuern' : ''}`;
    if (this.near) {
      const it = this.near;
      const name = it.kind === 'weapon' ? `${WEAPONS[it.id].name}${it.rarity ? ` (+${Object.keys(it.build).length} Aufsätze)` : ''}` : KIND_NAME[it.kind];
      h.prompt.innerHTML = `<span>E</span> ${name} aufnehmen`;
      h.prompt.style.color = it.kind === 'weapon' ? RARITY[it.rarity] : '#fff';
      h.prompt.style.display = 'block';
    } else h.prompt.style.display = 'none';
    if (!p.alive) h.prompt.style.display = 'none';
  }

  interact() {
    const it = this.near;
    if (!it || it.taken || !this.game.p.alive) return;
    net.send({ t: 'loot', i: it.i, kind: it.kind });
  }

  onLooted(m) {
    const it = this.loot[m.i];
    if (!it) return;
    it.taken = true;
    it.mesh.visible = false;
    if (m.by !== this.game.myId) return;
    const g = this.game;
    sfx.sfxPickup();
    if (it.kind === 'weapon') g.pickupWeapon(it.id, it.build);
    else if (it.kind === 'ammo') { for (const w of g.weapons) w.reserve += w.s.mag * 2; g.feed('Munition aufgenommen'); }
    else if (it.kind === 'nades') { g.p.nades = Math.min(5, g.p.nades + 2); g.feed('+2 Granaten'); }
    else g.feed(KIND_NAME[it.kind]);
  }

  // Kamera beim Zuschauen: hinter einem lebenden Mitspieler
  spectate(cam) {
    const list = [...this.game.remotes.values()].filter(r => r.alive);
    if (!list.length) return false;
    const r = list[this.specIdx % list.length];
    const back = new THREE.Vector3(Math.sin(r.yaw) * 3.5, 2.4, Math.cos(r.yaw) * 3.5);
    cam.position.copy(r.pos).add(back);
    cam.lookAt(r.pos.x, r.pos.y + 1.5, r.pos.z);
    this.h.info.innerHTML += `<br>${ic('eye')} Du schaust <b>${r.tag ? (this.game.names.get(r.id) || '') : ''}</b> zu – Klick wechselt`;
    return true;
  }

  dispose() { this.game.scene.remove(this.group, this.wall, this.nextRing); }
}
