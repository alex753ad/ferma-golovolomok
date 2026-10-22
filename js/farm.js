// Ферма: грядки (вскопать → посадить → вырастет → собрать), техника, животные, рынок, украшения.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { ZONES } from '../data/map.js';
import { S, save } from './save.js';
import { instances, cloneModel, fitHeight } from './assets.js';
import { isLocked, makeWindy, addPick, onFrame, fireworks } from './world.js';
import { blockRect } from './nav.js';
import { Actor } from './actor.js';
import { $, toast, floatAt, emit, makeLabel } from './ui.js';
import { motor, splash, chirp } from './audio.js';
import { open, close, esc } from './dialog.js';
import { face } from './portraits.js';

const C = CONFIG;
let scene, hooks;
const now = () => Date.now();
const solved = id => !!S.tasks[id]?.stars;
const fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// ---------- грядки ----------
export const PLOTS = [];
const PLOT = 2; // размер грядки, м
function buildPlots() {
  for (const zn of ZONES) {
    if (!['field', 'beds', 'greenhouse'].includes(zn.kind)) continue;
    const cols = Math.floor((zn.w - 1) / PLOT), rows = Math.floor((zn.d - 1) / PLOT);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      // змейкой — в таком порядке ездит техника
      const cc = r % 2 ? cols - 1 - c : c;
      PLOTS.push({ id: `${zn.id}-${r}-${cc}`, zone: zn.id, green: zn.kind === 'greenhouse',
        x: zn.x + (cc - (cols - 1) / 2) * PLOT, z: zn.z + (r - (rows - 1) / 2) * PLOT, n: PLOTS.length });
    }
  }
}

function plotState(p) {
  if (!S.plots[p.id]) S.plots[p.id] = p.zone === 'strip' ? { s: 'grow', crop: 'wheat', t0: 0 } : { s: 'wild' };
  return S.plots[p.id];
}
const watered = st => st.water || S.decor.includes('autowater');
const growMs = st => C.growMinutes[C.crops[st.crop].grow] * 60000 / (watered(st) ? C.waterBoost : 1);
const progress = st => Math.min(1, (now() - st.t0) / growMs(st));
function stage(p) {
  const st = plotState(p);
  if (st.s !== 'grow') return st.s;
  const k = progress(st);
  return k >= 1 ? 'ripe' : k < 0.4 ? 'sprout' : 'young';
}

export function plotAt(x, z) {
  for (const p of PLOTS) if (Math.abs(x - p.x) < PLOT / 2 && Math.abs(z - p.z) < PLOT / 2 && !isLocked(p.zone)) return p;
  return null;
}

const cropUnlocked = k => { const f = C.crops[k].from; return !f || (typeof f === 'string' ? !!S.chests[f] : solved(f)); };

// Действие с грядкой (Лев уже подошёл). Возвращает true, если что-то сделали.
export function actPlot(p, quiet = false) {
  const st = plotState(p), sg = stage(p);
  if (sg === 'wild') { S.plots[p.id] = { s: 'dug' }; emit('dig'); }
  else if (sg === 'dug') {
    const crop = p.green ? 'pumpkin' : S.seed === 'pumpkin' ? 'wheat' : S.seed;
    if (!cropUnlocked(crop)) { if (!quiet) toast('В теплице растут тыквы — их семена откроются позже.'); return false; }
    const cost = C.crops[crop].seed;
    if (S.coins < cost) { if (!quiet) toast(`Не хватает монет на семена (${cost}). Продай урожай тёте Вале!`); return false; }
    S.coins -= cost;
    S.plots[p.id] = { s: 'grow', crop, t0: now() };
    emit('plant');
  } else if (sg === 'ripe') {
    S.inv[st.crop] = (S.inv[st.crop] || 0) + 1;
    S.plots[p.id] = { s: 'dug' };
    floatAt(p, '+1 ' + C.crops[st.crop].icon);
    emit('harvest');
  } else if (S.items.watering && !watered(st)) {
    const k = progress(st);
    st.water = true;
    st.t0 = now() - k * growMs(st);
    floatAt(p, '💧');
    emit('water');
  } else {
    if (!quiet) toast(`${C.crops[st.crop].name} вырастет через ${fmt((1 - progress(st)) * growMs(st))}` + (watered(st) ? ' (уже полито)' : ''));
    return false;
  }
  save(); rebuild(); hooks.onChange();
  return true;
}

// ---------- отрисовка урожая (инстансинг, пересобираем при смене стадий) ----------
const MODELS = {
  wheat: ['nature/crops_wheatStageB', 0.95], carrot: ['nature/crop_carrot', 0.55],
  sunflower: ['nature/flower_yellowA', 1.4], pumpkin: ['nature/crop_pumpkin', 0.6], goldwheat: ['nature/crops_wheatStageB', 1.1],
};
const OFFS = [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]];
let layer, signature = '';
function rebuild() {
  if (layer) { layer.traverse(o => o.isInstancedMesh && o.dispose()); scene.remove(layer); }
  layer = new THREE.Group();
  const buckets = {};
  const add = (key, h, windy, item) => { const k = key + '|' + h + '|' + windy; (buckets[k] ||= { key, h, windy, items: [] }).items.push(item); };
  for (const p of PLOTS) {
    if (isLocked(p.zone)) continue;
    const sg = stage(p), st = plotState(p);
    if (sg === 'wild') continue;
    add('nature/crops_dirtRow', 0, false, { x: p.x, z: p.z - 0.45, s: 1.8 });
    add('nature/crops_dirtRow', 0, false, { x: p.x, z: p.z + 0.45, s: 1.8 });
    if (sg === 'dug') continue;
    const [key, h] = MODELS[st.crop];
    OFFS.forEach(([dx, dz], i) => {
      const it = { x: p.x + dx, z: p.z + dz, rot: (p.n * 4 + i) * 1.7, y: 0.05 };
      if (sg === 'sprout') add('nature/crops_leafsStageA', 0.3, false, it);
      else add(key, sg === 'young' ? +(h * 0.55).toFixed(2) : h, sg === 'ripe', it);
    });
  }
  for (const b of Object.values(buckets)) {
    const g = instances(b.key, b.items, b.h ? { height: b.h, shadow: false } : { scale: 1, shadow: false });
    layer.add(b.windy ? makeWindy(g, 0.3) : g);
  }
  scene.add(layer);
}

