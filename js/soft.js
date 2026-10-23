// «Мягкие кубики» — общий стиль игры (люди, животные, деревья, техника, постройки):
// низкополигональные детали с плоскими гранями, цвет '#rrggbb' или '@узор' (узоры рисуются на canvas, см. PATTERNS).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Узоры: имя -> [размер плитки в единицах модели, рисование на квадратном canvas] или функция, возвращающая материал.
// Наполняют модули, которым узор нужен (looks.js, models.js).
export const PATTERNS = {};

// Нарисовать фигуру и её копии по краям плитки, чтобы узор повторялся без швов
export function wrap(n, x, y, r, draw) {
  for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) if (x + dx > -r && x + dx < n + r && y + dy > -r && y + dy < n + r) draw(x + dx, y + dy);
}
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Мягкий куб: вершины куба подтянуты к шару (k=0 — куб, 1 — шар). Грани остаются видны.
// seg — делений на грань: 3 (108 треугольников) у людей и животных, 2 (48) у деревьев и урожая, 1 (12) у мелочей.
const geos = {}, mats = {};
export function soft(k, seg = 3) {
  const key = k + '/' + seg;
  if (geos[key]) return geos[key];
  const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg), p = g.attributes.position, v = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    v.lerp(s.copy(v).setLength(0.5), k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return (geos[key] = g);
}
// Для узоров: развёртка в размер детали, чтобы плитка узора была одинаковой на всех деталях
function softUV(k, w, h, d, tile) {
  const key = [k, w, h, d, tile].join();
  if (geos[key]) return geos[key];
  const g = soft(k).clone(), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let i = 0; i < uv.count; i++) { const [a, b] = dims[i / 16 | 0]; uv.setXY(i, uv.getX(i) * a / tile, uv.getY(i) * b / tile); }
  return (geos[key] = g);
}
// Мягкий куб нужного размера как готовая геометрия (для построек и украшений)
export function softBox(w, h, d, k = 0.2) {
  const key = ['b', w, h, d, k].join();
  return geos[key] || (geos[key] = soft(k).clone().scale(w, h, d));
}
export function mat(c) {
  if (typeof c !== 'string') return c;
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
function add(parent, m, [x, y, z], { rx = 0, ry = 0, rz = 0, name = '' }) {
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = m.receiveShadow = true;
  m.name = name;
  parent.add(m);
  return m;
}
// Деталь — мягкий куб размером [w, h, d] с центром в [x, y, z]; k — скругление, seg — детальность, name — для поиска (покраска трактора)
export function part(parent, color, [w, h, d], pos, o = {}) {
  const M = mat(color), tile = M.userData.tile;
  const m = new THREE.Mesh(tile ? softUV(o.k ?? 0.45, w, h, d, tile) : soft(o.k ?? 0.45, o.seg), M);
  m.scale.set(w, h, d);
  return add(parent, m, pos, o);
}
// Цилиндр (конус, если r2 = 0): [радиус сверху, радиус снизу, высота], seg — число граней
export function cyl(parent, color, [r1, r2, h], pos, o = {}) {
  const seg = o.seg || 8, key = ['c', r1, r2, h, seg].join();
  const g = geos[key] || (geos[key] = new THREE.CylinderGeometry(r1, r2, h, seg));
  return add(parent, new THREE.Mesh(g, mat(color)), pos, o);
}
// Плоская картинка поверх детали (надпись, вывеска)
const decals = {};
export function decal(parent, key, [w, h], [x, y, z], draw, o = {}) {
  const map = decals[key] || (decals[key] = canvasTex(256, Math.round(256 * h / w), draw));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map, transparent: true }));
  return add(parent, m, [x, y, z], o);
}

// Склеить детали одного родителя с одинаковым материалом и именем в один меш — меньше вызовов отрисовки.
// Дочерние группы (суставы, кости) не трогаем, внутри них склеиваем отдельно.
export function bake(root) {
  root.traverse(p => {
    const groups = {};
    for (const m of p.children) if (m.isMesh && !m.children.length && !m.material.transparent) (groups[m.material.uuid + m.name] ||= []).push(m);
    for (const list of Object.values(groups)) {
      if (list.length < 2) continue;
      const geo = mergeGeometries(list.map(m => { m.updateMatrix(); return m.geometry.clone().applyMatrix4(m.matrix); }));
      if (!geo) continue;
      const one = new THREE.Mesh(geo, list[0].material);
      one.name = list[0].name; one.castShadow = one.receiveShadow = true;
      list.forEach(m => m.removeFromParent());
      p.add(one);
    }
  });
  return root;
}
