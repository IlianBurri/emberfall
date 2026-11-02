// Zwischensequenzen im Spiel-Look: Kamerafahrten über die Missionskarte, Kinobalken, Titelkarte (Ort/Uhrzeit),
// Untertitel mit Sprechern und optional Sprachausgabe über die Browser-Stimme. Leertaste/Enter/Klick überspringt.
import * as THREE from 'three';
import { SPEAKERS, MISSIONS } from './data.js';
import { profile } from './profile.js';
import { animateSoldier, makeSoldier } from './actors.js';
import { lookFromProfile } from './profile.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = t => t * t * (3 - 2 * t);
const VOICE = { vogt: { pitch: 0.75, rate: 1.0 }, echo: { pitch: 1.35, rate: 1.05 }, rost: { pitch: 0.5, rate: 0.9 }, kessler: { pitch: 0.95, rate: 0.95 }, jonas: { pitch: 1.5, rate: 1.1 } };
const COLORS = { vogt: '#ffd23a', echo: '#5dffb0', rost: '#ff5a3a', kessler: '#c8b090', jonas: '#9ad0ff' };

function germanVoice() {
  const vs = window.speechSynthesis?.getVoices() || [];
  return vs.find(v => v.lang?.startsWith('de') && /Google|Microsoft|Natural/i.test(v.name)) || vs.find(v => v.lang?.startsWith('de')) || null;
}

