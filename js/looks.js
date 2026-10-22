// Внешность людей в стиле «превью семьи»: своё низкополигональное тело поверх скелета Kenney.
// Меши Kenney убираем, кости раздвигаем под новые пропорции — анимации (ходьба, кивок, трактор) остаются.
// Размеры — в единицах кости Kenney (голова ≈ 0.32), рост потом приводит fitHeight.
import * as THREE from 'three';

const SKIN = '#f1c7a5', EYE = '#2b2420';

// Пропорции: leg — длина ноги, torso — высота торса, w — ширина плеч
const BUILD = {
  man:   { leg: 0.4,  torso: 0.3,  w: 0.32 },
  woman: { leg: 0.4,  torso: 0.3,  w: 0.28 },
  kid:   { leg: 0.28, torso: 0.23, w: 0.26 },
};

// hair: [причёска, цвет]; sleeve: 'long' | 'short'; legs: 'shorts' | 'skirt' (иначе брюки до щиколотки)
export const LOOKS = {
  lev:       { build: 'kid',   hair: ['short', '#9b7b58'], shirt: '#5c6066', sleeve: 'short', pants: '#2f4a78' },
  grandpa:   { build: 'man',   hair: ['ring', '#dcd8c8'], brows: '#3a3632', mustache: '#e4e2d6', shirt: '#2f55a4', sleeve: 'long', pants: '#23262d', straps: '#5a3a22', belt: '#4a3020' },
  mom:       { build: 'woman', hair: ['long', '#3b2420'], shirt: '#8a8478', sleeve: 'short', pants: '#3b2e28', legs: 'shorts' },
  grandma:   { build: 'woman', hair: ['tail', '#4a2a22'], shirt: '#eef1e4', sleeve: 'short', pants: '#6b4536' },
  petrovich: { build: 'man',   hair: ['short', '#4a3b30'], mustache: '#4a3b30', shirt: '#e8590c', sleeve: 'short', pants: '#3b5b8c', bib: true },
  valya:     { build: 'woman', hair: ['bob', '#c0622c'], shirt: '#ae3ec9', sleeve: 'short', pants: '#7b2f8f', legs: 'skirt' },
  miller:    { build: 'man',   hair: ['short', '#bdbdb5'], beard: '#bdbdb5', shirt: '#f1ede4', sleeve: 'long', pants: '#8b7a62', apron: '#d9c9a3' },
  beekeeper: { build: 'man',   hair: ['short', '#6b4a2a'], shirt: '#f8f9fa', sleeve: 'long', pants: '#e9ecef' },
  baron:     { build: 'man',   hair: ['short', '#2b2b2b'], mustache: '#2b2b2b', shirt: '#5f3dc4', sleeve: 'long', pants: '#212529', front: '#f8f9fa' },
};

