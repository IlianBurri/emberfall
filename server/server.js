// EMBERFALL – HTTP-Server (liefert den Browser-Client aus) + WebSocket-Lobby für LAN-PvP und Koop.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { WebSocketServer } from 'ws';
import { makeZone, zoneAt } from '../client/js/zone.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CLIENT = path.join(ROOT, 'client');
const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const PORT = Number(process.env.PORT || (portArg >= 0 ? args[portArg + 1] : 3000));
// In der Cloud (Render setzt RENDER=true) keinen Browser öffnen
const CLOUD = !!process.env.RENDER || process.env.NODE_ENV === 'production';
const OPEN_BROWSER = !args.includes('--no-open') && !CLOUD;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};
const STATIC = {
  '/vendor/three.module.js': path.join(ROOT, 'node_modules/three/build/three.module.js'),
  '/vendor/three.core.js': path.join(ROOT, 'node_modules/three/build/three.core.js'),
};

const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch { res.writeHead(400); return res.end(); } // kaputte Adresse darf den Server nicht abstürzen lassen
  if (url === '/health') { res.writeHead(200); return res.end('ok'); }
  if (url === '/') url = '/index.html';
  let file = STATIC[url] || path.join(CLIENT, url);
  if (!file.startsWith(CLIENT) && !STATIC[url]) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Nicht gefunden'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---------------------------------------------------------------- Lobby / Räume
const wss = new WebSocketServer({ server, maxPayload: 64 * 1024 });

// Herzschlag: tote Verbindungen aufräumen und Cloud-Proxys die Verbindung nicht schließen lassen
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 25000);
const clients = new Map(); // id -> {id, ws, name, room}
const rooms = new Map();   // id -> room
let nextId = 1;
let nextRoom = 1;

const PVP_KILL_LIMIT = 20;
const PVP_TIME = 5 * 60 * 1000;

function send(c, msg) { if (c && c.ws.readyState === 1) c.ws.send(JSON.stringify(msg)); }
function broadcast(room, msg, exceptId) {
  const data = JSON.stringify(msg);
  for (const p of room.players.values()) if (p.id !== exceptId && p.ws.readyState === 1) p.ws.send(data);
}
function roomInfo(r) {
  return {
    id: r.id, name: r.name, mode: r.mode, mission: r.mission, map: r.map, host: r.host, started: r.started,
    players: [...r.players.values()].map(p => ({ id: p.id, name: p.name, kills: p.kills, deaths: p.deaths, look: p.look })),
  };
}
function roomList() { return [...rooms.values()].map(roomInfo); }
function pushLobby() {
  const list = roomList();
  for (const c of clients.values()) if (!c.room) send(c, { t: 'rooms', rooms: list });
}
function pushRoom(r) { broadcast(r, { t: 'room', room: roomInfo(r) }); pushLobby(); }

function leaveRoom(c) {
  const r = c.room;
  if (!r) return;
  if (r.started && r.mode === 'br') brEliminate(r, c);
  r.players.delete(c.id);
  c.room = null;
  broadcast(r, { t: 'left', id: c.id });
  if (r.players.size === 0) { rooms.delete(r.id); pushLobby(); return; }
  if (r.host === c.id) {
    r.host = r.players.keys().next().value;
    broadcast(r, { t: 'host', id: r.host });
  }
  pushRoom(r);
}

function startMatch(r) {
  r.started = true;
  r.seed = Math.floor(Math.random() * 1e9);
  for (const p of r.players.values()) { p.kills = 0; p.deaths = 0; p.hp = p.maxHp || 100; p.armor = 0; p.alive = true; p.lastHit = 0; p.place = 0; p.pos = null; }
  if (r.mode === 'pvp') r.endAt = Date.now() + PVP_TIME;
  if (r.mode === 'br') {
    r.zone = makeZone(r.seed, Date.now());
    r.taken = new Set();
    r.brSize = r.players.size;
  }
  broadcast(r, { t: 'started', room: roomInfo(r), seed: r.seed, endAt: r.endAt || 0, now: Date.now(), zone: r.zone, taken: [] });
  if (r.mode === 'br') broadcast(r, { t: 'alive', n: aliveCount(r) });
  pushLobby();
}

function aliveCount(r) { let n = 0; for (const p of r.players.values()) if (p.alive && !p.spectator) n++; return n; }

// Battle Royale: Spieler scheidet aus (Kill, Zone oder Verlassen)
function brEliminate(r, v) {
  if (!v.alive) return;
  v.alive = false;
  v.place = aliveCount(r) + 1;
  const n = aliveCount(r);
  broadcast(r, { t: 'alive', n });
  if (n <= (r.brSize > 1 ? 1 : 0)) setTimeout(() => endMatch(r), 1500);
}