// ---------- техника ----------
const MACHINES = {
  tractor: { model: 'cars/tractor', h: 1.9, x: 5, z: 19, rot: -0.6, name: 'Трактор' },
  seeder:  { model: 'cars/tractor', h: 1.6, x: 4.2, z: 22.2, rot: -0.3, name: 'Сеялка', seeder: true },
  combine: { model: 'cars/tractor-shovel', h: 2.2, x: 15.5, z: 13, rot: -1.2, name: 'Комбайн' },
  truck:   { model: 'cars/truck', h: 2.2, x: 16, z: 19.5, rot: -0.4, name: 'Грузовик' },
};
const parked = {}, picks = {};
let tractorBody = [];

function makeMachine(id) {
  const m = MACHINES[id];
  const o = fitHeight(cloneModel(m.model), m.h);
  if (m.seeder) { // ящик-сеялка сзади
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.8), new THREE.MeshLambertMaterial({ color: '#2f9e44' }));
    box.position.set(0, 0.6, -1.4); box.castShadow = true;
    const g = new THREE.Group(); g.add(o, box); return g;
  }
  return o;
}

function showMachines() {
  for (const id of Object.keys(MACHINES)) {
    const have = id === 'tractor' || S.items[id]; // старый трактор стоит с самого начала (сломанный)
    if (!have || parked[id]) continue;
    const m = MACHINES[id], o = makeMachine(id);
    const at = id === 'tractor' && S.tractorAt || { x: m.x, z: m.z, rot: m.rot }; // трактор стоит там, где Лев из него вышел
    o.position.set(at.x, 0, at.z); o.rotation.y = at.rot;
    scene.add(o); parked[id] = o;
    if (at.x === m.x && at.z === m.z) blockRect(m.x, m.z, 2.6, 2.6);
    picks[id] = addPick(at.x, at.z, 1.6, 2.2, { type: 'object', id: 'machine:' + id, name: m.name });
  }
  // покраска трактора: тонируем только кузов
  if (parked.tractor) {
    if (!tractorBody.length) parked.tractor.traverse(o => { if (o.isMesh && o.name.includes('body')) { o.material = o.material.clone(); tractorBody.push(o); } });
    for (const b of tractorBody) {
      b.material.color.set(S.paint || '#ffffff');
      b.material.emissive.set(S.paint === '#ffd43b' ? '#5a4500' : '#000000');
    }
  }
}

// Что можно сделать техникой на поле, где стоит Лев.
function machineActions(zoneId) {
  const ps = PLOTS.filter(p => p.zone === zoneId), st = p => stage(p);
  const list = [];
  if (S.items.tractor && ps.some(p => st(p) === 'wild')) list.push({ id: 'tractor', label: '🚜 Вспахать поле', want: 'wild' });
  if (S.items.seeder && ps.some(p => st(p) === 'dug')) list.push({ id: 'seeder', label: '🌱 Засеять поле', want: 'dug' });
  if (S.items.watering && ps.some(p => ['sprout', 'young'].includes(st(p)) && !watered(plotState(p)))) list.push({ id: 'water', label: '💧 Полить всё', want: 'water' });
  if (S.items.combine && ps.some(p => st(p) === 'ripe')) list.push({ id: 'combine', label: '🌾 Убрать урожай', want: 'ripe' });
  return list;
}

let run = null; // едущая техника: { obj, plots, i }
function startMachine(zoneId, a) {
  const ps = PLOTS.filter(p => p.zone === zoneId && (a.want === 'water' ? ['sprout', 'young'].includes(stage(p)) && !watered(plotState(p)) : stage(p) === a.want));
  if (!ps.length) return;
  if (a.id === 'water') { // полив — без машины, сразу
    let n = 0; for (const p of ps) if (actPlot(p, true)) n++;
    splash();
    toast(`Полито грядок: ${n}. Растёт вдвое быстрее!`);
    return;
  }
  const home = parked[a.id === 'seeder' ? 'seeder' : a.id];
  const obj = makeMachine(a.id);
  obj.position.set(ps[0].x, 0, ps[0].z + 3);
  if (home) home.visible = false;
  scene.add(obj);
  run = { obj, plots: ps, i: 0, home, act: a.id, want: a.want, done: 0 };
  motor(true);
}

function updateMachine(dt) {
  if (!run) return;
  const p = run.plots[run.i], o = run.obj.position;
  const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), step = 7 * dt;
  run.obj.rotation.y = Math.atan2(dx, dz);
  if (d > step) { o.x += dx / d * step; o.z += dz / d * step; return; }
  o.x = p.x; o.z = p.z;
  if (stage(p) === run.want && actPlot(p, true)) run.done++;
  if (++run.i >= run.plots.length) {
    scene.remove(run.obj);
    motor(false);
    if (run.home) run.home.visible = true;
    const names = { tractor: 'Вспахано', seeder: 'Засеяно', combine: 'Собрано' };
    toast(`${names[run.act]} грядок: ${run.done}` + (run.act === 'seeder' && run.done < run.plots.length ? ' — монеты на семена кончились' : ''));
    run = null;
  }
}

