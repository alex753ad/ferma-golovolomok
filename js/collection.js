// Коллекция: открытия за задачи, сундуки, питомцы, значки-достижения, призы от папы.
import { TASKS, CHESTS } from '../data/tasks.js';
import { CONFIG } from './config.js';
import { S, save, today } from './save.js';
import { CHEST_REWARDS } from './bonus.js';
import { open, close, confetti, T, esc } from './dialog.js';
import { $, toast, on } from './ui.js';

const ICONS = { 1: '🌱', 2: '🥕', 3: '🐔', 4: '🌾', 5: '🚜', 6: '🌾', 7: '🌻', 8: '💧', 9: '🌱', 10: '🐄', 11: '🍎', 12: '🌬️', 13: '🌾', 14: '🚜', 15: '🦆', 16: '🐝', 17: '🎃', 18: '🚚', 19: '🌾', 20: '🏆' };
const solved = id => !!S.tasks[id]?.stars;
const chapterTasks = i => TASKS.filter(t => t.id > i * 5 && t.id <= i * 5 + 5);

// ---------- значки ----------
export const BADGES = [
  { id: 'harvest', icon: '🌾', name: 'Первый урожай',        how: 'Собери урожай',                 ok: () => (S.counters.harvest || 0) >= 1 },
  { id: 'boss',    icon: '🏅', name: 'Победитель босса',     how: 'Реши задачу-босса',             ok: () => solved(5) },
  { id: 'clean5',  icon: '🧠', name: 'Без подсказок ×5',     how: '5 задач подряд с первой попытки без подсказок', ok: () => (S.counters.cleanBest || 0) >= 5 },
  { id: 'chapter', icon: '⭐', name: 'Все звёзды главы',     how: 'Получи 15 звёзд в одной главе', ok: () => [0, 1, 2, 3].some(i => chapterTasks(i).every(t => S.tasks[t.id]?.stars === 3)) },
  { id: 'daily5',  icon: '📅', name: 'Пять задач дня',       how: 'Реши 5 задач дня',              ok: () => (S.counters.daily || 0) >= 5 },
  { id: 'chests',  icon: '🗝️', name: 'Кладоискатель',        how: 'Открой все 5 сундуков',         ok: () => CHESTS.every(c => S.chests[c.id]) },
  { id: 'streak7', icon: '🔥', name: 'Неделя на ферме',      how: 'Играй 7 дней подряд',           ok: () => S.streak.count >= 7 },
  { id: 'chores5', icon: '🥧', name: 'Мамин помощник',       how: 'Выполни 5 поручений мамы',      ok: () => (S.counters.chores || 0) >= 5 },
  { id: 'rich',    icon: '💰', name: 'Богатый фермер',       how: 'Накопи 500 монет',              ok: () => S.coins >= 500 },
  { id: 'final',   icon: '🏆', name: 'Лучшая ферма округа',  how: 'Пройди игру',                   ok: () => !!S.story.final },
];

export function checkBadges() {
  for (const b of BADGES) {
    if (S.badges[b.id] || !b.ok()) continue;
    S.badges[b.id] = today(); save();
    toast(`Новый значок: ${b.icon} ${b.name}!`, 3500);
  }
  checkPrizes();
}

// ---------- призы от папы ----------
export function prizeInfo(i) {
  const p = S.parent.prizes[i];
  if (!p?.text) return null;
  const ts = chapterTasks(i);
  const earned = p.cond === 'stars' ? ts.every(t => S.tasks[t.id]?.stars === 3) : ts.every(t => solved(t.id));
  const lost = p.cond === 'stars' && ts.some(t => S.tasks[t.id] && S.tasks[t.id].stars < 3);
  return { text: p.text, cond: p.cond === 'stars' ? 'за 3 звезды во всех задачах главы' : 'за прохождение главы', earned, lost };
}
export const prizeLine = i => { const p = prizeInfo(i); return p ? `🎁 Приз от папы: ${p.text} — ${p.cond}` : ''; };

function checkPrizes() {
  S.prizesShown ||= {};
  for (let i = 0; i < 4; i++) {
    const p = prizeInfo(i);
    if (!p?.earned || S.prizesShown[i]) continue;
    S.prizesShown[i] = today(); save();
    pending.push(() => {
      open(`<div class="chapter"><div class="trophy">🎁</div><div class="ch-title">Приз от папы!</div>
        <div class="ch-text">Глава ${i + 1} пройдена ${esc(p.cond.replace('за ', 'с условием: '))}.<br>Твой приз: <b>${esc(p.text)}</b></div>
        <div class="muted">Покажи этот экран папе 😉</div><button class="btn g" id="go">Ура! ▶</button></div>`, 'chapter-dlg');
      confetti();
      $('go').onclick = close;
    });
  }
}
const pending = [];
// Показать отложенные экраны призов, когда ничего не открыто
export function flushPrizes(isOpen) { if (!isOpen() && pending.length) pending.shift()(); }

