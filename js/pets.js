// Питомцы, которые ходят за Львом: кошка Сима (с самого начала), собака, козлёнок и конь — из магазина.
// На коне можно ездить верхом.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { CHESTS } from '../data/tasks.js';
import { chestClosed } from './bonus.js';
import { ZONES } from '../data/map.js';
import { S, save } from './save.js';
import { Actor } from './actor.js';
import { part, bake } from './soft.js';
import { isLocked } from './world.js';
import { isOpen } from './dialog.js';
import { toast, makeLabel, on, floatAt } from './ui.js';

let scene, hooks, lev;
const followers = []; // { obj, slot, update(dt, moving) }

// ---------- козлёнок и конь из мягких кубиков ----------
function voxel(kind) {
  const horse = kind === 'horse';
  const col = horse ? { body: '#8d5524', dark: '#3b2412', nose: '#5c3a1e', mane: '#2b1a0e' } : { body: '#f1f3f5', dark: '#868e96', nose: '#ffc9c9', mane: '#dee2e6' };
  const s = horse ? 1.35 : 0.8;
  const root = new THREE.Group(), legs = [];
  const P = (p, c, [w, h, d], [x, y, z], o) => part(p, c, [w * s, h * s, d * s], [x * s, y * s, z * s], o);
  const eye = (x, y, z) => { for (const t of [1, -1]) { P(root, '#ffffff', [0.03, 0.09, 0.08], [t * x, y, z], { k: 1 }); P(root, '#212529', [0.03, 0.065, 0.055], [t * (x + 0.008), y - 0.005, z + 0.01], { k: 1 }); } };
  P(root, col.body, [0.6, 0.45, 1.0], [0, 0.72, 0], { k: 0.45 });
  if (horse) {
    P(root, col.body, [0.3, 0.6, 0.34], [0, 1.08, 0.45], { k: 0.4, rx: 0.35 });          // шея
    P(root, col.body, [0.3, 0.3, 0.6], [0, 1.38, 0.7], { k: 0.45 });                      // голова
    P(root, col.nose, [0.31, 0.16, 0.2], [0, 1.3, 0.95], { k: 0.5 });
    P(root, '#ffffff', [0.08, 0.16, 0.03], [0, 1.37, 0.995], { k: 0.2 });                   // проточина
    for (const t of [1, -1]) { P(root, col.body, [0.07, 0.14, 0.06], [t * 0.1, 1.58, 0.55], { k: 0.4, rz: t * -0.2 }); P(root, '#212529', [0.03, 0.03, 0.02], [t * 0.08, 1.31, 1.05], { k: 1 }); }
    eye(0.15, 1.45, 0.78);
    for (let i = 0; i < 5; i++) P(root, col.mane, [0.12, 0.22, 0.16], [0, 1.52 - i * 0.12, 0.52 - i * 0.07], { k: 0.6, rx: 0.4 }); // грива
    P(root, col.mane, [0.12, 0.55, 0.12], [0, 0.7, -0.6], { k: 0.5, rx: 0.4 });                // хвост
    P(root, '#c92a2a', [0.62, 0.08, 0.42], [0, 0.97, -0.05], { k: 0.4 });                      // седло
    P(root, '#7a1f1f', [0.5, 0.1, 0.12], [0, 1.02, -0.22], { k: 0.4 });
    for (const t of [1, -1]) P(root, '#adb5bd', [0.04, 0.2, 0.08], [t * 0.33, 0.78, 0], { k: 0.3 }); // стремена
  } else {
    P(root, col.body, [0.36, 0.36, 0.42], [0, 1.05, 0.6], { k: 0.5 });
    P(root, col.nose, [0.2, 0.14, 0.12], [0, 0.98, 0.84], { k: 0.6 });
    P(root, '#212529', [0.06, 0.03, 0.02], [0, 1.0, 0.905], { k: 1 });
    for (const t of [1, -1]) {
      P(root, col.dark, [0.06, 0.22, 0.06], [t * 0.1, 1.3, 0.52], { k: 0.4, rx: -0.5, rz: t * -0.25 }); // рожки
      P(root, col.body, [0.18, 0.07, 0.1], [t * 0.24, 1.12, 0.55], { k: 0.5, rz: t * -0.3 });             // уши
    }
    P(root, col.mane, [0.08, 0.16, 0.06], [0, 0.85, 0.78], { k: 0.5 });                                    // бородка
    P(root, col.body, [0.08, 0.14, 0.06], [0, 0.98, -0.52], { k: 0.5, rx: -0.6 });                         // хвостик
    eye(0.17, 1.1, 0.72);
  }
  for (const [x, z] of [[-0.2, 0.35], [0.2, 0.35], [-0.2, -0.35], [0.2, -0.35]]) {
    const pivot = new THREE.Group(); pivot.position.set(x * s, 0.55 * s, z * s);
    P(pivot, col.body, [0.15, 0.5, 0.15], [0, -0.25, 0], { k: 0.4 });
    P(pivot, col.dark, [0.16, 0.1, 0.18], [0, -0.52, 0.01], { k: 0.4 });
    root.add(pivot); legs.push(pivot);
  }
  bake(root);
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
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.3), new THREE.MeshLambertMaterial({ color: c, flatShading: true, emissive: c === '#ffd43b' ? '#5a4500' : '#000' }));
  m.position.set(0, 0.3, 0.12);
  sima.obj.root.add(m);
  sima.collar = m;
}

