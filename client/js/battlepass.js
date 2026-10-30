// Battle Pass „Glutfunken“: 50 Stufen, Gratis- und Premium-Spur, echte Belohnungen, Einlösen mit Doppel-Schutz.
// WICHTIG: Der Fortschritt liegt – wie der restliche Spielstand – nur im localStorage dieses Browsers. Das ist ein
// lokaler Prototyp und kein manipulationssicheres Online-System. Der Premium-Pass kann nicht gekauft werden.
import { BATTLE_PASS, SKINS, CHAR_ITEMS, RARITY } from './data.js';
import { profile, save, addCredits, bpInfo } from './profile.js';
import { skinPreviewCanvas } from './skins.js';
import { charSwatch } from './charmenu.js';
import * as sfx from './audio.js';

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = s => document.querySelector(s);

// ---------------------------------------------------------------- Profil-Kosmetik (Embleme & Banner)
export const EMBLEMS = {
  em_funke: { name: 'Funke', icon: '✦', rarity: 'common' },
  em_zahnrad: { name: 'Zahnrad', icon: '⚙', rarity: 'common' },
  em_flamme: { name: 'Flamme', icon: '🔥', rarity: 'rare' },
  em_schild: { name: 'Schild', icon: '🛡', rarity: 'rare' },
  em_wolf: { name: 'Wolf', icon: '🐺', rarity: 'epic' },
  em_glutkern: { name: 'Glutkern', icon: '◈', rarity: 'legendary' },
  em_phoenix: { name: 'Phönix', icon: '🦅', rarity: 'epic', premium: true },
};
export const BANNERS = {
  bn_standard: { name: 'Standard', colors: ['#2a3346', '#1a2030'], rarity: 'common' },
  bn_rost: { name: 'Rost', colors: ['#6a3420', '#2a1810'], rarity: 'common' },
  bn_morgenrot: { name: 'Morgenrot', colors: ['#ff7a3a', '#5a1a40'], rarity: 'rare' },
  bn_nacht: { name: 'Nachtwache', colors: ['#1a2a5a', '#0a0e1a'], rarity: 'rare' },
  bn_glut: { name: 'Glutstrom', colors: ['#ffb02e', '#a8200a'], rarity: 'epic' },
  bn_phoenix: { name: 'Phönix', colors: ['#ffd23a', '#c8301a'], rarity: 'legendary', premium: true },
};

// ---------------------------------------------------------------- Belohnungen pro Stufe
const FREE = {
  1: { type: 'credits', amount: 250 }, 2: { type: 'emblem', id: 'em_zahnrad' }, 3: { type: 'char', id: 'p_asche' }, 4: { type: 'boost', rounds: 3 },
  5: { type: 'skin', id: 'bp_asche' }, 7: { type: 'banner', id: 'bn_rost' }, 8: { type: 'char', id: 'u_funke' }, 10: { type: 'credits', amount: 500 },
  12: { type: 'emblem', id: 'em_flamme' }, 15: { type: 'skin', id: 'bp_funkenflug' }, 18: { type: 'char', id: 'm_asche' }, 20: { type: 'banner', id: 'bn_morgenrot' },
  22: { type: 'boost', rounds: 3 }, 25: { type: 'char', id: 'e_glut' }, 28: { type: 'emblem', id: 'em_schild' }, 30: { type: 'skin', id: 'bp_morgenrot' },
  33: { type: 'banner', id: 'bn_nacht' }, 35: { type: 'char', id: 'h_glutbarett' }, 38: { type: 'emblem', id: 'em_wolf' }, 40: { type: 'credits', amount: 1000 },
  42: { type: 'char', id: 'v_schmied' }, 45: { type: 'banner', id: 'bn_glut' }, 48: { type: 'emblem', id: 'em_glutkern' }, 50: { type: 'skin', id: 'bp_schmiede' },
};
const PREMIUM = {
  1: { type: 'emblem', id: 'em_phoenix' }, 5: { type: 'skin', id: 'bp_obsidian' }, 10: { type: 'char', id: 'u_obsidian' }, 15: { type: 'boost', rounds: 5 },
  20: { type: 'banner', id: 'bn_phoenix' }, 25: { type: 'skin', id: 'bp_lavastrom' }, 40: { type: 'skin', id: 'bp_phoenix' }, 50: { type: 'char', id: 'h_phoenix' },
};
export function bpReward(level, track) {
  const special = (track === 'free' ? FREE : PREMIUM)[level];
  if (special) return special;
  // Lücken mit Splittern füllen (Premium etwas mehr)
  const base = track === 'free' ? 80 + level * 4 : 150 + level * 6;
  return { type: 'credits', amount: Math.round(base / 10) * 10 };
}

