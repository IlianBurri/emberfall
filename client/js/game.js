// Die eigentliche Spielrunde: Story (Singleplayer), Koop (Host simuliert KI) und LAN-PvP.
import * as THREE from 'three';
import { World, makeSky, makeSun } from './world.js';
import { MAPS, ENEMY_TYPES, WEAPONS } from './data.js';
import { profile, build, skinDef, addCredits, track, activeCheats } from './profile.js';
import { weaponStats, buildGunModel } from './weapon.js';
import { Enemy, Puppet, hitTestActor, TYPE_LIST, enemyLook, setSoldierGun } from './actors.js';
import { MissionRuntime } from './mission.js';
import { FX } from './fx.js';
import * as sfx from './audio.js';
import { net } from './net.js';
import { BattleRoyale } from './br.js';

const DIFF = {
  leicht: { dmg: 0.55, acc: 0.75, hp: 0.8, react: 1.4, reward: 0.75 },
  normal: { dmg: 1, acc: 1, hp: 1, react: 1, reward: 1 },
  schwer: { dmg: 1.45, acc: 1.2, hp: 1.2, react: 0.7, reward: 1.5 },
};
const PVP_COLORS = ['#3a9bff', '#ff4a8a', '#ffd23a', '#7dff5a', '#b06aff', '#ff8a2a', '#2affd8', '#ffffff'];
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

export class Game {
  constructor(app, opts) {
    this.app = app;
    this.opts = opts;
    this.mode = opts.mode;               // 'story' | 'coop' | 'pvp' | 'br'
    this.versus = this.mode === 'pvp' || this.mode === 'br'; // Spieler gegen Spieler, Leben führt der Server
    this.isNet = this.mode !== 'story';
    this.isHost = this.mode === 'story' || (this.mode === 'coop' && opts.isHost);
    this.myId = this.isNet ? net.id : 0;
    this.diff = DIFF[opts.difficulty || profile.settings.difficulty] || DIFF.normal;
    this.time = 0;
    this.ended = false;
    this.paused = false;
    this.names = new Map();
    this.looks = new Map();
    (opts.room?.players || []).forEach(p => { this.names.set(p.id, p.name); if (p.look) this.looks.set(p.id, p.look); });
    this.scores = new Map();

    const mapDef = MAPS[opts.mapId];
    this.mapDef = mapDef;
    this.scene = new THREE.Scene();
    this.world = new World(mapDef);
    const th = this.world.theme;
    this.scene.add(this.world.group);
    this.scene.add(makeSky(th));
    this.scene.fog = new THREE.Fog(th.fog, 55, 230);
    this.scene.add(makeSun(th, new THREE.Vector3(30, 60, 20)));
    this.hemi = new THREE.HemisphereLight(th.skyBot, th.street, th.hemiI);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(th.sun, th.sunI);
    this.sun.position.set(30, 60, 20);
    this.sun.castShadow = app.quality.shadows;
    if (this.sun.castShadow) {
      const s = this.sun.shadow;
      s.mapSize.set(app.quality.shadowSize, app.quality.shadowSize);
      Object.assign(s.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 160 });
      s.bias = -0.0006;
      s.camera.updateProjectionMatrix();
    }
    this.scene.add(this.sun, this.sun.target);
    this.flashLight = new THREE.PointLight(0xffc070, 0, 8);
    this.scene.add(this.flashLight);
    this.fx = new FX(this.scene);

