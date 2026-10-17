// Проверка ответов всех задач перебором/вычислением.
// Запуск: node tools/verify-tasks.mjs
import { TASKS } from '../data/tasks.js';

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const first = (from, ok) => { for (let n = from; n < 100000; n++) if (ok(n)) return n; };
// следующий член, если разности растут на 1 (и проверка, что это так на всём ряду)
const next = s => { const d = s.slice(1).map((v, i) => v - s[i]); if (!d.every((x, i) => !i || x === d[i - 1] + 1)) return NaN; return s.at(-1) + d.at(-1) + 1; };
const cuts = (pieces, t) => (pieces - 1) * t;
const posts = (len, step) => len / step + 1;
const exceptColors = (a, b) => first(1, n => (n - a) + (n - b) === n);
const climb = (h, up, down) => { let p = 0; for (let d = 1; ; d++) { p += up; if (p >= h) return d; p -= down; } };
const doubling = (full, part) => { let s = 1; for (let d = full; d > 0; d--) { if (Math.abs(s - part) < 1e-9) return d; s /= 2; } };
const legs = (heads, total, a, b) => range(0, heads).find(x => x * b + (heads - x) * a === total); // x — с b ногами
const ageTimes = (p, c, k) => first(0, x => p + x === k * (c + x));
const rectArea = (per, diff) => { for (let w = 1; w < per; w++) { const l = w + diff; if (2 * (w + l) === per) return w * l; } };
const backward = (left, ...fractionsLeft) => first(1, x => { let r = x; for (const f of fractionsLeft) r *= f; return Math.abs(r - left) < 1e-9; });
// Взвешивания: наименьшее k, при котором 3^k >= n (известно, что лёгкий есть)
const weigh = n => first(0, k => 3 ** k >= n);
const pairs = n => { let c = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) c++; return c; };
const digits = (a, b) => range(a, b).join('').length;
const countDigit = (d, a, b) => range(a, b).join('').split('').filter(c => c === String(d)).length;
const together = (a, b) => a * b / (a + b); // точно, без дробей
const chase = (v1, head, v2) => Math.round(v1 * head / (v2 - v1) * 60); // минуты
const between = (lo, hi, ...divs) => range(lo + 1, hi - 1).filter(n => divs.every(d => n % d === 0));
const flock = (total, parts) => first(1, x => parts.reduce((s, p) => s + x * p, 0) + 1 === total);
const rate = (n0, d0, e0, n, d) => e0 / n0 / d0 * n * d;
const remainders = (divs, r, div0, min = 1) => first(min, n => divs.every(d => n % d === r) && n % div0 === 0);

// [ответ основной задачи, ответ близнеца 1, ответ близнеца 2]
const CHECK = {
  1: [cuts(6, 2), cuts(4, 3), cuts(10, 2)],
  2: [posts(12, 1), posts(20, 2), posts(15, 3)],
  3: [exceptColors(7, 5), exceptColors(4, 6), exceptColors(8, 5)],
  4: [next([1, 2, 4, 7, 11, 16]), next([3, 4, 6, 9, 13, 18]), next([2, 5, 9, 14, 20])],
  5: [doubling(30, 1 / 2), doubling(20, 1 / 2), doubling(12, 1 / 4)],
  6: [climb(10, 3, 2), climb(12, 4, 3), climb(15, 5, 2)],
  7: [legs(10, 28, 2, 4), legs(12, 34, 2, 4), 15 - legs(15, 46, 2, 4)],
  8: [ageTimes(40, 10, 3), ageTimes(36, 6, 4), ageTimes(45, 15, 2)],
  9: [rectArea(40, 4), rectArea(30, 5), rectArea(48, 6)],
  10: [backward(10, 1 / 2, 2 / 3), backward(12, 2 / 3, 1 / 2), backward(15, 1 / 2, 3 / 4)],
  11: [weigh(9), weigh(27), weigh(4)],
  12: [pairs(6), pairs(5), pairs(8)],
  13: [digits(1, 100), digits(1, 50), digits(1, 120)],
  14: [countDigit(5, 1, 100), countDigit(7, 1, 80), countDigit(1, 1, 50)],
  15: [together(6, 12), together(3, 6), together(10, 15)],
  16: [chase(10, 1, 30), chase(4, 0.5, 12), chase(8, 2, 24)],
  17: [between(25, 50, 6, 8), between(30, 40, 4, 6), between(40, 80, 5, 6)].map(v => v.length === 1 ? v[0] : 'неоднозначно: ' + v),
  18: [flock(100, [1, 1, 1 / 2, 1 / 4]), flock(51, [1, 1, 1 / 2]), flock(50, [1, 1 / 2, 1 / 4])],
  19: [rate(1.5, 1.5, 1.5, 6, 6), rate(3, 3, 3, 9, 9), rate(2, 2, 2, 4, 6)],
  20: [remainders([2, 3, 4, 5, 6], 1, 7), remainders([2, 3, 4], 1, 5), remainders([3, 4, 5], 2, 7, 3)],
};

let bad = 0;
console.log('№  | Основная (в файле / проверка) | Близнец 1        | Близнец 2');
for (const t of TASKS) {
  const got = [t.a, ...t.twins.map(w => w.a)], exp = CHECK[t.id];
  const cells = got.map((g, i) => { const ok = g === exp[i]; if (!ok) bad++; return `${g} / ${exp[i]} ${ok ? '✓' : '✗'}`; });
  if (t.twins.length < 2) { bad++; cells.push('мало близнецов ✗'); }
  for (const x of [t, ...t.twins]) if (!Number.isInteger(x.a) || x.a < 0 || x.a > 9999) { bad++; cells.push(`ответ ${x.a} не 0–9999 ✗`); }
  console.log(String(t.id).padStart(2), '|', cells.join(' | '));
}
console.log(bad ? `\nОШИБОК: ${bad}` : '\nВсе ответы верны.');
process.exit(bad ? 1 : 0);