function levZone() {
  const p = hooks.lev.root.position;
  for (const zn of ZONES) {
    if (!['field', 'beds', 'greenhouse'].includes(zn.kind) || isLocked(zn.id)) continue;
    if (Math.abs(p.x - zn.x) < zn.w / 2 + 1.5 && Math.abs(p.z - zn.z) < zn.d / 2 + 1.5) return zn.id;
  }
  return null;
}

let barKey = '';
function updateBar() {
  if (S.driving) {
    const acts = driveActions(), key = 'drive' + acts.map(a => a.id).join();
    if (key === barKey) return;
    barKey = key;
    $('farmBar').innerHTML = acts.map(a => `<button class="btn g" data-d="${a.id}">${a.label}</button>`).join('');
    $('farmBar').querySelectorAll('button').forEach(b => (b.onclick = () => { driveAct(b.dataset.d); barKey = ''; }));
    return;
  }
  const zid = run ? null : levZone();
  const acts = zid ? machineActions(zid) : [];
  const key = zid + acts.map(a => a.id).join();
  if (key === barKey) return;
  barKey = key;
  const bar = $('farmBar');
  bar.innerHTML = acts.map((a, i) => `<button class="btn g" data-i="${i}">${a.label}</button>`).join('');
  bar.querySelectorAll('button').forEach(b => (b.onclick = () => { startMachine(zid, acts[b.dataset.i]); barKey = ''; }));
}

// Выбор семян (кнопка внизу слева)
function seedButton() {
  const c = C.crops[S.seed];
  $('seedBtn').innerHTML = `${c.icon} ${c.name} · ${c.seed}<span class="coin"></span>`;
}
function nextSeed() {
  const keys = Object.keys(C.crops).filter(k => k !== 'pumpkin' && cropUnlocked(k));
  S.seed = keys[(keys.indexOf(S.seed) + 1) % keys.length];
  save(); seedButton();
  toast(`Сажаем: ${C.crops[S.seed].name}. Семена — ${C.crops[S.seed].seed} монет за грядку.`);
}

// ---------- животные ----------
const PENS = {
  coop:   { model: 'pets/animal-chick', h: 0.55, n: 4, area: [1, 0.5, 2.5, 2.2], at: [-1, -1] },
  barn:   { model: 'pets/animal-cow',   h: 1.3,  n: 2, area: [2.8, 0, 1.2, 3], at: [-1, 0] },
  apiary: { model: 'pets/animal-bee',   h: 0.45, n: 4, area: [0, 0, 4, 3.5], at: [0, 0], fly: true },
  garden: { at: [0, 0] },
};
const pens = {}; // id -> { animals: [], sign }

function setupPen(id) {
  if (pens[id] || isLocked(id)) return;
  const pen = PENS[id], zn = ZONES.find(z => z.id === id), a = C.animals[id];
  const list = [];
  for (let i = 0; i < (pen.n || 0); i++) {
    const act = new Actor(pen.model, { height: pen.h });
    act.speed = pen.fly ? 1.2 : 0.8;
    act.root.position.set(zn.x + pen.area[0] + (Math.random() - 0.5) * pen.area[2], pen.fly ? 1 : 0, zn.z + pen.area[1] + (Math.random() - 0.5) * pen.area[3]);
    act.wait = Math.random() * 3;
    scene.add(act.root);
    list.push(act);
  }
  const x = zn.x + pen.at[0], z = zn.z + pen.at[1];
  addPick(x, z, 2.2, 3, { type: 'object', id: 'pen:' + id, name: a.name });
  const sign = makeLabel([['', '700 40px sans-serif']], 72, 72, '#fff8e8', '#2b2a1f', 0.013);
  sign.position.set(x, 4.2, z);
  scene.add(sign);
  pens[id] = { animals: list, sign, zn, x, z, icon: '' };
  if (!S.animals[id]) S.animals[id] = a.feed ? {} : { t0: now() };
}

function penState(id) {
  const a = C.animals[id], st = S.animals[id] || {};
  if (a.feed && !st.fedAt) return { s: 'hungry' };
  const t = (a.feed ? st.fedAt : st.t0) + a.minutes * 60000;
  return now() >= t ? { s: 'ready' } : { s: 'wait', left: t - now() };
}

export function actPen(id) {
  const a = C.animals[id], st = penState(id), g = C.goods[a.product];
  if (st.s === 'hungry') {
    if (S.coins < a.feed) return toast(`Корм стоит ${a.feed} монет. Продай урожай тёте Вале!`);
    S.coins -= a.feed; S.animals[id] = { fedAt: now() };
    floatAt(pens[id], '🌾 −' + a.feed);
    emit('feed', id);
  } else if (st.s === 'ready') {
    S.inv[a.product] = (S.inv[a.product] || 0) + a.amount;
    S.animals[id] = a.feed ? {} : { t0: now() };
    floatAt(pens[id], `+${a.amount} ${g.icon}`);
    emit('collect', a.product);
  } else return toast(`${g.name}: будет через ${fmt(st.left)}`);
  save(); hooks.onChange();
}

function updatePens(dt) {
  for (const [id, pen] of Object.entries(pens)) {
    const st = penState(id), a = C.animals[id];
    const icon = st.s === 'ready' ? C.goods[a.product].icon : st.s === 'hungry' ? '🌾' : '';
    if (icon !== pen.icon) { // перерисовать значок
      pen.icon = icon;
      const old = pen.sign; scene.remove(old);
      pen.sign = makeLabel([[icon, '700 40px sans-serif']], 72, 72, st.s === 'ready' ? '#d3f9d8' : '#fff1b8', '#2b2a1f', 0.013);
      pen.sign.position.copy(old.position); pen.sign.visible = !!icon;
      scene.add(pen.sign);
    }
    pen.sign.position.y = 4.2 + Math.abs(Math.sin(performance.now() / 300)) * 0.2;
    const P = PENS[id];
    for (const an of pen.animals) {
      if (!an.path) {
        an.wait -= dt;
        if (an.wait < 0) {
          an.wait = 2 + Math.random() * 4;
          an.walk([{ x: pen.zn.x + P.area[0] + (Math.random() - 0.5) * P.area[2], z: pen.zn.z + P.area[1] + (Math.random() - 0.5) * P.area[3] }]);
        }
      }
      if (P.fly) an.root.position.y = 1 + Math.sin(performance.now() / 250 + an.root.position.x) * 0.3;
      an.update(dt);
    }
  }
}

