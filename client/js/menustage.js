// Hauptmenü-Bühne: eigener, leichter Hangar (nicht die Spielwelt), eigene Kamera und ein Soldat, der immer
// frontal zur Kamera steht. Keine automatische Drehung: Nur Atmen und minimale Gewichtsverlagerung.
// Waffen werden auf Wunsch in Großansicht gezeigt und lassen sich nur durch aktives Ziehen mit der Maus drehen.
import * as THREE from 'three';
import { makeSoldier, animateSoldier } from './actors.js';
import { buildGunModel } from './weapon.js';
import { rbox, skyEnvironment } from './geom.js';

const lerp = THREE.MathUtils.lerp;

// Prozedurale Betontextur (einmal gezeichnet, gekachelt)
function concreteTexture() {
  const s = 256, c = document.createElement('canvas');
  c.width = c.height = s;
  const x = c.getContext('2d');
  x.fillStyle = '#3a3f47'; x.fillRect(0, 0, s, s);
  const img = x.getImageData(0, 0, s, s);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  x.putImageData(img, 0, 0);
  x.strokeStyle = 'rgba(10,12,16,0.55)'; x.lineWidth = 2;
  x.strokeRect(1, 1, s - 2, s - 2);
  for (let k = 0; k < 6; k++) { // Flecken
    const g = x.createRadialGradient(Math.random() * s, Math.random() * s, 0, Math.random() * s, Math.random() * s, 40 + Math.random() * 60);
    g.addColorStop(0, 'rgba(20,22,26,0.18)'); g.addColorStop(1, 'rgba(20,22,26,0)');
    x.fillStyle = g; x.fillRect(0, 0, s, s);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// Weicher Kontaktschatten unter den Füßen
function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(0.45, 'rgba(0,0,0,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class MenuStage {
  constructor(renderer, quality) {
    this.renderer = renderer;
    this.quality = quality;
    this.mode = 'char';
    this.fx = 0.6;          // horizontale Position der Figur auf dem Bildschirm (0..1)
    this.fxNow = 0.5;
    this.camTarget = new THREE.Vector3(0, 1.25, 4);
    this.lookTarget = new THREE.Vector3(0, 1.2, 0);
    this.lookNow = new THREE.Vector3(0, 1.2, 0);
    this.t = 0;
    this.drag = null;
    this.userYaw = 0;       // nur bei Waffen-Inspektion (vom Nutzer gesteuert)
    this.buildScene();
    this.cam = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 60);
    this.cam.position.set(0, 1.6, 7); // Startpunkt etwas weiter weg -> sanfte Einfahrt ins Menü
    this.cam.lookAt(this.lookNow);
    this.bindInput();
  }

  buildScene() {
    const s = this.scene = new THREE.Scene();
    s.background = new THREE.Color('#0a0e16');
    s.fog = new THREE.FogExp2('#0c111b', 0.042);
    s.environment = skyEnvironment(this.renderer, '#2b3550', '#3a3026', '#101318');
    s.environmentIntensity = 0.5;

    // Licht: Grundhelligkeit, Hauptlicht (Spot mit Schatten), kühles Fülllicht, warmes Gegenlicht für die Silhouette
    s.add(new THREE.HemisphereLight('#9fb4d8', '#2a2018', 0.55));
    const key = this.key = new THREE.SpotLight('#ffe9d0', 38, 14, 0.5, 0.6, 1.6);
    key.position.set(-1.8, 4.2, 3.4);
    key.target.position.set(0, 1.0, 0);
    key.castShadow = this.quality.shadows;
    if (key.castShadow) { key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; key.shadow.radius = 4; }
    s.add(key, key.target);
    const fill = new THREE.DirectionalLight('#7fa6ff', 0.55); fill.position.set(3, 2, 3); s.add(fill);
    const rim = new THREE.DirectionalLight('#ff8a3a', 1.3); rim.position.set(1.5, 2.6, -3.5); s.add(rim);
    const rim2 = new THREE.DirectionalLight('#ffb070', 1.2); rim2.position.set(-2, 2.2, -3); s.add(rim2);

    // Boden
    const tex = concreteTexture(); tex.repeat.set(10, 10);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: tex, color: '#b8c4d4', roughness: 0.72, metalness: 0.1 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; s.add(floor);
    // Podest mit glühendem Rand
    const podMat = new THREE.MeshStandardMaterial({ color: '#232832', roughness: 0.5, metalness: 0.6 });
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.0, 0.06, 48), podMat);
    pod.position.y = 0.03; pod.receiveShadow = true; s.add(pod);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.975, 0.008, 6, 64), new THREE.MeshBasicMaterial({ color: '#ff7a1a' }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.06; s.add(ring);
    this.ring = ring;
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.062; s.add(blob);
    this.blob = blob;

    // Hangar-Rückwand mit Rippen, Tor und Lichtleisten (alles statisch, wenige Draw Calls)
    const wallMat = new THREE.MeshStandardMaterial({ color: '#2c3440', roughness: 0.85, metalness: 0.2 });
    // Warmes Licht an der Rückwand + weicher Lichthof hinter der Figur (trennt Silhouette vom Hintergrund)
    for (const x of [-4.5, 5]) { const pl = new THREE.PointLight('#ffc890', 9, 9, 1.6); pl.position.set(x, 5.5, -4.8); s.add(pl); }
    const cool = new THREE.PointLight('#6a9aff', 6, 8, 1.6); cool.position.set(0.6, 1.2, -4.6); s.add(cool);
    const gc = document.createElement('canvas'); gc.width = gc.height = 128;
    const gx = gc.getContext('2d'), gg = gx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gg.addColorStop(0, 'rgba(255,150,80,0.55)'); gg.addColorStop(0.5, 'rgba(120,90,150,0.18)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
    gx.fillStyle = gg; gx.fillRect(0, 0, 128, 128);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    halo.position.set(0, 2.2, -5.6); s.add(halo);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(24, 9, 0.3), wallMat);
    wall.position.set(0, 4.5, -6.5); wall.receiveShadow = true; s.add(wall);
    const ribs = new THREE.InstancedMesh(rbox(0.32, 9, 0.4, 0.04), new THREE.MeshStandardMaterial({ color: '#262c37', roughness: 0.6, metalness: 0.5 }), 13);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 13; i++) { m.makeTranslation(-12 + i * 2, 4.5, -6.2); ribs.setMatrixAt(i, m); }
    s.add(ribs);
    // Großes Tor mit Spalt aus warmem Licht
    const door = new THREE.Mesh(rbox(6.5, 5.2, 0.25, 0.05), new THREE.MeshStandardMaterial({ color: '#2a2f38', roughness: 0.7, metalness: 0.4 }));
    door.position.set(3.6, 2.6, -6.05); s.add(door);
    const slit = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 5.0), new THREE.MeshBasicMaterial({ color: '#ff9a4a' }));
    slit.position.set(3.6, 2.6, -5.9); s.add(slit);
    const lightBar = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: '#ffd9b0' }), 6);
    for (let i = 0; i < 6; i++) { m.makeTranslation(-7.5 + i * 3, 7.6, -6.0 + (i % 2) * 0.01); lightBar.setMatrixAt(i, m); }
    s.add(lightBar);
    // Warnstreifen am Boden vor der Wand
    const stripeC = document.createElement('canvas'); stripeC.width = 128; stripeC.height = 16;
    const sx = stripeC.getContext('2d');
    for (let i = -2; i < 16; i++) { sx.fillStyle = i % 2 ? '#d8a020' : '#16181c'; sx.beginPath(); sx.moveTo(i * 12, 16); sx.lineTo(i * 12 + 8, 0); sx.lineTo(i * 12 + 20, 0); sx.lineTo(i * 12 + 12, 16); sx.fill(); }
    const st = new THREE.CanvasTexture(stripeC); st.wrapS = THREE.RepeatWrapping; st.repeat.set(12, 1); st.colorSpace = THREE.SRGBColorSpace;
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(22, 0.35), new THREE.MeshStandardMaterial({ map: st, roughness: 0.7 }));
    stripe.rotation.x = -Math.PI / 2; stripe.position.set(0, 0.005, -5.3); s.add(stripe);

    // Requisiten: Kisten, Fässer, Waffenregal – seitlich, unscharf im Nebel
    const crateMat = new THREE.MeshStandardMaterial({ color: '#4a4a3a', roughness: 0.8, metalness: 0.15 });
    const crateGeo = rbox(1, 1, 1, 0.05);
    const crates = [[-3.6, 0.5, -2.8, 1.2, 1, 1, 0.2], [-3.4, 1.45, -2.9, 0.9, 0.9, 0.9, -0.15], [-4.9, 0.6, -3.6, 1.4, 1.2, 1.1, 0.5],
      [3.9, 0.45, -3.1, 1.1, 0.9, 1, -0.3], [4.6, 0.4, -1.8, 0.8, 0.8, 0.8, 0.6], [5.3, 0.7, -4.2, 1.4, 1.4, 1.2, 0.1]];
    const ci = new THREE.InstancedMesh(crateGeo, crateMat, crates.length);
    const q = new THREE.Quaternion();
    crates.forEach(([x, y, z, sx2, sy, sz, r], i) => {
      m.compose(new THREE.Vector3(x, y, z), q.setFromEuler(new THREE.Euler(0, r, 0)), new THREE.Vector3(sx2, sy, sz));
      ci.setMatrixAt(i, m);
    });
    ci.castShadow = ci.receiveShadow = true; s.add(ci);
    const barrel = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16), new THREE.MeshStandardMaterial({ color: '#7a3a18', roughness: 0.55, metalness: 0.5 }), 3);
    [[2.9, -2.4], [3.5, -2.9], [-3.3, -3.6]].forEach(([x, z], i) => { m.makeTranslation(x, 0.45, z); barrel.setMatrixAt(i, m); });
    s.add(barrel);

    // Schwebeteilchen: Staub und vereinzelte Glutfunken (ein Draw Call)
    const N = 220;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    this.dust = [];
    for (let i = 0; i < N; i++) {
      const ember = Math.random() < 0.18;
      const p = { x: (Math.random() - 0.5) * 12, y: Math.random() * 6, z: -5 + Math.random() * 6.5, v: ember ? 0.12 + Math.random() * 0.12 : 0.02 + Math.random() * 0.04, ph: Math.random() * 6.28 };
      this.dust.push(p);
      const c = ember ? new THREE.Color('#ff8a3a') : new THREE.Color('#9fb0c8').multiplyScalar(0.5);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.add(this.points);

    this.charRoot = new THREE.Group(); s.add(this.charRoot);
    this.weaponRoot = new THREE.Group(); s.add(this.weaponRoot);
  }

  bindInput() {
    // Waffen-Inspektion: nur aktiv, wenn der Nutzer selbst auf die Bühne klickt und zieht
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', e => { if (this.active && this.mode === 'weapon') this.drag = { x: e.clientX, yaw: this.userYaw }; });
    addEventListener('pointermove', e => { if (this.drag) this.userYaw = this.drag.yaw + (e.clientX - this.drag.x) * 0.01; });
    addEventListener('pointerup', () => { this.drag = null; });
  }

  // ------------------------------------------------------------------ Inhalt
  showCharacter(look, gunId) {
    this.mode = 'char';
    this.weaponRoot.clear();
    this.weaponRoot.visible = false;
    this.charRoot.visible = true;
    this.blob.visible = true;
    // Gleiches Aussehen + gleiche Waffe -> nichts neu bauen (verhindert Flackern beim Hovern)
    const key = JSON.stringify([look, gunId]);
    if (key !== this.charKey) {
      this.charKey = key;
      this.charRoot.clear();
      const sol = makeSoldier(look.color, { ...look, gun: gunId, pose: 'ready' });
      sol.traverse(o => { if (o.isMesh) { o.castShadow = this.quality.shadows; o.layers.disable(1); } });
      animateSoldier(sol, 0, 0.016, 0);  // Ruhepose setzen
      this.charRoot.add(sol);
      this.soldier = sol;
    }
    this.frame();
  }

  showWeapon(id, build, skin) {
    this.mode = 'weapon';
    this.charRoot.visible = false;
    this.blob.visible = false;
    this.weaponRoot.visible = true;
    this.weaponRoot.clear();
    const g = buildGunModel(id, build, skin);
    g.traverse(o => { if (o.isMesh) o.castShadow = this.quality.shadows; });
    const box = new THREE.Box3().setFromObject(g);
    const c = box.getCenter(new THREE.Vector3());
    g.position.sub(c);
    const holder = new THREE.Group();
    holder.add(g);
    holder.scale.setScalar(2.4);
    this.weaponRoot.add(holder);
    this.weaponRoot.position.set(0, 1.2, 0);
    this.weaponSize = box.getSize(new THREE.Vector3()).multiplyScalar(2.4);
    this.userYaw = 0;
    this.frame();
  }

  // ------------------------------------------------------------------ Kamera
  // fx: gewünschte Bildschirmposition der Figur (0 = links, 1 = rechts)
  // freeFrac: Anteil der Bildschirmbreite, der neben Navigation/Panel frei ist (Figur muss hineinpassen)
  setScreenX(fx, freeFrac = 1) {
    this.fx = fx;
    // Zu wenig Platz neben einem breiten Panel: Figur/Waffe ausblenden statt halb abgeschnitten zeigen
    this.cramped = freeFrac * innerWidth < 300 && innerWidth > 860;
    if (Math.abs(freeFrac - (this.freeFrac || 1)) > 0.01 || !this.freeFrac) { this.freeFrac = freeFrac; this.frame(); }
  }

  resize() {
    this.cam.aspect = innerWidth / innerHeight;
    this.cam.updateProjectionMatrix();
    this.frame();
  }

  // Bildausschnitt berechnen: Figur ab Knie aufwärts, Gesicht gut sichtbar, an jedes Seitenverhältnis angepasst
  frame() {
    const aspect = innerWidth / innerHeight;
    const fitAspect = aspect * Math.max(0.3, this.freeFrac || 1); // horizontal nur der freie Bereich
    const halfV = Math.tan(THREE.MathUtils.degToRad(this.cam.fov / 2));
    if (this.mode === 'char') {
      // Sichtbar von knapp unter dem Knie bis über den Helm, mit Luft nach oben (Hochformat: ganze Figur)
      const yTop = 2.12, yBot = aspect < 0.9 ? 0.0 : 0.38;
      const cy = (yTop + yBot) / 2, half = (yTop - yBot) / 2;
      const halfW = 0.75;
      const dist = Math.max(half / halfV, halfW / (halfV * fitAspect)) * 1.12;
      this.camTarget.set(0, cy + 0.12, dist);
      this.lookTarget.set(0, cy, 0);
    } else {
      const sz = this.weaponSize || new THREE.Vector3(1, 0.3, 1);
      const w = Math.max(sz.x, sz.z) * 0.62, h = sz.y * 0.9 + 0.2;
      const dist = Math.max(h / halfV, w / (halfV * fitAspect)) * 1.15 + 0.3;
      this.camTarget.set(0, 1.35, dist);
      this.lookTarget.set(0, 1.2, 0);
    }
    this.faceCamera();
  }

  // Die Figur dreht sich EINMAL so, dass Gesicht und Brust zur Kamera zeigen (Modell blickt entlang −Z).
  // Danach bleibt die Ausrichtung fest – auch während der Idle-Animation.
  faceCamera() {
    const dx = this.camTarget.x - this.charRoot.position.x, dz = this.camTarget.z - this.charRoot.position.z;
    this.charRoot.rotation.set(0, Math.atan2(-dx, -dz), 0);
  }

  // ------------------------------------------------------------------ Pro Bild
  render(dt) {
    this.t += dt;
    const t = this.t;
    // Kamera gleitet sanft auf ihr Ziel (Einfahrt + Wechsel zwischen Figur/Waffe), danach steht sie still
    const k = 1 - Math.exp(-dt * 5);
    this.cam.position.lerp(this.camTarget, k);
    this.lookNow.lerp(this.lookTarget, k);
    this.cam.lookAt(this.lookNow);
    this.fxNow = lerp(this.fxNow, this.fx, k);
    const W = innerWidth, H = innerHeight;
    this.cam.setViewOffset(W, H, (0.5 - this.fxNow) * W, 0, W, H);

    this.charRoot.visible = this.mode === 'char' && !this.cramped;
    this.weaponRoot.visible = this.mode === 'weapon' && !this.cramped;
    this.blob.visible = this.charRoot.visible;
    if (this.mode === 'char' && this.soldier) {
      // Idle: Atmen (Brustkorb hebt sich minimal), leichte Gewichtsverlagerung. KEINE Drehung um die Hochachse.
      const u = this.soldier.userData;
      const breathe = Math.sin(t * 1.7);
      u.upper.position.y = 0.92 + breathe * 0.0035;
      u.upper.rotation.x = -0.02 + breathe * 0.008;
      u.upper.rotation.z = Math.sin(t * 0.45) * 0.01;
      u.upper.rotation.y = 0;
      this.soldier.position.x = Math.sin(t * 0.45) * 0.006;
    } else if (this.mode === 'weapon') {
      const h = this.weaponRoot.children[0];
      if (h) {
        h.rotation.set(0.08, -Math.PI / 2 + 0.38 + this.userYaw, 0);
        h.position.y = Math.sin(t * 1.1) * 0.012;
      }
    }

    // Partikel
    const arr = this.points.geometry.attributes.position.array;
    this.dust.forEach((p, i) => {
      p.y += p.v * dt;
      if (p.y > 6.5) p.y = 0;
      arr[i * 3] = p.x + Math.sin(t * 0.3 + p.ph) * 0.25;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    });
    this.points.geometry.attributes.position.needsUpdate = true;
    this.ring.material.color.setHSL(0.07, 1, 0.5 + Math.sin(t * 1.3) * 0.06);

    this.renderer.render(this.scene, this.cam);
  }
}
