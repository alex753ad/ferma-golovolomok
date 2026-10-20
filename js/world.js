// Мир фермы: земля, дороги, зоны, постройки, трава, облака, свет, смена дня.
import * as THREE from 'three';
import { BOUNDS, ZONES, ROADS, BUILDINGS } from '../data/map.js';
import { instances, cloneModel, fitHeight } from './assets.js';
import { blockRect, blockCircle, isFree } from './nav.js';
import { makeLabel } from './ui.js';

export const wind = { value: 0 };      // общее время для шейдеров ветра
const animated = [];                    // функции (dt, t) для «живых» объектов
const zoneState = {};                   // id -> { zone, lockGroup, locked, inner: [] }
export const pickables = [];            // невидимые меши для касаний
export const mapShapes = { buildings: [], water: [], trees: [] }; // для миникарты

// Детерминированный генератор случайных чисел — мир всегда одинаковый.
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const rr = (a, b) => a + rnd() * (b - a);

const mats = {};
const mat = (c, o = {}) => mats[c + JSON.stringify(o)] ||= new THREE.MeshLambertMaterial({ color: c, ...o });

function mesh(geo, color, x = 0, y = 0, z = 0, o) {
  const m = new THREE.Mesh(geo, mat(color, o));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function flat(scene, w, d, color, x, z, y = 0.02) {
  const m = mesh(new THREE.PlaneGeometry(w, d), color, x, y, z);
  m.rotation.x = -Math.PI / 2;
  m.castShadow = false;
  scene.add(m);
  return m;
}

// Материал, который колышется на ветру (только для InstancedMesh).
function windy(material, amp) {
  const m = material.clone();
  m.onBeforeCompile = s => {
    s.uniforms.uTime = wind;
    s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec4 wp = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float sway = sin(uTime * 1.8 + wp.x * 0.35 + wp.z * 0.27) * ${amp.toFixed(3)} * max(position.y, 0.0);
      transformed.x += sway; transformed.z += sway * 0.5;`);
  };
  m.customProgramCacheKey = () => 'wind' + amp;
  return m;
}
export function makeWindy(group, amp) {
  group.traverse(o => { if (o.isInstancedMesh) { o.material = windy(o.material, amp); o.castShadow = false; } });
  return group;
}

// ---------- свет и небо ----------
let sun, hemi, scene, sky = new THREE.Color();
const SKY_DAY = new THREE.Color('#9fd8ff'), SKY_EVE = new THREE.Color('#ffa77a');
const SUN_DAY = new THREE.Color('#fff4dc'), SUN_EVE = new THREE.Color('#ff9a4d');

function setupLights(q) {
  hemi = new THREE.HemisphereLight('#e3f4ff', '#6d9a45', 1.6);
  scene.add(hemi);
  sun = new THREE.DirectionalLight('#fff4dc', 2.4);
  sun.castShadow = q.shadows;
  sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
  Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 120 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  scene.fog = new THREE.Fog(SKY_DAY, 60, 130);
  scene.background = sky.copy(SKY_DAY);
}

let dayPhase = 0;
// 0 — утро/день, 1 — закат. Ночи нет.
export function setDayPhase(p) {
  dayPhase = Math.max(0, Math.min(1, p));
  const k = Math.max(0, (dayPhase - 0.55) / 0.45); // день держится долго, потом тёплый вечер
  sky.copy(SKY_DAY).lerp(SKY_EVE, k);
  scene.fog.color.copy(sky);
  sun.color.copy(SUN_DAY).lerp(SUN_EVE, k);
  sun.intensity = 2.4 - k * 0.8;
  hemi.intensity = 1.6 - k * 0.6;
  hemi.color.set('#e3f4ff').lerp(SKY_EVE, k * 0.5);
}

// Солнце и тени следуют за Львом.
export function followSun(x, z) {
  const a = 0.6 + dayPhase * 1.2, elev = 1 - dayPhase * 0.55;
  sun.position.set(x + Math.cos(a) * 30, 18 + elev * 22, z + Math.sin(a) * 18);
  sun.target.position.set(x, 0, z);
}

// ---------- постройки ----------
function gableRoof(w, d, h, color) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  return mesh(g, color);
}

function building(b) {
  const g = new THREE.Group();
  const h = b.type === 'hut' ? 1.8 : b.type === 'manor' ? 4.2 : 2.8;
  g.add(mesh(box(b.w, h, b.d), b.color, 0, h / 2, 0));
  const roof = gableRoof(b.w + 0.6, b.d + 0.6, b.type === 'hut' ? 1.6 : 2, b.roof);
  roof.position.y = h;
  g.add(roof);
  // дверь и окна на южной стороне (+z)
  const front = b.d / 2 + 0.03;
  if (b.type === 'garage') g.add(mesh(box(2.6, 2.2, 0.1), '#6c7a89', 0, 1.1, front));
  else g.add(mesh(box(0.9, 1.6, 0.1), '#8d5524', 0, 0.8, front));
  if (b.type !== 'hut') for (const x of [-b.w / 3, b.w / 3]) g.add(mesh(box(0.9, 0.8, 0.1), '#9fd8ff', x, h * 0.6, front));
  if (b.type === 'manor') {
    for (const x of [-b.w / 3, b.w / 3]) g.add(mesh(box(0.9, 0.8, 0.1), '#9fd8ff', x, h * 0.6 + 1.6, front)); // второй этаж
    g.add(mesh(box(0.25, 2.2, 0.25), '#868e96', b.w / 2 - 1, h + 1.6, 0));
  }
  if (b.chimney) {
    g.add(mesh(box(0.6, 1.6, 0.6), '#a12d22', b.w / 4, h + 1.3, -b.d / 5));
    smoke(b.x + b.w / 4, h + 2.2, b.z - b.d / 5);
  }
  g.position.set(b.x, 0, b.z);
  scene.add(g);
  blockRect(b.x, b.z, b.w + 0.8, b.d + 0.8);
  mapShapes.buildings.push({ x: b.x, z: b.z, w: b.w, d: b.d, color: b.roof });
}

function smoke(x, y, z) {
  const puffs = [0, 1, 2, 3].map(() => {
    const p = mesh(new THREE.IcosahedronGeometry(0.35, 1), '#ffffff', x, y, z, { transparent: true });
    p.castShadow = false;
    scene.add(p);
    return p;
  });
  animated.push((dt, t) => puffs.forEach((p, i) => {
    const k = (t * 0.3 + i / 4) % 1;
    p.position.set(x + Math.sin(k * 5 + i) * 0.3 + k * 0.8, y + k * 3, z);
    p.scale.setScalar(0.6 + k * 1.5);
    p.material.opacity = 0.75 * (1 - k);
  }));
}

// ---------- зоны ----------
function zoneContent(zn, inner) {
  const g = new THREE.Group();
  const { x, z, w, d } = zn;
  if (zn.kind === 'field' || zn.kind === 'beds') flat(g, w - 0.4, d - 0.4, '#a7b86a', x, z, 0.022); // грядки рисует farm.js
  if (zn.kind === 'coop') {
    const c = building0('#d9480f', '#7a1f1f', 3, 2.2, 1.8);
    c.position.set(x - 1, 0, z - 1); g.add(c); inner.push([x - 1, z - 1, 3.6, 2.8]);
    flat(g, w - 1, d - 1, '#d8c48a', x, z, 0.022);
  }
  if (zn.kind === 'barn') {
    const c = building0('#c92a2a', '#7a1f1f', 6, 5, 3.2);
    c.position.set(x - 1, 0, z); g.add(c); inner.push([x - 1, z, 6.8, 5.8]);
  }
  if (zn.kind === 'garden') {
    const trees = [];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      if (i === 2 && j === 0) continue;
      const t = { x: x - 3 + i * 3, z: z - 3 + j * 3, rot: rnd() * 6 };
      trees.push(t); inner.push([t.x, t.z, 0.9, 0.9]);
    }
    g.add(instances('nature/tree_fat', trees, { height: 3.2 }));
    const cottage = building0('#ffe8cc', '#e8590c', 3, 2.6, 2.2);
    cottage.position.set(x + 3, 0, z + 3.2); g.add(cottage); inner.push([x + 3, z + 3.2, 3.6, 3.2]);
  }
  if (zn.kind === 'mill') {
    // башня + крылья (крылья из набора Kenney, крутятся, когда мельница починена)
    const tower = mesh(new THREE.CylinderGeometry(1.3, 1.9, 5.5, 8), '#f1e3c8', x, 2.75, z);
    const cap = mesh(new THREE.ConeGeometry(1.75, 2, 8), '#8d5524', x, 6.5, z);
    const door = mesh(box(0.1, 1.5, 1), '#5c3a1e', x + 1.75, 0.75, z);
    const sails = cloneModel('town/windmill');
    sails.scale.setScalar(7 / 3.11);
    sails.position.set(x + 1.7, 5.4, z);
    g.add(tower, cap, door, sails);
    animated.push(dt => { if (!zoneState[zn.id].locked) sails.rotation.x += dt * 0.7; });
    inner.push([x, z, 4, 4]);
  }
  if (zn.kind === 'pond') {
    const shore = mesh(new THREE.CircleGeometry(1, 40), '#e9c98a', x, 0.03, z);
    shore.scale.set(w / 2 - 0.3, d / 2 - 0.3, 1); shore.rotation.x = -Math.PI / 2; shore.castShadow = false;
    const water = mesh(new THREE.CircleGeometry(1, 40), '#3d9be9', x, 0.05, z);
    water.scale.set(w / 2 - 1, d / 2 - 1, 1); water.rotation.x = -Math.PI / 2; water.castShadow = false;
    g.add(shore, water);
    g.add(instances('nature/lily_large', [{ x: x - 2, z: z + 1 }, { x: x + 1.5, z: z - 1.2 }, { x: x + 2.5, z: z + 1.5 }], { scale: 1.2, y: 0.06, shadow: false }));
    animated.push((dt, t) => water.material.color.setHSL(0.57, 0.72, 0.56 + Math.sin(t * 1.2) * 0.03));
    for (let a = 0; a < 6.28; a += 0.4) inner.push([x + Math.cos(a) * (w / 2 - 2.5), z + Math.sin(a) * (d / 2 - 2.5), 4, 3]);
    mapShapes.water.push({ x, z, rx: w / 2 - 1, rz: d / 2 - 1 });
  }
  if (zn.kind === 'apiary') {
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const hx = x - 3 + i * 3, hz = z - 1.5 + j * 3;
      const hive = new THREE.Group();
      hive.add(mesh(box(0.9, 0.9, 0.9), '#fff3bf', 0, 0.55, 0), mesh(box(1.1, 0.15, 1.1), '#e8590c', 0, 1.05, 0), mesh(box(0.3, 0.1, 0.1), '#5c3a1e', 0, 0.3, 0.46));
      hive.position.set(hx, 0, hz); g.add(hive); inner.push([hx, hz, 1.1, 1.1]);
    }
  }
  if (zn.kind === 'bakery') {
    const b = building0('#ffd8a8', '#c2410c', 5, 3.6, 2.8);
    b.add(mesh(box(0.6, 1.4, 0.6), '#a12d22', 1.4, 3.6, -0.6), mesh(box(1.4, 0.5, 0.08), '#fff3bf', 0, 2.3, 1.84));
    b.position.set(x - 1.5, 0, z - 0.6); g.add(b); inner.push([x - 1.5, z - 0.6, 5.6, 4.2]);
    smoke(x - 0.1, 4.4, z - 1.2);
    mapShapes.buildings.push({ x: x - 1.5, z: z - 0.6, w: 5, d: 3.6, color: '#c2410c' });
  }
  if (zn.kind === 'greenhouse') {
    g.add(mesh(box(w - 2, 2.6, d - 1.6), '#e7f5ff', x, 1.3, z, { transparent: true, opacity: 0.4, emissive: '#5a7a90' }));
    g.add(mesh(box(w - 1.8, 0.15, d - 1.4), '#495057', x, 2.65, z));
    inner.push([x, z, w - 1.4, d - 1.2]);
  }
  scene.add(g);
  return g;
}

// Простой домик (для курятника, коровника, дома бабушки).
function building0(wall, roof, w, d, h) {
  const g = new THREE.Group();
  g.add(mesh(box(w, h, d), wall, 0, h / 2, 0));
  const r = gableRoof(w + 0.5, d + 0.5, h * 0.55, roof); r.position.y = h; g.add(r);
  g.add(mesh(box(0.8, 1.3, 0.1), '#5c3a1e', 0, 0.65, d / 2 + 0.03));
  return g;
}

// Забор вокруг закрытой зоны + табличка.
function lockFence(zn) {
  const g = new THREE.Group();
  const pts = [], hw = zn.w / 2 + 0.3, hd = zn.d / 2 + 0.3, step = 1.3;
  for (let xx = -hw; xx < hw - 0.01; xx += step) { pts.push({ x: zn.x + xx + step / 2, z: zn.z - hd, rot: Math.PI / 2 }, { x: zn.x + xx + step / 2, z: zn.z + hd, rot: Math.PI / 2 }); }
  for (let zz = -hd; zz < hd - 0.01; zz += step) { pts.push({ x: zn.x - hw, z: zn.z + zz + step / 2, rot: 0 }, { x: zn.x + hw, z: zn.z + zz + step / 2, rot: 0 }); }
  g.add(instances('town/fence', pts, { height: 1.0 }));
  const sign = makeLabel([[`🔒 ${zn.name}`, '700 30px Fredoka, Nunito, sans-serif'], [`Реши задачу №${zn.lock}`, '800 20px Nunito, sans-serif']], 280, 96, '#fff8e8', '#2b2a1f', 0.016);
  const side = { n: [0, -hd], s: [0, hd], e: [hw, 0], w: [-hw, 0] }[zn.gate];
  sign.position.set(zn.x + side[0], 2.1, zn.z + side[1]);
  g.add(sign);
  const post = fitHeight(cloneModel('surv/signpost-single'), 1.5);
  post.position.set(zn.x + side[0], 0, zn.z + side[1]);
  g.add(post);
  scene.add(g);
  return g;
}

function applyZoneNav(st) {
  const zn = st.zone;
  if (st.locked) { blockRect(zn.x, zn.z, zn.w + 1.4, zn.d + 1.4); return; }
  blockRect(zn.x, zn.z, zn.w + 1.4, zn.d + 1.4, 0);
  for (const [x, z, w, d] of st.inner) blockRect(x, z, w + 0.6, d + 0.6);
}

// Открыть зону. animate — забор уходит в землю, вокруг искры.
export function unlockZone(id, animate = false) {
  const st = zoneState[id];
  if (!st || !st.locked) return;
  st.locked = false;
  applyZoneNav(st);
  if (!animate) { scene.remove(st.lockGroup); return; }
  const g = st.lockGroup, zn = st.zone;
  sparkles(zn.x, zn.z, zn.w, zn.d);
  let k = 0;
  const f = dt => {
    k += dt / 1.4;
    g.position.y = -1.6 * Math.min(1, k);
    if (k >= 1) { scene.remove(g); animated.splice(animated.indexOf(f), 1); }
  };
  animated.push(f);
}

// Искры над зоной
function sparkles(x, z, w, d) {
  const n = 60, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [];
  for (let i = 0; i < n; i++) {
    pos.set([x + rr(-w / 2, w / 2), rr(0, 1), z + rr(-d / 2, d / 2)], i * 3);
    vel.push(rr(1, 3));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: '#ffe066', size: 0.35, transparent: true });
  const pts = new THREE.Points(geo, m);
  scene.add(pts);
  let t = 0;
  const f = dt => {
    t += dt;
    for (let i = 0; i < n; i++) pos[i * 3 + 1] += vel[i] * dt;
    geo.attributes.position.needsUpdate = true;
    m.opacity = Math.max(0, 1 - t / 2);
    if (t > 2) { scene.remove(pts); geo.dispose(); m.dispose(); animated.splice(animated.indexOf(f), 1); }
  };
  animated.push(f);
}

// Салют: несколько разноцветных вспышек в небе над точкой.
export function fireworks(x, z, seconds = 8) {
  const colors = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#ffa94d'];
  let t = 0, next = 0;
  const f = dt => {
    t += dt;
    if (t >= next && t < seconds) { burst(x + rr(-12, 12), 14 + rr(0, 8), z + rr(-10, 4), colors[(next * 7 | 0) % colors.length]); next += rr(0.3, 0.8); }
    if (t > seconds + 3) animated.splice(animated.indexOf(f), 1);
  };
  animated.push(f);
}
function burst(x, y, z, color) {
  const n = 70, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), v = [];
  for (let i = 0; i < n; i++) {
    pos.set([x, y, z], i * 3);
    const a = rnd() * 6.28, b = Math.acos(rr(-1, 1)), s = rr(5, 8);
    v.push([Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s, Math.sin(b) * Math.sin(a) * s]);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color, size: 0.6, transparent: true, depthWrite: false, fog: false });
  const pts = new THREE.Points(geo, m);
  scene.add(pts);
  let t = 0;
  const f = dt => {
    t += dt;
    for (let i = 0; i < n; i++) {
      v[i][1] -= 6 * dt;
      pos[i * 3] += v[i][0] * dt; pos[i * 3 + 1] += v[i][1] * dt; pos[i * 3 + 2] += v[i][2] * dt;
      v[i][0] *= 0.98; v[i][2] *= 0.98;
    }
    geo.attributes.position.needsUpdate = true;
    m.opacity = Math.max(0, 1 - t / 1.8);
    if (t > 1.8) { scene.remove(pts); geo.dispose(); m.dispose(); animated.splice(animated.indexOf(f), 1); }
  };
  animated.push(f);
}

export const zoneById = id => zoneState[id]?.zone;
export const isLocked = id => zoneState[id]?.locked;

// ---------- природа ----------
function grassGeometry() {
  const pos = [], col = [], base = new THREE.Color('#3f8a2a'), tip = new THREE.Color('#9bd65a');
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI / 3, c = Math.cos(a) * 0.07, s = Math.sin(a) * 0.07, lean = (k - 1) * 0.06;
    pos.push(-c, 0, -s, c, 0, s, lean, 0.42 + k * 0.05, 0);
    col.push(...base.toArray(), ...base.toArray(), ...tip.toArray());
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

function onRoadOrZone(x, z, m = 0.6) {
  for (const r of ROADS) if (Math.abs(x - r.x) < r.w / 2 + m && Math.abs(z - r.z) < r.d / 2 + m) return true;
  for (const zn of ZONES) if (Math.abs(x - zn.x) < zn.w / 2 + m && Math.abs(z - zn.z) < zn.d / 2 + m) return true;
  return false;
}

let grassMesh;
function grass(count) {
  const geo = grassGeometry();
  const material = windy(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 0.25);
  grassMesh = new THREE.InstancedMesh(geo, material, count);
  grassMesh.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  let n = 0, tries = 0;
  while (n < count && tries++ < count * 20) {
    const x = rr(BOUNDS.x0 - 10, BOUNDS.x1 + 10), z = rr(BOUNDS.z0 - 10, BOUNDS.z1 + 10);
    if (onRoadOrZone(x, z) || (x > BOUNDS.x0 && x < BOUNDS.x1 && z > BOUNDS.z0 && z < BOUNDS.z1 && !isFree(x, z))) continue;
    const s = rr(0.7, 1.4);
    q.setFromAxisAngle(up, rnd() * 6.28);
    grassMesh.setMatrixAt(n++, m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s, s)));
  }
  grassMesh.count = n;
  scene.add(grassMesh);
}
export function setGrassCount(n) { if (grassMesh) grassMesh.count = Math.min(n, grassMesh.instanceMatrix.count); }

function trees() {
  // лес за забором
  const kinds = ['nature/tree_oak', 'nature/tree_default', 'nature/tree_pineRoundC', 'nature/tree_fat'];
  const lists = kinds.map(() => []);
  for (let i = 0; i < 170; i++) {
    const a = rnd() * 6.28;
    let x, z;
    if (i % 4 === 0) { x = BOUNDS.x0 - rr(3, 16); z = rr(BOUNDS.z0 - 15, BOUNDS.z1 + 15); }
    else if (i % 4 === 1) { x = BOUNDS.x1 + rr(3, 16); z = rr(BOUNDS.z0 - 15, BOUNDS.z1 + 15); }
    else if (i % 4 === 2) { z = BOUNDS.z1 + rr(3, 14); x = rr(BOUNDS.x0 - 15, BOUNDS.x1 + 15); }
    else { z = BOUNDS.z0 - rr(3, 18); x = rr(BOUNDS.x0 - 15, BOUNDS.x1 + 15); if (Math.abs(x) < 14 && z > BOUNDS.z0 - 14) continue; }
    lists[i % 4].push({ x, z, rot: a, s: rr(0.8, 1.3) });
  }
  kinds.forEach((k, i) => scene.add(instances(k, lists[i], { height: 5 })));

  // деревья внутри фермы
  const inside = [];
  for (let i = 0; i < 60 && inside.length < 26; i++) {
    const x = rr(BOUNDS.x0 + 2, BOUNDS.x1 - 2), z = rr(BOUNDS.z0 + 2, BOUNDS.z1 - 2);
    if (onRoadOrZone(x, z, 2) || !isFree(x, z) || Math.hypot(x, z - 21) < 8) continue;
    inside.push({ x, z, rot: rnd() * 6, s: rr(0.85, 1.2) });
  }
  scene.add(instances('town/tree-high-round', inside, { height: 4.5 }));
  for (const t of inside) { blockCircle(t.x, t.z, 0.8); mapShapes.trees.push(t); }

  // кусты и цветы
  const bushes = [], flowers = [[], [], []];
  for (let i = 0; i < 400; i++) {
    const x = rr(BOUNDS.x0 + 1, BOUNDS.x1 - 1), z = rr(BOUNDS.z0 + 1, BOUNDS.z1 - 1);
    if (onRoadOrZone(x, z, 1) || !isFree(x, z)) continue;
    if (i % 5 === 0) bushes.push({ x, z, rot: rnd() * 6 });
    else flowers[i % 3].push({ x, z, rot: rnd() * 6 });
  }
  scene.add(instances('nature/plant_bush', bushes, { height: 0.7, shadow: false }));
  // камни и пни по краям
  const rocks = [], stumps = [];
  for (let i = 0; i < 40; i++) {
    const x = rr(BOUNDS.x0 + 1, BOUNDS.x1 - 1), z = rr(BOUNDS.z0 + 1, BOUNDS.z1 - 1);
    if (onRoadOrZone(x, z, 1.5) || !isFree(x, z) || Math.hypot(x, z - 21) < 6) continue;
    (i % 2 ? rocks : stumps).push({ x, z, rot: rnd() * 6, s: rr(0.7, 1.2) });
  }
  scene.add(instances('nature/rock_largeA', rocks, { height: 0.7 }), instances('nature/stump_round', stumps, { height: 0.45 }));
  for (const r of [...rocks, ...stumps]) blockCircle(r.x, r.z, 0.5);
  ['nature/flower_redA', 'nature/flower_yellowA', 'nature/flower_purpleA'].forEach((k, i) =>
    scene.add(makeWindy(instances(k, flowers[i], { height: 0.45, shadow: false }), 0.5)));
}

function clouds() {
  const cs = [];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const s = mesh(new THREE.IcosahedronGeometry(rr(1.6, 2.6), 1), '#ffffff', k * 2 - 3, rr(0, 0.8), rr(-1, 1), { flatShading: true, emissive: '#8a9bb0' });
      s.receiveShadow = false;
      c.add(s);
    }
    c.position.set(rr(-70, 70), rr(24, 30), rr(-50, 50));
    scene.add(c); cs.push(c);
  }
  animated.push(dt => cs.forEach(c => { c.position.x += dt * 1.2; if (c.position.x > 80) c.position.x = -80; }));
}

function butterflies() {
  const wingG = new THREE.CircleGeometry(0.13, 8);
  ['#ffd43b', '#ffffff', '#ff8787', '#74c0fc', '#ffd43b', '#da77f2'].forEach((c, i) => {
    const g = new THREE.Group();
    const a = mesh(wingG, c, -0.11, 0, 0, { side: THREE.DoubleSide }), b = mesh(wingG, c, 0.11, 0, 0, { side: THREE.DoubleSide });
    a.castShadow = b.castShadow = false;
    g.add(a, b);
    const cx = rr(-30, 30), cz = rr(-25, 30), ph = rnd() * 6;
    scene.add(g);
    animated.push((dt, t) => {
      const p = t * 0.5 + ph;
      g.position.set(cx + Math.sin(p) * 4, 1.1 + Math.sin(p * 3) * 0.4, cz + Math.sin(p * 1.7) * 3);
      const w = Math.sin(t * 22 + ph) * 0.9; a.rotation.y = w; b.rotation.y = -w; g.rotation.y = p;
    });
  });
}

function props() {
  // рынок: прилавки
  const stalls = [{ x: -4, z: 33.5, k: 'town/stall-red' }, { x: 0, z: 34.5, k: 'town/stall' }, { x: 4, z: 33.5, k: 'town/stall-green' }];
  for (const s of stalls) {
    const o = fitHeight(cloneModel(s.k), 2.6); o.position.set(s.x, 0, s.z); o.rotation.y = Math.PI; scene.add(o);
    blockRect(s.x, s.z, 3, 2);
    mapShapes.buildings.push({ x: s.x, z: s.z, w: 2.6, d: 1.6, color: '#e03131' });
  }
  flat(scene, 16, 6, '#e9c98a', 0, 33, 0.018);
  scene.add(instances('surv/barrel', [{ x: -7, z: 32 }, { x: -7.6, z: 33 }, { x: 7, z: 32.5 }], { height: 0.9 }));
  blockRect(-7.3, 32.5, 1.6, 2); blockRect(7, 32.5, 1, 1);


  // верстак и ящики у гаража
  const wb = fitHeight(cloneModel('surv/workbench'), 1); wb.position.set(12, 0, 17.4); scene.add(wb); blockRect(12, 17.4, 1.6, 1);
  scene.add(instances('surv/box', [{ x: 3.2, z: 12 }, { x: 3.2, z: 13 }, { x: 3.4, z: 12.5, y: 0.7 }], { height: 0.7 }));
  blockRect(3.3, 12.5, 1.2, 2.2);
  // поленница у дома
  scene.add(instances('nature/log_stack', [{ x: -12.2, z: 16, rot: 1.57 }], { height: 0.9 })); blockRect(-12.2, 16, 1.2, 2);
}

function farmFence() {
  const pts = [], step = 1.3;
  for (let x = BOUNDS.x0; x < BOUNDS.x1; x += step) pts.push({ x: x + step / 2, z: BOUNDS.z0, rot: Math.PI / 2 }, { x: x + step / 2, z: BOUNDS.z1, rot: Math.PI / 2 });
  for (let z = BOUNDS.z0; z < BOUNDS.z1; z += step) pts.push({ x: BOUNDS.x0, z: z + step / 2 }, { x: BOUNDS.x1, z: z + step / 2 });
  scene.add(instances('town/fence', pts, { height: 1.0 }));
  // вдоль забора не ходим, иначе Лев залезает в него
  const { x0, x1, z0, z1 } = BOUNDS, W = x1 - x0, D = z1 - z0;
  blockRect((x0 + x1) / 2, z0, W, 2); blockRect((x0 + x1) / 2, z1, W, 2);
  blockRect(x0, (z0 + z1) / 2, 2, D); blockRect(x1, (z0 + z1) / 2, 2, D);
}

// Невидимый цилиндр для касания: крупнее объекта, чтобы легко попасть пальцем.
const pickGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
const pickMat = new THREE.MeshBasicMaterial({ visible: false });
export function addPick(x, z, r, h, data, parent) {
  const m = new THREE.Mesh(pickGeo, pickMat);
  m.scale.set(r, h, r);
  m.position.set(x, h / 2, z);
  m.userData = data;
  (parent || scene).add(m);
  pickables.push(m);
  return m;
}

// ---------- сборка ----------
export function buildWorld(sc, q) {
  scene = sc;
  setupLights(q);

  const ground = flat(scene, 260, 260, '#86c34f', 0, 0, 0);
  ground.receiveShadow = true;
  for (const r of ROADS) flat(scene, r.w, r.d, '#e2c48a', r.x, r.z, 0.03);

  for (const b of BUILDINGS) building(b);
  for (const zn of ZONES) {
    const st = { zone: zn, inner: [], locked: zn.lock > 0 };
    st.content = zoneContent(zn, st.inner);
    if (st.locked) st.lockGroup = lockFence(zn);
    zoneState[zn.id] = st;
    applyZoneNav(st);
  }
  props();
  farmFence();
  trees();
  grass(q.grass);
  clouds();
  butterflies();
  setDayPhase(0);
}

export function updateWorld(dt, t) {
  wind.value = t;
  for (const f of [...animated]) f(dt, t);
}
export const onFrame = f => animated.push(f);

export { zoneState };