// Редкие животные за звёзды бегают по двору
const yardPets = {};
function showYardPets() {
  const defs = { 'gold-hen': ['pets/animal-chick', 0.6, '#ffd43b'], parrot: ['pets/animal-parrot', 0.6] };
  for (const [id, [model, h, tint]] of Object.entries(defs)) {
    if (!S.decor.includes(id) || yardPets[id]) continue;
    const a = new Actor(model, { height: h });
    if (tint) a.body.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set(tint); o.material.emissive = new THREE.Color('#4a3a00'); } });
    a.root.position.set(-6, 0, 21); a.speed = 1; a.wait = 0;
    scene.add(a.root); yardPets[id] = a;
  }
}
function updateYardPets(dt) {
  for (const a of Object.values(yardPets)) {
    if (!a.path && (a.wait -= dt) < 0) { a.wait = 3 + Math.random() * 4; a.walk([{ x: -11 + Math.random() * 8, z: 19 + Math.random() * 4 }]); }
    a.update(dt);
  }
}

// ---------- украшения ----------
const decorObjs = {};
function showDecor() {
  const m = (geo, c, x, y, z) => { const o = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: c })); o.position.set(x, y, z); o.castShadow = true; return o; };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const make = {
    scarecrow() {
      const g = new THREE.Group();
      g.add(m(B(0.12, 2, 0.12), '#7a4b24', 0, 1, 0), m(B(1.4, 0.1, 0.1), '#7a4b24', 0, 1.5, 0), m(B(0.6, 0.7, 0.3), '#e03131', 0, 1.35, 0),
        m(new THREE.SphereGeometry(0.25, 10, 8), '#f1d6a0', 0, 2.05, 0), m(new THREE.CylinderGeometry(0.45, 0.45, 0.04, 16), '#e9c46a', 0, 2.25, 0));
      g.position.set(34, 0, 30); blockRect(34, 30, 1, 1); return g;
    },
    flowerbed() {
      const g = new THREE.Group();
      g.add(m(new THREE.CylinderGeometry(1, 1.1, 0.3, 20), '#8b5e3c', 0, 0.15, 0));
      ['#ff6b6b', '#ffd43b', '#da77f2', '#ffffff', '#ff922b', '#74c0fc'].forEach((c, i) => {
        const a = i / 6 * 6.28; g.add(m(new THREE.SphereGeometry(0.16, 8, 6), c, Math.cos(a) * 0.55, 0.45, Math.sin(a) * 0.55));
      });
      g.position.set(34, 0, 34); blockRect(34, 34, 2.2, 2.2); return g;
    },
    bench() {
      const g = new THREE.Group();
      g.add(m(B(1.8, 0.1, 0.5), '#a0703c', 0, 0.5, 0), m(B(1.8, 0.5, 0.08), '#a0703c', 0, 0.85, -0.22),
        m(B(0.1, 0.5, 0.4), '#5c3a1e', -0.8, 0.25, 0), m(B(0.1, 0.5, 0.4), '#5c3a1e', 0.8, 0.25, 0));
      g.position.set(22, 0, 26.5); g.rotation.y = 0.3; blockRect(22, 26.5, 2, 1); return g;
    },
    flags() {
      const g = new THREE.Group();
      g.add(m(B(0.12, 3.2, 0.12), '#7a4b24', -1.8, 1.6, 0), m(B(0.12, 3.2, 0.12), '#7a4b24', 1.8, 1.6, 0));
      const cs = ['#e03131', '#ffd43b', '#1c7ed6', '#2f9e44', '#e64980', '#ff922b'];
      for (let i = 0; i < 9; i++) {
        const tri = new THREE.ConeGeometry(0.18, 0.35, 3); tri.rotateX(Math.PI);
        g.add(m(tri, cs[i % 6], -1.6 + i * 0.4, 2.85 - Math.sin(i / 8 * Math.PI) * 0.3, 0));
      }
      g.position.set(28.5, 0, 26.5); blockRect(26.7, 26.5, 0.4, 0.4); blockRect(30.3, 26.5, 0.4, 0.4); return g;
    },
    rooster() { // флюгер-петушок на крыше дома (из сундука)
      const g = new THREE.Group();
      g.add(m(B(0.08, 1.4, 0.08), '#495057', 0, 0.7, 0), m(B(0.7, 0.05, 0.05), '#495057', 0, 1.1, 0));
      const r = fitHeight(cloneModel('pets/animal-chick'), 0.6); r.position.y = 1.4; g.add(r);
      g.position.set(-8.5, 4.8, 14); return g;
    },
    lanterns() {
      const pts = [{ x: 1.9, z: 18 }, { x: 1.9, z: 21 }, { x: -1.9, z: 27.5 }, { x: 1.9, z: 27.5 }];
      pts.forEach(p => blockRect(p.x, p.z, 0.5, 0.5));
      return instances('town/lantern', pts, { height: 2.2 });
    },
    birdhouse() { // скворечник на шесте, на крыше прыгают птички
      const g = new THREE.Group();
      const birds = [m(new THREE.SphereGeometry(0.1, 8, 6), '#495057', -0.15, 2.95, 0), m(new THREE.SphereGeometry(0.1, 8, 6), '#e8590c', 0.15, 2.95, 0)];
      const roof = m(B(0.7, 0.08, 0.7), '#c0392b', 0, 2.82, 0); roof.rotation.z = 0.15;
      g.add(m(B(0.12, 2.4, 0.12), '#7a4b24', 0, 1.2, 0), m(B(0.5, 0.6, 0.5), '#e9c46a', 0, 2.5, 0), roof,
        m(new THREE.CircleGeometry(0.09, 12), '#2b2a1f', 0, 2.55, 0.26), ...birds);
      g.position.set(8, 0, 27); blockRect(8, 27, 0.6, 0.6);
      onFrame((dt, t) => birds.forEach((b, i) => { b.position.y = 2.95 + Math.max(0, Math.sin(t * 7 + i * 2)) * 0.12; }));
      return g;
    },
    cathouse() { // домик для Симы: вечером она спит в нём
      const g = new THREE.Group();
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.55, 4), new THREE.MeshLambertMaterial({ color: '#e64980' }));
      roof.position.y = 1.1; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
      g.add(m(B(0.9, 0.8, 0.9), '#ffd8a8', 0, 0.4, 0), roof, m(new THREE.CircleGeometry(0.22, 14), '#2b2a1f', 0, 0.35, 0.46));
      g.position.set(26, 0, 34); blockRect(26, 34, 1, 1); return g;
    },
    swing() { // качели: рама и сиденье на верёвках (крутится вокруг перекладины)
      const g = new THREE.Group(), seat = new THREE.Group();
      for (const x of [-1.1, 1.1]) for (const z of [-0.5, 0.5]) { const p = m(B(0.1, 2.6, 0.1), '#7a4b24', x, 1.25, z * 0.6); p.rotation.x = -z * 0.4; g.add(p); }
      g.add(m(B(2.4, 0.12, 0.12), '#5c3a1e', 0, 2.45, 0));
      seat.add(m(B(0.03, 1.9, 0.03), '#e9c46a', -0.35, -0.95, 0), m(B(0.03, 1.9, 0.03), '#e9c46a', 0.35, -0.95, 0), m(B(0.8, 0.08, 0.35), '#e03131', 0, -1.9, 0));
      seat.position.y = 2.45; g.add(seat); g.userData.seat = seat;
      g.position.set(16, 0, 31.5); blockRect(16, 31.5, 2.6, 1.4);
      addPick(16, 31.5, 1.4, 2.6, { type: 'object', id: 'fun:swing', name: 'Качели' });
      return g;
    },
    trampoline() {
      const g = new THREE.Group();
      g.add(m(new THREE.CylinderGeometry(1.2, 1.2, 0.12, 24), '#1c7ed6', 0, 0.5, 0), m(new THREE.CylinderGeometry(1.05, 1.05, 0.14, 24), '#212529', 0, 0.51, 0));
      for (let a = 0; a < 6.28; a += 1.57) g.add(m(B(0.08, 0.5, 0.08), '#868e96', Math.cos(a) * 1.1, 0.25, Math.sin(a) * 1.1));
      g.position.set(12, 0, 33.5); blockRect(12, 33.5, 2.4, 2.4);
      addPick(12, 33.5, 1.4, 1.5, { type: 'object', id: 'fun:trampoline', name: 'Батут' });
      return g;
    },
    telescope() {
      const g = new THREE.Group();
      for (let a = 0; a < 6.28; a += 2.09) { const l = m(B(0.06, 1.3, 0.06), '#495057', Math.cos(a) * 0.25, 0.6, Math.sin(a) * 0.25); l.rotation.set(Math.sin(a) * -0.35, 0, Math.cos(a) * 0.35); g.add(l); }
      const tube = m(new THREE.CylinderGeometry(0.1, 0.14, 1.2, 14), '#f1f3f5', 0, 1.35, 0); tube.rotation.x = -0.9;
      g.add(tube, m(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 14), '#1c7ed6', 0, 1.35 + Math.cos(0.9) * 0.6, -Math.sin(0.9) * 0.6));
      g.children.at(-1).rotation.x = -0.9;
      g.position.set(20, 0, 34); blockRect(20, 34, 0.9, 0.9);
      addPick(20, 34, 0.9, 1.8, { type: 'object', id: 'fun:telescope', name: 'Телескоп' });
      return g;
    },
    fountain() { // фонтан с брызгами
      const g = new THREE.Group();
      g.add(m(new THREE.CylinderGeometry(1.3, 1.4, 0.5, 24), '#ced4da', 0, 0.25, 0), m(new THREE.CylinderGeometry(1.12, 1.12, 0.06, 24), '#4dabf7', 0, 0.48, 0),
        m(new THREE.CylinderGeometry(0.15, 0.2, 1.2, 12), '#ced4da', 0, 0.9, 0), m(new THREE.CylinderGeometry(0.5, 0.25, 0.2, 16), '#ced4da', 0, 1.5, 0));
      const drops = [];
      for (let i = 0; i < 10; i++) { const d = m(new THREE.SphereGeometry(0.06, 6, 4), '#a5d8ff', 0, 1.6, 0); d.castShadow = false; drops.push(d); g.add(d); }
      onFrame((dt, t) => drops.forEach((d, i) => {
        const k = (t * 0.8 + i / 10) % 1, a = i * 0.63;
        d.position.set(Math.cos(a) * k * 0.9, 1.6 + k * 1.2 - k * k * 2, Math.sin(a) * k * 0.9);
      }));
      g.position.set(24, 0, 30); blockRect(24, 30, 2.8, 2.8); return g;
    },
    sz4() { // сеялка СЗ-4: рама, 4 бункера с сошниками, колёса, дышло вперёд (к трактору)
      const g = new THREE.Group();
      g.add(m(B(3.6, 0.15, 0.25), '#495057', 0, 0.75, 0), m(B(0.12, 0.12, 1.7), '#495057', 0, 0.6, 0.95));
      for (let i = 0; i < 4; i++) {
        const x = -1.35 + i * 0.9;
        g.add(m(B(0.7, 0.6, 0.6), '#2f9e44', x, 1.15, -0.1), m(B(0.75, 0.06, 0.65), '#ffd43b', x, 1.47, -0.1), m(B(0.06, 0.6, 0.06), '#212529', x, 0.45, -0.3));
      }
      for (const x of [-1.95, 1.95]) { const w = m(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 14), '#212529', x, 0.4, 0); w.rotation.z = Math.PI / 2; g.add(w); }
      const at = S.sz4At || { x: 17, z: 27, rot: 0 };
      g.position.set(at.x, 0, at.z); g.rotation.y = at.rot;
      szPick = addPick(at.x, at.z, 1.8, 1.5, { type: 'object', id: 'sz4:info', name: 'Сеялка СЗ-4' });
      return g;
    },
    balloon() { // воздушный шар кружит над фермой
      const g = new THREE.Group();
      ['#e03131', '#ffd43b', '#e03131', '#ffd43b', '#e03131', '#ffd43b', '#e03131', '#ffd43b'].forEach((c, i) => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(2.4, 6, 14, i * Math.PI / 4, Math.PI / 4), new THREE.MeshLambertMaterial({ color: c }));
        s.scale.y = 1.2; s.position.y = 4; s.castShadow = true; g.add(s);
      });
      g.add(m(B(1, 0.8, 1), '#8d5524', 0, 0, 0));
      for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) g.add(m(B(0.04, 1.8, 0.04), '#5c3a1e', x * 1.3, 1.2, z * 1.3));
      onFrame((dt, t) => { const a = t * 0.05; g.position.set(Math.cos(a) * 18, 16 + Math.sin(t * 0.6), 6 + Math.sin(a) * 14); });
      return g;
    },
  };
  for (const id of S.decor) {
    if (decorObjs[id] || !make[id]) continue;
    decorObjs[id] = make[id]();
    scene.add(decorObjs[id]);
  }
}

