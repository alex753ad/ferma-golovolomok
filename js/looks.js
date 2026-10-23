// Внешность людей в стиле «превью семьи»: своё низкополигональное тело поверх скелета Kenney.
// Меши Kenney убираем, кости раздвигаем под новые пропорции — анимации (ходьба, кивок, трактор) остаются.
// Размеры — в единицах кости Kenney (голова ≈ 0.32), рост потом приводит fitHeight.
// Цвет детали — '#rrggbb' или '@узор' (узоры рисуются на canvas, см. PATTERNS).
import * as THREE from 'three';

const SKIN = '#f1c7a5', EYE = '#2b2420';

// Пропорции: leg — длина ноги, torso — высота торса, w — ширина плеч
const BUILD = {
  man:   { leg: 0.4,  torso: 0.3,  w: 0.32 },
  woman: { leg: 0.4,  torso: 0.3,  w: 0.28 },
  kid:   { leg: 0.28, torso: 0.23, w: 0.26 },
};

// hair: [причёска, цвет]; sleeve: 'long' | 'mid' | 'short'; legs: 'shorts' | 'skirt' (иначе брюки до щиколотки);
// shoes: [верх, подошва, высокие?]; collar — уголки воротника; vneck — вырез; buttons — пуговицы по центру;
// pocket — нагрудный карман; cuffs — манжеты; hem — насколько кофта длиннее; earrings: [металл, камень?]; extra — особые детали
export const LOOKS = {
  lev: { build: 'kid', hair: ['fringe', '#8c7558'], eyes: '#4a2c1a', brows: '#6e5843', shirt: '@stars', sleeve: 'long', hem: 0.05,
    cuffs: '@stars', pants: '#2f4a78', shoes: ['#dee2e6', '#f8f9fa'], extra: hoodie },
  grandpa: { build: 'man', hair: ['bald', '#bdb6aa'], brows: '#8c8478', shirt: '@pinstripe', sleeve: 'long', collar: '@pinstripe', vneck: true,
    buttons: '#17213d', pocket: '@pinstripe', cuffs: '@pinstripe', belt: '#5c3a22', buckle: '#c9ccd1', pants: '#1c1e27', shoes: ['#1f1f1f', '#3a3a3a'] },
  mom: { build: 'woman', hair: ['straight', '#2a1a17'], brows: '#2a1a17', lips: '#d22f3c', shirt: '@leather', sleeve: 'long',
    pants: '#2c3345', shoes: ['#1a1a1a', '#0b0b0b', true], earrings: ['#d4a72c', '#111111'], extra: jacket },
  grandma: { build: 'woman', hair: ['bob', '#2b1f1c'], brows: '#2b1f1c', shirt: '@snake', sleeve: 'mid', vneck: true,
    pants: '#6b4536', shoes: ['#3b2a22', '#1e1612'], earrings: ['#c9b48a'] },
  petrovich: { build: 'man', hair: ['short', '#4a3b30'], mustache: '#4a3b30', shirt: '#e8590c', sleeve: 'short', collar: '#c94d0a',
    pants: '#3b5b8c', bib: true, shoes: ['#6b4a2b', '#2b1d12', true], extra: overalls },
  valya: { build: 'woman', hair: ['bob', '#c0622c'], shirt: '#ae3ec9', sleeve: 'short', buttons: '#ffffff', pants: '#7b2f8f', legs: 'skirt',
    shoes: ['#c2255c', '#5c1130'], extra: seller },
  miller: { build: 'man', hair: ['short', '#bdbdb5'], beard: '#bdbdb5', shirt: '#f1ede4', sleeve: 'mid', collar: '#e2dccf', cuffs: '#e2dccf',
    pants: '#8b7a62', apron: '#d9c9a3', shoes: ['#5a4030', '#2b1d12', true], extra: millerApron },
  beekeeper: { build: 'man', hair: ['short', '#6b4a2a'], shirt: '#f8f9fa', sleeve: 'long', collar: '#e9ecef', pants: '#e9ecef', gloves: '#e8c56b',
    cuffs: '#dee2e6', shoes: ['#f1f3f5', '#868e96', true], extra: beeSuit },
  baron: { build: 'man', hair: ['short', '#2b2b2b'], mustache: '#2b2b2b', shirt: '#5f3dc4', sleeve: 'long', pants: '#212529', front: '#f8f9fa',
    cuffs: '#f8f9fa', shoes: ['#111111', '#3a3a3a'], extra: tailcoat },
};