// Anzeige-Infos einer Belohnung
export function rewardInfo(r) {
  switch (r.type) {
    case 'credits': return { name: `${r.amount} Splitter`, kind: 'Währung', rarity: r.amount >= 500 ? 'rare' : 'common' };
    case 'boost': return { name: `XP-Booster ×${r.rounds}`, kind: `+25 % Pass-XP für ${r.rounds} Runden`, rarity: 'rare' };
    case 'skin': return { name: SKINS[r.id].name, kind: 'Waffen-Skin', rarity: SKINS[r.id].rarity };
    case 'char': { const it = CHAR_ITEMS[r.id]; return { name: it.name, kind: 'Outfit-Teil', rarity: it.rarity }; }
    case 'emblem': return { name: EMBLEMS[r.id].name, kind: 'Emblem', rarity: EMBLEMS[r.id].rarity };
    case 'banner': return { name: BANNERS[r.id].name, kind: 'Profil-Banner', rarity: BANNERS[r.id].rarity };
  }
  return { name: '?', kind: '', rarity: 'common' };
}

// Vorschaubild einer Belohnung (Canvas)
export function rewardIcon(r, size = 72) {
  if (r.type === 'skin') return skinPreviewCanvas(SKINS[r.id], size);
  if (r.type === 'char') return charSwatch(CHAR_ITEMS[r.id], size);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const bg = r.type === 'banner' ? BANNERS[r.id].colors : r.type === 'credits' ? ['#3a3018', '#16130a'] : r.type === 'boost' ? ['#1a3a2a', '#0a1a12'] : ['#2a2438', '#121018'];
  const g = x.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  if (r.type === 'credits') {
    x.fillStyle = '#ffd23a'; x.font = `900 ${size * 0.42}px system-ui`; x.fillText('◆', size / 2, size * 0.42);
    x.font = `800 ${size * 0.2}px system-ui`; x.fillText(r.amount, size / 2, size * 0.8);
  } else if (r.type === 'boost') {
    x.fillStyle = '#5dff8a'; x.font = `900 ${size * 0.34}px system-ui`; x.fillText('XP', size / 2, size * 0.42);
    x.font = `800 ${size * 0.18}px system-ui`; x.fillText('+25%', size / 2, size * 0.76);
  } else if (r.type === 'emblem') {
    x.fillStyle = '#ffffff'; x.font = `${size * 0.52}px system-ui`; x.fillText(EMBLEMS[r.id].icon, size / 2, size / 2 + 2);
  } else if (r.type === 'banner') {
    x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(size * 0.12, size * 0.6, size * 0.76, size * 0.12);
  }
  c.style.cssText = `position:static;width:${size}px;height:${size}px;border-radius:10px`;
  return c;
}

// ---------------------------------------------------------------- Status & Einlösen
export function rewardState(level, track) {
  const bp = profile.bp;
  if (bp.claimed[track].includes(level)) return 'claimed';
  if (track === 'premium' && !bp.premium) return 'premium';
  return level <= bpInfo().lvl ? 'ready' : 'locked';
}
export function bpClaimableCount() {
  let n = 0;
  for (let l = 1; l <= bpInfo().lvl; l++) if (rewardState(l, 'free') === 'ready') n++;
  return n;
}

// Gibt die Belohnung aus. Prüft Stufe, Spur und doppeltes Abholen – sonst passiert nichts.
export function claimBp(level, track) {
  if (rewardState(level, track) !== 'ready') return null;
  const r = bpReward(level, track);
  const bp = profile.bp;
  bp.claimed[track].push(level);
  let note = '';
  switch (r.type) {
    case 'credits': profile.credits += r.amount; break;
    case 'boost': bp.boost += r.rounds; break;
    case 'skin':
      if (profile.skins.includes(r.id)) { const ref = RARITY[SKINS[r.id].rarity].refund; profile.credits += ref; note = ` (schon vorhanden: +${ref} ◆)`; }
      else profile.skins.push(r.id);
      break;
    case 'char': if (!profile.charItems.includes(r.id)) profile.charItems.push(r.id); break;
    case 'emblem': case 'banner': if (!bp.owned.includes(r.id)) bp.owned.push(r.id); break;
  }
  save();
  return { r, note };
}

