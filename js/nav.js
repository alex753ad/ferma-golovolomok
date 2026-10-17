// Сетка проходимости и поиск пути A* (клетка 0.5 м).
import { BOUNDS } from '../data/map.js';

const CELL = 0.5;
const W = Math.round((BOUNDS.x1 - BOUNDS.x0) / CELL);
const H = Math.round((BOUNDS.z1 - BOUNDS.z0) / CELL);
const grid = new Uint8Array(W * H); // 0 — свободно, 1 — препятствие

const toI = x => Math.floor((x - BOUNDS.x0) / CELL);
const toJ = z => Math.floor((z - BOUNDS.z0) / CELL);
const cx = i => BOUNDS.x0 + (i + 0.5) * CELL;
const cz = j => BOUNDS.z0 + (j + 0.5) * CELL;
const inside = (i, j) => i >= 0 && j >= 0 && i < W && j < H;
const free = (i, j) => inside(i, j) && grid[j * W + i] === 0;

// Пометить прямоугольник (центр x,z, размеры w,d) как препятствие или снять отметку.
export function blockRect(x, z, w, d, v = 1) {
  const i0 = toI(x - w / 2), i1 = toI(x + w / 2 - 0.001);
  const j0 = toJ(z - d / 2), j1 = toJ(z + d / 2 - 0.001);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (inside(i, j)) grid[j * W + i] = v;
}

export function blockCircle(x, z, r) {
  for (let j = toJ(z - r); j <= toJ(z + r); j++)
    for (let i = toI(x - r); i <= toI(x + r); i++)
      if (inside(i, j) && Math.hypot(cx(i) - x, cz(j) - z) <= r) grid[j * W + i] = 1;
}

export const isFree = (x, z) => free(toI(x), toJ(z));

// Ближайшая свободная клетка (если цель внутри препятствия).
function nearestFree(i, j) {
  if (free(i, j)) return [i, j];
  for (let r = 1; r < 40; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++)
        if ((Math.abs(di) === r || Math.abs(dj) === r) && free(i + di, j + dj)) return [i + di, j + dj];
  return null;
}

// Прямая видимость между клетками (для сглаживания пути).
function lineFree(i0, j0, i1, j1) {
  const n = Math.ceil(Math.max(Math.abs(i1 - i0), Math.abs(j1 - j0)) * 2);
  for (let k = 1; k <= n; k++) {
    const t = k / n, i = i0 + (i1 - i0) * t, j = j0 + (j1 - j0) * t;
    // проверяем «толщину» Льва: соседние клетки тоже
    if (!free(Math.round(i), Math.round(j)) || !free(Math.floor(i), Math.floor(j)) || !free(Math.ceil(i), Math.ceil(j))) return false;
  }
  return true;
}

// Найти путь. Возвращает массив точек [{x,z}] или null.
export function findPath(x0, z0, x1, z1) {
  const s = nearestFree(toI(x0), toJ(z0)), g = nearestFree(toI(x1), toJ(z1));
  if (!s || !g) return null;
  const start = s[1] * W + s[0], goal = g[1] * W + g[0];
  gScore.fill(Infinity); from.fill(-1); closed.fill(0);
  heapN = 0;
  heapPush(0, start);
  gScore[start] = 0;
  const h = k => { const di = Math.abs(k % W - g[0]), dj = Math.abs((k / W | 0) - g[1]); return Math.max(di, dj) + 0.414 * Math.min(di, dj); };

  while (heapN) {
    const k = heapPop();
    if (k === goal) break;
    if (closed[k]) continue;
    closed[k] = 1;
    const i = k % W, j = k / W | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = i + di, nj = j + dj;
      if (!free(ni, nj)) continue;
      if (di && dj && (!free(i + di, j) || !free(i, j + dj))) continue; // не срезать углы
      const nk = nj * W + ni, cost = gScore[k] + (di && dj ? 1.414 : 1);
      if (cost < gScore[nk]) { gScore[nk] = cost; from[nk] = k; heapPush(cost + h(nk), nk); }
    }
  }
  if (from[goal] === -1 && goal !== start) return null;

  // Восстановить путь и выпрямить его (оставляем только «повороты»).
  const cells = [];
  for (let k = goal; k !== -1; k = from[k]) cells.push(k);
  cells.reverse();
  const pts = [cells[0]];
  for (let n = 2; n < cells.length; n++) {
    const a = pts[pts.length - 1], b = cells[n];
    if (!lineFree(a % W, a / W | 0, b % W, b / W | 0)) pts.push(cells[n - 1]);
  }
  pts.push(goal);
  const path = pts.slice(1).map(k => ({ x: cx(k % W), z: cz(k / W | 0) }));
  // Если цель свободна — идём точно в неё, а не в центр клетки.
  if (free(toI(x1), toJ(z1)) && path.length) path[path.length - 1] = { x: x1, z: z1 };
  return path;
}

// Рабочие массивы поиска (создаются один раз) и двоичная куча на типизированных массивах.
const gScore = new Float32Array(W * H), from = new Int32Array(W * H), closed = new Uint8Array(W * H);
const heapK = new Int32Array(W * H * 4), heapP = new Float32Array(W * H * 4);
let heapN = 0;
function swap(a, b) { const k = heapK[a], p = heapP[a]; heapK[a] = heapK[b]; heapP[a] = heapP[b]; heapK[b] = k; heapP[b] = p; }
function heapPush(p, k) {
  if (heapN >= heapK.length) return; // защита от переполнения (на практике не случается)
  let i = heapN++;
  heapK[i] = k; heapP[i] = p;
  while (i > 0) { const q = (i - 1) >> 1; if (heapP[q] <= heapP[i]) break; swap(q, i); i = q; }
}
function heapPop() {
  const top = heapK[0];
  heapN--;
  if (heapN) {
    heapK[0] = heapK[heapN]; heapP[0] = heapP[heapN];
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let m = i;
      if (l < heapN && heapP[l] < heapP[m]) m = l;
      if (r < heapN && heapP[r] < heapP[m]) m = r;
      if (m === i) break;
      swap(m, i); i = m;
    }
  }
  return top;
}

// Для миникарты: размер и доступ к сетке
export const NAV = { W, H, CELL, grid };