// ---------- узоры ----------
// [размер плитки в единицах модели, рисование на квадратном canvas]; функция — готовый материал
const PATTERNS = {
  stars: [0.3, (x, n) => { // серое худи Льва в белых контурах звёзд
    x.fillStyle = '#5b5e66'; x.fillRect(0, 0, n, n);
    x.strokeStyle = '#e9ecef'; x.lineWidth = n / 50; x.lineJoin = 'round';
    for (const [cx, cy, r, a] of [[0.25, 0.3, 0.26, 0.2], [0.75, 0.62, 0.32, -0.3], [0.32, 0.86, 0.18, 0.7]]) wrap(n, cx * n, cy * n, r * n, (px, py) => {
      x.beginPath();
      for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * n * 0.42 : r * n, t = a + i * Math.PI / 5 - Math.PI / 2; x.lineTo(px + Math.cos(t) * rr, py + Math.sin(t) * rr); }
      x.closePath(); x.stroke();
    });
  }],
  pinstripe: [0.1, (x, n) => { // синяя рубашка деда в тонкую белую полоску
    x.fillStyle = '#2d4f9a'; x.fillRect(0, 0, n, n);
    x.fillStyle = 'rgba(225,232,250,.8)';
    for (let i = 0; i < 6; i++) x.fillRect(i * n / 6, 0, n / 90, n);
  }],
  snake: [0.16, (x, n) => { // «змеиный» принт блузки бабушки: чешуйки полосами — бежевые, серые и «тигровые»
    x.fillStyle = '#231e1f'; x.fillRect(0, 0, n, n);
    const c = n / 8, fills = [['#efe5d3', '#d8cbb4'], ['#9a96a0', '#7d7984'], ['#a8927c', '#c7b59c'], ['#efe5d3', '#8e8a94']];
    let seed = 7;
    const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    for (let j = 0; j < 16; j++) for (let i = 0; i < 8; i++) {
      const px = i * c + (j % 2) * c / 2, py = j * c / 2, band = Math.floor((px + py) / (n / 2)) % 4;
      x.fillStyle = fills[band][rnd() < 0.5 ? 0 : 1];
      wrap(n, px, py, c, (qx, qy) => { x.beginPath(); x.moveTo(qx, qy - c * 0.44); x.lineTo(qx + c * 0.44, qy); x.lineTo(qx, qy + c * 0.44); x.lineTo(qx - c * 0.44, qy); x.fill(); });
    }
    x.strokeStyle = '#1a1617'; x.lineWidth = n / 40; x.lineCap = 'round';
    for (let k = 0; k < 7; k++) { // тёмные мазки
      const sx = rnd() * n, sy = rnd() * n;
      wrap(n, sx, sy, n / 4, (qx, qy) => { x.beginPath(); x.moveTo(qx, qy); x.quadraticCurveTo(qx + n / 10, qy - n / 14, qx + n / 5, qy + n / 20); x.stroke(); });
    }
  }],
  scarf: [0.12, (x, n) => { // оранжевый платок мамы с тёмно-зелёной и чёрной полосой
    x.fillStyle = '#e8622a'; x.fillRect(0, 0, n, n);
    x.fillStyle = '#1b1b1b'; x.fillRect(0, n * 0.55, n, n * 0.12);
    x.fillStyle = '#2b6b3a'; x.fillRect(0, n * 0.67, n, n * 0.15);
    x.fillStyle = '#f3e3c3'; x.fillRect(0, n * 0.82, n, n * 0.04);
  }],
  leather: () => new THREE.MeshPhongMaterial({ color: '#202024', specular: '#6c6c74', shininess: 45, flatShading: true }),
};
// Нарисовать фигуру и её копии по краям плитки, чтобы узор повторялся без швов
function wrap(n, x, y, r, draw) {
  for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) if (x + dx > -r && x + dx < n + r && y + dy > -r && y + dy < n + r) draw(x + dx, y + dy);
}
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

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
// Для узоров: развёртка в размер детали, чтобы плитка узора была одинаковой на рубашке, рукаве и кармане
function softUV(k, w, h, d, tile) {
  const key = [k, w, h, d, tile].join();
  if (geos[key]) return geos[key];
  const g = soft(k).clone(), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let i = 0; i < uv.count; i++) { const [a, b] = dims[i / 16 | 0]; uv.setXY(i, uv.getX(i) * a / tile, uv.getY(i) * b / tile); }
  return (geos[key] = g);
}
function mat(c) {
  if (mats[c]) return mats[c];
  if (c[0] !== '@') return (mats[c] = new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
  const P = PATTERNS[c.slice(1)];
  if (typeof P === 'function') return (mats[c] = P());
  const t = canvasTex(256, 256, P[1]);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const m = new THREE.MeshLambertMaterial({ map: t, flatShading: true });
  m.userData.tile = P[0];
  return (mats[c] = m);
}
function part(parent, color, [w, h, d], [x, y, z], { k = 0.45, rx = 0, ry = 0, rz = 0 } = {}) {
  const M = mat(color), tile = M.userData.tile;
  const m = new THREE.Mesh(tile ? softUV(k, w, h, d, tile) : soft(k), M);
  m.scale.set(w, h, d); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  parent.add(m);
  return m;
}
// Плоская картинка поверх одежды (надпись на худи)
const decals = {};
function decal(parent, key, [w, h], [x, y, z], draw) {
  const map = decals[key] || (decals[key] = canvasTex(256, Math.round(256 * h / w), draw));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map, transparent: true }));
  m.position.set(x, y, z);
  parent.add(m);
}

