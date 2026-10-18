// Внешность семьи по фото: перекрашиваем части модели Kenney и добавляем мелкие детали.
// Модель раскрашена по палитре colormap.png: клетка cXrY — столбец X (из 16) и ряд Y (из 4).
// Нужные треугольники переводим в свои клетки свободной (чёрной) части палитры.
import * as THREE from 'three';

const SKIN = '#f2c6a6';
const ARMS = 'arm-left,arm-right', LEGS = 'leg-left,leg-right';
const front = p => new THREE.Triangle(...p).getNormal(new THREE.Vector3()).z > 0.5;

// Узоры ткани (рисуются в клетку 128×128). box — область модели [x0, x1, y0, y1], на которую растягиваем узор.
const PATTERNS = {
  stripes: { box: [-0.22, 0.22, 0.17, 0.38], draw(x) {
    x.fillStyle = '#30508f'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#8ea4d4'; for (let i = 3; i < 128; i += 9) x.fillRect(i, 0, 1.5, 128);
  } },
  snake: { box: [-0.22, 0.22, 0.17, 0.38], draw(x) {
    x.fillStyle = '#8b8174'; x.fillRect(0, 0, 128, 128);
    let s = 7; const rnd = () => (s = s * 16807 % 2147483647) / 2147483647;
    for (let i = 0; i < 70; i++) {
      x.fillStyle = ['#2c2825', '#e9e0cf', '#5b544c'][i % 3];
      x.fillRect(rnd() * 128, rnd() * 128, 4 + rnd() * 10, 3 + rnd() * 6);
    }
  } },
  hoodie: { box: [-0.22, 0.22, 0.17, 0.38], draw(x) { stars(x); } },
  hoodieFront: { box: [-0.2, 0.2, 0.17, 0.37], draw(x) {
    stars(x);
    x.font = '900 26px Nunito, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#4c6ef5'; x.strokeStyle = '#fff'; x.lineWidth = 3;
    x.strokeText('СУПЕР', 64, 70); x.fillText('СУПЕР', 64, 70);
  } },
};
function stars(x) {
  x.fillStyle = '#5a5d64'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = '#c9ccd2'; x.lineWidth = 2;
  for (const [cx, cy, r] of [[22, 20, 16], [96, 30, 20], [30, 100, 18], [104, 104, 14]]) {
    x.beginPath();
    for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, q = k % 2 ? r * 0.45 : r; x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
    x.closePath(); x.stroke();
  }
}

// Правило: [кости, клетка, цвет | 'hide' | '@узор', условие по вершинам треугольника]. Срабатывает первое подходящее.
export const LOOKS = {
  lev: { rules: [
    ['head', 'c11r3', 'hide', p => Math.max(p[0].y, p[1].y, p[2].y) > 0.69], // хохолок торчит из кепки
    ['head', 'c11r3', '#a08462'], ['head,' + ARMS, 'c15r3', SKIN],
    ['torso', 'c1r3', '@hoodieFront', front], ['torso,' + ARMS, 'c1r3', '@hoodie'],
    ['torso,' + ARMS, 'c9r3', '#5a5d64'], ['torso', 'c9r2', '@hoodieFront'],
    [LEGS, 'c1r3', '#e9ecef', p => p[0].y + p[1].y + p[2].y < 0.15], [LEGS, 'c1r3', '#3d4a63'],
  ] },
  grandpa: { rules: [
    ['head,' + ARMS, 'c15r3', '#efbd9f'], ['head', 'c11r3', 'hide'], ['head', 'c13r3', 'hide'], ['head', 'c7r3', '#b9ad98'],
    ['torso,' + ARMS, 'c9r2', '@stripes'], ['torso', 'c11r3', '#5a3a22'], ['torso', 'c14r3', '#efbd9f'],
    [LEGS, 'c11r2', '#26282f'], [LEGS, 'c11r3', '#3a2c22'], [LEGS, 'c15r3', '#222222'],
  ], extra: sideHair },
  grandma: { rules: [
    ['head', 'c3r3', 'hide', p => Math.min(p[0].z, p[1].z, p[2].z) < -0.2 || Math.max(p[0].y, p[1].y, p[2].y) > 0.71], // пучок — у бабушки стрижка
    ['head', 'c3r3', '#3b2a24'], ['head', 'c9r2', '#3b2a24'], ['head,' + ARMS, 'c11r3', SKIN],
    ['torso,' + ARMS, 'c11r2', '@snake'], ['torso', 'c9r2', '#4a4440'], ['torso', 'c9r3', 'hide'], ['torso', 'c10r3', SKIN],
    [LEGS, 'c3r3', SKIN], [LEGS, 'c9r3', SKIN], [LEGS, 'c11r3', '#3a3030'],
  ], extra: h => earrings(h, '#d4a72c', 0.022) },
  mom: { rules: [
    ['head', 'c13r3', '#4a2c20'], ['head', 'c11r3', '#4a2c20'], ['head', 'c15r2', SKIN],
    ['head,' + ARMS, 'c15r3', '#f6d3bd'], ['torso', 'c14r3', '#f6d3bd'],
    ['torso,' + ARMS, 'c1r3', '#f3efe8'], ['torso,' + ARMS, 'c5r2', '#f3efe8'], ['torso', 'c3r3', '#d9d2c6'], ['torso', 'c7r3', '#f3efe8'],
    [LEGS, 'c15r2', '#6b4a3a'],
  ], extra: h => earrings(h, '#e9ecef', 0.026, true) },
};