function endMatch(r) {
  if (!r.started) return;
  r.started = false;
  let ranking = [...r.players.values()].map(p => ({ id: p.id, name: p.name, kills: p.kills, deaths: p.deaths, place: p.alive && !p.spectator ? 1 : p.place || 99 }));
  if (r.mode === 'br') ranking.sort((a, b) => a.place - b.place || b.kills - a.kills);
  else ranking.sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  broadcast(r, { t: 'end', ranking, mode: r.mode, total: r.mode === 'br' ? Math.max(r.brSize || 1, ranking.length) : ranking.length });
  for (const p of r.players.values()) p.spectator = false;
  pushRoom(r);
}

function scores(r) {
  broadcast(r, { t: 'score', players: [...r.players.values()].map(p => ({ id: p.id, name: p.name, kills: p.kills, deaths: p.deaths })) });
}

wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  const c = { id: nextId++, ws, name: 'Rekrut', room: null, hp: 100, alive: true, kills: 0, deaths: 0, lastHit: 0 };
  clients.set(c.id, c);
  send(c, { t: 'welcome', id: c.id, rooms: roomList() });

  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const r = c.room;
    switch (m.t) {
      case 'hello':
        c.name = String(m.name || 'Rekrut').slice(0, 16);
        if (m.look && typeof m.look === 'object') {
          c.look = {};
          for (const k of ['color', 'pants', 'vest', 'helmet', 'headgear', 'mask', 'maskColor', 'eye', 'skin']) {
            const v = m.look[k];
            if (typeof v === 'string' && /^[#a-zA-Z0-9]{1,10}$/.test(v)) c.look[k] = v;
          }
          if (c.room) pushRoom(c.room);
        }
        break;
      case 'list':
        send(c, { t: 'rooms', rooms: roomList() });
        break;
      case 'create': {
        leaveRoom(c);
        const room = {
          id: nextRoom++, name: String(m.name || `${c.name}s Raum`).slice(0, 24), mode: ['coop', 'br'].includes(m.mode) ? m.mode : 'pvp',
          mission: m.mission || 'm1', map: m.map || 'hafen', host: c.id, players: new Map(), started: false,
        };
        rooms.set(room.id, room);
        room.players.set(c.id, c);
        c.room = room;
        send(c, { t: 'joined', room: roomInfo(room) });
        pushRoom(room);
        break;
      }
      case 'join': {
        const room = rooms.get(m.id);
        if (!room) return send(c, { t: 'error', msg: 'Raum existiert nicht mehr.' });
        if (room.players.size >= 8) return send(c, { t: 'error', msg: 'Raum ist voll (max. 8).' });
        leaveRoom(c);
        c.kills = 0; c.deaths = 0; c.hp = 100; c.armor = 0; c.alive = true; c.spectator = false;
        if (room.started && room.mode === 'br') { c.alive = false; c.spectator = true; } // spät beigetreten: zuschauen
        room.players.set(c.id, c);
        c.room = room;
        send(c, { t: 'joined', room: roomInfo(room) });
        broadcast(room, { t: 'joinedOther', id: c.id, name: c.name, look: c.look }, c.id);
        if (room.started) send(c, { t: 'started', room: roomInfo(room), seed: room.seed, endAt: room.endAt || 0, now: Date.now(), late: true, zone: room.zone, taken: room.taken ? [...room.taken] : [] });
        pushRoom(room);
        break;
      }
      case 'leave':
        leaveRoom(c);
        send(c, { t: 'rooms', rooms: roomList() });
        break;
      case 'config':
        if (r && r.host === c.id && !r.started) {
          if (m.mission) r.mission = m.mission;
          if (m.map) r.map = m.map;
          pushRoom(r);
        }
        break;
      case 'start':
        if (r && r.host === c.id && !r.started) startMatch(r);
        break;
      case 'stop':
        if (r && r.host === c.id) endMatch(r);
        break;
      // ---------- Spielzustand (wird an alle anderen im Raum weitergereicht)
      case 'st':
        if (r) { c.pos = m.p; m.id = c.id; if (r.mode === 'br' && !c.alive) m.a = false; broadcast(r, m, c.id); }
        break;
      case 'shot': case 'nade': case 'en': case 'ms': case 'eshot': case 'ekill': case 'mdone': case 'fx':
        if (r) { m.id = c.id; broadcast(r, m, c.id); }
        break;
      case 'ehit': case 'act': // Koop: an den Host weiterleiten
        if (r) { m.id = c.id; send(clients.get(r.host), m); }
        break;
      case 'edmg': // Koop: Host meldet Gegnerschaden an einen Spieler
        if (r) send(clients.get(m.target), { t: 'edmg', dmg: m.dmg, from: m.from });
        break;
      case 'hit': { // PvP: Server führt die Lebenspunkte
        if (!r || !r.started || (r.mode !== 'pvp' && r.mode !== 'br') || !c.alive) break;
        const v = r.players.get(m.target);
        if (!v || !v.alive || v.god) break;
        let dmg = Math.max(0, Math.min(400, Number(m.dmg) || 0));
        if (v.armor > 0) { const a = Math.min(v.armor, dmg * 0.7); v.armor -= a; dmg -= a; }
        v.hp -= dmg;
        v.lastHit = Date.now();
        send(v, { t: 'hurt', hp: Math.max(0, v.hp), armor: Math.round(v.armor || 0), from: c.id, dmg });
        if (v.hp <= 0) {
          v.alive = false; v.deaths++;
          if (v.id !== c.id) c.kills++;
          broadcast(r, { t: 'kill', k: c.id, v: v.id, w: m.w, head: !!m.head });
          scores(r);
          if (r.mode === 'br') { v.alive = true; brEliminate(r, v); break; }
          setTimeout(() => {
            if (!r.players.has(v.id) || !r.started) return;
            v.alive = true; v.hp = v.maxHp || 100;
            broadcast(r, { t: 'respawn', id: v.id });
          }, 3000);
          if (c.kills >= PVP_KILL_LIMIT) endMatch(r);
        }
        break;
      }
      case 'loot': { // Battle Royale: wer zuerst kommt, bekommt den Gegenstand
        if (!r || r.mode !== 'br' || !r.started || !c.alive || r.taken.has(m.i)) break;
        r.taken.add(m.i);
        broadcast(r, { t: 'looted', i: m.i, by: c.id });
        if (m.kind === 'med') { c.hp = Math.min(c.maxHp || 100, c.hp + 50); send(c, { t: 'heal', hp: c.hp }); }
        if (m.kind === 'armor') { c.armor = Math.min(100, (c.armor || 0) + 50); send(c, { t: 'armor', armor: c.armor }); }
        break;
      }
      case 'cheats': // Max-Leben und Godmode aus dem Cheat-Menü
        c.maxHp = Math.max(100, Math.min(1000, Number(m.maxHp) || 100));
        c.god = !!m.god;
        if (r && r.started && c.alive) { c.hp = c.maxHp; send(c, { t: 'heal', hp: c.hp }); }
        break;
      case 'forfeit': // Battle Royale verlassen
        if (r && r.started && r.mode === 'br' && c.alive) { c.deaths++; broadcast(r, { t: 'kill', k: c.id, v: c.id, w: 'aufgegeben', head: false }); brEliminate(r, c); }
        break;
      case 'suicide':
        if (r && r.started && r.mode === 'pvp' && c.alive) {
          c.alive = false; c.deaths++; c.hp = 0;
          broadcast(r, { t: 'kill', k: c.id, v: c.id, w: 'welt', head: false });
          scores(r);
          setTimeout(() => { if (r.players.has(c.id) && r.started) { c.alive = true; c.hp = 100; broadcast(r, { t: 'respawn', id: c.id }); } }, 3000);
        }
        break;
    }
  });

  ws.on('close', () => { leaveRoom(c); clients.delete(c.id); });
});