function updateSima(dt) {
  const L = lev.root.position;
  if (hooks.isEvening()) { sima.goal = S.decor.includes('cathouse') ? { x: 26, z: 34.7 } : { x: -5, z: 17.6 }; } // спит в домике или на крыльце
  // 1) рядом спрятанный сундук — мяукает и бежит к нему
  if (!sima.goal || sima.goalType === 'lead') {
    for (const c of CHESTS) {
      if (!chestClosed(c.id) || chestNotified[c.id] > performance.now()) continue;
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
    mouse = new THREE.Group(); // серая мышка: тело, ушки, нос, хвостик (бежит по +z)
    part(mouse, '#868e96', [0.22, 0.16, 0.34], [0, 0.08, 0], { k: 0.7 });
    for (const t of [1, -1]) part(mouse, '#ffc9c9', [0.08, 0.08, 0.03], [t * 0.07, 0.18, 0.1], { k: 0.8 });
    part(mouse, '#f783ac', [0.04, 0.04, 0.04], [0, 0.08, 0.18], { k: 1 });
    part(mouse, '#ffc9c9', [0.02, 0.02, 0.28], [0, 0.06, -0.3], { k: 0.3, rx: -0.2 });
    mouse.position.set(mill.x + 2.5, 0, mill.z + 2.5);
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
function syncPets() {
  for (const id of ['dog', 'goat', 'horse']) {
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
  syncPets();
  on('collar', setCollar);
}

// ---------- верхом на коне ----------
export const hasHorse = () => !!petObjs.horse;
export function setRiding(on) {
  S.riding = on && hasHorse(); save();
  if (!S.riding) { lev.root.position.y = 0; lev.play('idle'); }
}
// Конь стоит под Львом, Лев сидит в седле
function ride(p, dt) {
  const L = lev.root.position, o = p.obj.root.position, r = lev.root.rotation.y;
  o.set(L.x + Math.sin(r) * 0.35, 0, L.z + Math.cos(r) * 0.35); // Лев ближе к хвосту, ноги не в шее
  p.obj.root.rotation.y = r;
  L.y = 1.2;
  lev.play('sit');
  p.obj.update(dt, !!lev.path || lev.joy);
}

export function updatePets(dt) {
  updateSima(dt);
  for (const p of followers) {
    if (p === sima) continue;
    if (p === petObjs.horse && S.riding) ride(p, dt);
    else p.obj.update(dt, follow(p, dt));
  }
}

export const refreshPets = () => { setCollar(); syncPets(); };
