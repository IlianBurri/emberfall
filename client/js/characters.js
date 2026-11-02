// Animierte 3D-Charaktere aus GLB-Dateien (Quaternius, CC0): Skelett-Animationen, Einfärbung nach Outfit/Gegnertyp,
// Waffen in der Hand. Falls die Dateien nicht laden, nutzt das Spiel automatisch die eigenen prozeduralen Soldaten.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const LIB = {};
export const charactersReady = () => !!LIB.swat;

export async function loadCharacters() {
  try {
    const L = new GLTFLoader();
    const swat = await L.loadAsync('/assets/models/swat.glb');
    for (const [k, g] of [['swat', swat]]) {
      g.clips = Object.fromEntries(g.animations.map(a => [a.name.split('|').pop(), a]));
      // Kopfhöhe messen, um beide Modelle auf ~1,8 m zu bringen
      g.scene.updateMatrixWorld(true);
      const head = new THREE.Vector3();
      g.scene.getObjectByName('Head').getWorldPosition(head);
      g.scale = 1.6 / head.y;
      LIB[k] = g;
    }
  } catch (e) {
    console.warn('3D-Modelle konnten nicht geladen werden – nutze eigene Soldaten.', e);
  }
}

const CLIPS = {
  swat: { idle: 'Idle_Gun', aim: 'Idle_Gun_Pointing', run: 'Run_Shoot', walk: 'Walk', shoot: 'Idle_Gun_Shoot', death: 'Death', hit: 'HitRecieve' },
  soldier: { idle: 'Idle', aim: 'Idle_Shoot', run: 'Run_Gun', walk: 'Run_Gun', shoot: 'Idle_Shoot', death: 'Death', hit: 'HitReact', duck: 'Duck', jump: 'Jump_Idle' },
};
const SOLDIER_WEAPONS = ['Sniper', 'SMG', 'RocketLauncher', 'Revolver', 'Revolver_Small', 'Pistol', 'GrenadeLauncher', 'ShortCannon', 'Shotgun', 'Sniper_2', 'Shovel', 'Knife_2', 'Knife_1', 'AK'];
const SOLDIER_GUN = { falke: 'AK', wespe: 'SMG', kolibri: 'Sniper_2', brecher: 'Shotgun', donner: 'ShortCannon', langstreck: 'Sniper', stachel: 'Pistol', hornisse: 'Revolver_Small', bulle: 'Revolver', werfer: 'GrenadeLauncher', rakete: 'RocketLauncher' };

// Lage der Waffe in der rechten Hand des SWAT-Modells (im Handgelenk-Koordinatensystem, Meter)
export const GUN_POS = new THREE.Vector3(0, 0.07, 0);
export const GUN_ROT = new THREE.Euler(Math.PI / 2, Math.PI, 0);

// Alle Teile des SWAT-Modells zu EINEM skinned Mesh verschmelzen (Farben als Vertex-Farben):
// 1 Draw Call und 1 Knochen-Upload pro Figur statt 9. Alle Teile teilen Knochen und Bindung.
const mergedCache = new Map();
const charMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 });
function mergeSkinned(model, opts) {
  const parts = [];
  model.traverse(o => { if (o.isSkinnedMesh) parts.push(o); });
  if (parts.length < 2) return;
  const cols = { Swat: opts.color, Swat_Black: opts.vest || '#161616', Skin: opts.skin, Visor: opts.eye ? shade(opts.eye, 0.55) : '#0a0a0a' };
  const key = JSON.stringify(cols);
  let geo = mergedCache.get(key);
  if (!geo) {
    const c = new THREE.Color();
    const geos = parts.map(o => {
      const g = o.geometry.clone();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight'].includes(k)) g.deleteAttribute(k);
      c.set(cols[o.material.name] || '#' + o.material.color.getHexString());
      const n = g.attributes.position.count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      return g;
    });
    geo = mergeGeometries(geos, false);
    geo.computeBoundingSphere();
    geo.boundingSphere.radius *= 1.8; // Platz für Animationen
    mergedCache.set(key, geo);
  }
  const first = parts[0];
  const mesh = new THREE.SkinnedMesh(geo, charMat);
  mesh.name = 'Swat_Merged';
  mesh.userData.merged = true;
  first.parent.add(mesh);
  mesh.position.copy(first.position); mesh.quaternion.copy(first.quaternion); mesh.scale.copy(first.scale);
  mesh.bind(first.skeleton, first.bindMatrix);
  mesh.boundingSphere = geo.boundingSphere.clone(); // feste, großzügige Hülle statt teurer Neuberechnung
  for (const o of parts) o.parent.remove(o);
}

// Materialien je Farbe nur einmal anlegen
const matCache = new Map();
function tint(src, color, opts = {}) {
  const key = src.uuid + '|' + color + '|' + (opts.emissive || '');
  if (!matCache.has(key)) {
    const m = src.clone();
    if (color) m.color.set(color);
    m.roughness = opts.roughness ?? 0.72;
    m.metalness = opts.metalness ?? 0.05;
    if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = 0.6; }
    matCache.set(key, m);
  }
  return matCache.get(key);
}
function shade(hex, f) { const c = new THREE.Color(hex); c.multiplyScalar(f); return '#' + c.getHexString(); }