// Мягкий куб: вершины куба подтянуты к шару (k=0 — куб, 1 — шар). Грани остаются видны, как на превью.
const geos = {}, mats = {};
function soft(k) {
  if (geos[k]) return geos[k];
  const g = new THREE.BoxGeometry(1, 1, 1, 3, 3, 3), p = g.attributes.position, v = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.lerp(s.copy(v).setLength(0.5), k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return (geos[k] = g);
}
const mat = c => mats[c] || (mats[c] = new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
function part(parent, color, [w, h, d], [x, y, z], { k = 0.45, rx = 0, ry = 0, rz = 0 } = {}) {
  const m = new THREE.Mesh(soft(k), mat(color));
  m.scale.set(w, h, d); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  parent.add(m);
  return m;
}

// Применить внешность к телу персонажа (после cloneModel, до fitHeight).
export function applyLook(body, id) {
  const L = LOOKS[id], B = BUILD[L.build];
  const kenney = [];
  body.traverse(o => o.isSkinnedMesh && kenney.push(o));
  kenney.forEach(o => o.removeFromParent());
  const [legL, legR, torso, armL, armR, head] = ['leg-left', 'leg-right', 'torso', 'arm-left', 'arm-right', 'head'].map(n => body.getObjectByName(n));

  // ноги: кость в тазу, нога свисает вниз; на превью — босые ступни
  for (const [bone, s] of [[legL, 1], [legR, -1]]) {
    bone.position.set(s * 0.068, B.leg, 0);
    const n = B.leg - 0.04;
    if (L.legs === 'shorts') {
      part(bone, L.pants, [0.13, n * 0.42, 0.13], [0, -n * 0.2, 0]);
      part(bone, SKIN, [0.095, n * 0.62, 0.1], [0, -n * 0.68, 0]);
    } else if (L.legs === 'skirt') part(bone, SKIN, [0.095, n, 0.1], [0, -n / 2, 0]);
    else part(bone, L.pants, [0.12, n, 0.125], [0, -n / 2, 0]);
    part(bone, SKIN, [0.085, 0.05, 0.11], [0, -B.leg + 0.025, 0.01]);
  }

  // торс: рубашка, низ — брюки (или юбка), шея; подтяжки, ремень, фартук и т.п.
  const T = B.torso, W = B.w, front = 0.082;
  torso.position.set(0, B.leg, 0);
  part(torso, L.shirt, [W, T - 0.03, 0.16], [0, T / 2 + 0.02, 0], { k: 0.35 });
  if (L.legs === 'skirt') part(torso, L.pants, [W + 0.05, 0.2, 0.2], [0, -0.04, 0], { k: 0.35 });
  else part(torso, L.pants, [W - 0.03, 0.1, 0.145], [0, 0.03, 0], { k: 0.35 });
  part(torso, SKIN, [0.09, 0.05, 0.09], [0, T, 0]);
  for (const s of [1, -1]) {
    if (L.straps) part(torso, L.straps, [0.04, T - 0.06, 0.168], [s * 0.065, T / 2 + 0.02, 0], { k: 0.15 });
    if (L.bib) part(torso, L.pants, [0.035, T * 0.5, 0.168], [s * 0.07, T * 0.72, 0], { k: 0.15 });
  }
  if (L.belt) part(torso, L.belt, [W - 0.02, 0.035, 0.165], [0, 0.08, 0], { k: 0.2 });
  if (L.bib) part(torso, L.pants, [W * 0.6, T * 0.4, 0.02], [0, T * 0.32, front], { k: 0.2 });
  if (L.apron) part(torso, L.apron, [W * 0.75, T * 0.8 + 0.12, 0.02], [0, T * 0.32 - 0.04, front], { k: 0.2 });
  if (L.front) part(torso, L.front, [0.06, T * 0.75, 0.02], [0, T * 0.58, front], { k: 0.2 });

  // руки: у Kenney в покое руки в стороны, а в анимациях опущены на 45° — доворачиваем, чтобы висели почти вдоль тела
  for (const [bone, s] of [[armL, 1], [armR, -1]]) {
    bone.position.set(s * (W / 2 + 0.04), T - 0.045, 0);
    const g = new THREE.Group();
    g.rotation.z = s * 0.86;
    bone.add(g);
    const a = T + 0.02, sl = L.sleeve === 'long' ? a - 0.04 : a * 0.4;
    part(g, L.shirt, [0.095, sl, 0.1], [0, -sl / 2 + 0.03, 0]);
    if (sl < a - 0.04) part(g, SKIN, [0.075, a - sl, 0.08], [0, -(sl + a) / 2 + 0.03, 0]);
    part(g, SKIN, [0.1, 0.1, 0.095], [0, -a, 0], { k: 0.6 });
  }

  // голова: лицо как на превью — вертикальные глаза-капли и брови, без рта.
  // Кость головы увеличиваем целиком — шапки из actor.js растут вместе с ней.
  const hw = 0.36, hh = 0.32, hd = 0.31, fz = hd / 2;
  head.position.set(0, T - 0.01, 0);
  head.scale.setScalar(1.15);
  part(head, SKIN, [hw, hh, hd], [0, hh / 2 + 0.01, 0], { k: 0.75 });
  for (const s of [1, -1]) {
    part(head, EYE, [0.03, 0.062, 0.02], [s * 0.072, hh * 0.5, fz - 0.007], { k: 1 });
    part(head, L.brows || EYE, [0.08, 0.02, 0.02], [s * 0.075, hh * 0.68, fz - 0.014], { k: 0.8, rz: s * 0.08 });
    if (L.mustache) { // усы-«руль» с подкрученными кончиками
      part(head, L.mustache, [0.1, 0.035, 0.035], [s * 0.048, hh * 0.3, fz - 0.005], { k: 1, rz: s * 0.35 });
      part(head, L.mustache, [0.035, 0.035, 0.03], [s * 0.1, hh * 0.36, fz - 0.015], { k: 1 });
    }
  }
  if (L.beard) part(head, L.beard, [hw * 0.85, 0.13, 0.08], [0, 0.07, fz - 0.03], { k: 0.6 });
  hair(head, ...L.hair, hw, hh, hd);
}

function hair(head, style, c, hw, hh, hd) {
  const top = (v = 0.03) => part(head, c, [hw + v, 0.12 + v, hd + v], [0, hh - 0.01, -0.005], { k: 0.6 });
  const back = (h, y, v = 0.04) => part(head, c, [hw + v, h, 0.08], [0, y, -hd / 2 + 0.01], { k: 0.5 });
  const strand = (x, y, z, h, rz = 0, rx = 0, w = 0.05) => part(head, c, [w, h, 0.05], [x, y, z], { k: 0.6, rz, rx });
  if (style === 'short') { // короткая стрижка с вихрами
    top(0.01); back(hh * 0.55, hh * 0.62, 0);
    for (const [x, rz] of [[-0.1, 0.35], [-0.035, 0.1], [0.035, -0.1], [0.1, -0.35]]) strand(x, hh + 0.03, hd / 2 - 0.04, 0.1, rz, 0.6, 0.09);
  } else if (style === 'ring') { // седина по бокам и сзади, пышная под шляпой
    part(head, c, [hw + 0.05, 0.08, hd + 0.05], [0, hh * 0.84, 0], { k: 0.6 });
    back(hh * 0.5, hh * 0.6, 0.01);
    for (const s of [1, -1]) part(head, c, [0.05, hh * 0.35, hd * 0.75], [s * (hw / 2 + 0.01), hh * 0.62, -0.02], { k: 0.6 });
    for (let i = -3; i <= 3; i++) strand(i * 0.05, hh * 0.9, hd / 2 - 0.01, 0.07, i * 0.12, 0.3, 0.045);
  } else { // длинные: чёлка прядями, пряди по бокам лица, сзади ниже плеч (tail — хвост, bob — каре)
    top(0.05);
    const len = style === 'bob' ? hh * 0.75 : hh + 0.14;
    back(len, hh - len / 2);
    for (const s of [1, -1]) {
      strand(s * (hw / 2 + 0.01), hh - len / 2 + 0.03, 0.0, len * 0.95, s * 0.05, 0, 0.07);
      strand(s * (hw / 2 + 0.02), hh - len * 0.8, 0.03, 0.14, s * -0.15);
      strand(s * 0.13, hh * 0.68, hd / 2 - 0.005, hh * 0.6, s * -0.15);
    }
    for (const [x, rz] of [[-0.08, -0.9], [0.0, -1.0], [0.07, -0.8]]) strand(x, hh * 0.88, hd / 2 + 0.005, 0.12, rz, 0.15, 0.055);
    if (style === 'tail') part(head, c, [0.09, 0.32, 0.08], [0, hh * 0.3, -hd / 2 - 0.05], { k: 0.6, rx: 0.2 });
  }
}
