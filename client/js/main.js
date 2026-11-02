// Menüs (Story, Multiplayer-Lobby, Waffenschmiede, Skin-Editor, Shop, Kisten, Quests, Einstellungen) und Render-Schleife.
import * as THREE from 'three';
import { WEAPONS, ATTACHMENTS, ATTACH_SLOTS, SKINS, RARITY, PATTERNS, CASES, MISSIONS, MAPS, CHAR_ITEMS, levelInfo } from './data.js';
import {
  profile, save, addCredits, addXP, spend, build, skinDef, missionUnlocked, track, allQuests, questState, claimQuest,
  claimableCount, setToast, onProfileChange, resetProfile,
} from './profile.js';
import { buildGunModel, weaponStats } from './weapon.js';
import { skinPreviewCanvas } from './skins.js';
import { Game } from './game.js';
import { net } from './net.js';
import * as sfx from './audio.js';
import { characterMenus, cheatPanel, charCase } from './charmenu.js';
import { lookFromProfile } from './profile.js';
import { animateSoldier } from './actors.js';
import { loadCharacters } from './characters.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const QUALITY = {
  niedrig: { ratio: 0.7, shadows: false, shadowSize: 512, aa: false },
  mittel: { ratio: 1, shadows: true, shadowSize: 1024, aa: false },
  hoch: { ratio: Math.min(devicePixelRatio, 2), shadows: true, shadowSize: 2048, aa: true },
};