    this.camera = new THREE.PerspectiveCamera(profile.settings.fov, innerWidth / innerHeight, 0.05, 500);
    this.camera.rotation.order = 'YXZ';
    // Ego-Waffe in eigener Szene (kein Clipping in Wände)
    this.vmScene = new THREE.Scene();
    this.vmScene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.6));
    const vmSun = new THREE.DirectionalLight(0xffffff, 1.4); vmSun.position.set(1, 2, 1); this.vmScene.add(vmSun);
    this.vmCam = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.01, 10);
    this.vmRoot = new THREE.Group();
    this.vmScene.add(this.vmRoot);
    const flashGeo = new THREE.PlaneGeometry(0.22, 0.22);
    this.muzzleFlash = new THREE.Mesh(flashGeo, new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    const flash2 = this.muzzleFlash.clone(); flash2.rotation.y = Math.PI / 2; this.muzzleFlash.add(flash2);
    this.muzzleFlash.visible = false;

    // Spieler
    this.p = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: 0, grounded: true, crouch: 0, hp: 100, alive: true, hurtT: -99, lives: 3, nades: 2, sprint: false, speed: 0, stepT: 0 };
    this.weapons = this.mode === 'br'
      ? [this.createWeapon('stachel', build('stachel'), 2)]
      : ['primary', 'secondary'].map(slot => this.createWeapon(profile.loadout[slot], build(profile.loadout[slot])));
    if (this.mode === 'br') this.p.nades = 0;
    this.cur = 0;
    this.switchT = 0;
    this.equip(0, true);
    this.recoil = { pitch: 0, yaw: 0 };
    this.bob = 0;
    this.sway = { x: 0, y: 0 };
    this.shake = 0;

    this.enemies = [];          // Host: echte Gegner
    this.proxies = new Map();   // Koop-Client: Gegner-Puppen
    this.remotes = new Map();   // andere Spieler
    this.nades = [];
    this.pickups = [];
    this.stats = { kills: 0, heads: 0, credits: 0, deaths: 0 };
    this.input = { keys: new Set(), fire: false, ads: false };
    this.netT = 0;
    this.enT = 0;
    this.msT = 0;
    this.respawnT = 0;
    this.fpsAcc = 0; this.fpsN = 0;

    this.frame = 0; this._tFrame = -1;
    this.buildHud();
    this.h.wname.textContent = WEAPONS[this.weapons[0].id].name;
    this.bindInput();
    if (this.isNet) this.bindNet();
    this.cheatsChanged(true);

    if (this.mode === 'pvp') {
      this.endAt = opts.endAt ? opts.endAt + (Date.now() - (opts.serverNow || Date.now())) : 0;
      this.p.pos.copy(this.pvpSpawn());
    } else if (this.mode === 'br') {
      this.br = new BattleRoyale(this, opts);
      this.p.pos.copy(this.pvpSpawn()).setY(55);
      this.p.chute = true;
      this.p.grounded = false;
      if (opts.late) { this.p.alive = false; this.p.hp = 0; this.p.chute = false; this.spectating = true; }
    } else {
      const idx = opts.room ? Math.max(0, opts.room.players.findIndex(p => p.id === this.myId)) : 0;
      this.p.pos.copy(this.world.pois[0]).add(tmp.set((idx % 3 - 1) * 1.5, 0, Math.floor(idx / 3) * 1.5));
      this.p.yaw = Math.atan2(-(this.world.pois[3].x - this.p.pos.x), -(this.world.pois[3].z - this.p.pos.z));
      this.mission = new MissionRuntime(this, opts.mission);
      this.mission.start();
    }
    this.updateCamera(0);
    this.centerMsg(this.mode === 'pvp' ? 'LAN-PvP – Jeder gegen jeden! 20 Kills gewinnen.'
      : this.mode === 'br' ? (opts.late ? 'Runde läuft schon – du schaust zu.' : 'Battle Royale! Lande, sammle Waffen, überlebe.') : opts.mission.name, 3);
  }

  createWeapon(id, b, magsReserve = 0) {
    const s = weaponStats(id, b);
    const model = buildGunModel(id, b, skinDef(profile.weaponSkin[id]), { hands: true });
    model.visible = false;
    this.vmRoot.add(model);
    return { id, s, model, ammo: s.mag, reserve: magsReserve ? s.mag * magsReserve : s.reserve, reloadT: 0, cool: 0, ads: 0, bloom: 0, kick: 0, latched: false };
  }

  // Battle Royale: Waffe vom Boden. Primärwaffen ersetzen die alte Primärwaffe, Sekundärwaffen die Pistole.
  pickupWeapon(id, b) {
    const w = this.createWeapon(id, b, 2);
    const primary = WEAPONS[id].slot === 'primary';
    const hasPrimary = this.weapons.length > 1 || WEAPONS[this.weapons[0].id].slot === 'primary';
    let idx;
    if (primary) { idx = 0; if (hasPrimary) this.vmRoot.remove(this.weapons[0].model); else this.weapons.unshift(null); }
    else { idx = this.weapons.length - 1; if (WEAPONS[this.weapons[idx].id].slot === 'secondary') this.vmRoot.remove(this.weapons[idx].model); else { this.weapons.push(null); idx++; } }
    this.weapons[idx] = w;
    this.cur = -1;
    this.equip(idx, true);
    this.switchT = 0.4;
    this.feed(WEAPONS[id].name + ' aufgenommen');
  }

  // ------------------------------------------------------------------ HUD
  buildHud() {
    const hud = document.getElementById('hud');
    hud.innerHTML = `
      <div id="crosshair"><i></i><i></i><i></i><i></i><b></b></div>
      <div id="hitmarker"></div>
      <div id="scope"><div></div></div>
      <div id="vignette"></div>
      <div id="objective"></div>
      <div id="radio"></div>
      <div id="killfeed"></div>
      <div id="feed"></div>
      <div id="bossbar"><span>Kommandant Rostzahn</span><div><i></i></div></div>
      <div id="hpbox"><div class="bar armor"><i></i></div><div class="bar"><i></i></div><span>100</span><em></em></div>
      <div id="ammo"><div class="wname"></div><b>0</b><span>/ 0</span><div class="nades"></div><div class="reload">Nachladen…</div></div>
      <div id="markers"></div>
      <div id="center-msg"></div>
      <div id="scoreboard"></div>
      <div id="timer"></div>
      <div id="fps"></div>
      <div id="hint">Klicken zum Spielen · WASD laufen · Maus zielen · Linksklick schießen · Rechtsklick zielen · R nachladen · G Granate · 1/2/Q Waffe · Shift sprinten · C ducken · Leertaste springen · Tab Punkte · Esc Pause</div>`;
    hud.style.display = 'block';
    const $ = s => hud.querySelector(s);
    this.h = {
      cross: $('#crosshair'), hit: $('#hitmarker'), scope: $('#scope'), vig: $('#vignette'), obj: $('#objective'), radio: $('#radio'),
      kf: $('#killfeed'), feed: $('#feed'), boss: $('#bossbar'), bossI: $('#bossbar i'), hpI: $('#hpbox .bar:not(.armor) i'), armor: $('#hpbox .armor'), armorI: $('#hpbox .armor i'), hpS: $('#hpbox span'), lives: $('#hpbox em'),
      ammoB: $('#ammo b'), ammoS: $('#ammo span'), wname: $('#ammo .wname'), nades: $('#ammo .nades'), reload: $('#ammo .reload'),
      markers: $('#markers'), center: $('#center-msg'), score: $('#scoreboard'), timer: $('#timer'), fps: $('#fps'), hint: $('#hint'),
    };
    this.markerPool = [];
    setTimeout(() => { if (this.h) this.h.hint.style.opacity = 0; }, 12000);
  }

  centerMsg(text, secs = 2.5) {
    this.h.center.textContent = text;
    this.h.center.style.opacity = 1;
    clearTimeout(this.centerTO);
    this.centerTO = setTimeout(() => { if (this.h) this.h.center.style.opacity = 0; }, secs * 1000);
  }
  radio(text) {
    if (!this.h) return;
    this.h.radio.textContent = text;
    this.h.radio.style.opacity = 1;
    clearTimeout(this.radioTO);
    this.radioTO = setTimeout(() => { if (this.h) this.h.radio.style.opacity = 0; }, 5000);
  }
  feed(text) {
    const d = document.createElement('div');
    d.textContent = text;
    this.h.feed.prepend(d);
    setTimeout(() => d.remove(), 1800);
  }
  killfeed(k, v, w, head) {
    const d = document.createElement('div');
    d.innerHTML = `<b>${esc(k)}</b> <span>[${esc(w)}${head ? ' ☠' : ''}]</span> <b>${esc(v)}</b>`;
    this.h.kf.prepend(d);
    while (this.h.kf.children.length > 5) this.h.kf.lastChild.remove();
    setTimeout(() => d.remove(), 6000);
  }
  hitmarker(kill, head) {
    this.h.hit.className = kill ? 'show kill' : head ? 'show head' : 'show';
    clearTimeout(this.hitTO);
    this.hitTO = setTimeout(() => { if (this.h) this.h.hit.className = ''; }, kill ? 260 : 120);
    sfx.sfxHit(head);
    if (kill) sfx.sfxKill();
  }

  // ------------------------------------------------------------------ Eingabe
  bindInput() {
    const canvas = this.app.renderer.domElement;
    this.onKeyDown = e => {
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (this.paused) return;
      this.input.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === 'KeyR') this.reload();
      if (e.code === 'Digit1') this.equip(0);
      if (e.code === 'Digit2') this.equip(1);
      if (e.code === 'KeyQ') this.equip(1 - this.cur);
      if (e.code === 'KeyG') this.throwNade();
      if (e.code === 'KeyE') this.br?.interact();
      if (e.code === 'Tab') this.showScores(true);
    };
    this.onKeyUp = e => {
      this.input.keys.delete(e.code);
      if (e.code === 'Tab') this.showScores(false);
    };
    this.onMouseDown = e => {
      if (!document.pointerLockElement) return;
      if (this.spectating && this.br) { this.br.specIdx++; return; }
      if (e.button === 0) this.input.fire = true;
      if (e.button === 2) this.input.ads = true;
    };
    this.onMouseUp = e => {
      if (e.button === 0) this.input.fire = false;
      if (e.button === 2) this.input.ads = false;
    };
    this.onMouseMove = e => {
      if (!document.pointerLockElement || !this.p.alive) return;
      const w = this.weapons[this.cur];
      const zoomF = 1 + (w.s.zoom - 1) * w.ads;
      const k = 0.0022 * profile.settings.sens / Math.pow(zoomF, 0.85);
      this.p.yaw -= e.movementX * k;
      this.p.pitch = Math.max(-1.5, Math.min(1.5, this.p.pitch - e.movementY * k));
      this.sway.x = Math.max(-1, Math.min(1, this.sway.x + e.movementX * 0.002));
      this.sway.y = Math.max(-1, Math.min(1, this.sway.y + e.movementY * 0.002));
    };
    this.onWheel = () => {
      if (!document.pointerLockElement || this.time - (this.wheelT || -1) < 0.3) return;
      this.wheelT = this.time;
      this.equip(1 - this.cur);
    };
    this.onClick = () => { if (!this.ended && !document.pointerLockElement) this.lock(); };
    this.onLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      if (!locked && !this.ended) { this.input.fire = false; this.input.ads = false; this.input.keys.clear(); this.app.showPause(true); this.paused = true; }
      if (locked) { this.app.showPause(false); this.paused = false; }
    };
    this.onResize = () => {
      this.camera.aspect = this.vmCam.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix(); this.vmCam.updateProjectionMatrix();
    };
    this.onCtx = e => e.preventDefault();
    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
    addEventListener('mousedown', this.onMouseDown);
    addEventListener('mouseup', this.onMouseUp);
    addEventListener('mousemove', this.onMouseMove);
    addEventListener('wheel', this.onWheel);
    addEventListener('resize', this.onResize);
    addEventListener('contextmenu', this.onCtx);
    canvas.addEventListener('click', this.onClick);
    document.addEventListener('pointerlockchange', this.onLockChange);
  }
  lock() {
    sfx.initAudio();
    const c = this.app.renderer.domElement;
    const plain = () => { try { c.requestPointerLock()?.catch?.(() => {}); } catch { /* nicht erlaubt */ } };
    try { const p = c.requestPointerLock({ unadjustedMovement: true }); if (p?.catch) p.catch(plain); } catch { plain(); }
  }
  unbindInput() {
    removeEventListener('keydown', this.onKeyDown);
    removeEventListener('keyup', this.onKeyUp);
    removeEventListener('mousedown', this.onMouseDown);
    removeEventListener('mouseup', this.onMouseUp);
    removeEventListener('mousemove', this.onMouseMove);
    removeEventListener('wheel', this.onWheel);
    removeEventListener('resize', this.onResize);
    removeEventListener('contextmenu', this.onCtx);
    this.app.renderer.domElement.removeEventListener('click', this.onClick);
    document.removeEventListener('pointerlockchange', this.onLockChange);
  }

  // ------------------------------------------------------------------ Netzwerk
  bindNet() {
    const offs = [];
    const on = (t, fn) => offs.push(net.on(t, m => { if (!this.ended) fn(m); }));
    this.netOffs = offs;
    on('st', m => {
      let r = this.remotes.get(m.id);
      if (!r) {
        const name = this.names.get(m.id) || 'Spieler ' + m.id;
        const look = this.looks.get(m.id) || { color: this.versus ? PVP_COLORS[m.id % PVP_COLORS.length] : '#2fb5a8', vest: '#3a4430', helmet: '#4d5a3c' };
        r = new Puppet(this.scene, look.color, { ...look, name, tagColor: this.versus ? '#ff8080' : '#9affea', gun: WEAPONS[m.w] ? m.w : 'falke' });
        r.id = m.id; r.hp = 100;
        this.remotes.set(m.id, r);
      }
      r.set(m.p, m.y, m.x, m.c);
      r.alive = m.a; r.hp = m.hp;
      if (m.w && WEAPONS[m.w] && r.w !== m.w) { r.w = m.w; setSoldierGun(r.model, m.w); }
    });
    on('left', m => { const r = this.remotes.get(m.id); if (r) { r.remove(); this.remotes.delete(m.id); } });
    on('room', m => m.room.players.forEach(p => { this.names.set(p.id, p.name); if (p.look) this.looks.set(p.id, p.look); }));
    on('joinedOther', m => { this.names.set(m.id, m.name); if (m.look) this.looks.set(m.id, m.look); });
    on('shot', m => {
      const a = tmp.fromArray(m.a), b = tmp2.fromArray(m.b);
      this.fx.tracer(a, b, '#fff0a0');
      if (m.hit) this.fx.burst(b, 4, '#cccccc', 3, 0.3);
      this.playAt(m.cls, m.silent, a);
    });
    on('nade', m => this.spawnNade(new THREE.Vector3().fromArray(m.o), new THREE.Vector3().fromArray(m.v), 'remote'));
    on('eshot', m => {
      const a = tmp.fromArray(m.a), b = tmp2.fromArray(m.b);
      this.fx.tracer(a, b, m.s ? '#ff4040' : '#ffb070', m.s ? 0.12 : 0.06);
      this.playAt(m.s ? 'sniper' : 'enemy', false, a);
    });
    on('edmg', m => this.takeDamage(m.dmg, m.from ? new THREE.Vector3(m.from[0], 0, m.from[1]) : null));
    // Koop
    on('en', m => { if (!this.isHost) this.syncProxies(m.l); });
    on('ms', m => { if (!this.isHost && this.mission) { this.mission.apply(m.s); if (m.s.failed) this.missionFailed('Mission gescheitert.'); } });
    on('ekill', m => this.onEnemyKilledMsg(m));
    on('mdone', () => { if (!this.isHost) this.missionComplete(); });
    on('ehit', m => {
      if (!this.isHost) return;
      const e = this.enemies.find(x => x.id === m.eid);
      if (!e || e.dead) return;
      const r = this.remotes.get(m.id);
      if (e.damage(m.dmg, r ? r.pos : null)) this.enemyKilled(e, m.id, m.cls, m.head);
    });
    on('act', m => { if (this.isHost && m.k === 'tdmg') this.mission.damageTarget(m.i, m.dmg); });
    on('host', m => { if (m.id === this.myId && this.mode === 'coop' && !this.isHost) this.becomeHost(); });
    // PvP
    on('hurt', m => {
      this.p.hp = m.hp;
      if (m.armor !== undefined) this.p.armor = m.armor;
      const r = this.remotes.get(m.from);
      this.hurtFx(m.dmg, r ? r.pos : null);
    });
    on('heal', m => { this.p.hp = m.hp; });
    on('armor', m => { this.p.armor = m.armor; });
    on('looted', m => this.br?.onLooted(m));
    on('alive', m => { if (this.br) this.br.alive = m.n; });
    on('kill', m => {
      const kn = m.k === this.myId ? 'Du' : this.names.get(m.k) || '?';
      const vn = m.v === this.myId ? 'dich' : this.names.get(m.v) || '?';
      this.killfeed(kn, vn, clsShort(m.w), m.head);
      if (m.v === this.myId) {
        this.die(m.w === 'zone' ? 'Die Zone hat dich erwischt!' : m.k === this.myId ? 'Selbst erwischt!' : `Ausgeschaltet von ${this.names.get(m.k) || '?'}`);
      } else {
        const r = this.remotes.get(m.v);
        if (r) { r.alive = false; this.fx.burst(r.pos.clone().setY(1), 30, '#ffd23a', 5, 0.8); }
        if (m.k === this.myId) { this.hitmarker(true, m.head); this.rewardKill(m.w, m.head, false); }
      }
    });
    on('respawn', m => {
      if (m.id === this.myId) this.respawn();
      else { const r = this.remotes.get(m.id); if (r) r.alive = true; }
    });
    on('score', m => m.players.forEach(p => { this.scores.set(p.id, p); this.names.set(p.id, p.name); }));
    on('end', m => {
      if (this.mode === 'br') this.finish({ type: 'br', ranking: m.ranking, total: m.total, myId: this.myId, stats: this.stats });
      else if (this.mode === 'pvp') this.pvpEnd(m.ranking);
      else this.finish({ type: 'error', msg: 'Der Host hat die Mission beendet.' });
    });
    on('close', () => this.finish({ type: 'error', msg: 'Verbindung zum Server verloren.' }));
  }

  playAt(cls, silent, a) {
    const cam = this.camera.position;
    const d = cam.distanceTo(a);
    const right = tmp2.set(Math.cos(this.p.yaw), 0, -Math.sin(this.p.yaw));
    const dir = new THREE.Vector3().subVectors(a, cam).normalize();
    sfx.sfxShot(cls, silent, d, dir.dot(right));
  }

  // ------------------------------------------------------------------ Ziele für die KI
  targets() {
    if (this._tFrame === this.frame) return this._targets;
    this._tFrame = this.frame;
    const out = [{ id: this.myId, local: true, pos: this.p.pos, eye: new THREE.Vector3(this.p.pos.x, this.p.pos.y + this.eyeH(), this.p.pos.z), alive: this.p.alive, crouch: this.p.crouch > 0.5, speed: this.p.speed }];
    if (this.mode === 'coop') for (const r of this.remotes.values()) out.push({ id: r.id, local: false, pos: r.pos, eye: new THREE.Vector3(r.pos.x, r.pos.y + (r.crouch ? 1.05 : 1.6), r.pos.z), alive: r.alive, crouch: !!r.crouch, speed: r.speed });
    this._targets = out;
    return out;
  }
  aliveEnemies() { return this.enemies.filter(e => !e.dead).length; }

  alertNear(pos, targetPos, r) {
    for (const e of this.enemies) if (!e.dead && e.pos.distanceTo(pos) < r) e.alert(targetPos);
  }

  spawnEnemy(type, at, obj) {
    const w = this.world;
    let pos, stationary = false, alert = false;
    const players = this.targets();
    const nearestPlayerD = p => Math.min(...players.map(t => t.pos.distanceTo(p)));
    if (type === 'schuetze' && w.sniperSpots.length && (at === 'spread')) {
      const free = w.sniperSpots.filter(s => !this.enemies.some(e => !e.dead && e.pos.distanceTo(s) < 1) && nearestPlayerD(s) > 25);
      if (free.length) { pos = free[Math.floor(Math.random() * free.length)].clone(); stationary = true; }
    }
    if (!pos && typeof at === 'number') {
      const c = w.pois[at];
      const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 2;
      pos = new THREE.Vector3(c.x + Math.cos(a) * r, 0.2, c.z + Math.sin(a) * r);
    }
    if (!pos) {
      const minD = at === 'spread' ? 30 : 22, maxD = at === 'spread' ? 999 : at === 'near' ? 42 : 55;
      const ref = at === 'wave' ? w.pois[obj.poi] : null;
      let cands = w.intersections.filter(it => {
        const p = tmp.set(it.x, 0, it.z);
        const dp = nearestPlayerD(p);
        const dr = ref ? ref.distanceTo(p) : dp;
        return dp > minD && dr < maxD && dr > minD;
      });
      if (!cands.length) cands = w.intersections;
      const it = cands[Math.floor(Math.random() * cands.length)];
      pos = new THREE.Vector3(it.x + (Math.random() - 0.5) * 3, 0, it.z + (Math.random() - 0.5) * 3);
      alert = at === 'near' || at === 'wave';
    }
    const alertPos = at === 'wave' ? w.pois[obj.poi] : players[0].pos;
    const e = new Enemy(this, type, pos, { alert, alertPos, stationary });
    this.enemies.push(e);
    if (ENEMY_TYPES[type].boss) { this.boss = e; this.h.boss.style.display = 'block'; }
    return e;
  }

  // ------------------------------------------------------------------ Gegner schießen
  enemyFire(e, t, d) {
    const T = e.T;
    const pellets = T.pellets || 1;
    let hits = 0;
    const base = T.acc * this.diff.acc * (1 - Math.min(0.7, (d / T.range) * 0.7)) * (t.crouch ? 0.8 : 1) * (t.speed > 3.5 ? 0.75 : 1);
    for (let i = 0; i < pellets; i++) if (Math.random() < base) hits++;
    const dmg = hits * T.dmg * this.diff.dmg;
    const a = e.eye(new THREE.Vector3()).add(tmp.set(-Math.sin(e.yaw) * 0.6, -0.25, -Math.cos(e.yaw) * 0.6));
    const b = t.eye.clone().add(tmp2.set((Math.random() - 0.5) * (hits ? 0.3 : 2.5), (Math.random() - 0.5) * (hits ? 0.3 : 1.5) - 0.2, (Math.random() - 0.5) * (hits ? 0.3 : 2.5)));
    this.fx.tracer(a, b, T.sniper ? '#ff4040' : '#ffb070', T.sniper ? 0.12 : 0.06);
    this.playAt(T.sniper ? 'sniper' : 'enemy', false, a);
    if (this.mode === 'coop') net.send({ t: 'eshot', a: a.toArray().map(r2), b: b.toArray().map(r2), s: !!T.sniper });
    if (dmg > 0) {
      if (t.local) this.takeDamage(dmg, e.pos);
      else net.send({ t: 'edmg', target: t.id, dmg, from: [r2(e.pos.x), r2(e.pos.z)] });
    }
  }
  enemyGrenade(e, t) {
    const o = e.eye(new THREE.Vector3());
    const ft = 1.2;
    const v = new THREE.Vector3((t.pos.x - o.x) / ft, (t.pos.y - o.y) / ft + 0.5 * 20 * ft, (t.pos.z - o.z) / ft);
    this.spawnNade(o, v, 'enemy');
    if (this.mode === 'coop') net.send({ t: 'nade', o: o.toArray().map(r2), v: v.toArray().map(r2) });
  }

  // ------------------------------------------------------------------ Spieler: Schaden / Tod
  // Cheats: Werte übernehmen (auch live aus dem Pause-Menü)
  cheatsChanged(start = false) {
    const c = activeCheats();
    this.maxHp = c.maxHp;
    if (this.versus) net.send({ t: 'cheats', maxHp: c.maxHp, god: !!c.god });
    else if (start || this.p.hp > c.maxHp || c.maxHp > (this.lastMaxHp || 100)) this.p.hp = c.maxHp;
    this.lastMaxHp = c.maxHp;
  }

  // Aimbot: dreht die Sicht weich zum nächsten sichtbaren Gegner im eingestellten Sichtfeld
  aimbot(dt) {
    const c = activeCheats(), p = this.p;
    if (!c.aimbot || !p.alive || this.paused) return;
    const want = c.aimMode === 'immer' || (c.aimMode === 'zielen' && this.input.ads) || (c.aimMode === 'schiessen' && this.input.fire);
    if (!want) return;
    const eye = new THREE.Vector3(p.pos.x, p.pos.y + this.eyeH(), p.pos.z);
    const fwd = new THREE.Vector3(-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch));
    let best = null, bestAng = THREE.MathUtils.degToRad(c.aimFov) / 2;
    for (const t of this.cheatTargets()) {
      const pt = new THREE.Vector3(t.pos.x, t.pos.y + (c.aimBone === 'kopf' ? 1.62 : 1.1) * t.scale - (t.crouch ? 0.35 : 0), t.pos.z);
      const dir = pt.clone().sub(eye);
      const ang = dir.angleTo(fwd);
      if (ang > bestAng || !this.world.lineOfSight(eye, pt)) continue;
      best = dir; bestAng = ang;
    }
    if (!best) return;
    const tYaw = Math.atan2(-best.x, -best.z), tPitch = Math.atan2(best.y, Math.hypot(best.x, best.z));
    const k = Math.min(1, dt * c.aimSmooth);
    let dy = Math.atan2(Math.sin(tYaw - p.yaw), Math.cos(tYaw - p.yaw));
    p.yaw += dy * k;
    p.pitch += (tPitch - p.pitch) * k;
  }
  cheatTargets() {
    if (this.versus) return [...this.remotes.values()].filter(r => r.alive).map(r => ({ pos: r.pos, scale: 1, crouch: r.crouch, name: this.names.get(r.id) || '?', hp: r.hp, max: 100 }));
    const list = this.isHost ? this.enemies : [...this.proxies.values()];
    return list.filter(e => !e.dead).map(e => ({ pos: e.pos, scale: e.scale || 1, crouch: 0, name: e.T?.name || 'Gegner', hp: e.hp, max: e.maxHp || e.T?.hp || 100 }));
  }

  takeDamage(dmg, from) {
    if (activeCheats().god) return;
    if (!this.p.alive || this.ended) return;
    if (this.versus) return; // PvP-Leben führt der Server
    this.p.hp -= dmg;
    this.hurtFx(dmg, from);
    if (this.p.hp <= 0) this.die('Du wurdest ausgeschaltet!');
  }
  hurtFx(dmg, from) {
    this.p.hurtT = this.time;
    this.h.vig.style.opacity = Math.min(1, 0.35 + dmg / 40);
    this.shake = Math.min(0.6, this.shake + dmg / 60);
    sfx.sfxHurt();
  }
  die(text) {
    if (!this.p.alive) return;
    this.p.alive = false;
    this.p.hp = 0;
    this.stats.deaths++;
    profile.stats.deaths++;
    this.input.fire = false;
    if (this.mode === 'story') {
      this.p.lives--;
      if (this.p.lives <= 0) { setTimeout(() => this.missionFailed('Keine Leben mehr übrig.'), 1500); this.centerMsg(text, 2); return; }
      this.centerMsg(`${text}  Leben übrig: ${this.p.lives}`, 3);
      this.respawnT = 3;
    } else if (this.mode === 'coop') {
      this.centerMsg(`${text}  Wiedereinstieg in 5 s`, 5);
      this.respawnT = 5;
    } else if (this.mode === 'br') {
      const place = (this.br?.alive || 1) + 0;
      this.centerMsg(`${text}  Ausgeschieden – Platz ${place}. Du schaust jetzt zu (Esc = verlassen).`, 6);
      this.brPlace = place;
      setTimeout(() => { this.spectating = true; }, 2500);
    } else this.centerMsg(`${text}  Wiedereinstieg in 3 s`, 3);
  }
  respawn() {
    const p = this.p;
    p.alive = true; p.hp = 100; p.vel.set(0, 0, 0); p.nades = 2;
    if (this.mode === 'pvp') p.pos.copy(this.pvpSpawn());
    else p.pos.copy(this.world.pois[0]).add(tmp.set(Math.random() * 2 - 1, 0, Math.random() * 2 - 1));
    for (const w of this.weapons) { w.ammo = w.s.mag; w.reserve = Math.max(w.reserve, w.s.reserve); w.reloadT = 0; }
    this.h.vig.style.opacity = 0;
  }
  pvpSpawn() {
    const others = [...this.remotes.values()].filter(r => r.alive).map(r => r.pos);
    const cands = this.world.intersections.map(it => {
      const v = new THREE.Vector3(it.x, 0, it.z);
      const d = others.length ? Math.min(...others.map(o => o.distanceTo(v))) : Math.random() * 100;
      return { v, d };
    }).sort((a, b) => b.d - a.d);
    const pick = cands[Math.floor(Math.random() * Math.min(6, cands.length))].v;
    this.p.yaw = Math.atan2(pick.x, pick.z); // grob zur Mapmitte schauen
    return pick.add(tmp.set(Math.random() - 0.5, 0, Math.random() - 0.5));
  }

  // ------------------------------------------------------------------ Waffen
  equip(i, instant = false) {
    if ((i === this.cur && !instant) || i >= this.weapons.length || i < 0) return;
    const old = this.weapons[this.cur];
    if (old) { old.reloadT = 0; old.ads = 0; }
    this.cur = i;
    this.weapons.forEach((w, k) => { w.model.visible = k === i; });
    const w = this.weapons[i];
    w.model.userData.muzzle.add(this.muzzleFlash);
    this.switchT = instant ? 0 : 0.4;
    this.h && (this.h.wname.textContent = WEAPONS[w.id].name);
  }
  reload() {
    const w = this.weapons[this.cur];
    if (w.reloadT > 0 || w.ammo >= w.s.mag || w.reserve <= 0 || this.switchT > 0) return;
    w.reloadT = w.s.reload;
    w.ads = Math.min(w.ads, 0.3);
    sfx.sfxReload(0);
    setTimeout(() => sfx.sfxReload(1), w.s.reload * 600);
  }
  eyeH() { return 1.6 - this.p.crouch * 0.55; }

  fire() {
    const w = this.weapons[this.cur], s = w.s, p = this.p;
    const cheat = activeCheats();
    if (!cheat.infAmmo) w.ammo--;
    w.cool = 60 / (s.rpm * cheat.rapid);
    const cam = this.camera;
    const origin = cam.position.clone();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    const spread = THREE.MathUtils.degToRad(this.currentSpread());
    const pellets = s.pellets || 1;
    const muzzleW = new THREE.Vector3();
    // Mündung ungefähr in Weltkoordinaten (für Leuchtspur)
    muzzleW.copy(origin).addScaledVector(fwd, 0.6).addScaledVector(right, w.ads > 0.5 ? 0 : 0.15).addScaledVector(up, -0.12);
    let anyHit = false, anyKill = false, anyHead = false;
    const netShots = [];
    for (let k = 0; k < pellets; k++) {
      const r = Math.sqrt(Math.random()) * Math.tan(spread), a = Math.random() * Math.PI * 2;
      const dir = fwd.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize();
      const hit = this.trace(origin, dir, 250);
      const end = origin.clone().addScaledVector(dir, hit.t);
      if (k < 3) { this.fx.tracer(muzzleW, end, '#fff2a0', 0.05); netShots.push(end); }
      const dist = hit.t;
      const fall = dist <= s.range ? 1 : Math.max(s.minDmg, 1 - (dist - s.range) / (s.range * 1.5) * (1 - s.minDmg));
      const dmg = s.dmg * fall * (hit.head ? s.headMult : 1);
      if (hit.kind === 'world') this.fx.burst(end, 4, '#d8d0c0', 3, 0.35);
      else {
        this.fx.burst(end, 7, hit.kind === 'target' ? '#ffb030' : '#ffd23a', 4, 0.4);
        anyHit = true; if (hit.head) anyHead = true;
        if (this.damageThing(hit, dmg, s.cls)) anyKill = true;
      }
    }
    if (anyHit) this.hitmarker(anyKill, anyHead);
    // Rückstoß
    const ads = w.ads, cr = p.crouch > 0.5 ? 0.8 : 1;
    const rv = THREE.MathUtils.degToRad(s.recoilV) * (1 - ads * 0.3) * cr;
    const rh = THREE.MathUtils.degToRad(s.recoilH) * (Math.random() * 2 - 1) * cr;
    if (!cheat.noRecoil) p.pitch = Math.min(1.5, p.pitch + rv * 0.7);
    if (!cheat.noRecoil) { p.yaw += rh * 0.7; this.recoil.pitch += rv * 0.3; this.recoil.yaw += rh * 0.3; }
    if (!cheat.noRecoil) w.bloom = Math.min(6, w.bloom + s.recoilV * 0.35 * (s.pellets ? 0.3 : 1));
    w.kick = 1;
    this.flashT = 0.05;
    this.muzzleFlash.visible = true;
    this.muzzleFlash.rotation.z = Math.random() * 3;
    this.muzzleFlash.scale.setScalar((s.silent ? 0.4 : 1) * (0.8 + Math.random() * 0.5));
    if (!s.silent) { this.flashLight.position.copy(muzzleW); this.flashLight.intensity = 6; }
    sfx.sfxShot(s.cls, s.silent);
    // Gegner hören Schüsse
    if (this.isHost) this.alertNear(p.pos, p.pos, s.silent ? 9 : 45);
    if (this.isNet) net.send({ t: 'shot', a: muzzleW.toArray().map(r2), b: netShots[0].toArray().map(r2), cls: s.cls, silent: s.silent, hit: true });
    if (w.ammo <= 0 && w.reserve > 0) setTimeout(() => this.reload(), 250);
  }

  currentSpread() {
    if (activeCheats().noRecoil) return 0;
    const w = this.weapons[this.cur], s = w.s, p = this.p;
    let sp = THREE.MathUtils.lerp(s.spreadHip, s.spreadAds, w.ads);
    sp *= 1 + Math.min(1, p.speed / 7) * (1.2 - w.ads * 0.8);
    if (p.crouch > 0.5) sp *= 0.75;
    if (!p.grounded) sp *= 2;
    return sp + w.bloom * (1 - w.ads * 0.6);
  }

  // Nächster Treffer entlang eines Strahls: Welt, Gegner, Ziele, Spieler (PvP)
  trace(o, d, maxD) {
    let best = { t: this.world.raycast(o, d, maxD), kind: 'world' };
    if (!this.versus) {
      const list = this.isHost ? this.enemies : [...this.proxies.values()];
      for (const e of list) {
        if (e.dead) continue;
        const h = hitTestActor(o, d, e.pos, e.scale);
        if (h && h.t < best.t) best = { t: h.t, kind: 'enemy', head: h.head, ref: e };
      }
      const tg = this.mission?.hitTest(o, d);
      if (tg && tg.t < best.t) best = { t: tg.t, kind: 'target', i: tg.i };
    } else {
      for (const r of this.remotes.values()) {
        if (!r.alive) continue;
        const h = hitTestActor(o, d, r.pos, 1, r.crouch);
        if (h && h.t < best.t) best = { t: h.t, kind: 'player', head: h.head, ref: r };
      }
    }
    return best;
  }

  // Gibt true zurück, wenn (sicher) ein Kill passiert ist
  damageThing(hit, dmg, cls) {
    dmg = Math.round(dmg);
    if (hit.kind === 'enemy') {
      const e = hit.ref;
      if (this.isHost) {
        if (e.damage(dmg, this.p.pos)) { this.enemyKilled(e, this.myId, cls, hit.head); return true; }
      } else {
        net.send({ t: 'ehit', eid: e.id, dmg, head: !!hit.head, cls });
        e.hpGuess = (e.hpGuess ?? e.hp) - dmg;
      }
    } else if (hit.kind === 'target') {
      if (this.isHost) this.mission.damageTarget(hit.i, dmg);
      else net.send({ t: 'act', k: 'tdmg', i: hit.i, dmg });
    } else if (hit.kind === 'player') {
      net.send({ t: 'hit', target: hit.ref.id, dmg, head: !!hit.head, w: cls });
    }
    return false;
  }

  enemyKilled(e, killerId, cls, head) {
    this.mission?.onKill(e);
    if (e.T.boss && this.mission) { this.mission.st.bossDead = true; this.h.boss.style.display = 'none'; }
    const m = { t: 'ekill', eid: e.id, killer: killerId, cls, head: !!head, type: e.type, pos: [r2(e.pos.x), r2(e.pos.y), r2(e.pos.z)] };
    if (this.mode === 'coop') net.send(m);
    this.onEnemyKilledMsg(m, true);
  }
  onEnemyKilledMsg(m, local = false) {
    const pos = new THREE.Vector3().fromArray(m.pos);
    this.fx.burst(pos.clone().setY(1), 25, '#ffd23a', 5, 0.7);
    if (!local) { const px = this.proxies.get(m.eid); if (px) { px.dead = true; px.deadT = 0; } }
    if (Math.random() < 0.45) this.spawnPickup(pos);
    const killer = m.killer === this.myId ? 'Du' : this.names.get(m.killer) || 'Verbündeter';
    this.killfeed(killer, ENEMY_TYPES[m.type].name, m.cls === 'grenade' ? 'Granate' : clsShort(m.cls), m.head);
    if (m.killer === this.myId) {
      if (!local) this.hitmarker(true, m.head);
      this.rewardKill(m.cls, m.head, ENEMY_TYPES[m.type].boss, ENEMY_TYPES[m.type].score);
    }
  }
  rewardKill(cls, head, boss, score) {
    const c = this.versus ? 15 : Math.max(10, score || 10);
    const n = c + (head ? 5 : 0);
    this.stats.kills++; if (head) this.stats.heads++;
    this.stats.credits += n;
    addCredits(n);
    this.feed(`+${n} ◆${head ? ' Kopfschuss' : ''}`);
    track('kill', { cls, head: !!head, mode: this.mode, boss: !!boss });
  }

  // ------------------------------------------------------------------ Granaten & Pickups
  throwNade() {
    const p = this.p;
    if (!p.alive || p.nades <= 0 || this.paused) return;
    p.nades--;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const o = this.camera.position.clone().addScaledVector(fwd, 0.5);
    const v = fwd.multiplyScalar(17).add(tmp.set(0, 4, 0)).add(p.vel.clone().setY(0).multiplyScalar(0.5));
    this.spawnNade(o, v, 'local');
    if (this.isNet) net.send({ t: 'nade', o: o.toArray().map(r2), v: v.toArray().map(r2) });
  }
  spawnNade(o, v, owner) {
    const m = new THREE.Mesh(nadeGeo, nadeMat);
    m.position.copy(o);
    this.scene.add(m);
    this.nades.push({ m, pos: o.clone(), vel: v.clone(), fuse: owner === 'enemy' ? 1.8 : 2.2, owner });
  }
  updateNades(dt) {
    const w = this.world;
    for (let i = this.nades.length - 1; i >= 0; i--) {
      const n = this.nades[i];
      n.fuse -= dt;
      n.vel.y -= 20 * dt;
      const next = n.pos.clone().addScaledVector(n.vel, dt);
      const inside = q => q.y < 0.1 || w.query(q.x - 0.1, q.z - 0.1, q.x + 0.1, q.z + 0.1).some(b => q.x > b.x0 && q.x < b.x1 && q.y > b.y0 && q.y < b.y1 && q.z > b.z0 && q.z < b.z1);
      if (inside(next)) {
        if (inside(tmp.set(next.x, n.pos.y, n.pos.z))) n.vel.x *= -0.4;
        if (inside(tmp.set(n.pos.x, next.y, n.pos.z))) { n.vel.y *= -0.35; n.vel.x *= 0.7; n.vel.z *= 0.7; }
        if (inside(tmp.set(n.pos.x, n.pos.y, next.z))) n.vel.z *= -0.4;
      } else n.pos.copy(next);
      if (n.pos.y < 0.1) n.pos.y = 0.1;
      n.m.position.copy(n.pos);
      n.m.rotation.x += dt * 8;
      if (n.fuse <= 0) { this.explode(n); this.scene.remove(n.m); this.nades.splice(i, 1); }
    }
  }
  boom(pos) {
    const d = this.camera.position.distanceTo(pos);
    sfx.sfxExplosion(d);
    this.shake = Math.min(1, this.shake + Math.max(0, 1 - d / 25));
  }
  explode(n) {
    const pos = n.pos, R = 6.5, MAX = 140;
    this.fx.explosion(pos.clone(), 4);
    this.boom(pos);
    const fall = d => d >= R ? 0 : MAX * (1 - d / R);
    const pd = this.p.pos.clone().setY(this.p.pos.y + 1).distanceTo(pos);
    if (this.p.alive && pd < R) {
      if (n.owner === 'enemy') this.takeDamage(fall(pd) * this.diff.dmg * 0.6, pos);
      else if (n.owner === 'local') {
        if (this.versus) net.send({ t: 'hit', target: this.myId, dmg: Math.round(fall(pd) * 0.5), w: 'grenade' });
        else this.takeDamage(fall(pd) * 0.35, pos);
      }
    }
    if (n.owner === 'local') {
      let hit = false, kill = false;
      if (this.versus) {
        for (const r of this.remotes.values()) {
          const d = r.pos.clone().setY(r.pos.y + 1).distanceTo(pos);
          if (r.alive && d < R) { hit = true; net.send({ t: 'hit', target: r.id, dmg: Math.round(fall(d)), w: 'grenade' }); }
        }
      } else {
        const list = this.isHost ? this.enemies : [...this.proxies.values()];
        for (const e of list) {
          if (e.dead) continue;
          const d = e.pos.clone().setY(e.pos.y + 1).distanceTo(pos);
          if (d < R) { hit = true; if (this.damageThing({ kind: 'enemy', ref: e, head: false }, fall(d) * 1.5, 'grenade')) kill = true; }
        }
        for (const t of this.mission?.targetsInRadius(pos, R) || []) this.damageThing({ kind: 'target', i: t.i }, fall(t.d), 'grenade');
      }
      if (hit) this.hitmarker(kill, false);
    }
    if (n.owner === 'enemy' && this.mode === 'coop') {
      for (const r of this.remotes.values()) {
        const d = r.pos.clone().setY(r.pos.y + 1).distanceTo(pos);
        if (r.alive && d < R) net.send({ t: 'edmg', target: r.id, dmg: fall(d) * this.diff.dmg * 0.6, from: [pos.x, pos.z] });
      }
    }
  }
  spawnPickup(pos) {
    const m = new THREE.Mesh(pickGeo, pickMat);
    m.position.copy(pos).setY(pos.y + 0.4);
    this.scene.add(m);
    this.pickups.push({ m, t: 30 });
  }
  pickupSound() { sfx.sfxPickup(); }
  updatePickups(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const k = this.pickups[i];
      k.t -= dt;
      k.m.rotation.y += dt * 2;
      if (this.p.alive && k.m.position.distanceTo(tmp.copy(this.p.pos).setY(this.p.pos.y + 0.4)) < 1.5) {
        for (const w of this.weapons) w.reserve = Math.min(w.s.reserve * 2, w.reserve + w.s.mag);
        if (this.p.nades < 3 && Math.random() < 0.35) this.p.nades++;
        sfx.sfxPickup();
        this.feed('Munition aufgenommen');
        k.t = 0;
      }
      if (k.t <= 0) { this.scene.remove(k.m); this.pickups.splice(i, 1); }
    }
  }

  // ------------------------------------------------------------------ Koop-Synchronisation
  syncProxies(list) {
    const seen = new Set();
    for (const [id, ti, x, y, z, yaw, hp, flags, tid] of list) {
      seen.add(id);
      let px = this.proxies.get(id);
      const type = TYPE_LIST[ti];
      if (!px) {
        const T = ENEMY_TYPES[type];
        px = new Puppet(this.scene, T.color, enemyLook(type));
        px.id = id; px.type = type; px.T = T; px.dead = false;
        this.proxies.set(id, px);
        if (T.boss) { this.boss = px; this.h.boss.style.display = 'block'; }
      }
      px.set([x, y, z], yaw, 0, 0);
      px.hp = hp; px.maxHp = px.T.hp; px.aiming = flags & 1; px.tid = tid;
      if (hp <= 0 && !px.dead) { px.dead = true; px.deadT = 0; }
    }
    for (const [id, px] of this.proxies) if (!seen.has(id) && !px.dead) { px.dead = true; px.deadT = 0; }
  }
  updateProxies(dt) {
    for (const [id, px] of this.proxies) {
      if (px.dead) {
        px.deadT += dt;
        px.model.rotation.x = Math.max(-Math.PI / 2, -px.deadT * 6);
        px.model.position.y = px.pos.y - Math.max(0, px.deadT - 1.2);
        if (px.deadT > 2.4) { px.remove(); this.proxies.delete(id); }
        continue;
      }
      px.update(dt);
    }
  }
  becomeHost() {
    this.isHost = true;
    this.radio('Funk: Du bist jetzt Einsatzleiter (Host).');
    for (const px of this.proxies.values()) {
      if (px.dead) continue;
      const e = new Enemy(this, px.type, px.pos, { id: px.id, hp: px.hp, alert: true, alertPos: this.p.pos });
      e.yaw = px.yaw;
      this.enemies.push(e);
      if (px.T.boss) this.boss = e;
      px.remove();
    }
    this.proxies.clear();
  }
  broadcastMission(force) {
    if (this.mode !== 'coop' || !this.isHost || !this.mission) return;
    if (force || this.msT <= 0) { net.send({ t: 'ms', s: this.mission.serialize() }); this.msT = 1; }
  }

  // ------------------------------------------------------------------ Hauptschleife
  update(dt) {
    if (this.ended) return;
    this.frame = (this.frame || 0) + 1;
    this.time += dt;
    const pauseSim = this.paused && this.mode === 'story';
    if (!pauseSim) {
      this.updatePlayer(dt);
      this.aimbot(dt);
      this.updateWeapon(dt);
      this.updateNades(dt);
      this.updatePickups(dt);
      if (this.isHost) {
        for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].update(dt)) { this.enemies[i].remove(); this.enemies.splice(i, 1); }
      } else this.updateProxies(dt);
      for (const r of this.remotes.values()) r.update(dt);
      this.mission?.update(dt);
      this.br?.update(dt);
      if (this.ended) return;
      this.world.clouds.rotation.y += dt * 0.004;
      this.fx.update(dt);
      this.updateLasers();
    }
    if (this.isNet) this.netTick(dt);
    if (this.ended) return;
    this.updateCamera(dt);
    this.updateViewmodel(dt);
    this.updateHud(dt);
  }

  netTick(dt) {
    this.netT -= dt; this.enT -= dt; this.msT -= dt;
    const p = this.p;
    if (this.netT <= 0) {
      this.netT = 0.05;
      net.send({ t: 'st', p: [r2(p.pos.x), r2(p.pos.y), r2(p.pos.z)], y: r2(p.yaw), x: r2(p.pitch), c: p.crouch > 0.5 ? 1 : 0, a: p.alive, hp: Math.round(p.hp), w: this.weapons[this.cur].id });
    }
    if (this.mode === 'coop' && this.isHost) {
      if (this.enT <= 0) {
        this.enT = 0.1;
        net.send({ t: 'en', l: this.enemies.map(e => [e.id, e.typeIdx, r2(e.pos.x), r2(e.pos.y), r2(e.pos.z), r2(e.yaw), Math.round(e.hp), e.T.sniper && e.aimT > 0 ? 1 : 0, e.target?.id ?? -1]) });
      }
      this.broadcastMission(false);
    }
  }

  updatePlayer(dt) {
    const p = this.p, k = this.input.keys;
    if (!p.alive) {
      if (this.respawnT > 0) { this.respawnT -= dt; if (this.respawnT <= 0) this.respawn(); }
      p.speed = 0;
      return;
    }
    const w = this.weapons[this.cur];
    const fwd = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const side = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    const crouchWant = k.has('KeyC') || k.has('ControlLeft');
    p.crouch += ((crouchWant ? 1 : 0) - p.crouch) * Math.min(1, dt * 12);
    p.sprint = k.has('ShiftLeft') && fwd > 0 && !crouchWant && w.ads < 0.3 && !this.input.fire;
    const cheat = activeCheats();
    let speed = (p.sprint ? 7.6 : 5.2) * w.s.move * cheat.speed;
    if (p.crouch > 0.5) speed = 2.7;
    speed *= 1 - w.ads * 0.4;
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    let mx = -sin * fwd + cos * side, mz = -cos * fwd - sin * side;
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }
    const accel = p.grounded ? 14 : 3;
    p.vel.x += (mx * speed - p.vel.x) * Math.min(1, dt * accel);
    p.vel.z += (mz * speed - p.vel.z) * Math.min(1, dt * accel);
    if (k.has('Space') && p.grounded) { p.vel.y = 7.8 * Math.sqrt(cheat.jump); p.grounded = false; }
    if (p.chute) {
      p.vel.x = mx * 9; p.vel.z = mz * 9;
      p.vel.y = Math.max(p.vel.y, -7);
      if (p.grounded) { p.chute = false; this.feed('Gelandet!'); }
    }
    // in Teilschritten bewegen, damit nichts durch Wände tunnelt
    const steps = Math.ceil(dt / 0.017);
    for (let s = 0; s < steps; s++) p.grounded = this.world.move(p.pos, p.vel, dt / steps, 0.38, 1.8 - p.crouch * 0.6, p.grounded, p.chute ? 4 : 24);
    p.speed = Math.hypot(p.vel.x, p.vel.z);
    if (p.grounded && p.speed > 2) {
      p.stepT -= dt * p.speed;
      if (p.stepT <= 0) { p.stepT = 2.6; if (p.crouch < 0.5) sfx.sfxStep(); }
    }
    // Regeneration (PvP macht das der Server)
    if (!this.versus && this.time - p.hurtT > 4 && p.hp < this.maxHp) p.hp = Math.min(this.maxHp, p.hp + 30 * dt * this.maxHp / 100);
    if (p.pos.y < -5) this.respawn();
  }

  updateWeapon(dt) {
    const w = this.weapons[this.cur], s = w.s, p = this.p;
    w.cool -= dt;
    w.bloom = Math.max(0, w.bloom - dt * 5);
    w.kick = Math.max(0, w.kick - dt * 9);
    this.recoil.pitch *= Math.exp(-dt * 10); this.recoil.yaw *= Math.exp(-dt * 10);
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) { this.muzzleFlash.visible = false; this.flashLight.intensity = 0; } }
    if (this.switchT > 0) { this.switchT -= dt; w.ads = 0; return; }
    if (w.reloadT > 0) {
      w.reloadT -= dt;
      if (w.reloadT <= 0) { const take = Math.min(s.mag - w.ammo, w.reserve); w.ammo += take; w.reserve -= take; }
    }
    const adsWant = this.input.ads && p.alive && !p.sprint && w.reloadT <= 0 ? 1 : 0;
    w.ads = Math.max(0, Math.min(1, w.ads + (adsWant ? 1 : -1) * dt / s.adsTime));
    if (!p.alive || this.paused) return;
    if (this.input.fire && !p.sprint && w.reloadT <= 0) {
      if (w.ammo <= 0) {
        if (!w.latched) { sfx.sfxEmpty(); w.latched = true; this.reload(); }
      } else if (w.cool <= 0 && (s.mode === 'auto' || !w.latched)) {
        this.fire();
        w.latched = true;
      }
    }
    if (!this.input.fire) w.latched = false;
  }

  updateCamera(dt) {
    const p = this.p, w = this.weapons[this.cur];
    const cam = this.camera;
    // Kamerahöhe glätten, damit Stufen/Kanten nicht ruckeln
    const targetY = p.pos.y + this.eyeH();
    if (this.camY === undefined || !p.grounded || Math.abs(targetY - this.camY) > 0.8) this.camY = targetY;
    else this.camY += (targetY - this.camY) * Math.min(1, dt * 15);
    cam.position.set(p.pos.x, this.camY, p.pos.z);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2);
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.12;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.12;
    }
    if (!p.alive) cam.position.y = p.pos.y + 0.5;
    cam.rotation.y = p.yaw + this.recoil.yaw;
    cam.rotation.x = p.pitch + this.recoil.pitch;
    cam.rotation.z = !p.alive ? 0.4 : 0;
    if (this.spectating && this.br) { cam.rotation.z = 0; this.br.spectate(cam); }
    const base = THREE.MathUtils.degToRad(profile.settings.fov);
    const z = 1 + (w.s.zoom - 1) * easeInOut(w.ads);
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(base / 2) / z)) * (p.sprint ? 1.06 : 1);
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    // Schatten folgen dem Spieler
    this.sun.position.set(p.pos.x + 30, 60, p.pos.z + 20);
    this.sun.target.position.set(p.pos.x, 0, p.pos.z);
  }

  updateViewmodel(dt) {
    const w = this.weapons[this.cur], p = this.p, g = w.model;
    const ads = easeInOut(w.ads);
    const pistol = w.s.cls === 'pistol';
    const hip = pistol ? [0.16, -0.17, -0.42] : [0.19, -0.19, -0.5];
    const sightY = g.userData.sightY;
    const adsP = [0, -sightY, pistol ? -0.38 : -0.4];
    this.bob += dt * p.speed * 1.5 * (p.grounded ? 1 : 0);
    const bobA = Math.min(1, p.speed / 6) * (1 - ads * 0.9);
    this.sway.x *= Math.exp(-dt * 8); this.sway.y *= Math.exp(-dt * 8);
    let x = THREE.MathUtils.lerp(hip[0], adsP[0], ads) + Math.sin(this.bob) * 0.012 * bobA - this.sway.x * 0.02 * (1 - ads);
    let y = THREE.MathUtils.lerp(hip[1], adsP[1], ads) + Math.abs(Math.cos(this.bob)) * 0.01 * bobA + this.sway.y * 0.015 * (1 - ads);
    let zz = THREE.MathUtils.lerp(hip[2], adsP[2], ads) + w.kick * 0.045;
    let rx = w.kick * 0.09 * (1 - ads * 0.6), ry = 0, rz = 0;
    if (p.sprint) { ry = 0.6; rx -= 0.25; y -= 0.04; x -= 0.03; }
    if (w.reloadT > 0) {
      const t = 1 - w.reloadT / w.s.reload;
      const a = Math.sin(t * Math.PI);
      rz = a * 0.7; y -= a * 0.06; rx += a * 0.2;
      const mag = g.userData.mag;
      mag.position.y = mag.userData.baseY - (t > 0.2 && t < 0.7 ? 0.25 : 0);
    } else g.userData.mag.position.y = g.userData.mag.userData.baseY;
    if (this.switchT > 0) y -= this.switchT * 0.6;
    if (!p.alive) y -= 0.5;
    g.visible = !this.spectating;
    g.position.set(x, y, zz);
    g.rotation.set(rx, ry, rz);
    const scoped = w.s.scope && w.ads > 0.92;
    g.visible = !scoped && !this.spectating;
    this.h.scope.style.display = scoped ? 'block' : 'none';
    this.h.cross.style.display = scoped || ads > 0.6 ? 'none' : 'block';
  }

  updateLasers() {
    const list = [];
    if (this.isHost) {
      for (const e of this.enemies) if (!e.dead && e.T.sniper && e.aimT > 0 && e.target) list.push([e.eye(new THREE.Vector3()), e.target.eye.clone()]);
    } else {
      for (const px of this.proxies.values()) {
        if (px.dead || !px.aiming) continue;
        const a = px.pos.clone().setY(px.pos.y + 1.6);
        let b;
        if (px.tid === this.myId) b = this.camera.position.clone().setY(this.camera.position.y - 0.2);
        else { const r = this.remotes.get(px.tid); b = r ? r.pos.clone().setY(r.pos.y + 1.4) : a.clone().add(tmp.set(-Math.sin(px.yaw) * 40, 0, -Math.cos(px.yaw) * 40)); }
        list.push([a, b]);
      }
    }
    if (list.length && Math.random() < 0.05) sfx.sfxLaser(this.camera.position.distanceTo(list[0][0]), 0);
    this.fx.setLasers(list);
  }

  updateHud(dt) {
    const p = this.p, w = this.weapons[this.cur], h = this.h;
    h.hpI.style.width = Math.max(0, Math.min(100, p.hp / (this.maxHp || 100) * 100)) + '%';
    this.updateEsp();
    h.hpI.style.background = p.hp > 60 ? '#5dff8a' : p.hp > 30 ? '#ffd23a' : '#ff4a3a';
    h.hpS.textContent = Math.max(0, Math.ceil(p.hp));
    h.lives.textContent = this.mode === 'story' ? '♥'.repeat(Math.max(0, p.lives)) : '';
    h.armor.style.display = this.mode === 'br' ? 'block' : 'none';
    h.armorI.style.width = Math.max(0, p.armor || 0) + '%';
    h.ammoB.textContent = w.ammo;
    h.ammoS.textContent = '/ ' + w.reserve;
    h.ammoB.style.color = w.ammo <= Math.ceil(w.s.mag * 0.25) ? '#ff6a4a' : '';
    h.nades.textContent = '● '.repeat(p.nades) + ' Granaten';
    h.reload.style.display = w.reloadT > 0 ? 'block' : 'none';
    let vig = parseFloat(h.vig.style.opacity) || 0;
    if (this.time - p.hurtT > 0.3) vig = Math.max(0, vig - dt * 1.5);
    if (p.hp < 30 && p.alive) vig = Math.max(vig, 0.3 + Math.sin(this.time * 6) * 0.1);
    h.vig.style.opacity = vig;
    // Fadenkreuz
    const sp = THREE.MathUtils.degToRad(this.currentSpread());
    const px = Math.tan(sp) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * innerHeight / 2;
    const gap = Math.max(4, Math.min(120, px));
    const [t, b, l, r] = h.cross.children;
    t.style.transform = `translate(-50%, ${-gap - 10}px)`;
    b.style.transform = `translate(-50%, ${gap}px)`;
    l.style.transform = `translate(${-gap - 10}px, -50%)`;
    r.style.transform = `translate(${gap}px, -50%)`;
    // Ziel / Timer
    if (this.mission) h.obj.textContent = this.mission.text();
    if (this.mode === 'pvp') {
      const left = Math.max(0, this.endAt - Date.now()) / 1000;
      const me = this.scores.get(this.myId);
      h.timer.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}   Kills: ${me ? me.kills : 0}/20`;
      h.obj.textContent = 'LAN-PvP · Jeder gegen jeden';
    }
    if (this.mode === 'br') h.obj.textContent = 'Battle Royale';
    if (this.boss) {
      const hp = this.boss.hp, max = this.boss.maxHp || this.boss.T.hp;
      h.bossI.style.width = Math.max(0, hp / max * 100) + '%';
      if (hp <= 0 || this.boss.dead) h.boss.style.display = 'none';
    }
    // Marker
    const marks = this.mission ? this.mission.markers() : [];
    if (this.mission?.obj?.type === 'kill') {
      const list = this.isHost ? this.enemies.filter(e => !e.dead) : [...this.proxies.values()].filter(e => !e.dead);
      const rel = this.mission.obj.only ? list.filter(e => e.type === this.mission.obj.only) : list;
      if (rel.length <= 3 || this.mission.obj.only) rel.forEach(e => marks.push({ pos: e.pos.clone().setY(e.pos.y + 2.4 * e.scale), label: '', enemy: true }));
    }
    while (this.markerPool.length < marks.length) { const d = document.createElement('div'); d.className = 'marker'; h.markers.appendChild(d); this.markerPool.push(d); }
    this.markerPool.forEach((d, i) => {
      const m = marks[i];
      if (!m) { d.style.display = 'none'; return; }
      const v = m.pos.clone().project(this.camera);
      let sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight;
      if (v.z > 1) { sx = innerWidth - sx; sy = innerHeight - 40; }
      sx = Math.max(30, Math.min(innerWidth - 30, sx)); sy = Math.max(60, Math.min(innerHeight - 60, sy));
      d.style.display = 'block';
      d.style.transform = `translate(${sx}px, ${sy}px)`;
      d.className = m.enemy ? 'marker enemy' : 'marker';
      d.textContent = m.enemy ? '' : `${m.label} ${Math.round(this.p.pos.distanceTo(m.pos))} m`;
    });
    // FPS
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 0.5) { h.fps.textContent = Math.round(this.fpsN / this.fpsAcc) + ' FPS'; this.fpsAcc = 0; this.fpsN = 0; }
  }

  // ESP: Rahmen mit Name, Entfernung und Lebensbalken über allen Gegnern
  updateEsp() {
    const c = activeCheats();
    if (!this.espPool) this.espPool = [];
    const list = c.esp ? this.cheatTargets() : [];
    while (this.espPool.length < list.length) {
      const d = document.createElement('div');
      d.className = 'esp';
      d.innerHTML = '<span></span><i><b></b></i>';
      this.h.markers.appendChild(d);
      this.espPool.push(d);
    }
    const top = new THREE.Vector3(), bot = new THREE.Vector3();
    this.espPool.forEach((d, i) => {
      const t = list[i];
      if (!t) { d.style.display = 'none'; return; }
      top.set(t.pos.x, t.pos.y + 1.9 * t.scale, t.pos.z).project(this.camera);
      bot.set(t.pos.x, t.pos.y, t.pos.z).project(this.camera);
      if (top.z > 1 || bot.z > 1) { d.style.display = 'none'; return; }
      const y0 = (-top.y * 0.5 + 0.5) * innerHeight, y1 = (-bot.y * 0.5 + 0.5) * innerHeight;
      const hgt = Math.max(8, y1 - y0), wid = hgt * 0.45, x = (top.x * 0.5 + 0.5) * innerWidth;
      d.style.display = 'block';
      d.style.transform = `translate(${x - wid / 2}px, ${y0}px)`;
      d.style.width = wid + 'px'; d.style.height = hgt + 'px';
      d.firstChild.textContent = `${t.name} · ${Math.round(this.p.pos.distanceTo(t.pos))} m`;
      d.lastChild.firstChild.style.height = Math.max(0, Math.min(100, t.hp / t.max * 100)) + '%';
    });
  }

  showScores(show) {
    const h = this.h;
    if (!show) { h.score.style.display = 'none'; return; }
    let rows;
    if (this.versus) {
      rows = [...this.names.entries()].map(([id, name]) => ({ name, ...(this.scores.get(id) || { kills: 0, deaths: 0 }) })).sort((a, b) => b.kills - a.kills);
      h.score.innerHTML = `<h3>Punktestand</h3><table><tr><th>Spieler</th><th>Kills</th><th>Tode</th></tr>${rows.map(r => `<tr><td>${esc(r.name)}</td><td>${r.kills}</td><td>${r.deaths}</td></tr>`).join('')}</table>`;
    } else {
      h.score.innerHTML = `<h3>${esc(this.opts.mission.name)}</h3><p>Deine Kills: ${this.stats.kills} · Kopfschüsse: ${this.stats.heads} · Verdient: ${this.stats.credits} ◆</p>
        <p>Team: ${[...this.names.values()].map(esc).join(', ') || 'nur du'}</p>`;
    }
    h.score.style.display = 'block';
  }

  render() {
    const r = this.app.renderer;
    r.autoClear = true;
    r.render(this.scene, this.camera);
    if (activeCheats().wallhack) {
      r.autoClear = false;
      const bg = this.scene.background, fog = this.scene.fog;
      this.scene.overrideMaterial = xrayMat; this.scene.fog = null;
      this.camera.layers.set(1);
      r.render(this.scene, this.camera);
      this.camera.layers.set(0);
      this.scene.overrideMaterial = null; this.scene.fog = fog; this.scene.background = bg;
    }
    r.autoClear = false;
    r.clearDepth();
    r.render(this.vmScene, this.vmCam);
    r.autoClear = true;
  }

  // ------------------------------------------------------------------ Ende
  missionComplete() {
    if (this.ended) return;
    if (this.mode === 'coop' && this.isHost) { net.send({ t: 'mdone' }); net.send({ t: 'stop' }); }
    const def = this.opts.mission;
    const mult = this.diff.reward * (this.mode === 'coop' ? 1.2 : 1);
    const reward = Math.round(def.reward * mult), xp = Math.round(def.xp * mult + this.stats.kills * 20);
    sfx.sfxUI('win');
    this.finish({ type: 'mission', success: true, mission: def, reward, xp, stats: this.stats, coop: this.mode === 'coop' });
  }
  missionFailed(reason) {
    if (this.ended) return;
    if (this.mode === 'coop' && this.isHost) setTimeout(() => net.send({ t: 'stop' }), 300);
    this.finish({ type: 'mission', success: false, mission: this.opts.mission, reason, xp: this.stats.kills * 20, stats: this.stats, coop: this.mode === 'coop' });
  }
  pvpEnd(ranking) {
    this.finish({ type: 'pvp', ranking, myId: this.myId, stats: this.stats });
  }
  quit() {
    if (this.mode === 'coop' && this.isHost && this.remotes.size) net.send({ t: 'stop' });
    if (this.mode === 'br') {
      if (this.p.alive) net.send({ t: 'forfeit' });
      return this.finish({ type: 'br', ranking: null, place: this.brPlace || this.br?.alive || 99, total: this.names.size, myId: this.myId, stats: this.stats });
    }
    this.finish({ type: 'quit' });
  }
  finish(result) {
    if (this.ended) return;
    this.ended = true;
    this.unbindInput();
    this.netOffs?.forEach(off => off());
    if (document.pointerLockElement) document.exitPointerLock();
    clearTimeout(this.centerTO); clearTimeout(this.radioTO);
    document.getElementById('hud').style.display = 'none';
    document.getElementById('hud').innerHTML = '';
    this.h = null;
    this.mission?.dispose();
    this.br?.dispose();
    this.fx.dispose();
    this.world.group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    if (this.sun.shadow.map) this.sun.shadow.map.dispose();
    this.app.onGameEnd(result);
  }
}

const xrayMat = new THREE.MeshBasicMaterial({ color: 0xff2a6a, transparent: true, opacity: 0.45, depthTest: false, depthWrite: false });
const nadeGeo = new THREE.IcosahedronGeometry(0.12, 0);
const nadeMat = new THREE.MeshLambertMaterial({ color: 0x3f5a2a });
const pickGeo = new THREE.BoxGeometry(0.5, 0.35, 0.35);
const pickMat = new THREE.MeshLambertMaterial({ color: 0x4a7a2a, emissive: 0x2a4a10 });
function r2(v) { return Math.round(v * 100) / 100; }
function easeInOut(t) { return t * t * (3 - 2 * t); }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function clsShort(c) { return { ar: 'Sturmgewehr', smg: 'MP', dmr: 'DMR', shotgun: 'Schrot', lmg: 'LMG', sniper: 'Sniper', pistol: 'Pistole', grenade: 'Granate' }[c] || c; }
