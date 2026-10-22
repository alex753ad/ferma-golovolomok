// Проверка ответов всех задач перебором/вычислением.
// Запуск: node tools/verify-tasks.mjs
import { TASKS, DAILY, CHESTS } from '../data/tasks.js';
import { TEMPLATES, genTask } from '../data/gen.js';

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

// Задачи дня и сундуки: независимое вычисление
const zeros = n => { let z = 0; for (let k = 5; k <= n; k *= 5) z += Math.floor(n / k); return z; };
// Минутная стрелка обгоняет часовую на 360° каждые 12/11 часа. Считаем моменты совпадения в [0; 24 ч).
const meets = () => { let c = 0; for (let k = 0; k * 12 / 11 < 24; k++) c++; return c; };
const EXTRA = {
  d1: first(1, x => x + (x - 12) === 50), d2: range(10, 99).filter(n => Math.floor(n / 10) + n % 10 === 5).length,
  d3: first(1, p => p + (p - 4) === 20), d4: first(1, w => w === 1000 + w / 2), d5: legs(8, 26, 2, 4),
  d6: first(1, n => n % 3 === 2 && n % 5 === 4), d7: first(1, n => (n - 2) * (n - 1) * n === 120) ,
  d8: meets(), d9: 17 + 12 - (25 - 3), d10: range(100, 999).filter(n => new Set(String(n)).size === 1).length,
  d11: first(0, x => x * 3 + 7 === 40), d12: 40 / 2 * 4, d13: range(1, 20).reduce((a, b) => a + b),
  d14: [1, 2, 3].reduce((s, k) => s + (4 - k) ** 2, 0), d15: 2 + 1,
  d16: first(1, n => n % 2 && (n - 4) + (n - 2) + n === 75), d17: range(10, 99).filter(n => n % 3 === 0 && n % 4 === 0).length,
  d18: countDigit(7, 1, 100), d19: digits(1, 150), d20: rate(3, 3, 3, 12, 12), d21: first(1, x => x + x / 2 + 5 === 50),
  d22: (([b, s]) => b + s)(range(1, 20).flatMap(b => range(1, 20).map(s => [b, s])).find(([b, s]) => b - 1 === s && b === 2 * (s - 1))),
  d23: first(2, n => [2, 3, 4, 5, 6].every(d => n % d === 1)), d24: 9 * (36 / 4 / 3 * 4),
  d25: range(100, 999).filter(n => [...String(n)].reduce((a, c) => a + +c, 0) === 3).length, d26: (300 + 600) / 1,
  d27: range(0, 30).find(r => 30 - r <= 11 && r <= 19), d28: range(1, 39).filter(n => n % 2).reduce((a, b) => a + b), d29: zeros(50),
  d30: Math.abs(30 * 3 + 0.5 * 30 - 6 * 30), d31: ageTimes(40, 10, 2), d32: range(100, 999).filter(n => n % 77 === 0).at(-1), d33: pairs(8),
  d34: range(0, 9).find(d => (4702 + d * 10) % 9 === 0), d35: 60 / (30 / 10 + 30 / 15), d36: together(6, 3), d37: pairs(6),
  d38: range(1000, 9999).filter(n => [...String(n)].every(c => +c % 2)).length, d39: (b => 2 * b + 5)(first(1, b => b + 2 * b + 2 * b + 5 === 30)),
  d40: first(1, c => c * 100 / 3 === 100), d41: range(100, 999).filter(n => new Set(String(n)).size === 3 && [...String(n)].reduce((a, c) => a + +c, 0) === 20).at(-1),
  d42: first(1, x => 10 * x - x === 252), d43: (50 + 70 + 40) / 2 - 40,
  d44: range(0, 23).flatMap(h => range(0, 59).map(m => String(h).padStart(2, '0') + String(m).padStart(2, '0'))).filter(t => new Set(t).size === 1).length,
  d45: Math.min(...range(0, 6).filter(a => (34 - 5 * a) % 3 === 0).map(a => a + (34 - 5 * a) / 3)),
  d46: countDigit(1, 1, 30), d47: range(100, 999).filter(n => String(n) === [...String(n)].reverse().join('')).length,
  d48: first(1, n => [2, 3, 4, 5, 6, 7].every(d => n % d === 0)), d49: first(1, x => x / 4 - 3 === 9), d50: 3 * 4,
  d51: pairs(6) - 6, d52: first(1, w => w === 2 + w / 2), d53: 7 + 3 + 1, d54: 3 + 1, d55: (s => 4 * s)(first(1, s => s + 4 * s === 100)),
  d56: first(1, s => (s + 28 + 4) === 3 * (s + 4)), d57: first(1, x => x + (x + 5) + (x + 10) + (x + 15) === 70), d58: climb(15, 5, 3),
  d59: first(1, c => c + (c + 100) === 110), d60: (13 * 60 + 20) - (9 * 60 + 45), d61: first(0, x => 7 * x + 15 === 99),
  d62: range(10, 99).filter(n => n % 11 === 0).reduce((a, b) => a + b),
  d63: range(10, 99).filter(n => Math.floor(n / 10) * (n % 10) === 12 && Math.floor(n / 10) + n % 10 === 7).at(-1),
  d64: range(100, 999).filter(n => /^[123]+$/.test(String(n)) && new Set(String(n)).size === 3).length,
  d65: range(100, 999).filter(n => /^[123]+$/.test(String(n))).length, d66: range(10, 99).filter(n => Math.floor(n / 10) > n % 10).length,
  d67: first(1, t => t * (1 / 120 + 1 / 180) >= 1 - 1e-9), d68: (f => f(10))(function f(n) { return n <= 1 ? 1 : f(n - 1) + f(n - 2); }),
  d69: [1, 2, 3, 4].reduce((s, k) => s + (5 - k) ** 2, 0), d70: pairs(3) * pairs(4), d71: between(200, 250, 5, 9)[0],
  d72: range(101, 199).filter(n => n % 2).length, d73: (x => x + 3)(first(1, x => x + (x + 3) + (x + 2) === 32)),
  d74: first(1, x => x - 15 === x / 4), d75: 18 + 15 - (30 - 5), d76: (60 / 3) + 5, d77: (d => 4 * d)(first(1, d => d + 4 * d === 40)),
  d78: (31 + 28) % 7 + 1, d79: range(100, 999).filter(n => [...String(n)].every(c => +c % 2 === 0)).length,
  d80: first(0, x => (2025 + x) % 7 === 0), d81: (s => 2 * s)(first(1, s => s + 2 * s === 90)), d82: first(1, t => t % 50 === 0 && t % 75 === 0),
  d83: first(1, n => n % 4 === 3 && n % 5 === 4 && n % 6 === 5), d84: first(1, x => x / 3 / 2 === 15),
  d85: Math.max(...range(100, 999).filter(n => n % 5 === 0).map(n => [...String(n)].reduce((a, c) => a + +c, 0))), d86: 200 % 15,
  d87: (12 - 1) * 4, d88: 5 / (6 - 1) * (11 - 1), d89: first(1, t => t / 20 - t / 30 >= 1 - 1e-9), d90: Math.max(...range(1, 19).map(a => a * (20 - a))),
  d91: range(1, 36).find(a => 36 % a === 0 && a + 36 / a === 13 && a > 36 / a), d92: range(1, 36).filter(d => 36 % d === 0).length,
  d93: first(1, n => range(1, n).filter(d => n % d === 0).length === 6), d94: range(1, 27).filter(d => 28 % d === 0).reduce((a, b) => a + b),
  d95: (v => 2 * v)(first(1, v => 2 * v - 10 === v + 10)), d96: 60 / (3 / 4), d97: range(10, 99).filter(n => new Set(String(n)).size === 2).length,
  d98: first(1, x => x * (1 + 2 + 4 + 8 + 16) === 62), d99: range(1, 100).filter(n => n % 2 && n % 3).length,
  d100: (x => x + 25)(first(1, x => x + (x + 15) + (x + 25) === 100)), d101: range(1, 50).reduce(s => s + 1, 0),
  d102: range(1, 64).find(p => range(1, 64).some(t => 3 * t + 2 * p === 64 && 2 * t + 3 * p === 66)),
  d103: first(0, x => 5 * x - 3 * (20 - x) === 68), d104: first(1, v => v - v / 2 - v / 2 / 3 === 20),
  d105: first(1, s => range(1, s - 1).some(a => 2 * (s + a) === 20 && 2 * (s + s - a) === 28)),
  c1: first(1, g => g + g / 12 === 65), c2: zeros(25), c3: Number([1, 3, 5, 7].join('')),
  c4: first(1000, n => new Set(String(n)).size === 4), c5: range(2001, 2099).find(y => String(y) === [...String(y)].reverse().join('')),
};
console.log('\nЗадачи дня и сундуки (в файле / проверка):');
for (const t of [...DAILY, ...CHESTS]) {
  const ok = t.a === EXTRA[t.id];
  if (!ok) bad++;
  console.log(t.id.padStart(3), '|', `${t.a} / ${EXTRA[t.id]} ${ok ? '✓' : '✗'}`);
}
// Шаблоны: по 500 случайных задач каждого — ответ совпадает с перебором и лежит в 0–9999
console.log('\nШаблоны (500 вариантов каждого):');
TEMPLATES.forEach((_, k) => {
  let fails = 0, ex = '';
  for (let i = 0; i < 500; i++) {
    const t = genTask(`g${k}-test${i}`);
    if (t.a !== t.check || !Number.isInteger(t.a) || t.a < 0 || t.a > 9999) { fails++; ex ||= `${t.q} → ${t.a} / ${t.check}`; }
  }
  if (fails) bad++;
  console.log(`g${k}`.padStart(3), '|', fails ? `ОШИБКИ ${fails}: ${ex}` : '✓');
});
console.log(bad ? `\nОШИБОК: ${bad}` : '\nВсе ответы верны.');
// node tools/verify-tasks.mjs --md  → таблица в docs/ПРОВЕРКА_ЗАДАЧ.md
if (process.argv.includes('--md')) {
  const fs = await import('fs');
  const short = q => q.replace(/\{(\w+)\}/g, (m, k) => ({ lev: 'Лев', cat: 'Сима' })[k] || m).replace(/\|/g, '/');
  const who = { grandpa: 'Дедушка Сергей', valya: 'Тётя Валя', beekeeper: 'Пасечник', petrovich: 'Петрович', miller: 'Мельник' };
  let md = `# Проверка ответов

Создано скриптом \`node tools/verify-tasks.mjs --md\`. Каждый ответ пересчитан независимо: перебором или формулой (см. tools/verify-tasks.mjs).

`;
  md += `## 20 основных задач и близнецы

| № | Кто | Условие | Ответ | Проверка | Близнец 1 | Близнец 2 |
|---|---|---|---|---|---|---|
`;
  for (const t of TASKS) {
    const e = CHECK[t.id], ok = (g, i) => g === e[i] ? '✓' : '✗';
    md += `| ${t.id}${t.boss ? ' 🏆' : ''} | ${who[t.npc]} | ${short(t.q)} | **${t.a}** | ${e[0]} ${ok(t.a, 0)} | ${short(t.twins[0].q)} → **${t.twins[0].a}** (${e[1]} ${ok(t.twins[0].a, 1)}) | ${short(t.twins[1].q)} → **${t.twins[1].a}** (${e[2]} ${ok(t.twins[1].a, 2)}) |
`;
  }
  md += `
## Задачи дня

| № | Условие | Ответ | Проверка |
|---|---|---|---|
`;
  for (const t of DAILY) md += `| ${t.id} | ${short(t.q)} | **${t.a}** | ${EXTRA[t.id]} ${t.a === EXTRA[t.id] ? '✓' : '✗'} |
`;
  md += `
## Загадки сундуков (код замка)

| № | Загадка | Код | Проверка |
|---|---|---|---|
`;
  for (const t of CHESTS) md += `| ${t.id} | ${short(t.q)} | **${t.a}** | ${EXTRA[t.id]} ${t.a === EXTRA[t.id] ? '✓' : '✗'} |
`;
  md += `
**Итог: ${bad ? 'ОШИБОК ' + bad : 'все 80 ответов верны'}.**
`;
  fs.mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
  fs.writeFileSync(new URL('../docs/ПРОВЕРКА_ЗАДАЧ.md', import.meta.url), md);
  console.log('Таблица записана в docs/ПРОВЕРКА_ЗАДАЧ.md');
}
process.exit(bad ? 1 : 0);
