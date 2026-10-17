// Питомцы, которые ходят за Львом: кошка Сима (с самого начала), собака, козлёнок и конь — за серию дней.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { CHESTS } from '../data/tasks.js';
import { ZONES } from '../data/map.js';
import { S, save } from './save.js';
import { Actor } from './actor.js';
import { isLocked } from './world.js';
import { isOpen } from './dialog.js';
import { toast, makeLabel, on, floatAt } from './ui.js';

let scene, hooks, lev;
const followers = []; // { obj, slot, update(dt, moving) }

// ---------- козлёнок и конь из кубиков (в стиле Kenney Cube Pets) ----------
function voxel(kind) {
  const horse = kind === 'horse';
  const col = horse ? { body: '#8d5524', dark: '#3b2412', nose: '#5c3a1e' } : { body: '#f1f3f5', dark: '#868e96', nose: '#ffc9c9' };
  const s = horse ? 1.35 : 0.8;
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  const box = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w * s, h * s, d * s), mat(c)); m.position.set(x * s, y * s, z * s); m.castShadow = true; return m; };
  const root = new THREE.Group(), legs = [];
  root.add(box(0.6, 0.45, 1.0, col.body, 0, 0.72, 0));
  if (horse) {
    root.add(box(0.28, 0.6, 0.32, col.body, 0, 1.08, 0.45), box(0.3, 0.3, 0.6, col.body, 0, 1.38, 0.7),
      box(0.31, 0.12, 0.2, col.nose, 0, 1.3, 0.95), box(0.1, 0.62, 0.36, col.dark, 0, 1.15, 0.35),
      box(0.12, 0.5, 0.12, col.dark, 0, 0.7, -0.55));
    root.children.at(-1).rotation.x = 0.4;
  } else {
    root.add(box(0.36, 0.36, 0.42, col.body, 0, 1.05, 0.6), box(0.2, 0.14, 0.12, col.nose, 0, 0.98, 0.84),
      box(0.06, 0.22, 0.06, col.dark, -0.1, 1.3, 0.55), box(0.06, 0.22, 0.06, col.dark, 0.1, 1.3, 0.55),
      box(0.08, 0.16, 0.06, col.body, 0, 0.82, 0.78), box(0.12, 0.08, 0.2, col.body, -0.24, 1.12, 0.55), box(0.12, 0.08, 0.2, col.body, 0.24, 1.12, 0.55));
  }
  for (const [x, z] of [[-0.2, 0.35], [0.2, 0.35], [-0.2, -0.35], [0.2, -0.35]]) {
    const pivot = new THREE.Group(); pivot.position.set(x * s, 0.55 * s, z * s);
    const leg = box(0.15, 0.55, 0.15, col.body, 0, -0.27, 0);
    const hoof = box(0.16, 0.1, 0.16, col.dark, 0, -0.52, 0);
    pivot.add(leg, hoof); root.add(pivot); legs.push(pivot);
  }
  let ph = 0;
  return {
    root,
    update(dt, moving) {
      ph += moving ? dt * 10 : 0;
      const a = moving ? Math.sin(ph) * 0.6 : 0;
      legs[0].rotation.x = legs[3].rotation.x = a;
      legs[1].rotation.x = legs[2].rotation.x = -a;
    },
  };
}

// Модель Kenney (собака, кошка) с анимациями
function cube(model, h) {
  const a = new Actor(model, { height: h });
  let state = '';
  return {
    root: a.root, actor: a,
    update(dt, moving) {
      const want = moving ? 'walk' : 'idle';
      if (want !== state) { state = want; a.play(want); }
      a.mixer.update(dt);
    },
  };
}

// Следовать за Львом. slot — место позади (влево/вправо/прямо).
function follow(p, dt) {
  const o = p.obj.root.position, L = lev.root.position, r = lev.root.rotation.y;
  const side = [[-1.2, -1.4], [1.2, -1.4], [-0.6, -2.8], [0.8, -2.8]][p.slot];
  const tx = L.x + Math.cos(r) * side[0] + Math.sin(r) * side[1], tz = L.z - Math.sin(r) * side[0] + Math.cos(r) * side[1];
  const target = p.goal || { x: tx, z: tz };
  const dx = target.x - o.x, dz = target.z - o.z, d = Math.hypot(dx, dz);
  if (d > 25) { o.x = tx; o.z = tz; return false; } // отстал — догоняет «прыжком»
  const moving = d > (p.goal ? 0.6 : 0.4);
  if (moving) {
    const sp = Math.min(d * 2.5, lev.speed * 1.3 + 1) * dt;
    o.x += dx / d * Math.min(sp, d); o.z += dz / d * Math.min(sp, d);
    let a = Math.atan2(dx, dz) - p.obj.root.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a));
    p.obj.root.rotation.y += a * Math.min(1, dt * 8);
  }
  return moving;
}

function addFollower(obj, slot) {
  obj.root.position.set(lev.root.position.x - 1, 0, lev.root.position.z + 1);
  scene.add(obj.root);
  const p = { obj, slot };
  followers.push(p);
  return p;
}

// ---------- Сима ----------
let sima, bubble, idleT = 0, lastLev = new THREE.Vector3(), chestNotified = {}, mouse = null, mouseT = 30;

