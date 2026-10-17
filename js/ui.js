// Мелкие помощники интерфейса.
import * as THREE from 'three';

export const $ = id => document.getElementById(id);

// Табличка-спрайт с текстом. lines: [[текст, css-шрифт], ...]
export function makeLabel(lines, w, h, bg, fg, scale) {
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  const x = c.getContext('2d');
  x.scale(2, 2);
  x.fillStyle = bg;
  x.beginPath(); x.roundRect(2, 2, w - 4, h - 4, Math.min(24, h / 3)); x.fill();
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach((l, i) => { x.font = l[1]; x.fillText(l[0], w / 2, h / (lines.length + 1) * (i + 1) + (lines.length > 1 ? (i ? -4 : 4) : 0)); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(w * scale, h * scale, 1);
  return s;
}

let toastTimer;
export function toast(text, ms = 2200) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), ms);
}
