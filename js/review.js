// Аккаунт просмотра (PIN 2025): всё открыто, у персонажей — их задачи с ответами и решениями, листаются ◀ ▶.
import { CONFIG } from './config.js';
import { ZONES } from '../data/map.js';
import { TASKS, DAILY, CHESTS } from '../data/tasks.js';
import { TEMPLATES, genTask } from '../data/gen.js';
import { S, save } from './save.js';
import { open, close, T, esc } from './dialog.js';
import { face } from './portraits.js';
import { $ } from './ui.js';

// Один раз: открыть все зоны, технику, задачи, сундуки, покупки, питомцев; без лимита времени.
export function setupReview() {
  if (S.reviewReady) return;
  Object.assign(S, {
    reviewReady: true, pinHash: CONFIG.pinHash, coins: 99999, stars: 999,
    unlocked: ZONES.filter(z => z.lock).map(z => z.id),
    items: { tractor: true, watering: true, seeder: true, combine: true, truck: true },
    tasks: Object.fromEntries(TASKS.map(t => [t.id, { stars: 3 }])),
    chests: Object.fromEntries(CHESTS.map(c => [c.id, true])),
    decor: [...CONFIG.shop.filter(i => !i.pet && !i.paint && !i.collar && !i.once).map(i => i.id), 'rooster'],
    pets: { dog: true, goat: true, horse: true },
    story: { prologue: true, tutorial: true, final: true },
    parent: { ...S.parent, minutes: 0 },
  });
  save();
}

const story = id => TASKS.filter(t => t.npc === id).flatMap(t => [
  { ...t, title: `Задача ${t.id}${t.boss ? ' · босс' : ''}` },
  ...t.twins.map((w, i) => ({ ...w, title: `Задача ${t.id} · похожая ${i + 1}` })),
]);
const others = () => [
  ...DAILY.map(t => ({ ...t, title: `Задача дня ${t.id}` })),
  ...CHESTS.map(c => ({ ...c, title: `Сундук ${c.id}` })),
  ...TEMPLATES.map((_, k) => ({ ...genTask(`g${k}-review`), title: `Шаблон ${k + 1} из ${TEMPLATES.length} · числа случайные`, gen: k })),
];

// Нажали на персонажа: true, если показали задачи
export function reviewTalk(id) {
  const list = [...story(id), ...(id === 'grandpa' ? others() : [])];
  if (!list.length) return false;
  reviewScreen(id, list, 0);
  return true;
}
export function reviewChest(id) {
  const list = others();
  reviewScreen('lev', list, list.findIndex(t => t.id === id));
}

function reviewScreen(who, list, i) {
  const t = list[i], hints = t.hints || (t.hint ? [t.hint] : []);
  open(`<div class="l">
      <div class="who">${face(who)}<div><b>${esc(t.title)}</b><span>${i + 1} из ${list.length}</span></div></div>
      <div class="q">${T(t.q)}</div>
      <div class="hint"><small>Ответ</small><b>${t.a}</b></div>
      <div class="sol"><small>Решение</small>${T(t.sol)}</div>
      ${hints.length ? `<div class="hint"><small>Подсказки</small>${hints.map((h, k) => `${k + 1}) ${T(h)}`).join('<br>')}</div>` : ''}
      <div class="row"><button class="btn y" id="prev">◀ Назад</button>${t.gen !== undefined ? '<button class="btn" id="dice">🎲 Другие числа</button>' : ''}<button class="btn y" id="next">Дальше ▶</button></div>
    </div><button class="x" id="x" aria-label="Закрыть">✕</button>`, 'market');
  $('x').onclick = close;
  $('prev').onclick = () => reviewScreen(who, list, (i - 1 + list.length) % list.length);
  $('next').onclick = () => reviewScreen(who, list, (i + 1) % list.length);
  if ($('dice')) $('dice').onclick = () => { list[i] = { ...genTask(`g${t.gen}-${Math.random()}`), title: t.title, gen: t.gen }; reviewScreen(who, list, i); };
}