function say(text, sec = 4) {
  if (bubble) bubble.removeFromParent();
  bubble = makeLabel([[text, '800 26px Nunito, sans-serif']], text.length * 15 + 40, 46, '#ffffff', '#2b2a1f', 0.013);
  bubble.position.y = 1.4;
  sima.obj.root.add(bubble);
  clearTimeout(say.t);
  say.t = setTimeout(() => { bubble?.removeFromParent(); bubble = null; }, sec * 1000);
}

function setCollar() {
  sima.collar?.removeFromParent();
  const c = S.collar || (S.chests.c4 ? '#e03131' : null);
  if (!c) return;
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.3), new THREE.MeshLambertMaterial({ color: c, emissive: c === '#ffd43b' ? '#5a4500' : '#000' }));
  m.position.set(0, 0.3, 0.12);
  sima.obj.root.add(m);
  sima.collar = m;
}

function updateSima(dt) {
  const L = lev.root.position;
  if (hooks.isEvening()) { sima.goal = { x: -5, z: 17.6 }; } // спит на крыльце
  // 1) рядом спрятанный сундук — мяукает и бежит к нему
  if (!sima.goal || sima.goalType === 'lead') {
    for (const c of CHESTS) {
      if (S.chests[c.id] || chestNotified[c.id] > performance.now()) continue;
      if (Math.hypot(c.x - L.x, c.z - L.z) < 12) {
        chestNotified[c.id] = performance.now() + 60000;
        sima.goal = { x: c.x + 0.8, z: c.z + 0.8 }; sima.goalType = 'chest'; sima.goalUntil = performance.now() + 15000;
        say('Мяу! 🐾 Тут что-то есть!');
        break;
      }
    }
  }
  // 2) Лев долго стоит без дела — ведёт к «!»
  if (L.distanceTo(lastLev) > 0.1 || isOpen()) { idleT = 0; lastLev.copy(L); } else idleT += dt;
  if (idleT > 25 && !sima.goal) {
    const t = hooks.taskNpcPos();
    if (t) { sima.goal = t; sima.goalType = 'lead'; sima.goalUntil = performance.now() + 12000; say('Мяу? Пойдём!'); toast(`${CONFIG.names.cat} зовёт за собой — к «!»`); }
    idleT = 0;
  }
  if (sima.goal && sima.goalType !== undefined && performance.now() > sima.goalUntil && !hooks.isEvening()) { sima.goal = null; sima.goalType = undefined; }
  if (sima.goal && sima.goalType === 'chest' && Math.hypot(sima.goal.x - L.x, sima.goal.z - L.z) < 2.5) { sima.goal = null; sima.goalType = undefined; }
  // 3) мыши на мельнице
  updateMouse(dt);
  const moving = follow(sima, dt);
  sima.obj.update(dt, moving);
}

function updateMouse(dt) {
  const mill = ZONES.find(z => z.id === 'mill');
  if (isLocked('mill')) return;
  const L = lev.root.position;
  const near = Math.hypot(L.x - mill.x, L.z - mill.z) < 14;
  if (!mouse && near && (mouseT -= dt) < 0) {
    mouse = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.18, 0.4), new THREE.MeshLambertMaterial({ color: '#868e96' }));
    mouse.position.set(mill.x + 2.5, 0.1, mill.z + 2.5);
    scene.add(mouse);
    say('Мышь! 🐭');
    mouseT = 60;
  }
  if (!mouse) return;
  mouse.position.x += Math.sin(performance.now() / 300) * dt * 2;
  mouse.position.z += dt * 1.2;
  sima.goal = { x: mouse.position.x, z: mouse.position.z }; sima.goalType = 'mouse'; sima.goalUntil = performance.now() + 2000;
  if (sima.obj.root.position.distanceTo(mouse.position) < 0.7) {
    scene.remove(mouse); mouse = null; sima.goal = null; sima.goalType = undefined;
    S.coins += 5; save(); hooks.onChange();
    floatAt(sima.obj.root.position, '+5');
    toast(`${CONFIG.names.cat} поймала мышь! Мельник дарит 5 монет.`);
  }
}

// ---------- запуск ----------
const petObjs = {};
function syncStreakPets() {
  const need = CONFIG.streakPets;
  for (const id of ['dog', 'goat', 'horse']) {
    if (S.streak.count >= need[id] && !S.pets[id]) { S.pets[id] = true; save(); toast(`Новый друг за ${need[id]} дн. подряд: ${{ dog: 'собака', goat: 'козлёнок', horse: 'конь' }[id]}!`, 4000); }
    if (S.pets[id] && !petObjs[id]) {
      const obj = id === 'dog' ? cube('pets/animal-dog', 0.6) : voxel(id);
      petObjs[id] = addFollower(obj, { dog: 1, goat: 2, horse: 3 }[id]);
    }
  }
}

export function initPets(sc, h) {
  scene = sc; hooks = h; lev = h.lev;
  sima = addFollower(cube('pets/animal-cat', 0.55), 0);
  setCollar();
  syncStreakPets();
  on('newday', syncStreakPets);
  on('collar', setCollar);
}

export function updatePets(dt) {
  updateSima(dt);
  for (const p of followers) if (p !== sima) p.obj.update(dt, follow(p, dt));
}

export const refreshPets = () => { setCollar(); syncStreakPets(); };