export function playerEmblem() { return EMBLEMS[profile.bp.emblem] || EMBLEMS.em_funke; }
export function playerBanner() { return BANNERS[profile.bp.banner] || BANNERS.bn_standard; }

// ---------------------------------------------------------------- Menü (wird in App gemischt)
export const battlePassMenus = {
  battlepass(focus = null) {
    const I = bpInfo();
    const bp = profile.bp;
    const claimable = bpClaimableCount();
    const pct = I.maxed ? 100 : I.rest / I.need * 100;
    const cols = [];
    for (let l = 1; l <= BATTLE_PASS.levels; l++) {
      const cur = l === I.lvl;
      cols.push(`<div class="bp-col ${l <= I.lvl ? 'reached' : ''} ${cur ? 'cur' : ''}" data-l="${l}">
        <div class="bp-lvl">${l}</div>
        ${['free', 'premium'].map(tr => {
          const r = bpReward(l, tr), info = rewardInfo(r), st = rewardState(l, tr);
          return `<button class="bp-card ${tr} st-${st}" data-card="${l}:${tr}" style="--rc:${RARITY[info.rarity].color}" title="${esc(info.name)}">
            <span class="bp-ico" data-ico="${l}:${tr}"></span>
            <span class="bp-name">${esc(info.name)}</span>
            <span class="bp-state">${st === 'claimed' ? '✔ Abgeholt' : st === 'ready' ? 'Abholen' : st === 'premium' ? '🔒 Premium' : '🔒 Stufe ' + l}</span>
          </button>`;
        }).join('')}
      </div>`);
    }
    const owned = bp.owned;
    const m = this.menu(`
      <div class="bp-head">
        <div class="bp-badge"><small>STUFE</small><b>${I.lvl}</b><small>von ${I.max}</small></div>
        <div style="flex:1;min-width:220px">
          <div class="bp-title">BATTLE PASS <span>${esc(BATTLE_PASS.name)}</span></div>
          <div class="bp-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
          <div class="dim">${I.maxed ? 'Maximale Stufe erreicht' : `${I.rest} / ${I.need} XP bis Stufe ${I.lvl + 1}`} · Gesamt ${I.total} XP${bp.boost ? ` · <span style="color:#5dff8a">XP-Booster aktiv: noch ${bp.boost} Runde${bp.boost > 1 ? 'n' : ''}</span>` : ''}</div>
        </div>
        <button class="primary" id="bpall" ${claimable ? '' : 'disabled'}>Alle abholen${claimable ? ` (${claimable})` : ''}</button>
      </div>
      <div class="bp-trackwrap">
        <div class="bp-rowlabels"><span></span><span class="free">GRATIS</span><span class="premium">PREMIUM</span></div>
        <div class="bp-track" id="bptrack">${cols.join('')}</div>
      </div>
      <div class="bp-detail" id="bpdetail"></div>
      <div class="card"><b>Pass-XP verdienen</b>
        <div class="dim">Jede Runde (Story, Koop, PvP, Battle Royale) gibt dieselben XP wie dein Rang. Tagesaufträge +400, Aufträge +250 Pass-XP. ${BATTLE_PASS.xpPerLevel} XP pro Stufe.</div></div>
      <div class="card"><b>Profil-Kosmetik</b> <span class="dim">– wird oben rechts und auf deiner Spielerkarte gezeigt</span>
        <div class="row" style="margin-top:8px" id="bpemb">${Object.entries(EMBLEMS).map(([id, e]) => `<button class="small cos ${bp.emblem === id ? 'on' : ''}" data-emb="${id}" ${owned.includes(id) ? '' : 'disabled'} title="${owned.includes(id) ? '' : 'Noch nicht freigeschaltet'}">${e.icon} ${esc(e.name)}</button>`).join('')}</div>
        <div class="row" style="margin-top:8px">${Object.entries(BANNERS).map(([id, b]) => `<button class="small cos ${bp.banner === id ? 'on' : ''}" data-ban="${id}" ${owned.includes(id) ? '' : 'disabled'} style="background:linear-gradient(90deg,${b.colors[0]},${b.colors[1]})">${esc(b.name)}</button>`).join('')}</div></div>
      <p class="dim bp-note">⚠ Premium-Pass: noch nicht verfügbar – es gibt keine Käufe und kein Echtgeld. Premium-Belohnungen sind nur als Vorschau zu sehen.<br>
      Fortschritt wird nur lokal in diesem Browser gespeichert (Prototyp, nicht manipulationssicher).</p>`, true);

    m.querySelectorAll('[data-ico]').forEach(el => { const [l, tr] = el.dataset.ico.split(':'); el.appendChild(rewardIcon(bpReward(+l, tr), 64)); });
    const detail = (l, tr) => {
      const r = bpReward(l, tr), info = rewardInfo(r), st = rewardState(l, tr), rar = RARITY[info.rarity];
      const d = $('#bpdetail');
      d.innerHTML = `<span data-big></span><div style="flex:1"><div class="dim">Stufe ${l} · ${tr === 'free' ? 'Gratis' : 'Premium'} · ${esc(info.kind)}</div>
        <h3 style="margin:2px 0;color:${rar.color}">${esc(info.name)}</h3><div class="dim" style="color:${rar.color}">${rar.name}</div></div>
        ${st === 'ready' ? `<button class="primary" data-claim="${l}:${tr}">Abholen</button>` : `<span class="dim">${st === 'claimed' ? '✔ Abgeholt' : st === 'premium' ? '🔒 Premium nicht verfügbar' : `🔒 Ab Stufe ${l}`}</span>`}`;
      d.querySelector('[data-big]').appendChild(rewardIcon(r, 72));
      const b = d.querySelector('[data-claim]');
      if (b) b.onclick = () => this.bpClaim(l, tr);
      // Outfit-Teile direkt am Charakter zeigen, Skins an der Primärwaffe
      if (r.type === 'char') { const it = CHAR_ITEMS[r.id]; this.previewOutfit(it.slot, r.id); }
      else if (r.type === 'skin') this.previewSkin(SKINS[r.id]);
      else this.showCharacter();
    };
    m.querySelectorAll('[data-card]').forEach(c => {
      const [l, tr] = c.dataset.card.split(':');
      c.onclick = () => { sfx.sfxUI(); if (rewardState(+l, tr) === 'ready') this.bpClaim(+l, tr); else detail(+l, tr); };
      c.onmouseenter = () => detail(+l, tr);
    });
    $('#bpall').onclick = () => {
      let n = 0;
      for (let l = 1; l <= I.lvl; l++) if (claimBp(l, 'free')) n++;
      if (n) { sfx.sfxUI('win'); this.toast(`${n} Battle-Pass-Belohnung${n > 1 ? 'en' : ''} abgeholt!`); }
      this.battlepass();
    };
    m.querySelectorAll('[data-emb]').forEach(b => b.onclick = () => { profile.bp.emblem = b.dataset.emb; save(); sfx.sfxUI(); this.battlepass(); });
    m.querySelectorAll('[data-ban]').forEach(b => b.onclick = () => { profile.bp.banner = b.dataset.ban; save(); sfx.sfxUI(); this.battlepass(); });

    // Spur zur aktuellen Stufe (oder zur gerade abgeholten) scrollen
    const tr = $('#bptrack');
    const target = tr.querySelector(`[data-l="${focus || Math.max(1, I.lvl)}"]`);
    if (target) tr.scrollLeft = target.offsetLeft - tr.clientWidth / 2 + target.offsetWidth / 2;
    tr.onwheel = e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { tr.scrollLeft += e.deltaY; e.preventDefault(); } };
    const f = focus || I.lvl;
    detail(f, 'free');
    if (focus) tr.querySelector(`[data-card="${focus}:free"]`)?.classList.add('pop');
  },

  bpClaim(l, tr) {
    const res = claimBp(l, tr);
    if (!res) return;
    const info = rewardInfo(res.r);
    sfx.sfxUI(info.rarity === 'legendary' || info.rarity === 'epic' ? 'legendary' : 'win');
    this.toast(`Abgeholt: ${info.name}${res.note}`);
    this.battlepass(l);
  },
};