// ---------- рынок тёти Вали ----------
function priceOf(k) {
  const base = C.crops[k]?.price ?? C.goods[k]?.price ?? 0;
  const mill = k === 'wheat' && !isLocked('mill') ? C.millBonus : 1;
  return Math.round(base * mill * (S.items.truck ? C.truckBonus : 1));
}
const goodsName = k => C.crops[k]?.name ?? C.goods[k]?.name;
const goodsIcon = k => C.crops[k]?.icon ?? C.goods[k]?.icon;

export function marketScreen(tab = 'sell') {
  const inv = Object.entries(S.inv).filter(([, n]) => n > 0);
  const total = inv.reduce((s, [k, n]) => s + n * priceOf(k), 0);
  const sell = inv.length ? `<div class="list">${inv.map(([k, n]) => `<div class="li"><span>${goodsIcon(k)} ${esc(goodsName(k))} × ${n}</span><b>${n * priceOf(k)} <span class="coin"></span></b></div>`).join('')}</div>
      <div class="muted">${S.items.truck ? '🚚 Грузовик: цены выше на 25%. ' : ''}${!isLocked('mill') ? 'Мельница мелет муку — пшеница дороже.' : ''}</div>
      <div class="row"><button class="btn g" id="sellAll">Продать всё за ${total}</button></div>`
    : `<div class="q small">Пока нечего продавать. Собери урожай на грядках — и приходи!</div>`;
  const shop = `<div class="list">${C.shop.map(it => {
      const owned = it.once ? false : it.pet ? S.pets[it.id] : it.paint ? S.paint === it.paint : it.collar ? S.collar === it.collar : S.decor.includes(it.id);
      const lockedByStars = it.stars && S.stars < it.stars;
      const price = it.stars ? `за ${it.stars}⭐` : `${it.cost} <span class="coin"></span>`;
      const btn = owned ? '<i>есть ✓</i>' : lockedByStars ? `<i>нужно ${it.stars}⭐</i>` : `<button class="btn y sm" data-buy="${it.id}">${it.stars ? 'Забрать' : 'Купить'}</button>`;
      return `<div class="li"><span>${it.icon} ${esc(it.name)} <small>${price}</small></span>${btn}</div>`;
    }).join('')}</div>
    <div class="muted">Звёзды не тратятся: награды за звёзды открываются, когда их наберётся достаточно.</div>`;
  open(`<div class="l">
      <div class="who">${face('valya', '#f3d9fa')}<div><b>Рынок тёти Вали</b><span>У тебя ${S.coins} монет · ${S.stars} ⭐</span></div></div>
      <div class="tabs"><button class="tab ${tab === 'sell' ? 'on' : ''}" id="tSell">Продать</button><button class="tab ${tab === 'shop' ? 'on' : ''}" id="tShop">Магазин</button></div>
      ${tab === 'sell' ? sell : shop}
    </div><button class="x" id="x" aria-label="Закрыть">✕</button>`, 'market');
  $('x').onclick = close;
  $('tSell').onclick = () => marketScreen('sell');
  $('tShop').onclick = () => marketScreen('shop');
  if ($('sellAll')) $('sellAll').onclick = () => {
    S.coins += total; S.inv = {}; save(); hooks.onChange(); emit('sell', total);
    toast(`Продано на ${total} монет!`); marketScreen('sell');
  };
  document.querySelectorAll('[data-buy]').forEach(b => (b.onclick = () => buy(b.dataset.buy)));
}