// kind: 'soldier' (Spieler/Mitspieler) oder 'swat' (Gegner). opts: Farben (color, pants, vest, skin, eye), gun, scale
export function createCharacter(kind, opts, gunMeshFactory) {
  const src = LIB[kind];
  const root = new THREE.Group();
  const inner = new THREE.Group();
  inner.rotation.y = Math.PI;              // Modelle schauen nach +Z, das Spiel nach -Z
  inner.scale.setScalar(src.scale);
  root.add(inner);
  const model = SkeletonUtils.clone(src.scene);
  inner.add(model);
  if (kind === 'swat') mergeSkinned(model, opts);
  model.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.frustumCulled = false;
    o.layers.enable(1);                    // Wallhack-Ebene
    const n = o.material.name;
    if (kind === 'soldier') {
      if (n === 'Character_Main') o.material = tint(o.material, /ShoulderPad/.test(o.name) ? opts.vest : opts.color);
      else if (n === 'Pants') o.material = tint(o.material, opts.pants || shade(opts.color, 0.8));
      else if (n === 'Skin') o.material = tint(o.material, opts.skin);
      else o.material = tint(o.material, null, { roughness: 0.55, metalness: 0.3 });
    } else if (o.userData.merged) {
      o.frustumCulled = true;              // eigene, großzügige Hüllkugel → unsichtbare Figuren werden übersprungen
    } else {
      if (n === 'Swat') o.material = tint(o.material, opts.color);
      else if (n === 'Swat_Black') o.material = tint(o.material, opts.vest || '#161616');
      else if (n === 'Skin') o.material = tint(o.material, opts.skin);
      else if (n === 'Visor') o.material = tint(o.material, '#0a0a0a', { roughness: 0.1, metalness: 0.6, emissive: opts.eye });
    }
  });
  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const [state, clip] of Object.entries(CLIPS[kind])) if (src.clips[clip]) actions[state] = mixer.clipAction(src.clips[clip]);
  if (actions.death) { actions.death.setLoop(THREE.LoopOnce, 1); actions.death.clampWhenFinished = true; }
  const spine = model.getObjectByName(kind === 'swat' ? 'Chest' : 'Torso');
  const hand = model.getObjectByName('WristR') || model.getObjectByName('LowerArmR');
  const c = {
    kind, model, mixer, actions, spine, current: null, dead: false,
    play(state, fade = 0.2) {
      const a = actions[state] || actions.idle;
      if (!a || this.current === a) return;
      a.reset().setEffectiveWeight(1).fadeIn(fade).play();
      if (this.current) this.current.fadeOut(fade);
      this.current = a;
    },
    setWeapon(id) {
      if (kind === 'soldier') {
        const want = SOLDIER_GUN[id] || 'AK';
        for (const w of SOLDIER_WEAPONS) { const o = model.getObjectByName(w); if (o) o.visible = w === want; }
      } else if (gunMeshFactory && hand) {
        if (this.gun) hand.remove(this.gun);
        this.gun = gunMeshFactory(id);
        // Knochen haben eigene Skalierung: Waffe so skalieren, dass sie in Metern relativ zur Figur passt
        root.updateMatrixWorld(true);
        const ws = new THREE.Vector3();
        hand.getWorldScale(ws);
        const k = root.scale.x / ws.x;
        this.gun.scale.setScalar(k);
        this.gun.position.set(GUN_POS.x * k, GUN_POS.y * k, GUN_POS.z * k);
        this.gun.rotation.copy(GUN_ROT);
        hand.add(this.gun);
      }
    },
  };
  c.setWeapon(opts.gun);
  c.play('idle', 0);
  mixer.update(Math.random() * 2); // nicht alle im Gleichschritt
  root.userData = { gltf: c, s: opts.scale || 1, opts };
  root.scale.setScalar(opts.scale || 1);
  return root;
}

// Animation abhängig von Bewegung/Schießen/Ducken; Oberkörper neigt sich zum Ziel
export function animateCharacter(root, speed, dt, pitch = 0, crouch = 0) {
  const c = root.userData.gltf;
  if (c.dead) { c.mixer.update(dt); return; }
  const firing = root.userData.firing > 0;
  let state;
  if (crouch > 0.5 && c.actions.duck) state = 'duck';
  else if (speed > 2.6) state = 'run';
  else if (speed > 0.5) state = 'walk';
  else state = firing ? 'shoot' : root.userData.combat ? 'aim' : 'idle';
  c.play(state);
  const a = c.actions[state];
  if (a) a.timeScale = state === 'run' ? Math.min(1.5, Math.max(0.7, speed / 4.5)) : state === 'walk' ? Math.max(0.6, speed / 2) : 1;
  c.mixer.update(dt);
  if (c.spine) c.spine.rotation.x += -pitch * 0.55; // nach der Animation addieren
}

export function characterDie(root) {
  const c = root.userData.gltf;
  if (!c || c.dead) return;
  c.dead = true;
  c.play('death', 0.12);
}