// Детали на голове (координаты кости головы, как у шапок в actor.js)
const mat = c => new THREE.MeshLambertMaterial({ color: c });
function sideHair(head) {
  const m = mat('#cfc6b4'), box = (w, h, d, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); head.add(b); };
  box(0.02, 0.12, 0.3, -0.18, 0.23, -0.02); box(0.02, 0.12, 0.3, 0.18, 0.23, -0.02); box(0.36, 0.13, 0.02, 0, 0.23, -0.175);
}
function earrings(head, color, r, star) {
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(star ? new THREE.OctahedronGeometry(r) : new THREE.SphereGeometry(r, 8, 6), mat(color));
    e.position.set(s * 0.215, 0.035, -0.025);
    if (star) e.scale.z = 0.4;
    head.add(e);
  }
}

// Общая палитра с нашими клетками: цвета — 32×32 в верхней чёрной полосе, узоры — 112×112 ниже.
let material, canvas, ctx, colorN = 0;
const cells = {};
function cell(key) {
  if (cells[key]) return cells[key];
  if (key.startsWith('@')) {
    const n = Object.keys(cells).filter(k => k.startsWith('@')).length, px = 64 + n * 112;
    ctx.save(); ctx.translate(px, 128); ctx.scale(112 / 128, 112 / 128); ctx.beginPath(); ctx.rect(0, 0, 128, 128); ctx.clip();
    PATTERNS[key.slice(1)].draw(ctx); ctx.restore();
    return (cells[key] = { u0: (px + 2) / 512, v0: 130 / 512, s: 108 / 512, box: PATTERNS[key.slice(1)].box });
  }
  const n = colorN++, px = (n % 16) * 32, py = Math.floor(n / 16) * 32;
  ctx.fillStyle = key; ctx.fillRect(px, py, 32, 32);
  return (cells[key] = { u: (px + 16) / 512, v: (py + 16) / 512 });
}
function sharedMaterial(src) {
  if (!material) {
    canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    ctx = canvas.getContext('2d');
    ctx.drawImage(src.map.image, 0, 0, 512, 512);
    const map = new THREE.CanvasTexture(canvas); // не clone(): у клона общая картинка с оригиналом
    for (const k of ['flipY', 'colorSpace', 'magFilter', 'minFilter', 'wrapS', 'wrapT']) map[k] = src.map[k];
    material = src.clone(); material.map = map;
  }
  return material;
}

// Применить внешность к телу персонажа (после cloneModel).
export function applyLook(body, id) {
  const look = LOOKS[id];
  const meshes = [];
  body.traverse(o => o.isMesh && meshes.push(o));
  for (const mesh of meshes) {
    mesh.material = sharedMaterial(mesh.material);
    const g = mesh.geometry = mesh.geometry.clone();
    const pos = g.attributes.position, uv = g.attributes.uv, idx = g.index.array;
    const uv0 = uv.array.slice(); // исходные: соседние треугольники делят вершины
    const bones = mesh.isSkinnedMesh ? mesh.skeleton.bones.map(b => b.name) : null, si = g.attributes.skinIndex;
    const P = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    for (let t = 0; t < idx.length; t += 3) {
      const v = [idx[t], idx[t + 1], idx[t + 2]];
      const u = (uv0[v[0] * 2] + uv0[v[1] * 2] + uv0[v[2] * 2]) / 3, w = (uv0[v[0] * 2 + 1] + uv0[v[1] * 2 + 1] + uv0[v[2] * 2 + 1]) / 3;
      const sw = `c${Math.floor(u * 16)}r${Math.floor(w * 4)}`, bone = bones ? bones[si.getX(v[0])] : 'head';
      v.forEach((k, i) => P[i].fromBufferAttribute(pos, k));
      const r = look.rules.find(([b, s, , when]) => s === sw && b.split(',').includes(bone) && (!when || when(P)));
      if (!r) continue;
      if (r[2] === 'hide') { idx[t + 1] = idx[t + 2] = idx[t]; continue; }
      const c = cell(r[2]);
      v.forEach((k, i) => {
        if (!c.box) return uv.setXY(k, c.u, c.v);
        const [x0, x1, y0, y1] = c.box, q = P[i];
        uv.setXY(k, c.u0 + THREE.MathUtils.clamp((q.x + q.z * 0.5 - x0) / (x1 - x0), 0, 1) * c.s,
          c.v0 + THREE.MathUtils.clamp((y1 - q.y) / (y1 - y0), 0, 1) * c.s);
      });
    }
    g.index.needsUpdate = uv.needsUpdate = true;
  }
  material.map.needsUpdate = true;
  const head = body.getObjectByName('head');
  if (look.extra && head) look.extra(head);
}