function buy(id) {
  const it = C.shop.find(x => x.id === id);
  if (it.cost) { if (S.coins < it.cost) return toast('Не хватает монет'); S.coins -= it.cost; }
  if (it.pet) S.pets[id] = true;
  else if (it.paint) S.paint = it.paint;
  else if (it.collar) S.collar = it.collar;
  else if (!it.once) S.decor.push(id);
  if (it.hat) S.hat = id;
  save(); applyAll(); hooks.onChange();
  emit('buy', id);
  if (id === 'salute') { close(); fireworks(hooks.lev.root.position.x, hooks.lev.root.position.z - 6, 8); return; }
  toast(`${it.name} — готово!`);
  marketScreen('shop');
}

// ---------- пекарня ----------
let oven = null; // { x, z, sign, icon }
function setupBakery() {
  if (oven || isLocked('bakery')) return;
  const zn = ZONES.find(z => z.id === 'bakery'), x = zn.x - 1.5, z = zn.z + 1.6;
  addPick(x, z, 1.8, 3, { type: 'object', id: 'bake:oven', name: 'Пекарня' });
  oven = { x, z, sign: null, icon: null };
}
const ovenReady = () => S.oven && now() >= S.oven.readyAt;
const needText = need => Object.entries(need).map(([k, n]) => `${goodsIcon(k)}×${n}`).join(' ');