export const cinematicMixin = {
  // kind: 'intro' oder 'outro'; onEnd wird nach dem Ende/Überspringen aufgerufen
  playCinematic(kind, onEnd) {
    const m = this.opts.mission;
    const lines = (kind === 'intro' ? m.intro : m.outro) || [];
    if (!lines.length) { onEnd?.(); return; }
    const durs = lines.map(([, t]) => Math.min(7.5, Math.max(3.2, t.length * 0.068)));
    const titleT = kind === 'intro' ? 3.4 : 0;
    const total = titleT + durs.reduce((a, b) => a + b, 0) + 0.6;
    const shots = kind === 'intro' ? this.introShots(total) : this.outroShots(total);
    const el = document.getElementById('cine');
    const idx = MISSIONS.indexOf(m) + 1;
    el.innerHTML = `<div class="bar top"></div><div class="bar bottom"></div>
      <div class="title">${kind === 'intro' ? `<small>MISSION ${idx}</small><b>${m.name.toUpperCase()}</b><span></span>` : `<b>MISSION ERFÜLLT</b><small>${m.name}</small>`}</div>
      <div class="sub"><i></i><p></p></div><div class="skip">Leertaste / Klick: Überspringen</div>`;
    el.style.display = 'block';
    requestAnimationFrame(() => el.classList.add('on'));
    document.getElementById('hud').style.visibility = 'hidden';
    this.cine = { kind, t: 0, total, shots, lines, durs, titleT, line: -1, onEnd, el, typed: 0, card: m.card };
    if (kind === 'outro') this.spawnOutroActor();
    this.cineKey = e => { if (['Space', 'Enter', 'NumpadEnter'].includes(e.code)) { e.preventDefault(); this.endCinematic(); } };
    this.cineClick = () => this.endCinematic();
    addEventListener('keydown', this.cineKey);
    setTimeout(() => this.cine && addEventListener('mousedown', this.cineClick), 400);
  },

  // Kamerafahrten für den Einstieg: Luftbild → erstes Ziel → Gegner → eigener Startpunkt
  introShots(total) {
    const w = this.world, ms = this.mission;
    const first = ms.def.objectives[0];
    const goal = ms.poi(first.poi ?? first.pois?.[0] ?? 3);
    const spawn = this.p.pos.clone();
    const enemy = [...this.enemies].sort((a, b) => a.pos.distanceTo(goal) - b.pos.distanceTo(goal))[0];
    const ep = enemy ? enemy.pos.clone() : goal.clone();
    const ed = enemy ? V(-Math.sin(enemy.yaw), 0, -Math.cos(enemy.yaw)) : V(0, 0, -1);
    const shots = [
      { from: V(-95, 62, -110), to: V(-35, 48, -70), lookA: V(0, 0, 0), lookB: V(goal.x * 0.4, 0, goal.z * 0.4) },
      { from: goal.clone().add(V(24, 14, 22)), to: goal.clone().add(V(11, 6, 12)), lookA: goal.clone().add(V(0, 1, 0)), lookB: goal.clone().add(V(0, 1.5, 0)) },
      { from: ep.clone().add(ed.clone().multiplyScalar(6)).add(V(2, 2.4, 0)), to: ep.clone().add(ed.clone().multiplyScalar(3.2)).add(V(1, 1.7, 0)), lookA: ep.clone().add(V(0, 1.5, 0)), lookB: ep.clone().add(V(0, 1.4, 0)) },
      { from: spawn.clone().add(V(-4, 2.6, 6)), to: spawn.clone().add(V(-0.6, 1.75, 1.4)), lookA: spawn.clone().add(V(0, 1.4, 0)), lookB: spawn.clone().add(V(-Math.sin(this.p.yaw) * 8, 1.5, -Math.cos(this.p.yaw) * 8)) },
    ];
    const d = total / shots.length;
    shots.forEach((s, i) => { s.t0 = i * d; s.t1 = (i + 1) * d; });
    return shots;
  },
  // Abspann: Kamera umkreist den Spieler und steigt dann auf
  outroShots(total) {
    const c = this.p.pos.clone();
    const shots = [];
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a0 = this.p.yaw + Math.PI + i * 0.7, a1 = a0 + 0.7;
      const r0 = 4 + i * 2, r1 = 5 + i * 3, h0 = 1.6 + i * 3, h1 = 2.2 + i * 5;
      shots.push({ from: c.clone().add(V(Math.sin(a0) * r0, h0, Math.cos(a0) * r0)), to: c.clone().add(V(Math.sin(a1) * r1, h1, Math.cos(a1) * r1)), lookA: c.clone().add(V(0, 1.3, 0)), lookB: c.clone().add(V(0, 1.2, 0)), t0: i * total / n, t1: (i + 1) * total / n });
    }
    return shots;
  },
  // Im Abspann steht dein eigener Soldat da, wo du die Mission beendet hast
  spawnOutroActor() {
    const look = lookFromProfile();
    const m = makeSoldier(look.color, { ...look, gun: this.weapons[this.cur].id });
    m.position.copy(this.p.pos);
    m.rotation.y = this.p.yaw;
    this.scene.add(m);
    this.cineActor = m;
  },

  updateCinematic(dt) {
    const c = this.cine;
    c.t += dt;
    // Kamera
    const s = c.shots.find(s => c.t < s.t1) || c.shots[c.shots.length - 1];
    const k = ease(Math.min(1, Math.max(0, (c.t - s.t0) / (s.t1 - s.t0))));
    const cam = this.camera;
    cam.position.lerpVectors(s.from, s.to, k);
    const look = s.lookA.clone().lerp(s.lookB, k);
    cam.fov = 55; cam.updateProjectionMatrix();
    cam.lookAt(look);
    // Titelkarte: Ort und Uhrzeit tippen sich ein
    const title = c.el.querySelector('.title');
    if (c.kind === 'intro') {
      const card = `${c.card?.place || ''} — ${c.card?.time || ''} Uhr`;
      const n = Math.min(card.length, Math.floor(Math.max(0, c.t - 0.6) * 28));
      title.querySelector('span').textContent = card.slice(0, n);
      title.style.opacity = c.t < c.titleT ? Math.min(1, c.t * 2) : Math.max(0, 1 - (c.t - c.titleT) * 2);
    } else title.style.opacity = c.t < 3 ? Math.min(1, c.t * 2) : Math.max(0, 1 - (c.t - 3) * 1.5);
    // Untertitel
    let acc = c.titleT, li = -1;
    for (let i = 0; i < c.durs.length; i++) { if (c.t >= acc) li = i; acc += c.durs[i]; }
    const speaking = window.speechSynthesis?.speaking;
    if (li !== c.line && li > c.line) {
      // Mit Stimme: nächste Zeile erst, wenn die vorige fertig gesprochen ist
      if (speaking && c.line >= 0) c.t -= dt;
      else { c.line = li; c.typed = 0; this.speakLine(c.lines[li]); }
    }
    const sub = c.el.querySelector('.sub');
    if (c.line >= 0) {
      const [who, text] = c.lines[c.line];
      c.typed += dt * 55;
      sub.querySelector('i').textContent = SPEAKERS[who] || who;
      sub.querySelector('i').style.color = COLORS[who] || '#fff';
      sub.querySelector('p').textContent = text.slice(0, Math.floor(c.typed));
      sub.style.opacity = 1;
    }
    // Figuren leben weiter (Animationen), aber niemand schießt
    for (const e of this.enemies) if (!e.dead) { e.model.userData.combat = false; e.model.userData.firing = 0; animateSoldier(e.model, 0, dt, 0); }
    if (this.cineActor) animateSoldier(this.cineActor, 0, dt, 0);
    this.mission?.updateHostage?.(dt);
    this.fx.update(dt);
    if (c.t >= c.total && !speaking) this.endCinematic();
  },

  speakLine(line) {
    if (!line || profile.settings.voice === false || !window.speechSynthesis) return;
    const [who, text] = line;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE';
      const v = germanVoice(); if (v) u.voice = v;
      const p = VOICE[who] || {};
      u.pitch = p.pitch ?? 1; u.rate = p.rate ?? 1; u.volume = Math.min(1, profile.settings.volume + 0.2);
      speechSynthesis.speak(u);
    } catch { /* keine Sprachausgabe verfügbar */ }
  },

  endCinematic() {
    const c = this.cine;
    if (!c) return;
    this.cine = null;
    try { window.speechSynthesis?.cancel(); } catch { /* egal */ }
    removeEventListener('keydown', this.cineKey);
    removeEventListener('mousedown', this.cineClick);
    c.el.classList.remove('on');
    setTimeout(() => { c.el.style.display = 'none'; c.el.innerHTML = ''; }, 350);
    if (this.cineActor) { this.scene.remove(this.cineActor); this.cineActor = null; }
    if (this.h) document.getElementById('hud').style.visibility = '';
    this.camera.fov = profile.settings.fov; this.camera.updateProjectionMatrix();
    if (c.kind === 'intro' && this.h) this.centerMsg(this.opts.mission.name, 2.5);
    c.onEnd?.();
  },
};