class App {
  constructor() {
    this.quality = QUALITY[profile.settings.quality] || QUALITY.mittel;
    this.renderer = new THREE.WebGLRenderer({ antialias: this.quality.aa, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.quality.ratio);
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = this.quality.shadows;
    this.renderer.shadowMap.type = this.quality.aa ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    document.body.prepend(this.renderer.domElement);
    addEventListener('resize', () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.menuCam.aspect = innerWidth / innerHeight; this.menuCam.updateProjectionMatrix();
    });
    this.game = null;
    this.room = null;
    this.setupMenuScene();
    setToast(t => this.toast(t));
    onProfileChange(() => this.topbar());
    sfx.setVolume(profile.settings.volume);
    addEventListener('pointerdown', () => sfx.initAudio(), { once: false });
    $('#resume').onclick = () => this.game?.lock();
    $('#quit').onclick = () => { this.showPause(false); this.game?.quit(); };
    $('#psens').oninput = e => { profile.settings.sens = +e.target.value; save(); };
    $('#pcheats').onclick = () => {
      const el = $('#pcheatpanel');
      el.style.display = el.style.display === 'block' ? 'none' : 'block';
      if (el.style.display === 'block') cheatPanel(el, () => this.game?.cheatsChanged());
    };
    this.topbar();
    this.home();
    $('#loading').remove();
    let last = performance.now();
    const loop = now => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (this.game && !this.game.ended) { this.game.update(dt); if (this.game && !this.game.ended) this.game.render(); }
      else this.renderMenu(dt);
    };
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------ Menü-Hintergrund mit Waffenvorschau
  setupMenuScene() {
    const s = new THREE.Scene();
    s.background = new THREE.Color('#141c2e');
    s.fog = new THREE.Fog('#141c2e', 4, 12);
    s.add(new THREE.HemisphereLight('#bcd8ff', '#3a2a20', 1.6));
    const d = new THREE.DirectionalLight('#ffe8c8', 2.2); d.position.set(2, 3, 2); s.add(d);
    const r = new THREE.DirectionalLight('#ff7a1a', 1.2); r.position.set(-3, 1, -2); s.add(r);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.2, 8), new THREE.MeshLambertMaterial({ color: '#232c42', flatShading: true }));
    floor.position.set(0, -0.75, 0); s.add(floor);
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(0.07 + Math.random() * 0.06, 0.6, 0.25 + Math.random() * 0.2) }));
      const a = Math.PI + Math.random() * Math.PI, rad = 3 + Math.random() * 5;
      m.position.set(Math.cos(a) * rad, -0.8 + Math.random() * 0.5, Math.sin(a) * rad - 2);
      m.scale.set(0.4 + Math.random(), 0.3 + Math.random() * 2, 0.4 + Math.random());
      m.rotation.y = Math.random() * 3;
      s.add(m);
    }
    this.menuScene = s;
    this.menuCam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 50);
    this.menuCam.position.set(-0.9, 0.35, 3.0);
    this.menuCam.lookAt(0, 0, 0);
    this.preview = new THREE.Group();
    s.add(this.preview);
    this.showWeapon(profile.loadout.primary);
  }
  showWeapon(id, b = build(id), skin = skinDef(profile.weaponSkin[id])) {
    this.preview.clear();
    this.previewKind = 'weapon';
    this.menuCam.position.set(-0.9, 0.35, 3.0);
    this.menuCam.lookAt(0, 0, 0);
    const g = buildGunModel(id, b, skin);
    g.scale.setScalar(1.7);
    g.position.set(0, 0, 0.6);
    const box = new THREE.Box3().setFromObject(g);
    const c = box.getCenter(new THREE.Vector3());
    g.position.sub(c);
    this.preview.add(g);
  }
  renderMenu(dt) {
    if (this.previewKind === 'char') {
      const t = performance.now() / 1000;
      this.preview.rotation.y = Math.PI + 0.35 + Math.sin(t * 0.4) * 0.45; // Gesicht zur Kamera
      this.preview.position.y = 0;
      animateSoldier(this.previewSoldier, 0, dt, Math.sin(t * 0.7) * 0.05);
      if (this.previewSoldier.userData.upper) this.previewSoldier.userData.upper.position.y += Math.sin(t * 2) * 0.006; // Atmen
    } else {
      this.preview.rotation.y += dt * 0.5;
      this.preview.position.y = Math.sin(performance.now() / 900) * 0.04;
    }
    // Waffe rechts vom Menü platzieren
    const panelW = $('#menu').offsetWidth + 22;
    const frac = Math.min(0.8, (panelW + (innerWidth - panelW) / 2) / innerWidth);
    this.menuCam.setViewOffset(innerWidth, innerHeight, (0.5 - frac) * innerWidth, 0, innerWidth, innerHeight);
    this.renderer.render(this.menuScene, this.menuCam);
  }

  topbar() {
    const L = levelInfo(profile.xp);
    const q = claimableCount();
    $('#topbar').innerHTML = `<div class="logo">EMBER<span>FALL</span></div><div class="spacer"></div>
      <div class="chip">${esc(profile.name)}</div>
      <div class="chip">Stufe ${L.lvl} · ${L.rank}<span class="xpbar"><i style="width:${(L.rest / L.need * 100).toFixed(0)}%"></i></span></div>
      <div class="chip credits">◆ ${profile.credits} Splitter</div>${q ? `<div class="chip" style="color:#5dff8a">${q} Quest${q > 1 ? 's' : ''} abholbereit</div>` : ''}`;
  }
  toast(text) {
    const d = document.createElement('div');
    d.textContent = text;
    $('#toast').appendChild(d);
    setTimeout(() => d.remove(), 4000);
  }
  menu(html, wide = false) {
    const m = $('#menu');
    m.style.display = 'block';
    m.className = wide ? 'wide' : '';
    m.innerHTML = html;
    m.scrollTop = 0;
    m.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { sfx.sfxUI(); this[b.dataset.go](); });
    return m;
  }

  // ------------------------------------------------------------ Hauptmenü
  home() {
    this.showCharacter();
    const q = claimableCount();
    this.menu(`<h2>Hauptquartier Morgenrot</h2>
      <p class="dim">Das Rost-Syndikat baut eine Superwaffe – den Glutkern. Halte sie auf: allein, im Team oder trainiere gegen Freunde im LAN.</p>
      <div class="navgrid">
        <button class="big primary" data-go="story">▶ Story-Kampagne<small style="color:#4a2000">5 Missionen gegen das Rost-Syndikat</small></button>
        <button data-go="lobby">🤝 Koop & LAN-PvP<small>Mit Freunden im selben Netzwerk</small></button>
        <button data-go="quests">📜 Quests${q ? `<span class="badge">${q}</span>` : ''}<small>Aufträge & Tagesaufträge</small></button>
        <button data-go="charakter">🪖 Charakter<small>Outfit anpassen & freischalten</small></button>
        <button data-go="loadout">🔧 Waffenschmiede<small>Loadout, Aufsätze, Skins</small></button>
        <button data-go="skinEditor">🎨 Skin-Editor<small>Eigene Lackierungen</small></button>
        <button data-go="shop">🛒 Shop<small>Waffen, Aufsätze, Ausrüstung, Codes</small></button>
        <button data-go="cases">📦 Waffenkisten<small>Skins mit Splittern</small></button>
        <button data-go="settings">⚙ Einstellungen<small>Steuerung, Grafik, Name</small></button>
        <button data-go="help">❓ Steuerung<small>Tasten & Tipps</small></button>
        ${profile.cheatsUnlocked ? '<button data-go="cheats">🕹 Cheats<small>Wallhack, Aimbot & mehr</small></button>' : ''}
      </div>
      <p class="dim" style="margin-top:14px">Alle Belohnungen gibt es nur im Spiel – kein Echtgeld. Fortschritt wird in diesem Browser gespeichert.</p>`);
  }

  help() {
    this.menu(`<button class="back small" data-go="home">← Zurück</button><h2>Steuerung</h2>
      <table>
      <tr><td>W A S D</td><td>Laufen</td></tr><tr><td>Maus</td><td>Umsehen</td></tr><tr><td>Linksklick</td><td>Schießen</td></tr>
      <tr><td>Rechtsklick (halten)</td><td>Zielen / Zoom</td></tr><tr><td>R</td><td>Nachladen</td></tr><tr><td>1 / 2 / Q / Mausrad</td><td>Waffe wechseln</td></tr>
      <tr><td>G</td><td>Granate werfen</td></tr><tr><td>Shift</td><td>Sprinten</td></tr><tr><td>C</td><td>Ducken (genauer)</td></tr><tr><td>Leertaste</td><td>Springen</td></tr>
      <tr><td>Tab</td><td>Punktestand</td></tr><tr><td>Esc</td><td>Pause / Maus freigeben</td></tr></table>
      <p class="dim">Tipps: Leben regeneriert sich nach ein paar Sekunden ohne Treffer. Gegner lassen Munitionskisten fallen. Rote Laser = Scharfschütze zielt auf dich – in Deckung! Schalldämpfer machen dich für Gegner schwerer hörbar.</p>`);
  }

  // ------------------------------------------------------------ Story
  story(sel = this.storySel ?? MISSIONS.findIndex((m, i) => missionUnlocked(i) && !profile.missions[m.id]?.done)) {
    if (sel < 0) sel = 0;
    this.storySel = sel;
    const m = MISSIONS[sel];
    const list = MISSIONS.map((x, i) => {
      const un = missionUnlocked(i), done = profile.missions[x.id]?.done;
      return `<div class="card ${i === sel ? 'sel' : ''} ${un ? '' : 'locked'}" data-m="${i}" style="cursor:${un ? 'pointer' : 'default'}">
        <b>${i + 1}. ${esc(x.name)}</b> ${done ? '<span style="color:#5dff8a">✔ abgeschlossen</span>' : un ? '' : '🔒'}
        <div class="dim">${esc(MAPS[x.map].name)} · Belohnung ${x.reward} ◆</div></div>`;
    }).join('');
    const menu = this.menu(`<button class="back small" data-go="home">← Zurück</button><h2>Story-Kampagne</h2>${list}
      <div class="card"><h3>${esc(m.name)}</h3><p>${esc(m.brief)}</p>
      <div class="dim">Ziele: ${m.objectives.map(o => esc(o.text)).join(' → ')}</div>
      <div class="row" style="margin-top:10px">Schwierigkeit:
        <select id="diff">${['leicht', 'normal', 'schwer'].map(d => `<option ${profile.settings.difficulty === d ? 'selected' : ''} value="${d}">${d[0].toUpperCase() + d.slice(1)}</option>`).join('')}</select>
        <span class="dim">Schwer = 1,5× Belohnung</span></div>
      <div class="row" style="margin-top:12px"><button class="primary" id="go" ${missionUnlocked(sel) ? '' : 'disabled'}>Mission starten</button>
      <span class="dim">Du hast 3 Leben.</span></div></div>`);
    menu.querySelectorAll('[data-m]').forEach(c => c.onclick = () => { if (missionUnlocked(+c.dataset.m)) { sfx.sfxUI(); this.story(+c.dataset.m); } });
    $('#diff').onchange = e => { profile.settings.difficulty = e.target.value; save(); };
    $('#go').onclick = () => this.startGame({ mode: 'story', mission: m, mapId: m.map });
  }

  startGame(opts) {
    sfx.initAudio();
    this.inLobby = false; this.inRoom = false;
    $('#menu').style.display = 'none';
    $('#topbar').style.display = 'none';
    this.game = new Game(this, opts);
    this.game.lock();
  }

  showPause(show) {
    $('#pause').style.display = show && this.game && !this.game.ended ? 'flex' : 'none';
    $('#psens').value = profile.settings.sens;
    $('#pcheats').style.display = profile.cheatsUnlocked ? 'block' : 'none';
    if (!show) $('#pcheatpanel').style.display = 'none';
    $('#pausenote').textContent = this.game?.mode === 'story' ? 'Das Spiel ist pausiert.' : 'Achtung: Im Multiplayer läuft das Spiel weiter!';
  }

  onGameEnd(r) {
    this.game = null;
    this.showPause(false);
    $('#topbar').style.display = 'flex';
    let html = '';
    if (r.type === 'mission') {
      const st = r.stats;
      if (r.success) {
        const firstTime = !profile.missions[r.mission.id]?.done;
        profile.missions[r.mission.id] = { done: true };
        const bonus = firstTime ? Math.round(r.reward * 0.5) : 0;
        const unlocked = Object.values(CHAR_ITEMS).filter(it => it.mission === r.mission.id).map(it => it.name);
        addCredits(r.reward + bonus);
        addXP(r.xp);
        track('mission', { id: r.mission.id, coop: !!r.coop });
        track('storyDone', { count: MISSIONS.filter(m => profile.missions[m.id]?.done).length });
        html = `<h2 style="color:#5dff8a">Mission erfüllt: ${esc(r.mission.name)}</h2>
          <p>Belohnung: <b>${r.reward} ◆</b>${bonus ? ` + Erstabschluss-Bonus <b>${bonus} ◆</b>` : ''} · <b>${r.xp} XP</b></p>
          <p class="dim">Kills: ${st.kills} · Kopfschüsse: ${st.heads} · Kill-Splitter: ${st.credits} ◆ · Tode: ${st.deaths}</p>
          ${firstTime && unlocked.length ? `<p>🪖 Neue Ausrüstung freigeschaltet: <b>${unlocked.map(esc).join(', ')}</b> – im Menü „Charakter“ anlegen!</p>` : ''}
          ${r.mission.id === 'm5' ? '<p>Der Glutkern ist erloschen. Rostzahn ist besiegt – Rostbucht ist frei! Danke, Rekrut. 🎖</p>' : ''}`;
      } else {
        addXP(r.xp);
        html = `<h2 style="color:#ff6a4a">Mission gescheitert</h2><p>${esc(r.reason || '')}</p><p class="dim">Kills: ${st.kills} · Splitter aus Kills behältst du: ${st.credits} ◆</p>`;
      }
    } else if (r.type === 'pvp') {
      const me = r.ranking.findIndex(p => p.id === r.myId);
      const win = me === 0 && r.ranking.length > 1;
      const reward = 50 + (win ? 200 : 0);
      addCredits(reward);
      addXP(150 + r.stats.kills * 30 + (win ? 300 : 0));
      track('pvpPlayed');
      if (win) { track('pvpWin'); profile.stats.pvpWins++; save(); }
      html = `<h2>${win ? '🏆 Sieg!' : 'Match beendet'}</h2><p>Du bist Platz <b>${me + 1}</b> von ${r.ranking.length}. Belohnung: <b>${reward} ◆</b> (+ Kill-Splitter)</p>
        <table><tr><th>#</th><th>Spieler</th><th>Kills</th><th>Tode</th></tr>${r.ranking.map((p, i) => `<tr style="${p.id === r.myId ? 'color:#ffd23a' : ''}"><td>${i + 1}</td><td>${esc(p.name)}</td><td>${p.kills}</td><td>${p.deaths}</td></tr>`).join('')}</table>`;
    } else if (r.type === 'br') {
      const mine = r.ranking?.find(p => p.id === r.myId);
      const place = mine ? mine.place : r.place || 99;
      const total = r.total || (r.ranking ? r.ranking.length : 1);
      const win = place === 1 && total > 1;
      const reward = total <= 1 ? 30 : win ? 400 : place <= 3 ? 150 : 60; // allein = nur Training
      addCredits(reward, 'Battle Royale');
      addXP(100 + r.stats.kills * 40 + (win ? 400 : 0));
      track('brPlayed');
      if (win) track('brWin');
      html = `<h2>${win ? '🏆 Letzter Überlebender!' : 'Battle Royale beendet'}</h2>
        <p>Platz <b>${place < 99 ? place : '–'}</b> von ${total} · Kills: ${r.stats.kills} · Belohnung: <b>${reward} ◆</b> (+ Kill-Splitter)</p>
        ${r.ranking ? `<table><tr><th>Platz</th><th>Spieler</th><th>Kills</th></tr>${r.ranking.map(p => `<tr style="${p.id === r.myId ? 'color:#ffd23a' : ''}"><td>${p.place < 99 ? p.place : '–'}</td><td>${esc(p.name)}</td><td>${p.kills}</td></tr>`).join('')}</table>` : '<p class="dim">Du hast die Runde vorzeitig verlassen.</p>'}`;
    } else if (r.type === 'error') {
      html = `<h2>Runde beendet</h2><p>${esc(r.msg)}</p>`;
    } else {
      if (!this.room) return this.home();
      return this.roomView();
    }
    const back = this.room ? `<button class="primary" data-go="roomView">Zurück zur Lobby</button>` : r.type === 'mission' ? `<button class="primary" data-go="story">Zur Kampagne</button>` : '';
    this.menu(`${html}<div class="row" style="margin-top:16px">${back}<button data-go="home">Hauptmenü</button><button data-go="quests">Quests</button></div>`);
  }

  // ------------------------------------------------------------ Multiplayer
  async lobby() {
    this.menu(`<button class="back small" data-go="home">← Zurück</button><h2>Koop & LAN-PvP</h2><p>Verbinde mit dem Server …</p>`);
    try {
      await net.connect(profile.name);
    } catch (e) {
      this.menu(`<button class="back small" data-go="home">← Zurück</button><h2>Koop & LAN-PvP</h2>
        <p style="color:#ff6a4a">Keine Verbindung zum Server.</p><p class="dim">Starte das Spiel mit <b>npm start</b> (oder start.bat) und öffne die Adresse, die im Server-Fenster angezeigt wird.</p>`);
      return;
    }
    if (!this.netBound) this.bindLobby();
    net.send({ t: 'hello', name: profile.name, look: lookFromProfile() });
    if (this.room) return this.roomView();
    net.send({ t: 'list' });
    this.roomsView([]);
  }

  bindLobby() {
    this.netBound = true;
    net.on('rooms', m => { this.rooms = m.rooms; if (!this.room && !this.game && this.inLobby) this.roomsView(m.rooms); });
    net.on('joined', m => { this.room = m.room; this.roomView(); });
    net.on('room', m => { this.room = m.room; if (!this.game && this.inRoom) this.roomView(); });
    net.on('error', m => this.toast(m.msg));
    net.on('host', m => { if (this.room) this.room.host = m.id; });
    net.on('started', m => {
      if (this.game) return;
      this.room = m.room;
      const r = m.room;
      const mission = MISSIONS.find(x => x.id === r.mission) || MISSIONS[0];
      this.startGame({ mode: r.mode, mission, mapId: r.mode === 'coop' ? mission.map : r.map, isHost: r.host === net.id, room: r, endAt: m.endAt, serverNow: m.now, seed: m.seed, zone: m.zone, taken: m.taken, late: !!m.late });
    });
    net.on('close', () => { this.room = null; if (!this.game) { this.toast('Verbindung zum Server getrennt.'); this.home(); } });
  }

  roomsView(rooms = this.rooms || []) {
    this.inLobby = true; this.inRoom = false;
    const host = location.host;
    const list = rooms.length ? rooms.map(r => `<div class="card row" style="justify-content:space-between">
        <div><b>${esc(r.name)}</b> <span class="dim">${r.mode === 'br' ? '🪂 Battle Royale · ' + esc(MAPS[r.map]?.name || '') : r.mode === 'pvp' ? '⚔ PvP · ' + esc(MAPS[r.map]?.name || '') : '🤝 Koop · ' + esc(MISSIONS.find(m => m.id === r.mission)?.name || '')}</span>
        <div class="dim">${r.players.map(p => esc(p.name)).join(', ')} ${r.started ? '· läuft' : ''}</div></div>
        <button class="small primary" data-join="${r.id}">Beitreten</button></div>`).join('') : '<p class="dim">Noch keine Räume. Erstelle einen!</p>';
    const unlocked = MISSIONS.filter((m, i) => missionUnlocked(i));
    const m = this.menu(`<button class="back small" id="lback">← Zurück</button><h2>Koop & LAN-PvP</h2>
      <div class="card"><b>Freunde einladen:</b> Sie öffnen im Browser <b style="color:#ffd23a">http://${esc(host.startsWith('localhost') ? '&lt;deine-LAN-IP&gt;:' + (location.port || 80) : host)}</b>
      <div class="dim">Die LAN-IP steht im Server-Fenster (z. B. http://192.168.1.23:3000).</div></div>
      <h3>Offene Räume</h3>${list}
      <div class="row"><button class="small" id="refresh">↻ Aktualisieren</button></div>
      <h3 style="margin-top:16px">Neuen Raum erstellen</h3>
      <div class="card">
        <div class="row">Modus: <select id="cmode"><option value="pvp">⚔ LAN-PvP (Jeder gegen jeden)</option><option value="br">🪂 Battle Royale (Letzter gewinnt)</option><option value="coop">🤝 Koop-Story</option></select></div>
        <div class="row" id="cmaprow" style="margin-top:8px">Map: <select id="cmap">${Object.values(MAPS).map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div>
        <div class="row" id="cmisrow" style="margin-top:8px;display:none">Mission: <select id="cmis">${unlocked.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div>
        <div class="row" style="margin-top:10px"><button class="primary" id="create">Raum erstellen</button></div>
      </div>`);
    $('#lback').onclick = () => { this.inLobby = false; this.home(); };
    $('#refresh').onclick = () => net.send({ t: 'list' });
    $('#cmode').onchange = e => { $('#cmaprow').style.display = e.target.value !== 'coop' ? 'flex' : 'none'; $('#cmisrow').style.display = e.target.value === 'coop' ? 'flex' : 'none'; };
    $('#create').onclick = () => net.send({ t: 'create', mode: $('#cmode').value, map: $('#cmap').value, mission: $('#cmis').value, name: `${profile.name}s Raum` });
    m.querySelectorAll('[data-join]').forEach(b => b.onclick = () => net.send({ t: 'join', id: +b.dataset.join }));
  }

  roomView() {
    const r = this.room;
    if (!r) return this.lobby();
    this.inLobby = false; this.inRoom = true;
    const isHost = r.host === net.id;
    const mis = MISSIONS.find(x => x.id === r.mission);
    const unlocked = MISSIONS.filter((x, i) => missionUnlocked(i));
    this.menu(`<h2>${esc(r.name)}</h2>
      <p>${r.mode === 'br' ? `🪂 Battle Royale · Map: <b>${esc(MAPS[r.map].name)}</b> · Fallschirmsprung, Waffen am Boden aufsammeln (E), die blaue Zone schrumpft – der Letzte gewinnt` : r.mode === 'pvp' ? `⚔ LAN-PvP · Map: <b>${esc(MAPS[r.map].name)}</b> · 20 Kills oder 5 Minuten` : `🤝 Koop-Mission: <b>${esc(mis.name)}</b> · Gegner werden beim Host berechnet`}</p>
      ${isHost && !r.started ? (r.mode !== 'coop'
        ? `<div class="row">Map ändern: <select id="rmap">${Object.values(MAPS).map(x => `<option ${x.id === r.map ? 'selected' : ''} value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div>`
        : `<div class="row">Mission ändern: <select id="rmis">${unlocked.map(x => `<option ${x.id === r.mission ? 'selected' : ''} value="${x.id}">${esc(x.name)}</option>`).join('')}</select></div>`) : ''}
      <h3 style="margin-top:14px">Spieler (${r.players.length}/8)</h3>
      ${r.players.map(p => `<div class="card">${p.id === r.host ? '👑 ' : ''}<b>${esc(p.name)}</b>${p.id === net.id ? ' (du)' : ''}</div>`).join('')}
      <div class="row" style="margin-top:12px">
        ${isHost ? `<button class="primary" id="rstart" ${r.started ? 'disabled' : ''}>${r.started ? 'Läuft …' : 'Runde starten'}</button>` : `<span class="dim">${r.started ? 'Runde läuft – du steigst gleich ein.' : 'Warte, bis der Host startet …'}</span>`}
        <button id="rleave">Raum verlassen</button>
      </div>
      <p class="dim">Tipp: Im Koop bekommt jeder die Belohnung (+20 % Koop-Bonus). Fortschritt bleibt in deinem eigenen Browser.</p>`);
    $('#rleave').onclick = () => { net.send({ t: 'leave' }); this.room = null; this.inRoom = false; this.roomsView(); };
    if ($('#rstart')) $('#rstart').onclick = () => net.send({ t: 'start' });
    if ($('#rmap')) $('#rmap').onchange = e => net.send({ t: 'config', map: e.target.value });
    if ($('#rmis')) $('#rmis').onchange = e => net.send({ t: 'config', mission: e.target.value });
  }

  // ------------------------------------------------------------ Waffenschmiede
  loadout(selId = this.loadSel || profile.loadout.primary) {
    this.loadSel = selId;
    const def = WEAPONS[selId];
    const b = build(selId);
    const s = weaponStats(selId, b);
    this.showWeapon(selId);
    const owned = Object.values(WEAPONS).filter(w => profile.weapons.includes(w.id));
    const bar = (label, v, txt) => `<div class="stat"><span>${label}</span><div class="b"><i style="width:${Math.max(3, Math.min(100, v * 100))}%"></i></div><span>${txt}</span></div>`;
    const dps = s.dmg * (s.pellets || 1);
    const slots = Object.entries(ATTACH_SLOTS).map(([slot, name]) => {
      const opts = Object.values(ATTACHMENTS).filter(a => a.slot === slot && a.classes.includes(def.cls) && profile.attachments.includes(a.id));
      const avail = Object.values(ATTACHMENTS).some(a => a.slot === slot && a.classes.includes(def.cls));
      if (!avail) return '';
      return `<div class="row" style="margin:5px 0"><span style="width:80px">${name}</span><select data-slot="${slot}"><option value="">– keiner –</option>
        ${opts.map(a => `<option value="${a.id}" ${b[slot] === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
        <span class="dim">${esc(ATTACHMENTS[b[slot]]?.desc || '')}</span></div>`;
    }).join('');
    const skinKeys = [...profile.skins, ...profile.customSkins.map(c => 'custom:' + c.id)];
    const cur = profile.weaponSkin[selId] || 'werk';
    const m = this.menu(`<button class="back small" data-go="home">← Zurück</button><h2>Waffenschmiede</h2>
      <div class="row">${owned.map(w => `<button class="small ${w.id === selId ? 'primary' : ''}" data-w="${w.id}">${esc(w.name)}${profile.loadout[w.slot] === w.id ? ' ★' : ''}</button>`).join('')}</div>
      <div class="card" style="margin-top:10px"><h3>${esc(def.name)} <span class="dim">${def.clsName} · ${def.slot === 'primary' ? 'Primärwaffe' : 'Sekundärwaffe'}</span></h3>
        <p class="dim">${esc(def.desc)}</p>
        ${bar('Schaden', dps / 130, Math.round(dps))}
        ${bar('Feuerrate', s.rpm / 1100, Math.round(s.rpm))}
        ${bar('Reichweite', s.range / 140, Math.round(s.range) + 'm')}
        ${bar('Kontrolle', 1 - s.recoilV / 6.5, (10 - s.recoilV * 1.5).toFixed(1))}
        ${bar('Präzision', 1 - s.spreadAds / 5, (10 - s.spreadAds * 2).toFixed(1))}
        ${bar('Beweglichkeit', s.move / 1.15, Math.round(s.move * 100) + '%')}
        ${bar('Magazin', s.mag / 90, s.mag)}
        ${bar('Nachladen', 1 - s.reload / 5, s.reload.toFixed(1) + 's')}
        <div class="row" style="margin-top:8px"><button class="primary small" id="equip" ${profile.loadout[def.slot] === selId ? 'disabled' : ''}>${profile.loadout[def.slot] === selId ? 'Ausgerüstet' : 'Als ' + (def.slot === 'primary' ? 'Primär' : 'Sekundär') + 'waffe ausrüsten'}</button></div>
      </div>
      <div class="card"><h3>Aufsätze</h3>${slots}<p class="dim">Mehr Aufsätze gibt es im Shop.</p></div>
      <div class="card"><h3>Skin</h3><div id="skins"></div><p class="dim">Neue Skins: Waffenkisten oder Skin-Editor.</p></div>`);
    m.querySelectorAll('[data-w]').forEach(x => x.onclick = () => { sfx.sfxUI(); this.loadout(x.dataset.w); });
    m.querySelectorAll('[data-slot]').forEach(x => x.onchange = () => { b[x.dataset.slot] = x.value || undefined; save(); this.loadout(selId); });
    $('#equip').onclick = () => { profile.loadout[def.slot] = selId; save(); sfx.sfxUI(); this.loadout(selId); };
    const sk = $('#skins');
    for (const k of skinKeys) {
      const d = skinDef(k);
      const el = document.createElement('div');
      el.className = 'skinbox' + (k === cur ? ' sel' : '');
      el.appendChild(skinPreviewCanvas(d));
      el.insertAdjacentHTML('beforeend', `<span style="color:${RARITY[d.rarity]?.color || '#fff'}">${esc(d.name)}</span>`);
      el.onclick = () => { profile.weaponSkin[selId] = k; save(); sfx.sfxUI(); this.loadout(selId); };
      sk.appendChild(el);
    }
  }

  // ------------------------------------------------------------ Skin-Editor
  skinEditor(edit = null) {
    const s = edit ? { ...edit } : { id: Date.now().toString(36), name: 'Mein Skin', base: '#ff7a1a', accent: '#1b2232', pattern: 'stripes', scale: 1, glow: 0, rarity: 'custom' };
    const w = profile.loadout.primary;
    const draw = () => {
      this.showWeapon(w, build(w), s);
      const c = $('#skprev'); const ctx = c.getContext('2d');
      const tmp = skinPreviewCanvas(s, 128); ctx.drawImage(tmp, 0, 0);
    };
    const m = this.menu(`<button class="back small" data-go="home">← Zurück</button><h2>Skin-Editor</h2>
      <div class="row" style="align-items:flex-start"><canvas id="skprev" width="128" height="128" style="position:static;border-radius:12px"></canvas>
      <div style="flex:1;min-width:220px">
        <div class="row">Name <input id="skn" maxlength="20" value="${esc(s.name)}"></div>
        <div class="row" style="margin-top:8px">Grundfarbe <input type="color" id="skb" value="${s.base}"> Akzent <input type="color" id="ska" value="${s.accent}"></div>
        <div class="row" style="margin-top:8px">Muster <select id="skp">${Object.entries(PATTERNS).map(([k, v]) => `<option value="${k}" ${k === s.pattern ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
        <div class="row" style="margin-top:8px">Größe <input type="range" id="sks" min="0.5" max="2.5" step="0.1" value="${s.scale}"></div>
        <div class="row" style="margin-top:8px">Leuchten <input type="range" id="skg" min="0" max="1" step="0.05" value="${s.glow}"></div>
        <div class="row" style="margin-top:8px"><button id="skr" class="small">🎲 Zufall</button></div>
      </div></div>
      <div class="row" style="margin-top:14px"><button class="primary" id="sksave">${edit ? 'Änderungen speichern' : 'Skin speichern'}</button>
      <span class="dim">Vorschau rechts auf deiner Primärwaffe.</span></div>
      <h3 style="margin-top:18px">Deine Skins (${profile.customSkins.length})</h3><div id="mylist"></div>`);
    const bind = (id, key, num) => { $(id).oninput = e => { s[key] = num ? +e.target.value : e.target.value; draw(); }; };
    bind('#skn', 'name'); bind('#skb', 'base'); bind('#ska', 'accent'); bind('#skp', 'pattern'); bind('#sks', 'scale', true); bind('#skg', 'glow', true);
    $('#skr').onclick = () => {
      const rc = () => '#' + new THREE.Color().setHSL(Math.random(), 0.5 + Math.random() * 0.5, 0.25 + Math.random() * 0.5).getHexString();
      s.base = rc(); s.accent = rc(); s.pattern = Object.keys(PATTERNS)[Math.floor(Math.random() * 10)]; s.scale = +(0.6 + Math.random() * 1.6).toFixed(1);
      this.skinEditor({ ...s, id: s.id, _new: !edit });
    };
    $('#sksave').onclick = () => {
      s.name = s.name.trim() || 'Mein Skin';
      const i = profile.customSkins.findIndex(c => c.id === s.id);
      delete s._new;
      if (i >= 0) profile.customSkins[i] = s; else { profile.customSkins.push(s); track('skin'); }
      save();
      sfx.sfxUI('win');
      this.toast(`Skin „${s.name}“ gespeichert – in der Waffenschmiede ausrüsten!`);
      this.skinEditor();
    };
    if (edit && edit._new) { /* Zufall auf neuem Skin: bleibt neu */ }
    const list = $('#mylist');
    for (const c of profile.customSkins) {
      const el = document.createElement('div');
      el.className = 'card row';
      el.appendChild(skinPreviewCanvas(c, 40));
      el.lastChild.style.cssText = 'position:static;width:40px;height:40px;border-radius:6px';
      el.insertAdjacentHTML('beforeend', `<b style="flex:1">${esc(c.name)}</b><button class="small" data-e>Bearbeiten</button><button class="small" data-d>Löschen</button>`);
      el.querySelector('[data-e]').onclick = () => this.skinEditor(c);
      el.querySelector('[data-d]').onclick = () => {
        profile.customSkins = profile.customSkins.filter(x => x.id !== c.id);
        for (const k in profile.weaponSkin) if (profile.weaponSkin[k] === 'custom:' + c.id) delete profile.weaponSkin[k];
        save(); this.skinEditor();
      };
      list.appendChild(el);
    }
    draw();
  }

  // ------------------------------------------------------------ Shop
  shop(tab = this.shopTab || 'weapons') {
    this.shopTab = tab;
    let items = '';
    if (tab === 'weapons') {
      items = Object.values(WEAPONS).filter(w => w.price > 0).map(w => {
        const own = profile.weapons.includes(w.id);
        return `<div class="card row" style="justify-content:space-between" data-prev="${w.id}"><div><b>${esc(w.name)}</b> <span class="dim">${w.clsName}</span><div class="dim">${esc(w.desc)}</div></div>
          <button class="small ${own ? '' : 'primary'}" data-buyw="${w.id}" ${own || profile.credits < w.price ? 'disabled' : ''}>${own ? 'Besitzt du' : w.price + ' ◆'}</button></div>`;
      }).join('');
    } else if (tab === 'outfit') {
      items = this.shopOutfits();
    } else if (tab === 'codes') {
      items = this.shopCodes();
    } else {
      items = Object.entries(ATTACH_SLOTS).map(([slot, name]) => `<h3>${name}</h3>` + Object.values(ATTACHMENTS).filter(a => a.slot === slot).map(a => {
        const own = profile.attachments.includes(a.id);
        return `<div class="card row" style="justify-content:space-between"><div><b>${esc(a.name)}</b><div class="dim">${esc(a.desc)}</div></div>
          <button class="small ${own ? '' : 'primary'}" data-buya="${a.id}" ${own || profile.credits < a.price ? 'disabled' : ''}>${own ? 'Besitzt du' : a.price + ' ◆'}</button></div>`;
      }).join('')).join('');
    }
    const m = this.menu(`<button class="back small" data-go="home">← Zurück</button><h2>Shop</h2>
      <p class="dim">Bezahlt wird nur mit Splittern ◆ aus Missionen, Quests und Matches.</p>
      <div class="tabs"><button class="small ${tab === 'weapons' ? 'on' : ''}" id="tw">Waffen</button><button class="small ${tab === 'att' ? 'on' : ''}" id="ta">Aufsätze</button><button class="small ${tab === 'outfit' ? 'on' : ''}" id="to">Ausrüstung</button><button class="small ${tab === 'codes' ? 'on' : ''}" id="tc">🔑 Codes</button><button class="small" data-go="cases">Kisten →</button></div>${items}`);
    $('#tw').onclick = () => this.shop('weapons');
    $('#ta').onclick = () => this.shop('att');
    $('#to').onclick = () => this.shop('outfit');
    $('#tc').onclick = () => this.shop('codes');
    if (tab === 'outfit') this.bindShopOutfits(m);
    if (tab === 'codes') this.bindShopCodes();
    if (tab === 'outfit' || tab === 'codes') this.showCharacter();
    m.querySelectorAll('[data-prev]').forEach(c => c.onmouseenter = () => this.showWeapon(c.dataset.prev, {}, SKINS.werk));
    m.querySelectorAll('[data-buyw]').forEach(b => b.onclick = () => {
      const w = WEAPONS[b.dataset.buyw];
      if (spend(w.price)) { profile.weapons.push(w.id); save(); sfx.sfxUI('win'); this.toast(`${w.name} gekauft! In der Waffenschmiede ausrüsten.`); this.shop(); }
    });
    m.querySelectorAll('[data-buya]').forEach(b => b.onclick = () => {
      const a = ATTACHMENTS[b.dataset.buya];
      if (spend(a.price)) { profile.attachments.push(a.id); save(); sfx.sfxUI('win'); this.toast(`${a.name} gekauft!`); this.shop(); }
    });
  }

  // ------------------------------------------------------------ Waffenkisten
  cases() {
    const m = this.menu(`<button class="back small" data-go="home">← Zurück</button><h2>Kisten</h2>
      <p class="dim">Waffenkisten enthalten Waffen-Skins, die Ausrüstungskiste Outfits für deinen Charakter. Doppelte Skins werden in Splitter umgewandelt. Nur mit Ingame-Währung.</p>
      ${[...Object.values(CASES), charCase].map(c => `<div class="card"><div class="row" style="justify-content:space-between"><div><b style="color:${c.color}">■ ${esc(c.name)}</b> <span class="dim">${esc(c.desc)}</span></div>
        <button class="primary small" data-open="${c.id}" ${profile.credits < c.price ? 'disabled' : ''}>Öffnen · ${c.price} ◆</button></div>
        <div class="dim">${Object.entries(c.odds).filter(([, v]) => v).map(([k, v]) => `<span style="color:${RARITY[k].color}">${RARITY[k].name} ${v}%</span>`).join(' · ')}</div>
        <div class="row" style="margin-top:6px" data-pool="${c.id}"></div></div>`).join('')}
      <p class="dim">Gesammelt: ${profile.skins.length} von ${Object.keys(SKINS).length} Skins</p>`);
    const caseById = id => id === charCase.id ? charCase : CASES[id];
    m.querySelectorAll('[data-pool]').forEach(row => {
      const c = caseById(row.dataset.pool);
      for (const k of c.pool) {
        const d = caseDef(c, k);
        const cv = casePreview(c, k, 32);
        cv.style.cssText = `position:static;width:28px;height:28px;border-radius:5px;border:2px solid ${RARITY[d.rarity].color};opacity:${caseOwned(c, k) ? 1 : 0.45}`;
        cv.title = d.name;
        row.appendChild(cv);
      }
    });
    m.querySelectorAll('[data-open]').forEach(b => b.onclick = () => this.openCase(caseById(b.dataset.open)));
  }

  openCase(c) {
    if (!spend(c.price)) return;
    sfx.initAudio();
    const roll = () => {
      let r = Math.random() * 100, rar = 'common';
      for (const [k, v] of Object.entries(c.odds)) { if ((r -= v) < 0) { rar = k; break; } }
      const pool = c.pool.filter(k => caseDef(c, k).rarity === rar);
      return (pool.length ? pool : c.pool)[Math.floor(Math.random() * (pool.length || c.pool.length))];
    };
    const result = roll();
    const N = 48, WIN = 40, IW = 118;
    const items = Array.from({ length: N }, (_, i) => i === WIN ? result : roll());
    const modal = $('#modal');
    modal.style.display = 'flex';
    modal.innerHTML = `<div class="box"><h2>${esc(c.name)}</h2><div class="strip-wrap"><div class="strip"></div></div><div id="cres" style="min-height:90px"></div></div>`;
    const strip = modal.querySelector('.strip');
    for (const k of items) {
      const d = document.createElement('div');
      d.className = 'it';
      d.style.borderColor = RARITY[caseDef(c, k).rarity].color;
      d.appendChild(casePreview(c, k, 64));
      d.insertAdjacentHTML('beforeend', esc(caseDef(c, k).name));
      strip.appendChild(d);
    }
    const wrapW = modal.querySelector('.strip-wrap').offsetWidth;
    const target = WIN * IW + 55 - wrapW / 2 + (Math.random() - 0.5) * 80;
    const T = 5200;
    const t0 = performance.now();
    let lastIdx = -1;
    const anim = now => {
      const t = Math.min(1, (now - t0) / T);
      const x = target * (1 - Math.pow(1 - t, 4));
      strip.style.transform = `translateX(${-x}px)`;
      const idx = Math.floor((x + wrapW / 2) / IW);
      if (idx !== lastIdx) { lastIdx = idx; sfx.sfxUI('tick'); }
      if (t < 1) requestAnimationFrame(anim);
      else done();
    };
    requestAnimationFrame(anim);
    let finished = false;
    // Fallback, falls requestAnimationFrame gedrosselt ist (Tab im Hintergrund)
    setTimeout(() => { if (!finished) { strip.style.transform = `translateX(${-target}px)`; done(); } }, T + 400);
    const done = () => {
      if (finished) return;
      finished = true;
      const sk = caseDef(c, result), rar = RARITY[sk.rarity];
      const dup = caseOwned(c, result);
      if (!dup) { if (c.kind === 'char') c.grant(result); else profile.skins.push(result); }
      profile.stats.cases++;
      save();
      track('case');
      if (dup) addCredits(rar.refund);
      sfx.sfxUI(sk.rarity === 'legendary' || sk.rarity === 'epic' ? 'legendary' : 'win');
      modal.querySelector('#cres').innerHTML = `<h2 style="color:${rar.color}">${rar.name}: ${esc(sk.name)}</h2>
        <p>${dup ? `Doppelt – du bekommst <b>${rar.refund} ◆</b> zurück.` : c.kind === 'char' ? 'Neu! Im Menü „Charakter“ anlegen.' : 'Neu in deiner Sammlung! In der Waffenschmiede ausrüsten.'}</p>
        <div class="row" style="justify-content:center"><button class="primary" id="cagain" ${profile.credits < c.price ? 'disabled' : ''}>Nochmal (${c.price} ◆)</button><button id="cclose">Schließen</button></div>`;
      if (c.kind === 'char') this.showCharacter(lookFromProfile({ ...profile.character, [sk.slot]: result }));
      else this.showWeapon(profile.loadout.primary, build(profile.loadout.primary), sk);
      $('#cclose').onclick = () => { modal.style.display = 'none'; this.cases(); };
      $('#cagain').onclick = () => this.openCase(c);
    };
  }

  // ------------------------------------------------------------ Quests
  quests() {
    const qs = allQuests();
    const row = q => {
      const st = questState(q);
      const done = st.p >= q.goal;
      return `<div class="card"><div class="row" style="justify-content:space-between"><div><b>${esc(q.name)}</b> <span class="dim">· ${q.reward} ◆</span><div class="dim">${esc(q.desc)}</div></div>
        ${st.claimed ? '<span style="color:#5dff8a">✔ Abgeholt</span>' : `<button class="small ${done ? 'primary' : ''}" data-claim="${q.id}" ${done ? '' : 'disabled'}>${done ? 'Abholen' : st.p + '/' + q.goal}</button>`}</div>
        <div class="prog"><i style="width:${Math.min(100, st.p / q.goal * 100)}%"></i></div></div>`;
    };
    const m = this.menu(`<button class="back small" data-go="home">← Zurück</button><h2>Quests</h2>
      <h3>Tagesaufträge <span class="dim">(neu jeden Tag)</span></h3>${qs.filter(q => q.daily).map(row).join('')}
      <h3 style="margin-top:14px">Aufträge</h3>${qs.filter(q => !q.daily).map(row).join('')}`);
    m.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => { claimQuest(qs.find(q => q.id === b.dataset.claim)); sfx.sfxUI('win'); this.quests(); });
  }

  // ------------------------------------------------------------ Einstellungen
  settings() {
    const st = profile.settings;
    this.menu(`<button class="back small" data-go="home">← Zurück</button><h2>Einstellungen</h2>
      <div class="card">
        <div class="row">Spielername <input id="sname" maxlength="16" value="${esc(profile.name)}"></div>
        <div class="row" style="margin-top:10px">Mausempfindlichkeit <input type="range" id="ssens" min="0.2" max="3" step="0.05" value="${st.sens}"><span id="vsens">${st.sens}</span></div>
        <div class="row" style="margin-top:10px">Sichtfeld (FOV) <input type="range" id="sfov" min="60" max="105" step="1" value="${st.fov}"><span id="vfov">${st.fov}°</span></div>
        <div class="row" style="margin-top:10px">Lautstärke <input type="range" id="svol" min="0" max="1" step="0.05" value="${st.volume}"></div>
        <label class="row" style="margin-top:10px">Sprachausgabe in Zwischensequenzen <input type="checkbox" id="svoice" ${st.voice !== false ? 'checked' : ''} style="width:20px;height:20px"></label>
        <div class="row" style="margin-top:10px">Grafik <select id="squal">${Object.keys(QUALITY).map(q => `<option ${q === st.quality ? 'selected' : ''} value="${q}">${q[0].toUpperCase() + q.slice(1)}</option>`).join('')}</select>
          <span class="dim">Niedrig = maximale FPS (ohne Schatten). Wird nach Neuladen aktiv.</span></div>
      </div>
      <div class="card"><b>Statistik</b><div class="dim">Kills ${profile.stats.kills} · Kopfschüsse ${profile.stats.heads} · Tode ${profile.stats.deaths} · Kisten ${profile.stats.cases} · PvP-Siege ${profile.stats.pvpWins}</div></div>
      <div class="row"><button id="sreset">Spielstand zurücksetzen</button></div>`);
    $('#sname').onchange = e => { profile.name = e.target.value.trim().slice(0, 16) || 'Rekrut'; save(); net.send({ t: 'hello', name: profile.name }); };
    $('#ssens').oninput = e => { st.sens = +e.target.value; $('#vsens').textContent = st.sens; save(); };
    $('#sfov').oninput = e => { st.fov = +e.target.value; $('#vfov').textContent = st.fov + '°'; save(); };
    $('#svol').oninput = e => { st.volume = +e.target.value; sfx.setVolume(st.volume); save(); };
    $('#svoice').onchange = e => { st.voice = e.target.checked; save(); };
    $('#squal').onchange = e => { st.quality = e.target.value; save(); if (confirm('Grafik geändert. Jetzt neu laden?')) location.reload(); };
    $('#sreset').onclick = () => { if (confirm('Wirklich den gesamten Fortschritt löschen?')) resetProfile(); };
  }
}

// Kisten-Helfer: Waffen-Skins oder Charakter-Ausrüstung
function caseDef(c, k) { return c.kind === 'char' ? c.def(k) : SKINS[k]; }
function casePreview(c, k, size) { return c.kind === 'char' ? c.preview(k, size) : skinPreviewCanvas(SKINS[k], size); }
function caseOwned(c, k) { return c.kind === 'char' ? c.owned(k) : profile.skins.includes(k); }

Object.assign(App.prototype, characterMenus);
// Erst die 3D-Charaktere laden, dann das Spiel starten (bei Fehlern geht es mit eigenen Modellen weiter)
const charLoad = loadCharacters();
Promise.race([charLoad, new Promise(r => setTimeout(r, 6000))]).finally(() => {
  window.app = new App();
  // Kamen die Figuren erst später, Menü-Soldat aktualisieren
  charLoad.then(() => { if (window.app.previewKind === 'char' && !window.app.previewSoldier?.userData.gltf) window.app.showCharacter(); });
});