// ---------- экран коллекции ----------
export function collectionScreen(tab = 'finds') {
  const cell = (ok, icon, name, sub = '') => `<div class="cell ${ok ? '' : 'locked'}"><div class="ci">${ok ? icon : '❔'}</div><div class="cn">${ok ? esc(name) : '???'}</div>${ok && sub ? `<div class="cs">${sub}</div>` : ''}</div>`;
  let body = '';
  if (tab === 'finds') body = `<div class="grid">${TASKS.map(t => cell(solved(t.id), ICONS[t.id], t.reward.text, '★'.repeat(S.tasks[t.id]?.stars || 0))).join('')}</div>`;
  if (tab === 'chests') body = `<div class="grid">${CHESTS.map(c => cell(S.chests[c.id], CHEST_REWARDS[c.reward].icon, T(CHEST_REWARDS[c.reward].name))).join('')}</div>
    <div class="muted">Сундуки спрятаны по углам фермы. ${esc(CONFIG.names.cat)} мяукает, когда рядом сундук!</div>`;
  if (tab === 'pets') {
    const hats = HATS.filter(h => h.has());
    body = `<div class="grid">${cell(true, '🐱', CONFIG.names.cat, 'всегда с тобой')}
      ${cell(S.pets.dog, '🐶', 'Собака', 'из магазина')}${cell(S.pets.goat, '🐐', 'Козлёнок', 'из магазина')}${cell(S.pets.horse, '🐴', 'Конь', 'из магазина')}
      ${cell(S.decor.includes('gold-hen'), '🐔', 'Золотая курица', 'за звёзды')}${cell(S.decor.includes('parrot'), '🦜', 'Попугай Кеша', 'за звёзды')}</div>
      <div class="muted">Питомцы продаются у тёти Вали. Серия дней подряд: ${S.streak.count} 🔥 — за 3, 7 и 14 дней подарок монетами.</div>
      ${hats.length > 1 ? `<div class="row">${hats.map(h => `<button class="btn ${S.hat === h.id ? 'g' : 'y'}" data-hat="${h.id}">${h.name}</button>`).join('')}</div>` : ''}`;
  }
  if (tab === 'badges') body = `<div class="grid">${BADGES.map(b => `<div class="cell ${S.badges[b.id] ? '' : 'locked'}"><div class="ci">${S.badges[b.id] ? b.icon : '🔒'}</div><div class="cn">${esc(b.name)}</div><div class="cs">${esc(b.how)}</div></div>`).join('')}</div>`;
  if (tab === 'prizes') {
    const rows = [0, 1, 2, 3].map(i => {
      const p = prizeInfo(i);
      if (!p) return `<div class="li"><span>Глава ${i + 1}</span><i>папа ещё не придумал приз</i></div>`;
      return `<div class="li"><span>Глава ${i + 1}: <b>${esc(p.text)}</b><small>${esc(p.cond)}</small></span><i>${p.earned ? '✅ получен!' : p.lost ? 'в этот раз не вышло' : 'в процессе'}</i></div>`;
    }).join('');
    body = `<div class="list">${rows}</div>`;
  }
  const tabs = [['finds', 'Открытия'], ['chests', 'Сундуки'], ['pets', 'Питомцы'], ['badges', 'Значки'], ['prizes', 'Призы']];
  const count = TASKS.filter(t => solved(t.id)).length + CHESTS.filter(c => S.chests[c.id]).length;
  open(`<div class="l">
      <div class="who"><div class="face" style="background:#ffe8a3;display:flex;align-items:center;justify-content:center;font-size:44px">🎒</div>
        <div><b>Коллекция</b><span>Найдено ${count} из ${TASKS.length + CHESTS.length} · ⭐ ${S.stars} · 🔥 ${S.streak.count} дн.</span></div></div>
      <div class="tabs">${tabs.map(([id, n]) => `<button class="tab ${tab === id ? 'on' : ''}" data-tab="${id}">${n}</button>`).join('')}</div>
      ${body}
    </div><button class="x" id="x" aria-label="Закрыть">✕</button>`, 'market coll');
  $('x').onclick = close;
  document.querySelectorAll('[data-tab]').forEach(b => (b.onclick = () => collectionScreen(b.dataset.tab)));
  document.querySelectorAll('[data-hat]').forEach(b => (b.onclick = () => { S.hat = b.dataset.hat; save(); hooksRef.onHat(); collectionScreen('pets'); }));
}

// Шапки Льва
const HATS = [
  { id: 'cap', name: '🧢 Кепка', has: () => true },
  { id: 'cowboy', name: '🤠 Шляпа', has: () => !!S.chests.c1 },
  { id: 'drone', name: '🚁 Кепка-дрон', has: () => S.decor.includes('drone') },
];

let hooksRef;
export function initCollection(h) {
  hooksRef = h;
  for (const ev of ['harvest', 'chore', 'solved', 'daily', 'chest', 'sell', 'newday', 'letter']) on(ev, () => setTimeout(checkBadges, 300));
  on('harvest', () => { S.counters.harvest = (S.counters.harvest || 0) + 1; });
  on('chore', () => { S.counters.chores = (S.counters.chores || 0) + 1; });
  on('solved', r => {
    // серия задач «с первой попытки без подсказок»
    S.counters.clean = r.stars === 3 && !r.errors && !r.hintsUsed && !r.granny ? (S.counters.clean || 0) + 1 : 0;
    S.counters.cleanBest = Math.max(S.counters.cleanBest || 0, S.counters.clean);
    save();
  });
  checkBadges();
}
