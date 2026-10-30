// Prozedurale Skin-Texturen (Canvas) – werden gecacht, damit jede Kombination nur einmal erzeugt wird.
import * as THREE from 'three';

function rand(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function drawSkin(ctx, size, skin) {
  const { base, accent, pattern } = skin;
  const sc = skin.scale || 1;
  const r = rand(7 + size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = accent;
  ctx.strokeStyle = accent;
  const u = size / 8 / sc;
  switch (pattern) {
    case 'stripes':
      ctx.lineWidth = u * 0.9;
      for (let i = -size; i < size * 2; i += u * 2.4) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + size, size); ctx.stroke(); }
      break;
    case 'camo':
      for (let i = 0; i < 26 * sc; i++) {
        ctx.beginPath();
        const x = r() * size, y = r() * size, rad = u * (0.6 + r() * 1.3);
        for (let a = 0; a < 7; a++) {
          const ang = a / 7 * Math.PI * 2, rr = rad * (0.6 + r() * 0.6);
          a ? ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr) : ctx.moveTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
        }
        ctx.fill();
      }
      break;
    case 'digital': {
      const s = u * 0.6;
      for (let y = 0; y < size; y += s) for (let x = 0; x < size; x += s) if (r() < 0.32) ctx.fillRect(x, y, s * (1 + (r() < 0.3)), s);
      break;
    }
    case 'dots':
      for (let y = u / 2; y < size; y += u * 1.4) for (let x = (y / u) % 2 ? u * 0.7 : 0; x < size + u; x += u * 1.4) { ctx.beginPath(); ctx.arc(x, y, u * 0.38, 0, Math.PI * 2); ctx.fill(); }
      if (skin.glow) for (let i = 0; i < 40; i++) { ctx.fillStyle = '#ffffff'; ctx.fillRect(r() * size, r() * size, 1.5, 1.5); }
      break;
    case 'tiger':
      for (let i = 0; i < 14 * sc; i++) {
        const x = r() * size, w = u * (0.3 + r() * 0.5);
        ctx.beginPath(); ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + u * 2 * (r() - 0.5), size * 0.33, x + u * 2 * (r() - 0.5), size * 0.66, x + u * (r() - 0.5), size);
        ctx.lineWidth = w; ctx.stroke();
      }
      break;
    case 'grid':
      ctx.lineWidth = Math.max(1, u * 0.18);
      for (let i = 0; i <= size; i += u) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke(); }
      break;
    case 'gradient': {
      const g = ctx.createLinearGradient(0, 0, size, size);
      g.addColorStop(0, base); g.addColorStop(1, accent);
      ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
      break;
    }
    case 'hex': {
      const s = u * 0.7, h = s * Math.sqrt(3);
      ctx.lineWidth = Math.max(1, u * 0.15);
      for (let y = 0; y < size + h; y += h / 2) for (let x = ((y / (h / 2)) % 2) * s * 1.5; x < size + s * 3; x += s * 3) {
        ctx.beginPath();
        for (let a = 0; a < 6; a++) { const ang = a * Math.PI / 3; a ? ctx.lineTo(x + Math.cos(ang) * s, y + Math.sin(ang) * s) : ctx.moveTo(x + s, y); }
        ctx.closePath(); ctx.stroke();
      }
      break;
    }
    case 'zigzag':
      ctx.lineWidth = u * 0.5;
      for (let y = 0; y < size + u; y += u * 1.6) {
        ctx.beginPath(); ctx.moveTo(0, y);
        for (let x = 0; x <= size; x += u) ctx.lineTo(x, y + ((x / u) % 2 ? u * 0.6 : 0));
        ctx.stroke();
      }
      break;
    default: break;
  }
}

const cache = new Map();
export function skinMaterial(skin) {
  const key = JSON.stringify([skin.base, skin.accent, skin.pattern, skin.scale || 1, skin.glow || 0]);
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  drawSkin(c.getContext('2d'), 128, skin);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  const mat = new THREE.MeshPhongMaterial({ map: tex, shininess: 35, specular: 0x333333 });
  mat.userData.baseColor = skin.base; // für zusammengeführte Gegner-Modelle
  if (skin.glow) { mat.emissive = new THREE.Color(skin.accent); mat.emissiveMap = tex; mat.emissiveIntensity = skin.glow * 0.8; }
  cache.set(key, mat);
  return mat;
}

export function skinPreviewCanvas(skin, size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  drawSkin(c.getContext('2d'), size, skin);
  return c;
}