// Применить внешность к телу персонажа (после cloneModel, до fitHeight).
export function applyLook(body, id) {
  const L = LOOKS[id], B = BUILD[L.build];
  const kenney = [];
  body.traverse(o => o.isSkinnedMesh && kenney.push(o));
  kenney.forEach(o => o.removeFromParent());
  const [legL, legR, torso, armL, armR, head] = ['leg-left', 'leg-right', 'torso', 'arm-left', 'arm-right', 'head'].map(n => body.getObjectByName(n));

  // ноги: кость в тазу, нога свисает вниз; обувь — верх и подошва
  for (const [bone, s] of [[legL, 1], [legR, -1]]) {
    bone.position.set(s * 0.068, B.leg, 0);
    const n = B.leg - 0.04;
    if (L.legs === 'shorts') {
      part(bone, L.pants, [0.13, n * 0.42, 0.13], [0, -n * 0.2, 0]);
      part(bone, SKIN, [0.095, n * 0.62, 0.1], [0, -n * 0.68, 0]);
    } else if (L.legs === 'skirt') part(bone, SKIN, [0.095, n, 0.1], [0, -n / 2, 0]);
    else part(bone, L.pants, [0.12, n, 0.125], [0, -n / 2, 0]);
    if (!L.shoes) { part(bone, SKIN, [0.085, 0.05, 0.11], [0, -B.leg + 0.025, 0.01]); continue; }
    const [up, sole, high] = L.shoes, sh = high ? 0.11 : 0.055;
    part(bone, up, [0.11, sh, 0.14], [0, -B.leg + 0.012 + sh / 2, 0.015], { k: 0.5 });
    part(bone, sole, [0.115, 0.024, 0.15], [0, -B.leg + 0.012, 0.017], { k: 0.25 });
  }

  // торс: рубашка, низ — брюки (или юбка), шея; воротник, пуговицы, карман, ремень и т.п.
  const T = B.torso, W = B.w, front = 0.082, hem = L.hem || 0;
  torso.position.set(0, B.leg, 0);
  part(torso, L.shirt, [W, T - 0.03 + hem, 0.16], [0, T / 2 + 0.02 - hem / 2, 0], { k: 0.35 });
  if (L.legs === 'skirt') part(torso, L.pants, [W + 0.05, 0.2, 0.2], [0, -0.04, 0], { k: 0.35 });
  else part(torso, L.pants, [W - 0.03, 0.1, 0.145], [0, 0.03, 0], { k: 0.35 });
  part(torso, SKIN, [0.09, 0.05, 0.09], [0, T, 0]);
  if (L.vneck) part(torso, SKIN, [0.075, 0.075, 0.01], [0, T - 0.012, front - 0.003], { k: 0.1, rz: Math.PI / 4 });
  for (const s of [1, -1]) {
    if (L.collar) part(torso, L.collar, [0.06, 0.035, 0.014], [s * 0.042, T - 0.012, front + 0.004], { k: 0.3, rz: s * 0.55 });
    if (L.bib) part(torso, L.pants, [0.035, T * 0.5, 0.168], [s * 0.07, T * 0.72, 0], { k: 0.15 });
  }
  if (L.buttons) for (let i = 0; i < 4; i++) part(torso, L.buttons, [0.02, 0.02, 0.012], [0, T * (L.vneck ? 0.7 : 0.82) - i * T * 0.19, front + 0.003], { k: 1 });
  if (L.pocket) {
    part(torso, L.pocket, [0.07, 0.075, 0.012], [0.075, T * 0.62, front + 0.002], { k: 0.2 });
    part(torso, L.pocket, [0.074, 0.02, 0.014], [0.075, T * 0.62 + 0.035, front + 0.004], { k: 0.2 });
  }
  if (L.belt) {
    part(torso, L.belt, [W - 0.02, 0.035, 0.165], [0, 0.08, 0], { k: 0.2 });
    part(torso, L.buckle, [0.045, 0.032, 0.01], [0, 0.08, front + 0.002], { k: 0.1 });
    part(torso, L.belt, [0.028, 0.016, 0.01], [0, 0.08, front + 0.005], { k: 0.1 });
  }
  if (L.bib) part(torso, L.pants, [W * 0.6, T * 0.4, 0.02], [0, T * 0.32, front], { k: 0.2 });
  if (L.apron) part(torso, L.apron, [W * 0.75, T * 0.8 + 0.12, 0.02], [0, T * 0.32 - 0.04, front], { k: 0.2 });
  if (L.front) part(torso, L.front, [0.06, T * 0.75, 0.02], [0, T * 0.58, front], { k: 0.2 });

  // руки: у Kenney в покое руки в стороны, а в анимациях опущены на 45° — доворачиваем, чтобы висели почти вдоль тела
  const arms = [];
  for (const [bone, s] of [[armL, 1], [armR, -1]]) {
    bone.position.set(s * (W / 2 + 0.04), T - 0.045, 0);
    const g = new THREE.Group();
    g.rotation.z = s * 0.86;
    bone.add(g);
    arms.push(g);
    const a = T + 0.02, sl = L.sleeve === 'long' ? a - 0.04 : L.sleeve === 'mid' ? a * 0.62 : a * 0.4;
    part(g, L.shirt, [0.095, sl, 0.1], [0, -sl / 2 + 0.03, 0]);
    if (L.cuffs) part(g, L.cuffs, [0.104, 0.035, 0.109], [0, -sl + 0.045, 0], { k: 0.3 });
    if (sl < a - 0.04) part(g, SKIN, [0.075, a - sl, 0.08], [0, -(sl + a) / 2 + 0.03, 0]);
    part(g, L.gloves || SKIN, [0.1, 0.1, 0.095], [0, -a, 0], { k: 0.6 });
  }

  // голова: лицо как на превью — вертикальные глаза-капли и брови.
  // Кость головы увеличиваем целиком — шапки из actor.js растут вместе с ней.
  const hw = 0.36, hh = 0.32, hd = 0.31, fz = hd / 2;
  head.position.set(0, T - 0.01, 0);
  head.scale.setScalar(1.15);
  part(head, SKIN, [hw, hh, hd], [0, hh / 2 + 0.01, 0], { k: 0.75 });
  for (const s of [1, -1]) {
    part(head, L.eyes || EYE, [0.03, 0.062, 0.02], [s * 0.072, hh * 0.5, fz - 0.007], { k: 1 });
    part(head, L.brows || EYE, [0.08, 0.02, 0.02], [s * 0.075, hh * 0.68, fz - 0.014], { k: 0.8, rz: s * 0.08 });
    if (L.mustache) { // усы-«руль» с подкрученными кончиками
      part(head, L.mustache, [0.1, 0.035, 0.035], [s * 0.048, hh * 0.3, fz - 0.005], { k: 1, rz: s * 0.35 });
      part(head, L.mustache, [0.035, 0.035, 0.03], [s * 0.1, hh * 0.36, fz - 0.015], { k: 1 });
    }
    if (L.earrings) { // серьги: металл и камень, подвеска ниже
      const [m, st] = L.earrings;
      part(head, m, [0.03, 0.03, 0.03], [s * 0.172, hh * 0.3, 0.035], { k: 1 });
      if (st) part(head, st, [0.016, 0.016, 0.01], [s * 0.18, hh * 0.3, 0.05], { k: 1 });
      part(head, m, [0.018, 0.04, 0.018], [s * 0.172, hh * 0.3 - 0.04, 0.035], { k: 1 });
    }
  }
  if (L.lips) part(head, L.lips, [0.065, 0.022, 0.02], [0, hh * 0.25, fz - 0.012], { k: 1 });
  if (L.beard) part(head, L.beard, [hw * 0.85, 0.13, 0.08], [0, 0.07, fz - 0.03], { k: 0.6 });
  hair(head, ...L.hair, hw, hh, hd);
  L.extra?.({ torso, head, arms, legs: [legL, legR], T, W, front, hh, hd });
}

