// Battle Royale: Zonen-Zeitplan. Wird vom Server (Schaden) UND vom Browser (Anzeige) benutzt.

export function mulberry(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// [Wartezeit s, Schrumpfdauer s, neuer Radius, Schaden/s außerhalb]
const PHASES = [[45, 30, 70, 2], [35, 25, 46, 4], [30, 22, 26, 7], [25, 20, 12, 11], [20, 18, 0, 18]];
export const DROP_TIME = 6; // Sekunden Fallschirmsprung vor der ersten Phase

export function makeZone(seed, startMs) {
  const rnd = mulberry(seed ^ 0xb0b);
  const phases = [];
  let cx = 0, cz = 0, r = 100, t = DROP_TIME;
  for (const [wait, shrink, nr, dps] of PHASES) {
    const a = rnd() * Math.PI * 2, d = rnd() * Math.max(0, Math.min(r - nr, 40)) * 0.8;
    let tx = cx + Math.cos(a) * d, tz = cz + Math.sin(a) * d;
    const lim = Math.max(0, 60 - nr);
    tx = Math.max(-lim, Math.min(lim, tx)); tz = Math.max(-lim, Math.min(lim, tz));
    phases.push({ t0: t + wait, t1: t + wait + shrink, fx: cx, fz: cz, fr: r, tx, tz, tr: nr, dps });
    t += wait + shrink; cx = tx; cz = tz; r = nr;
  }
  return { start: startMs, phases };
}

// Aktueller Kreis: {x, z, r, dps, shrinking, nextIn (s bis zur nächsten Schrumpfung), next {x,z,r}}
export function zoneAt(zone, nowMs) {
  const s = (nowMs - zone.start) / 1000;
  let dps = 1;
  for (const p of zone.phases) {
    if (s < p.t0) return { x: p.fx, z: p.fz, r: p.fr, dps, shrinking: false, nextIn: p.t0 - s, next: { x: p.tx, z: p.tz, r: p.tr } };
    if (s < p.t1) {
      const k = (s - p.t0) / (p.t1 - p.t0);
      return { x: p.fx + (p.tx - p.fx) * k, z: p.fz + (p.tz - p.fz) * k, r: p.fr + (p.tr - p.fr) * k, dps: p.dps, shrinking: true, nextIn: p.t1 - s, next: { x: p.tx, z: p.tz, r: p.tr } };
    }
    dps = p.dps;
  }
  const l = zone.phases[zone.phases.length - 1];
  return { x: l.tx, z: l.tz, r: l.tr, dps: l.dps * 1.5, shrinking: false, nextIn: 0, next: null };
}
