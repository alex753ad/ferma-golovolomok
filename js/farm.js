// Ферма: грядки (вскопать → посадить → вырастет → собрать), техника, животные, рынок, украшения.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { ZONES } from '../data/map.js';
import { S, save } from './save.js';
import { instances, cloneModel, fitHeight } from './assets.js';
import { isLocked, makeWindy, addPick, onFrame } from './world.js';
import { blockRect } from './nav.js';
import { Actor } from './actor.js';
import { $, toast, floatAt, emit, makeLabel } from './ui.js';
import { motor, splash } from './audio.js';
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
const growMs = st => C.growMinutes[C.crops[st.crop].grow] * 60000 / (st.water ? C.waterBoost : 1);
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
  } else if (S.items.watering && !st.water) {
    const k = progress(st);
    st.water = true;
    st.t0 = now() - k * growMs(st);
    floatAt(p, '💧');
    emit('water');
  } else {
    if (!quiet) toast(`${C.crops[st.crop].name} вырастет через ${fmt((1 - progress(st)) * growMs(st))}` + (S.items.watering ? ' (уже полито)' : ''));
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
const parked = {};
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
    o.position.set(m.x, 0, m.z); o.rotation.y = m.rot;
    scene.add(o); parked[id] = o;
    blockRect(m.x, m.z, 2.6, 2.6);
    addPick(m.x, m.z, 1.6, 2.2, { type: 'object', id: 'machine:' + id, name: m.name });
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
  if (S.items.watering && ps.some(p => ['sprout', 'young'].includes(st(p)) && !plotState(p).water)) list.push({ id: 'water', label: '💧 Полить всё', want: 'water' });
  if (S.items.combine && ps.some(p => st(p) === 'ripe')) list.push({ id: 'combine', label: '🌾 Убрать урожай', want: 'ripe' });
  return list;
}

let run = null; // едущая техника: { obj, plots, i }
function startMachine(zoneId, a) {
  const ps = PLOTS.filter(p => p.zone === zoneId && (a.want === 'water' ? ['sprout', 'young'].includes(stage(p)) && !plotState(p).water : stage(p) === a.want));
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
      g.position.set(-21.5, 0, 11); blockRect(-21.5, 11, 1, 1); return g;
    },
    flowerbed() {
      const g = new THREE.Group();
      g.add(m(new THREE.CylinderGeometry(1, 1.1, 0.3, 20), '#8b5e3c', 0, 0.15, 0));
      ['#ff6b6b', '#ffd43b', '#da77f2', '#ffffff', '#ff922b', '#74c0fc'].forEach((c, i) => {
        const a = i / 6 * 6.28; g.add(m(new THREE.SphereGeometry(0.16, 8, 6), c, Math.cos(a) * 0.55, 0.45, Math.sin(a) * 0.55));
      });
      g.position.set(-10, 0, 19.2); blockRect(-10, 19.2, 2.2, 2.2); return g;
    },
    bench() {
      const g = new THREE.Group();
      g.add(m(B(1.8, 0.1, 0.5), '#a0703c', 0, 0.5, 0), m(B(1.8, 0.5, 0.08), '#a0703c', 0, 0.85, -0.22),
        m(B(0.1, 0.5, 0.4), '#5c3a1e', -0.8, 0.25, 0), m(B(0.1, 0.5, 0.4), '#5c3a1e', 0.8, 0.25, 0));
      g.position.set(-13, 0, 19); g.rotation.y = 0.3; blockRect(-13, 19, 2, 1); return g;
    },
    flags() {
      const g = new THREE.Group();
      g.add(m(B(0.12, 3.2, 0.12), '#7a4b24', -1.8, 1.6, 0), m(B(0.12, 3.2, 0.12), '#7a4b24', 1.8, 1.6, 0));
      const cs = ['#e03131', '#ffd43b', '#1c7ed6', '#2f9e44', '#e64980', '#ff922b'];
      for (let i = 0; i < 9; i++) {
        const tri = new THREE.ConeGeometry(0.18, 0.35, 3); tri.rotateX(Math.PI);
        g.add(m(tri, cs[i % 6], -1.6 + i * 0.4, 2.85 - Math.sin(i / 8 * Math.PI) * 0.3, 0));
      }
      g.position.set(0, 0, 10); blockRect(-1.8, 10, 0.4, 0.4); blockRect(1.8, 10, 0.4, 0.4); return g;
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
      const owned = it.paint ? S.paint === it.paint : it.collar ? S.collar === it.collar : S.decor.includes(it.id);
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
  if (it.paint) S.paint = it.paint; else if (it.collar) S.collar = it.collar; else S.decor.push(id);
  save(); applyAll(); hooks.onChange();
  toast(`${it.name} — готово!`);
  emit('buy', id);
  marketScreen('shop');
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
  toast(`${m.name} готов к работе! Подойди к открытому полю — внизу появится кнопка.`);
}

function applyAll() { showMachines(); showDecor(); showYardPets(); for (const id of Object.keys(PENS)) setupPen(id); seedButton(); }

// ---------- запуск и кадр ----------
export function initFarm(sc, h) {
  scene = sc; hooks = h;
  buildPlots();
  $('seedBtn').onclick = nextSeed;
  applyAll();
  rebuild();
  let acc = 0;
  onFrame(dt => {
    updateMachine(dt); updatePens(dt); updateYardPets(dt);
    if ((acc += dt) > 1) { // раз в секунду: стадии роста и панель техники
      acc = 0;
      const sig = PLOTS.map(p => isLocked(p.zone) ? '' : stage(p)[0]).join('');
      if (sig !== signature) { signature = sig; rebuild(); }
      updateBar();
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
  return out;
}

