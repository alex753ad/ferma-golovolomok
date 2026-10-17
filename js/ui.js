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

// Всплывающий текст над точкой мира (+1 🌾, +10 монет)
let cam;
export function setCamera(c) { cam = c; }
export function floatAt(pos, text) {
  if (!cam) return;
  const v = new THREE.Vector3(pos.x, (pos.y || 0) + 1.8, pos.z).project(cam);
  const f = document.createElement('div');
  f.className = 'fl';
  f.textContent = text;
  f.style.left = (v.x + 1) / 2 * innerWidth - 20 + 'px';
  f.style.top = (1 - v.y) / 2 * innerHeight - 20 + 'px';
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1000);
}

// Простая шина событий: emit('harvest') — слушают поручения мамы, достижения и т.п.
const listeners = {};
export const on = (ev, f) => (listeners[ev] ||= []).push(f);
export const emit = (ev, data) => (listeners[ev] || []).forEach(f => f(data));
