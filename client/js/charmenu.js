// Charakter-Anpassung, Ausrüstung im Shop, Code-Eingabe und Cheat-Menü.
import * as THREE from 'three';
import { CHAR_ITEMS, CHAR_SLOTS, CHAR_CASE, CHEAT_CODE, MISSIONS, RARITY } from './data.js';
import { profile, save, spend, ownsChar, lookFromProfile, DEFAULT_CHEATS } from './profile.js';
import { net } from './net.js';
import * as sfx from './audio.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICON = { uniform: '👕', pants: '👖', vest: '🦺', headgear: '⛑', mask: '🎭', eyes: '🥽', face: '🙂' };

// Kleines Vorschaubild für ein Ausrüstungsteil (Farbfeld + Symbol)
export function charSwatch(item, size = 56) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, item.color);
  g.addColorStop(1, new THREE.Color(item.color).multiplyScalar(0.6).getStyle());
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  x.font = `${Math.round(size * 0.5)}px system-ui`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(ICON[item.slot] || '◆', size / 2, size / 2 + 2);
  c.style.cssText = `position:static;width:${size}px;height:${size}px;border-radius:8px`;
  return c;
}

function unlockText(it) {
  if (it.free) return 'Gratis';
  if (it.bp) return `Battle Pass Stufe ${it.bp}${it.premium ? ' (Premium)' : ''}`;
  if (it.mission) return `Mission „${MISSIONS.find(m => m.id === it.mission)?.name}“ schaffen`;
  if (it.case) return 'Nur aus der Ausrüstungskiste';
  return `${it.price} ◆`;
}