// PvP-Zeitlimit und Lebensregeneration
setInterval(() => {
  const now = Date.now();
  for (const r of rooms.values()) {
    if (r.started && r.mode === 'br') { brTick(r, now); continue; }
    if (!r.started || r.mode !== 'pvp') continue;
    if (now >= r.endAt) { endMatch(r); continue; }
    for (const p of r.players.values()) {
      const max = p.maxHp || 100;
      if (p.alive && p.hp < max && now - p.lastHit > 4500) {
        p.hp = Math.min(max, p.hp + 10 * max / 100);
        send(p, { t: 'heal', hp: p.hp });
      }
    }
  }
}, 250);

// Zonenschaden (Server kennt die Positionen aus den 'st'-Nachrichten)
function brTick(r, now) {
  const z = zoneAt(r.zone, now);
  for (const p of r.players.values()) {
    if (!p.alive || p.spectator || !p.pos || p.god) continue;
    if (Math.hypot(p.pos[0] - z.x, p.pos[2] - z.z) <= z.r) continue;
    const dmg = z.dps * 0.25;
    p.hp -= dmg;
    send(p, { t: 'hurt', hp: Math.max(0, p.hp), armor: Math.round(p.armor || 0), from: 0, dmg, zone: true });
    if (p.hp <= 0) {
      p.deaths++;
      broadcast(r, { t: 'kill', k: p.id, v: p.id, w: 'zone', head: false });
      brEliminate(r, p);
    }
  }
}

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} ist schon belegt. Läuft der Server schon? Sonst: npm start -- --port 3001\n`);
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, '0.0.0.0', () => {
  const local = `http://localhost:${PORT}`;
  console.log('\n  ==============================================');
  console.log('   EMBERFALL  –  Server läuft');
  console.log('  ==============================================');
  console.log(`   Auf diesem PC:      ${local}`);
  for (const ip of lanAddresses()) console.log(`   Freunde im LAN:     http://${ip}:${PORT}`);
  console.log('\n   Beenden mit Strg+C\n');
  if (OPEN_BROWSER) {
    const cmd = process.platform === 'win32' ? `start "" "${local}"` : process.platform === 'darwin' ? `open "${local}"` : `xdg-open "${local}"`;
    exec(cmd, () => {});
  }
});
