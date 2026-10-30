// Lokaler Spielstand (localStorage): Währung, XP, Besitz, Loadout, Skins, Quests, Einstellungen.
import { WEAPONS, ATTACHMENTS, SKINS, QUESTS, DAILY_TEMPLATES, MISSIONS, CHAR_ITEMS, DEFAULT_CHAR, BATTLE_PASS, levelInfo } from './data.js';

const KEY = 'glutkern-profil-v1';

export const DEFAULT_CHEATS = {
  enabled: false, wallhack: false, esp: false, aimbot: false, aimFov: 30, aimSmooth: 12, aimBone: 'kopf', aimMode: 'zielen',
  speed: 1, jump: 1, maxHp: 100, god: false, infAmmo: false, noRecoil: false, rapid: 1,
};

function defaults() {
  return {
    name: 'Rekrut' + Math.floor(Math.random() * 900 + 100),
    credits: 500,
    xp: 0,
    weapons: ['falke', 'stachel'],
    attachments: ['rotpunkt'],
    skins: ['werk'],
    customSkins: [], // {id, name, base, accent, pattern, scale, glow}
    loadout: { primary: 'falke', secondary: 'stachel' },
    builds: {},      // weaponId -> {optic, muzzle, mag, grip, stock}
    weaponSkin: {},  // weaponId -> skinKey
    missions: {},    // id -> {done, best}
    quests: {},      // id -> {p, claimed}
    daily: { date: '', list: [] },
    stats: { kills: 0, deaths: 0, heads: 0, cases: 0, pvpWins: 0 },
    settings: { sens: 1.0, fov: 80, quality: 'mittel', volume: 0.7, difficulty: 'normal' },
    character: { ...DEFAULT_CHAR },
    charItems: [],   // gekaufte / gezogene Ausrüstung
    cheatsUnlocked: false,
    cheats: { ...DEFAULT_CHEATS },
    bp: defaultBp(),
  };
}
// Battle-Pass-Fortschritt. Lokal im Browser – kein sicheres Online-Fortschrittssystem.
function defaultBp() {
  return { season: BATTLE_PASS.id, xp: 0, claimed: { free: [], premium: [] }, premium: false, boost: 0, owned: ['em_funke', 'bn_standard'], emblem: 'em_funke', banner: 'bn_standard' };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = defaults();
      const p = JSON.parse(raw);
      return { ...d, ...p, settings: { ...d.settings, ...p.settings }, stats: { ...d.stats, ...p.stats }, character: { ...d.character, ...p.character }, cheats: { ...d.cheats, ...p.cheats },
        bp: p.bp && p.bp.season === BATTLE_PASS.id ? { ...d.bp, ...p.bp, claimed: { ...d.bp.claimed, ...p.bp.claimed } } : d.bp };
    }
  } catch { /* kaputter Spielstand -> neu */ }
  return defaults();
}

export const profile = load();
const listeners = new Set();
export function onProfileChange(fn) { listeners.add(fn); }
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* privat-modus */ }
  for (const fn of listeners) fn();
}
export function resetProfile() { localStorage.removeItem(KEY); location.reload(); }

let toastFn = () => {};
export function setToast(fn) { toastFn = fn; }

export function addCredits(n, why) {
  if (!n) return;
  profile.credits += Math.round(n);
  if (why) toastFn(`+${Math.round(n)} ◆ ${why}`);
  save();
}
export function spend(n) {
  if (profile.credits < n) return false;
  profile.credits -= n;
  save();
  return true;
}
export function addXP(n) {
  addBpXP(n, true); // jede gespielte Runde zählt auch für den Battle Pass
  const before = levelInfo(profile.xp).lvl;
  profile.xp += Math.round(n);
  const after = levelInfo(profile.xp);
  if (after.lvl > before) {
    toastFn(`Rang aufgestiegen! Stufe ${after.lvl} – ${after.rank} (+${after.lvl * 50} ◆)`);
    profile.credits += after.lvl * 50;
  }
  save();
}