export const characterMenus = {
  // Soldat auf der Menü-Bühne (steht immer frontal zur Kamera, siehe menustage.js)
  showCharacter(look = lookFromProfile()) {
    this.stage.showCharacter(look, profile.loadout.primary);
  },
  // Vorschau: ein Ausrüstungsteil anprobieren, ohne es anzulegen
  previewOutfit(slot, id) {
    this.showCharacter(lookFromProfile({ ...profile.character, [slot]: id }));
  },

  charakter(slot = this.charSlot || 'uniform') {
    this.charSlot = slot;
    this.showCharacter();
    const items = Object.entries(CHAR_ITEMS).filter(([, it]) => it.slot === slot);
    const m = this.menu(`<button class="back small" data-go="home">← Zurück</button><h2>Charakter</h2>
      <p class="dim">Rüste deinen Soldaten aus. Mitspieler im LAN sehen dein Outfit. Neue Teile gibt es im Shop, in der Ausrüstungskiste oder als Belohnung für Story-Missionen.</p>
      <div class="tabs" style="flex-wrap:wrap">${Object.entries(CHAR_SLOTS).map(([k, n]) => `<button class="small ${k === slot ? 'on' : ''}" data-slot="${k}">${ICON[k]} ${n}</button>`).join('')}</div>
      <div class="grid3" id="charitems"></div>
      <div class="row" style="margin-top:12px"><button data-go="shop" class="small">🛒 Ausrüstung im Shop</button><button class="small" id="tochest">📦 Ausrüstungskiste</button></div>`);
    m.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { sfx.sfxUI(); this.charakter(b.dataset.slot); });
    $('#tochest').onclick = () => this.cases();
    const grid = $('#charitems');
    for (const [id, it] of items) {
      const own = ownsChar(id), eq = profile.character[slot] === id;
      const card = document.createElement('div');
      card.className = 'card' + (eq ? ' sel' : '') + (own ? '' : ' locked');
      card.style.cssText = 'cursor:pointer;text-align:center;margin:0';
      card.appendChild(charSwatch(it));
      card.insertAdjacentHTML('beforeend', `<div style="font-weight:700;color:${RARITY[it.rarity].color}">${esc(it.name)}</div>
        <div class="dim" style="font-size:12px">${eq ? '✔ Angelegt' : own ? 'Klicken zum Anlegen' : '🔒 ' + esc(unlockText(it))}</div>
        ${!own && it.price && !it.mission && !it.case ? `<button class="small primary" style="margin-top:6px" ${profile.credits < it.price ? 'disabled' : ''}>Kaufen ${it.price} ◆</button>` : ''}`);
      card.onmouseenter = () => this.showCharacter(lookFromProfile({ ...profile.character, [slot]: id }));
      card.onmouseleave = () => this.showCharacter();
      card.onclick = e => {
        if (e.target.tagName === 'BUTTON') {
          if (spend(it.price)) { profile.charItems.push(id); profile.character[slot] = id; save(); sfx.sfxUI('win'); this.toast(`${it.name} gekauft und angelegt!`); }
          return this.charakter(slot);
        }
        if (!own) return;
        profile.character[slot] = id; save(); sfx.sfxUI();
        if (net.connected) net.send({ t: 'hello', name: profile.name, look: lookFromProfile() });
        this.charakter(slot);
      };
      grid.appendChild(card);
    }
  },

  // Shop-Reiter: Ausrüstung kaufen
  shopOutfits() {
    return Object.entries(CHAR_SLOTS).map(([slot, name]) => {
      const list = Object.entries(CHAR_ITEMS).filter(([, it]) => it.slot === slot && (it.price || it.mission || it.case) && !it.free);
      if (!list.length) return '';
      return `<h3>${ICON[slot]} ${name}</h3>` + list.map(([id, it]) => {
        const own = ownsChar(id);
        const btn = own ? '<button class="small" disabled>Besitzt du</button>'
          : it.price && !it.case && !it.mission ? `<button class="small primary" data-buyc="${id}" ${profile.credits < it.price ? 'disabled' : ''}>${it.price} ◆</button>`
            : `<span class="dim">🔒 ${esc(unlockText(it))}</span>`;
        return `<div class="card row" style="justify-content:space-between" data-prevc="${id}"><div class="row"><span data-sw="${id}"></span><div><b style="color:${RARITY[it.rarity].color}">${esc(it.name)}</b><div class="dim">${RARITY[it.rarity].name}</div></div></div>${btn}</div>`;
      }).join('');
    }).join('');
  },
  bindShopOutfits(m) {
    m.querySelectorAll('[data-sw]').forEach(s => s.appendChild(charSwatch(CHAR_ITEMS[s.dataset.sw], 36)));
    m.querySelectorAll('[data-prevc]').forEach(c => c.onmouseenter = () => {
      const it = CHAR_ITEMS[c.dataset.prevc];
      this.showCharacter(lookFromProfile({ ...profile.character, [it.slot]: c.dataset.prevc }));
    });
    m.querySelectorAll('[data-buyc]').forEach(b => b.onclick = () => {
      const id = b.dataset.buyc, it = CHAR_ITEMS[id];
      if (spend(it.price)) { profile.charItems.push(id); save(); sfx.sfxUI('win'); this.toast(`${it.name} gekauft! Im Menü „Charakter“ anlegen.`); this.shop('outfit'); }
    });
  },

  // Shop-Reiter: Codes
  shopCodes() {
    return `<div class="card"><h3>🔑 Code einlösen</h3>
      <div class="row"><input id="codein" placeholder="Code eingeben …" style="flex:1;min-width:220px" autocomplete="off"><button class="primary" id="codego">Einlösen</button></div>
      <p class="dim" id="codemsg"></p></div>
      ${profile.cheatsUnlocked ? '<div class="card"><b>🕹 Cheat-Menü freigeschaltet</b><div class="row" style="margin-top:8px"><button class="primary small" data-go="cheats">Cheat-Menü öffnen</button></div></div>' : ''}`;
  },
  bindShopCodes() {
    const go = () => {
      const v = $('#codein').value.trim();
      if (v.toLowerCase() === CHEAT_CODE.toLowerCase()) {
        profile.cheatsUnlocked = true; save();
        sfx.sfxUI('legendary');
        this.toast('Code akzeptiert – Cheat-Menü freigeschaltet!');
        this.cheats();
      } else {
        $('#codemsg').textContent = 'Ungültiger Code.';
        $('#codemsg').style.color = '#ff6a4a';
        sfx.sfxEmpty?.();
      }
    };
    $('#codego').onclick = go;
    $('#codein').onkeydown = e => { if (e.key === 'Enter') go(); };
  },

  cheats() {
    if (!profile.cheatsUnlocked) return this.shop('codes');
    this.showCharacter();
    const m = this.menu(`<button class="back small" data-go="home">← Zurück</button><h2>🕹 Cheat-Menü</h2>
      <p class="dim">Gilt in allen Modi. Auch im Spiel über das Pause-Menü (Esc) änderbar.</p><div id="cheatpanel"></div>`);
    cheatPanel(m.querySelector('#cheatpanel'));
  },
};