function hair(head, style, c, hw, hh, hd) {
  const top = (v = 0.03) => part(head, c, [hw + v, 0.12 + v, hd + v], [0, hh - 0.01, -0.005], { k: 0.6 });
  const back = (h, y, v = 0.04) => part(head, c, [hw + v, h, 0.08], [0, y, -hd / 2 + 0.01], { k: 0.5 });
  const strand = (x, y, z, h, rz = 0, rx = 0, w = 0.05) => part(head, c, [w, h, 0.05], [x, y, z], { k: 0.6, rz, rx });
  if (style === 'short') { // короткая стрижка с вихрами
    top(0.01); back(hh * 0.55, hh * 0.62, 0);
    for (const [x, rz] of [[-0.1, 0.35], [-0.035, 0.1], [0.035, -0.1], [0.1, -0.35]]) strand(x, hh + 0.03, hd / 2 - 0.04, 0.1, rz, 0.6, 0.09);
  } else if (style === 'fringe') { // короткая, чёлка падает на лоб (Лев)
    top(0.015); back(hh * 0.55, hh * 0.62, 0);
    for (const [x, rz] of [[-0.12, 0.3], [-0.05, 0.12], [0.02, -0.05], [0.09, -0.2], [0.14, -0.4]]) strand(x, hh * 0.88, hd / 2 - 0.018, 0.09, rz, -0.1, 0.075);
  } else if (style === 'bald') { // лысеющий: коротко стриженная седина по бокам и сзади
    part(head, c, [hw - 0.03, hh * 0.45, 0.04], [0, hh * 0.52, -hd / 2 + 0.012], { k: 0.6 });
    part(head, c, [hw - 0.1, 0.03, hd * 0.45], [0, hh + 0.005, -0.06], { k: 0.6 });
    for (const s of [1, -1]) part(head, c, [0.02, hh * 0.32, hd * 0.55], [s * (hw / 2 - 0.012), hh * 0.58, -0.045], { k: 0.6 });
  } else if (style === 'ring') { // седина по бокам и сзади, пышная под шляпой
    part(head, c, [hw + 0.05, 0.08, hd + 0.05], [0, hh * 0.84, 0], { k: 0.6 });
    back(hh * 0.5, hh * 0.6, 0.01);
    for (const s of [1, -1]) part(head, c, [0.05, hh * 0.35, hd * 0.75], [s * (hw / 2 + 0.01), hh * 0.62, -0.02], { k: 0.6 });
    for (let i = -3; i <= 3; i++) strand(i * 0.05, hh * 0.9, hd / 2 - 0.01, 0.07, i * 0.12, 0.3, 0.045);
  } else { // длинные: пряди по бокам лица, сзади ниже плеч (tail — хвост, bob — каре с чёлкой, straight — прямые с пробором)
    top(0.05);
    const len = style === 'bob' ? hh * 0.75 : style === 'straight' ? hh + 0.34 : hh + 0.14;
    back(len, hh - len / 2);
    for (const s of [1, -1]) {
      strand(s * (hw / 2 + 0.01), hh - len / 2 + 0.03, 0.0, len * 0.95, s * 0.05, 0, 0.07);
      strand(s * (hw / 2 + 0.02), hh - len * 0.8, 0.03, 0.14, s * -0.15);
      if (style === 'straight') { // пряди спереди падают на плечи, пробор посередине
        strand(s * 0.15, hh * 0.25, hd / 2 - 0.04, hh + 0.12, s * -0.06, 0, 0.07);
        strand(s * 0.075, hh * 0.9, hd / 2 + 0.005, 0.13, s * -1.15, 0.15, 0.055);
      } else strand(s * 0.13, hh * 0.68, hd / 2 - 0.005, hh * 0.6, s * -0.15);
    }
    if (style !== 'straight') for (const [x, rz] of [[-0.08, -0.9], [0.0, -1.0], [0.07, -0.8]]) strand(x, hh * 0.88, hd / 2 + 0.005, 0.12, rz, 0.15, 0.055);
    if (style === 'tail') part(head, c, [0.09, 0.32, 0.08], [0, hh * 0.3, -hd / 2 - 0.05], { k: 0.6, rx: 0.2 });
  }
}