export function bakeryScreen() {
  if (S.oven) {
    const id = S.oven.id, g = C.goods[id];
    if (!ovenReady()) return toast(`${g.name} печётся — будет через ${fmt(S.oven.readyAt - now())}`);
    S.inv[id] = (S.inv[id] || 0) + 1;
    floatAt(oven, `+1 ${g.icon}`);
    S.oven = null; save(); hooks.onChange(); emit('bake');
    return toast(`${g.name} готов! Тётя Валя купит за ${priceOf(id)} монет.`);
  }
  const have = k => S.inv[k] || 0;
  const rows = C.bakery.map(r => {
    const g = C.goods[r.id], ok = Object.entries(r.need).every(([k, n]) => have(k) >= n);
    return `<div class="li"><span>${g.icon} ${esc(g.name)} <small>${needText(r.need)} · ${r.minutes} мин · продать за ${priceOf(r.id)}</small></span>
      ${ok ? `<button class="btn y sm" data-bake="${r.id}">Испечь</button>` : '<i>не хватает</i>'}</div>`;
  }).join('');
  open(`<div class="l">
      <div class="who"><div class="face" style="background:#ffe8cc;display:flex;align-items:center;justify-content:center;font-size:44px">🍞</div>
        <div><b>Пекарня</b><span>Из урожая — угощения, они дороже. Печётся по одному.</span></div></div>
      <div class="list">${rows}</div>
      <div class="muted">Не продавай всё сразу: для выпечки нужны пшеница, яйца, молоко, яблоки, морковь и мёд.</div>
    </div><button class="x" id="x" aria-label="Закрыть">✕</button>`, 'market');
  $('x').onclick = close;
  document.querySelectorAll('[data-bake]').forEach(b => (b.onclick = () => {
    const r = C.bakery.find(x => x.id === b.dataset.bake);
    for (const [k, n] of Object.entries(r.need)) S.inv[k] -= n;
    S.oven = { id: r.id, readyAt: now() + r.minutes * 60000 };
    save(); hooks.onChange(); close();
    toast(`${C.goods[r.id].name} в печи! Будет готов через ${r.minutes} мин.`);
  }));
}

function updateBakery() {
  if (!oven) return;
  const icon = ovenReady() ? C.goods[S.oven.id].icon : S.oven ? '🔥' : '';
  if (icon !== oven.icon) {
    oven.icon = icon;
    if (oven.sign) scene.remove(oven.sign);
    oven.sign = makeLabel([[icon, '700 40px sans-serif']], 72, 72, ovenReady() ? '#d3f9d8' : '#fff1b8', '#2b2a1f', 0.013);
    oven.sign.visible = !!icon;
    scene.add(oven.sign);
  }
  oven.sign.position.set(oven.x, 4.4 + Math.abs(Math.sin(performance.now() / 300)) * 0.2, oven.z - 2);
}

// ---------- Лев за рулём трактора, сеялка СЗ-4 ----------
let szPick = null, noSeedT = 0;
const behind = (o, d) => ({ x: o.position.x - Math.sin(o.rotation.y) * d, z: o.position.z - Math.cos(o.rotation.y) * d });

export function setDriving(on) {
  const L = hooks.lev, t = parked.tractor;
  if (on === !!S.driving || !t) return;
  if (on) {
    if (!S.tractorAt) blockRect(MACHINES.tractor.x, MACHINES.tractor.z, 2.6, 2.6, 0); // уехал с места — там больше не препятствие
    S.driving = true;
    L.stop(); L.root.position.set(t.position.x, 0, t.position.z); L.root.rotation.y = L.targetRot = t.rotation.y;
    toast('Рули джойстиком! Где проедешь — грядки вспашутся' + (S.decor.includes('sz4') ? '. Прицепи СЗ-4 — и сразу засеются.' : '.'), 4000);
  } else {
    S.driving = false;
    S.tractorAt = { x: t.position.x, z: t.position.z, rot: t.rotation.y };
    const r = t.rotation.y; // выйти слева от трактора
    L.root.position.set(t.position.x + Math.cos(r) * 1.8, 0, t.position.z - Math.sin(r) * 1.8);
    L.play('idle');
  }
  save(); barKey = '';
}

function driveActions() {
  const acts = [{ id: 'exit', label: '🚜 Выйти из трактора' }], sz = decorObjs.sz4, t = parked.tractor;
  if (sz && !S.hitched && Math.hypot(sz.position.x - t.position.x, sz.position.z - t.position.z) < 5) acts.push({ id: 'hitch', label: '🔗 Прицепить СЗ-4' });
  if (S.hitched) acts.push({ id: 'unhitch', label: '⛓️ Отцепить СЗ-4' });
  return acts;
}
function driveAct(id) {
  if (id === 'exit') return setDriving(false);
  S.hitched = id === 'hitch';
  const sz = decorObjs.sz4;
  if (!S.hitched) S.sz4At = { x: sz.position.x, z: sz.position.z, rot: sz.rotation.y };
  save();
  toast(S.hitched ? `СЗ-4 прицеплена! Едь по вспаханным грядкам — посеет: ${C.crops[S.seed].name}.` : 'СЗ-4 отцеплена.');
}