// Bedienfeld mit Schaltern und Reglern (Hauptmenü und Pause-Menü)
export function cheatPanel(el, onChange = () => {}) {
  const c = profile.cheats;
  const tog = (k, label, hint = '') => `<label class="row" style="justify-content:space-between;margin:6px 0"><span>${label}${hint ? ` <span class="dim">${hint}</span>` : ''}</span><input type="checkbox" data-k="${k}" ${c[k] ? 'checked' : ''} style="width:20px;height:20px"></label>`;
  const rng = (k, label, min, max, step, unit = '') => `<div class="row" style="justify-content:space-between;margin:6px 0"><span>${label}</span><span class="row"><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${c[k]}" style="width:150px"><b data-v="${k}" style="width:56px;text-align:right">${c[k]}${unit}</b></span></div>`;
  el.innerHTML = `
    <div class="card" style="border-color:${c.enabled ? '#5dff8a' : 'var(--line)'}">${tog('enabled', '<b>Cheats aktiv</b>', '(Hauptschalter)')}</div>
    <div class="card"><b>👁 Sicht</b>
      ${tog('wallhack', 'Wallhack', '– Gegner leuchten durch Wände')}
      ${tog('esp', 'ESP-Boxen', '– Rahmen, Name, Entfernung, Leben')}</div>
    <div class="card"><b>🎯 Aimbot</b>
      ${tog('aimbot', 'Aimbot an')}
      <div class="row" style="justify-content:space-between;margin:6px 0"><span>Auslösen</span><select data-k="aimMode">
        <option value="zielen" ${c.aimMode === 'zielen' ? 'selected' : ''}>Beim Zielen (Rechtsklick)</option>
        <option value="schiessen" ${c.aimMode === 'schiessen' ? 'selected' : ''}>Beim Schießen</option>
        <option value="immer" ${c.aimMode === 'immer' ? 'selected' : ''}>Immer</option></select></div>
      <div class="row" style="justify-content:space-between;margin:6px 0"><span>Zielpunkt</span><select data-k="aimBone">
        <option value="kopf" ${c.aimBone === 'kopf' ? 'selected' : ''}>Kopf</option><option value="koerper" ${c.aimBone === 'koerper' ? 'selected' : ''}>Körper</option></select></div>
      ${rng('aimFov', 'Sichtfeld (FOV)', 5, 180, 1, '°')}
      ${rng('aimSmooth', 'Geschwindigkeit', 1, 40, 1)}</div>
    <div class="card"><b>🏃 Bewegung</b>
      ${rng('speed', 'Super-Speed', 1, 4, 0.1, '×')}
      ${rng('jump', 'Super-Jump', 1, 6, 0.1, '×')}</div>
    <div class="card"><b>❤ Überleben & Waffen</b>
      ${rng('maxHp', 'Max. Leben', 100, 1000, 25, ' HP')}
      ${tog('god', 'Unverwundbar (Godmode)')}
      ${tog('infAmmo', 'Unendlich Munition')}
      ${tog('noRecoil', 'Kein Rückstoß & keine Streuung')}
      ${rng('rapid', 'Feuerrate', 1, 5, 0.1, '×')}</div>
    <div class="row"><button class="small" id="cheatreset">Alles zurücksetzen</button></div>`;
  const units = { aimFov: '°', speed: '×', jump: '×', maxHp: ' HP', rapid: '×' };
  el.querySelectorAll('[data-k]').forEach(inp => {
    const k = inp.dataset.k;
    const upd = () => {
      c[k] = inp.type === 'checkbox' ? inp.checked : inp.type === 'range' ? +inp.value : inp.value;
      const v = el.querySelector(`[data-v="${k}"]`);
      if (v) v.textContent = c[k] + (units[k] || '');
      save();
      onChange();
    };
    inp.oninput = upd; inp.onchange = upd;
  });
  el.querySelector('#cheatreset').onclick = () => { Object.assign(c, DEFAULT_CHEATS); save(); cheatPanel(el, onChange); onChange(); };
}

// Ausrüstungskiste: Adapter für die Kisten-Animation
export const charCase = {
  ...CHAR_CASE,
  kind: 'char',
  def: k => CHAR_ITEMS[k],
  preview: (k, size) => charSwatch(CHAR_ITEMS[k], size),
  owned: k => ownsChar(k),
  grant: k => { profile.charItems.push(k); },
};