// ---------- особые детали ----------
// Худи Льва: высокий ворот, капюшон за спиной, резинка внизу и надпись «СУПЕР»
function hoodie({ torso, T, W, front }) {
  part(torso, '@stars', [0.16, 0.07, 0.15], [0, T + 0.005, -0.005], { k: 0.7 });
  part(torso, '@stars', [W * 0.72, 0.13, 0.09], [0, T - 0.03, -0.09], { k: 0.8 });
  part(torso, '@stars', [W + 0.008, 0.035, 0.168], [0, -0.01, 0], { k: 0.3 });
  decal(torso, 'super', [W * 0.8, W * 0.25], [0, T * 0.42, front + 0.002], (x, w, h) => {
    x.font = `800 ${h * 0.9}px Nunito, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round'; x.lineWidth = h / 9; x.strokeStyle = '#f1f3f5'; x.strokeText('СУПЕР', w / 2, h * 0.55);
    x.fillStyle = '#3b5bdb'; x.fillText('СУПЕР', w / 2, h * 0.55);
  });
}

// Кожаная куртка мамы нараспашку: чёрный верх, молния, отвороты, платок на шее
function jacket({ torso, T, W, front }) {
  part(torso, '#141416', [0.085, T * 0.8, 0.01], [0, T * 0.52, front + 0.001], { k: 0.1 });
  for (const s of [1, -1]) {
    part(torso, '#b9bcc2', [0.007, T * 0.8, 0.008], [s * 0.046, T * 0.52, front + 0.003], { k: 0.1 });
    part(torso, '@leather', [0.06, 0.11, 0.016], [s * 0.065, T * 0.8, front + 0.006], { k: 0.2, rz: s * -0.3 });
    part(torso, '#9a9da3', [0.05, 0.006, 0.008], [s * (W / 2 - 0.06), T * 0.3, front + 0.002], { k: 0.1, rz: s * 0.6 });
  }
  part(torso, '@scarf', [0.17, 0.08, 0.16], [0, T + 0.005, 0.01], { k: 0.8 });
  part(torso, '@scarf', [0.07, 0.06, 0.05], [0.045, T - 0.03, front + 0.015], { k: 0.9 });
  part(torso, '@scarf', [0.05, 0.09, 0.016], [0.08, T - 0.08, front + 0.02], { k: 0.4, rz: 0.45 });
  part(torso, '@scarf', [0.05, 0.08, 0.016], [0.025, T - 0.085, front + 0.024], { k: 0.4, rz: -0.2 });
}

// Комбинезон Петровича: пряжки лямок, карман с ключом, карманы на штанинах, тряпка у пояса
function overalls({ torso, legs, T, W, front }) {
  for (const s of [1, -1]) part(torso, '#ced4da', [0.03, 0.025, 0.012], [s * 0.07, T * 0.5, front + 0.012], { k: 0.3 });
  part(torso, '#2f4b75', [0.085, 0.06, 0.01], [0, T * 0.28, front + 0.012], { k: 0.2 });
  part(torso, '#868e96', [0.016, 0.08, 0.008], [0.022, T * 0.38, front + 0.016], { k: 0.3 });
  part(torso, '#868e96', [0.034, 0.022, 0.008], [0.022, T * 0.38 + 0.045, front + 0.016], { k: 0.3 });
  part(torso, '#c92a2a', [0.045, 0.1, 0.02], [-W / 2 + 0.01, -0.02, 0.05], { k: 0.4, rz: 0.15 });
  legs.forEach((leg, i) => part(leg, '#2f4b75', [0.012, 0.075, 0.065], [(i ? -1 : 1) * 0.062, -0.1, 0], { k: 0.2 }));
}

// Тётя Валя: белый круглый воротничок, фартук с карманом и завязками
function seller({ torso, T, W, front }) {
  for (const s of [1, -1]) part(torso, '#ffffff', [0.065, 0.04, 0.012], [s * 0.034, T - 0.01, front + 0.004], { k: 0.9, rz: s * 0.3 });
  part(torso, '#fff0f6', [W * 0.75, 0.22, 0.012], [0, -0.04, 0.107], { k: 0.2 });
  part(torso, '#f783ac', [0.09, 0.06, 0.01], [0, -0.06, 0.114], { k: 0.2 });
  part(torso, '#f783ac', [W + 0.01, 0.025, 0.17], [0, 0.075, 0], { k: 0.2 });
}

// Мельник: лямка фартука на шее, карман, мучные пятна
function millerApron({ torso, T, front }) {
  for (const s of [1, -1]) part(torso, '#d9c9a3', [0.022, 0.08, 0.01], [s * 0.05, T * 0.84, front + 0.003], { k: 0.2 });
  part(torso, '#c4b28a', [0.11, 0.065, 0.01], [0, T * 0.08, front + 0.012], { k: 0.2 });
  for (const [x, y] of [[-0.06, 0.18], [0.05, 0.02], [-0.02, -0.08]]) part(torso, '#f4efe3', [0.04, 0.03, 0.006], [x, y, front + 0.012], { k: 1 });
}

// Пасечник: молния, нагрудные карманы с клапанами
function beeSuit({ torso, T, front }) {
  part(torso, '#adb5bd', [0.01, T * 0.85, 0.008], [0, T * 0.45, front + 0.002], { k: 0.1 });
  for (const s of [1, -1]) {
    part(torso, '#e9ecef', [0.07, 0.06, 0.01], [s * 0.08, T * 0.6, front + 0.002], { k: 0.2 });
    part(torso, '#ced4da', [0.074, 0.022, 0.012], [s * 0.08, T * 0.6 + 0.03, front + 0.004], { k: 0.2 });
  }
}

// Фрак барона: отвороты, золотые пуговицы, бабочка, платочек, цепочка часов, фалды, монокль
function tailcoat({ torso, head, T, W, front, hh, hd }) {
  for (const s of [1, -1]) {
    part(torso, '#4527a0', [0.045, T * 0.5, 0.012], [s * 0.05, T * 0.68, front + 0.004], { k: 0.2, rz: s * 0.25 });
    for (let i = 0; i < 3; i++) part(torso, '#fcc419', [0.018, 0.018, 0.01], [s * 0.065, T * 0.38 - i * 0.05, front + 0.003], { k: 1 });
    part(torso, '#111111', [0.045, 0.035, 0.012], [s * 0.022, T - 0.025, front + 0.012], { k: 0.4, rz: s * 0.2 });
  }
  part(torso, '#111111', [0.018, 0.02, 0.014], [0, T - 0.025, front + 0.016], { k: 0.6 });
  part(torso, '#e03131', [0.04, 0.03, 0.01], [0.1, T * 0.66, front + 0.004], { k: 0.4, rz: 0.2 });
  for (let i = 0; i < 6; i++) part(torso, '#fcc419', [0.012, 0.012, 0.008], [-0.055 + i * 0.022, 0.1 - Math.sin(i / 5 * Math.PI) * 0.025, front + 0.004], { k: 1 });
  part(torso, '#5f3dc4', [W - 0.04, 0.2, 0.03], [0, -0.06, -0.07], { k: 0.3 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.007, 6, 16), mat('#fcc419'));
  ring.position.set(-0.072, hh * 0.5, hd / 2 + 0.008);
  head.add(ring);
}
