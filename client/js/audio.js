// Synthetische Sounds über WebAudio – keine Audiodateien nötig.
let ctx = null, master = null, noiseBuf = null;
let volume = 0.7;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function setVolume(v) { volume = v; if (master) master.gain.value = v; }

function out(gain, pan) {
  const g = ctx.createGain();
  g.gain.value = gain;
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p); p.connect(master);
  } else g.connect(master);
  return g;
}

function noise(t0, dur, freq, q, gain, dest, type = 'lowpass') {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
}
function tone(t0, dur, f0, f1, gain, dest, type = 'square') {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(dest);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

const GUN = {
  ar: { f: 2400, d: 0.16, low: 110 }, smg: { f: 3200, d: 0.11, low: 150 }, dmr: { f: 1800, d: 0.25, low: 90 },
  shotgun: { f: 1300, d: 0.35, low: 70 }, lmg: { f: 2000, d: 0.18, low: 95 }, sniper: { f: 1400, d: 0.5, low: 60 },
  pistol: { f: 2800, d: 0.13, low: 140 }, enemy: { f: 2100, d: 0.15, low: 120 },
};

// dist: Entfernung zum Hörer, pan: -1..1
export function sfxShot(cls, silent = false, dist = 0, pan = 0) {
  if (!ctx) return;
  const g = GUN[cls] || GUN.ar;
  const att = 1 / (1 + dist * 0.06);
  if (att < 0.03) return;
  const t = ctx.currentTime;
  const o = out((silent ? 0.25 : 0.9) * att, pan);
  noise(t, g.d * (silent ? 0.5 : 1), silent ? 900 : g.f * (dist > 30 ? 0.4 : 1), 0.7, 0.9, o);
  if (!silent) tone(t, g.d * 0.8, g.low * 2, g.low * 0.6, 0.6, o, 'triangle');
}
export function sfxExplosion(dist = 0, pan = 0) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = out(1.2 / (1 + dist * 0.04), pan);
  noise(t, 1.1, 500, 0.5, 1, o);
  tone(t, 0.8, 120, 30, 0.9, o, 'sine');
}
export function sfxHit(head) {
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(t, 0.06, head ? 1900 : 1300, head ? 2400 : 1100, 0.18, out(0.6), 'square');
}
export function sfxKill() {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(0.5);
  tone(t, 0.08, 900, 900, 0.2, o, 'square');
  tone(t + 0.08, 0.12, 1350, 1350, 0.2, o, 'square');
}
export function sfxReload(stage) {
  if (!ctx) return;
  const t = ctx.currentTime;
  noise(t, 0.05, stage ? 3500 : 1800, 4, 0.5, out(0.5), 'bandpass');
}
export function sfxEmpty() {
  if (!ctx) return;
  noise(ctx.currentTime, 0.03, 4000, 6, 0.4, out(0.4), 'bandpass');
}
export function sfxHurt() {
  if (!ctx) return;
  const t = ctx.currentTime;
  tone(t, 0.15, 220, 90, 0.35, out(0.5), 'sawtooth');
}
export function sfxPickup() {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(0.4);
  tone(t, 0.08, 660, 660, 0.25, o, 'triangle');
  tone(t + 0.07, 0.12, 990, 990, 0.25, o, 'triangle');
}
export function sfxUI(kind = 'click') {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(0.3);
  if (kind === 'tick') tone(t, 0.03, 1500, 1500, 0.15, o, 'square');
  else if (kind === 'win') { [523, 659, 784, 1046].forEach((f, i) => tone(t + i * 0.1, 0.25, f, f, 0.25, o, 'triangle')); }
  else if (kind === 'legendary') { [523, 784, 1046, 1318, 1568].forEach((f, i) => tone(t + i * 0.08, 0.4, f, f, 0.25, o, 'triangle')); }
  else tone(t, 0.05, 700, 500, 0.15, o, 'triangle');
}
export function sfxStep() {
  if (!ctx) return;
  noise(ctx.currentTime, 0.06, 500, 1, 0.12, out(0.4));
}
export function sfxLaser(dist, pan) {
  if (!ctx) return;
  tone(ctx.currentTime, 0.4, 1800, 2600, 0.08 / (1 + dist * 0.02), out(0.5, pan), 'sine');
}