// ---------------------------------------------------------------- Battle Pass (Fortschritt)
// Stufe 1 hat man von Anfang an; jede weitere Stufe kostet BATTLE_PASS.xpPerLevel XP.
export function bpInfo(xp = profile.bp.xp) {
  const per = BATTLE_PASS.xpPerLevel, max = BATTLE_PASS.levels;
  const lvl = Math.min(max, 1 + Math.floor(xp / per));
  const maxed = lvl >= max;
  return { lvl, max, maxed, rest: maxed ? per : xp % per, need: per, total: xp };
}
// round = XP aus einer gespielten Runde (nur dann wirkt und verbraucht sich ein XP-Booster)
export function addBpXP(n, round = false) {
  n = Math.max(0, Math.round(n));
  if (!n) return;
  const bp = profile.bp;
  let gain = n;
  if (round && bp.boost > 0) { gain = Math.round(n * 1.25); bp.boost--; }
  const before = bpInfo().lvl;
  bp.xp = Math.min(bp.xp + gain, (BATTLE_PASS.levels - 1) * BATTLE_PASS.xpPerLevel);
  const after = bpInfo().lvl;
  if (after > before) toastFn(`Battle Pass: Stufe ${after} erreicht – Belohnung abholbereit!`);
}

export function build(weaponId) {
  if (!profile.builds[weaponId]) profile.builds[weaponId] = {};
  return profile.builds[weaponId];
}

export function skinDef(key) {
  if (!key) return SKINS.werk;
  if (key.startsWith('custom:')) return profile.customSkins.find(s => 'custom:' + s.id === key) || SKINS.werk;
  return SKINS[key] || SKINS.werk;
}

export function missionUnlocked(i) {
  return i === 0 || !!profile.missions[MISSIONS[i - 1].id]?.done;
}

// ---------------------------------------------------------------- Quests
function today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

export function dailyQuests() {
  const t = today();
  if (profile.daily.date !== t) {
    let h = hash(t);
    const pool = DAILY_TEMPLATES.map((q, i) => i);
    const list = [];
    for (let k = 0; k < 3; k++) {
      h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
      const idx = pool.splice(h % pool.length, 1)[0];
      list.push({ ...DAILY_TEMPLATES[idx], id: `d_${t}_${idx}`, daily: true });
    }
    profile.daily = { date: t, list };
    save();
  }
  return profile.daily.list;
}
export function allQuests() { return [...dailyQuests(), ...QUESTS]; }
export function questState(q) {
  if (!profile.quests[q.id]) profile.quests[q.id] = { p: 0, claimed: false };
  return profile.quests[q.id];
}

function matches(q, data) {
  if (!q.match) return true;
  return Object.entries(q.match).every(([k, v]) => data[k] === v);
}

// Ereignis melden: 'kill' {cls, head, mode, boss}, 'mission' {id, coop}, 'pvpWin', 'pvpPlayed', 'case', 'skin', 'storyDone'
export function track(event, data = {}) {
  if (event === 'kill') { profile.stats.kills++; if (data.head) profile.stats.heads++; }
  for (const q of allQuests()) {
    if (q.event !== event || !matches(q, data)) continue;
    const st = questState(q);
    if (st.claimed || st.p >= q.goal) continue;
    if (event === 'storyDone') st.p = data.count;
    else st.p++;
    if (st.p >= q.goal) { st.p = q.goal; toastFn(`Quest erfüllt: ${q.name} – im Menü „Quests“ abholen!`); }
  }
  save();
}
export function claimQuest(q) {
  const st = questState(q);
  if (st.claimed || st.p < q.goal) return;
  st.claimed = true;
  addBpXP(q.daily ? 400 : 250);
  addCredits(q.reward, q.name);
}
export function claimableCount() {
  return allQuests().filter(q => { const s = questState(q); return !s.claimed && s.p >= q.goal; }).length;
}

export function ownsWeapon(id) { return profile.weapons.includes(id); }
export function ownsAttachment(id) { return profile.attachments.includes(id); }
export { WEAPONS, ATTACHMENTS };

// ---------------------------------------------------------------- Charakter
export function ownsChar(id) {
  const it = CHAR_ITEMS[id];
  if (!it) return false;
  return !!(it.free || profile.charItems.includes(id) || (it.mission && profile.missions[it.mission]?.done));
}
// Aussehen als Optionen für makeSoldier (wird auch an Mitspieler geschickt)
export function lookFromProfile(c = profile.character) {
  const g = k => CHAR_ITEMS[c[k]] || CHAR_ITEMS[DEFAULT_CHAR[k]];
  return {
    color: g('uniform').color, pants: g('pants').color, vest: g('vest').color, helmet: g('headgear').color, headgear: g('headgear').shape,
    mask: g('mask').shape, maskColor: g('mask').color, eye: g('eyes').color, skin: g('face').color,
  };
}
// Aktive Cheat-Werte (oder neutrale Werte, wenn aus)
export function activeCheats() {
  const c = profile.cheats;
  if (!profile.cheatsUnlocked || !c.enabled) return DEFAULT_CHEATS;
  return c;
}
