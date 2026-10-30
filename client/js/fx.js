// Effekte mit wenigen Draw Calls: ein Partikel-Points-Objekt, ein LineSegments für Leuchtspuren, ein Pool für Explosionen.
import * as THREE from 'three';

const _z = new THREE.Vector3(0, 0, 1), _hq = new THREE.Quaternion(), _hr = new THREE.Quaternion(), _hp = new THREE.Vector3(), _hs = new THREE.Vector3(), _hm = new THREE.Matrix4();
const PN = 800, TN = 96, LN = 16, HN = 150; // HN = gleichzeitig sichtbare Einschusslöcher

export class FX {
  constructor(scene) {
    this.scene = scene;
    // Partikel
    this.pPos = new Float32Array(PN * 3).fill(-9999);
    this.pCol = new Float32Array(PN * 3);
    this.pVel = new Float32Array(PN * 3);
    this.pLife = new Float32Array(PN);
    this.pGrav = new Float32Array(PN);
    this.pNext = 0;
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    pg.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    // Runde, weiche Partikel statt Quadrate
    const dot = document.createElement('canvas'); dot.width = dot.height = 32;
    const dx = dot.getContext('2d'), grad = dx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.6)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    dx.fillStyle = grad; dx.fillRect(0, 0, 32, 32);
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.12, vertexColors: true, sizeAttenuation: true, depthWrite: false, transparent: true, map: new THREE.CanvasTexture(dot), alphaTest: 0.02 }));
    this.points.frustumCulled = false;
    scene.add(this.points);
    // Leuchtspuren
    this.tPos = new Float32Array(TN * 6).fill(-9999);
    this.tCol = new Float32Array(TN * 6);
    this.tLife = new Float32Array(TN);
    this.tNext = 0;
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(this.tPos, 3));
    tg.setAttribute('color', new THREE.BufferAttribute(this.tCol, 3));
    this.lines = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }));
    this.lines.frustumCulled = false;
    scene.add(this.lines);
    // Laser (Scharfschützen)
    this.lPos = new Float32Array(LN * 6).fill(-9999);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(this.lPos, 3));
    this.lasers = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xff2020 }));
    this.lasers.frustumCulled = false;
    scene.add(this.lasers);
    // Explosionen
    this.booms = [];
    const bg = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, depthWrite: false }));
      m.visible = false;
      scene.add(m);
      this.booms.push({ m, t: 1 });
    }
    // Einschusslöcher: ein InstancedMesh (1 Draw Call), Ringpuffer – das älteste Loch verschwindet zuerst
    const hc = document.createElement('canvas'); hc.width = hc.height = 64;
    const hx = hc.getContext('2d');
    let g = hx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.3, 'rgba(6,5,4,1)'); g.addColorStop(0.36, 'rgba(48,38,28,0.95)');
    g.addColorStop(0.46, 'rgba(70,58,44,0.6)'); g.addColorStop(0.7, 'rgba(30,24,18,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    hx.fillStyle = g; hx.fillRect(0, 0, 64, 64);
    hx.strokeStyle = 'rgba(20,16,12,0.55)'; hx.lineWidth = 1.5; // feine Risse
    for (let i = 0; i < 7; i++) { const a = Math.random() * 6.28, r0 = 7, r1 = 14 + Math.random() * 12; hx.beginPath(); hx.moveTo(32 + Math.cos(a) * r0, 32 + Math.sin(a) * r0); hx.lineTo(32 + Math.cos(a + 0.2) * r1, 32 + Math.sin(a + 0.2) * r1); hx.stroke(); }
    const ht = new THREE.CanvasTexture(hc); ht.colorSpace = THREE.SRGBColorSpace;
    this.holes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({
      map: ht, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), HN);
    this.holes.frustumCulled = false;
    this.holes.renderOrder = 1;
    this.hNext = 0;
    const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < HN; i++) this.holes.setMatrixAt(i, hide);
    scene.add(this.holes);
    this.c = new THREE.Color();
  }

  // Einschussloch auf eine Oberfläche legen (p = Trefferpunkt, n = Flächennormale)
  bulletHole(p, n, size = 0.1) {
    const q = _hq.setFromUnitVectors(_z, n);
    q.multiply(_hr.setFromAxisAngle(_z, Math.random() * Math.PI * 2)); // zufällig gedreht -> keine Wiederholung sichtbar
    _hp.copy(p).addScaledVector(n, 0.004);
    _hs.setScalar(size * (0.8 + Math.random() * 0.45));
    _hm.compose(_hp, q, _hs);
    this.holes.setMatrixAt(this.hNext, _hm);
    this.holes.instanceMatrix.needsUpdate = true;
    this.hNext = (this.hNext + 1) % HN;
  }

  burst(p, n, color, speed = 4, life = 0.5, grav = 9) {
    this.c.set(color);
    for (let k = 0; k < n; k++) {
      const i = this.pNext; this.pNext = (this.pNext + 1) % PN;
      this.pPos[i * 3] = p.x; this.pPos[i * 3 + 1] = p.y; this.pPos[i * 3 + 2] = p.z;
      const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 2 - 1);
      const s = speed * (0.3 + Math.random() * 0.7);
      this.pVel[i * 3] = Math.sin(ph) * Math.cos(th) * s;
      this.pVel[i * 3 + 1] = Math.abs(Math.cos(ph)) * s * 0.8 + speed * 0.2;
      this.pVel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * s;
      const f = 0.8 + Math.random() * 0.4;
      this.pCol[i * 3] = this.c.r * f; this.pCol[i * 3 + 1] = this.c.g * f; this.pCol[i * 3 + 2] = this.c.b * f;
      this.pLife[i] = life * (0.6 + Math.random() * 0.6);
      this.pGrav[i] = grav;
    }
  }

  tracer(a, b, color = '#ffe08a', life = 0.06) {
    const i = this.tNext; this.tNext = (this.tNext + 1) % TN;
    this.c.set(color);
    this.tPos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    this.tCol.set([this.c.r, this.c.g, this.c.b, this.c.r * 0.4, this.c.g * 0.4, this.c.b * 0.4], i * 6);
    this.tLife[i] = life;
  }

  setLasers(list) { // [[a, b], ...]
    this.lPos.fill(-9999);
    list.slice(0, LN).forEach(([a, b], i) => this.lPos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6));
    this.lasers.geometry.attributes.position.needsUpdate = true;
  }

  explosion(p, r = 5) {
    const b = this.booms.find(x => x.t >= 1) || this.booms[0];
    b.t = 0; b.r = r; b.m.position.copy(p); b.m.visible = true;
    this.burst(p, 60, '#ffb030', 12, 0.8, 6);
    this.burst(p, 40, '#5a5048', 6, 1.4, -1);
  }

  update(dt) {
    for (let i = 0; i < PN; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt;
      if (this.pLife[i] <= 0) { this.pPos[i * 3 + 1] = -9999; continue; }
      this.pVel[i * 3 + 1] -= this.pGrav[i] * dt;
      this.pPos[i * 3] += this.pVel[i * 3] * dt;
      this.pPos[i * 3 + 1] += this.pVel[i * 3 + 1] * dt;
      this.pPos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
    for (let i = 0; i < TN; i++) {
      if (this.tLife[i] <= 0) continue;
      this.tLife[i] -= dt;
      if (this.tLife[i] <= 0) { this.tPos[i * 6 + 1] = this.tPos[i * 6 + 4] = -9999; }
    }
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.lines.geometry.attributes.color.needsUpdate = true;
    for (const b of this.booms) {
      if (b.t >= 1) continue;
      b.t = Math.min(1, b.t + dt * 2.5);
      b.m.scale.setScalar(0.5 + b.r * Math.sqrt(b.t));
      b.m.material.opacity = 1 - b.t;
      b.m.material.color.setHSL(0.09 - b.t * 0.07, 1, 0.6 - b.t * 0.3);
      if (b.t >= 1) b.m.visible = false;
    }
  }

  dispose() { this.scene.remove(this.points, this.lines, this.lasers, this.holes, ...this.booms.map(b => b.m)); this.holes.geometry.dispose(); this.holes.material.map.dispose(); this.holes.material.dispose(); }
}