function updateDrive() {
  const t = parked.tractor, sz = decorObjs.sz4;
  if (S.hitched && sz && t) { // сеялка едет за трактором
    const b = behind(t, 2.7);
    sz.position.set(b.x, 0, b.z); sz.rotation.y = t.rotation.y;
    szPick.position.set(b.x, 0.75, b.z);
  }
  if (!S.driving || !t) return;
  const L = hooks.lev, p = L.root.position;
  t.position.set(p.x, 0, p.z); t.rotation.y = L.root.rotation.y;
  picks.tractor.position.set(p.x, 1.1, p.z);
  p.y = 0.75; L.play('drive');
  // работа в поле: трактор пашет, СЗ-4 сеет полосу шириной 2 грядки
  const pl = plotAt(p.x, p.z);
  if (pl && stage(pl) === 'wild') actPlot(pl, true);
  if (!S.hitched) return;
  for (const q of PLOTS) {
    if (isLocked(q.zone) || q.green || Math.abs(q.x - sz.position.x) > 1.8 || Math.abs(q.z - sz.position.z) > 1.8 || stage(q) !== 'dug') continue;
    if (!actPlot(q, true) && performance.now() > noSeedT) { noSeedT = performance.now() + 5000; toast(`Не хватает монет на семена (${C.crops[S.seed].seed}). Продай урожай тёте Вале!`); }
  }
}

// ---------- качели, батут, телескоп ----------
let fun = null; // { id, t } — Лев качается или прыгает
export const levBusy = () => !!fun;
export function funAct(id) {
  if (id === 'telescope') return toast('Днём звёзд не видно. Вечером посмотри в телескоп — покажу созвездие!');
  if (fun) return;
  fun = { id, t: 0 };
  hooks.lev.stop();
  hooks.lev.root.rotation.y = hooks.lev.targetRot = 0;
  hooks.lev.play(id === 'swing' ? 'sit' : 'jump');
}
function updateFun(dt) {
  if (!fun) return;
  const L = hooks.lev, o = decorObjs[fun.id], p = L.root.position;
  fun.t += dt;
  if (fun.id === 'trampoline') p.set(o.position.x, 0.55 + Math.abs(Math.sin(fun.t * 3)) * 2.2, o.position.z);
  else {
    const a = Math.sin(fun.t * 2.6) * 0.8 * Math.min(1, fun.t / 1.5);
    o.userData.seat.rotation.x = a;
    p.set(o.position.x, 2.45 - 1.9 * Math.cos(a) - 0.05, o.position.z + 1.9 * Math.sin(a));
  }
  if (fun.t > 6) {
    if (o.userData.seat) o.userData.seat.rotation.x = 0;
    p.set(o.position.x, 0, o.position.z + 1.8);
    L.play('idle');
    fun = null;
  }
}

// Птицы поют, когда Лев рядом со скворечником
let chirpT = 3;
function updateBirds(dt) {
  if (!decorObjs.birdhouse || (chirpT -= dt) > 0) return;
  chirpT = 5 + Math.random() * 6;
  const p = hooks.lev.root.position;
  if (Math.hypot(p.x - 8, p.z - 27) < 12) chirp();
}

// ---------- награды ----------
export function grantItem(item) {
  if (['tractor', 'watering', 'seeder', 'combine', 'truck'].includes(item)) S.items[item] = true;
  save(); applyAll();
}

// Подсказка при касании техники
export function actMachine(id) {
  const m = MACHINES[id];
  if (id === 'tractor' && !S.items.tractor) return toast('Старый трактор не заводится. Может, кто-то поможет его получить?');
  if (id === 'tractor') return setDriving(true);
  toast(`${m.name} готов к работе! Подойди к открытому полю — внизу появится кнопка.`);
}

function applyAll() { showMachines(); showDecor(); showYardPets(); for (const id of Object.keys(PENS)) setupPen(id); setupBakery(); seedButton(); }

// ---------- запуск и кадр ----------
export function initFarm(sc, h) {
  scene = sc; hooks = h;
  buildPlots();
  $('seedBtn').onclick = nextSeed;
  applyAll();
  rebuild();
  S.driving = false; // после перезапуска Лев не за рулём
  let acc = 0, barAcc = 0;
  onFrame(dt => {
    updateMachine(dt); updatePens(dt); updateYardPets(dt); updateBakery(); updateFun(dt); updateBirds(dt); updateDrive();
    if ((barAcc += dt) > 0.25) { barAcc = 0; updateBar(); }
    if ((acc += dt) > 1) { // раз в секунду: стадии роста
      acc = 0;
      const sig = PLOTS.map(p => isLocked(p.zone) ? '' : stage(p)[0]).join('');
      if (sig !== signature) { signature = sig; rebuild(); }
    }
  });
}

// После открытия зоны
export function onZoneOpened() { applyAll(); rebuild(); }

// Значки для миникарты: готовый урожай и готовые продукты
export function farmMarkers() {
  const out = [];
  for (const p of PLOTS) if (!isLocked(p.zone) && stage(p) === 'ripe') out.push({ x: p.x, z: p.z, color: '#ffd43b', small: true });
  for (const [id, pen] of Object.entries(pens)) if (penState(id).s === 'ready') out.push({ x: pen.x, z: pen.z, color: '#40c057', small: true });
  if (oven && ovenReady()) out.push({ x: oven.x, z: oven.z, color: '#40c057', small: true });
  return out;
}

