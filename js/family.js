// Семья: поручения мамы (без математики), бабушка и её подсказка.
import { CONFIG } from './config.js';
import { S, save, today } from './save.js';
import { isLocked } from './world.js';
import { talk } from './dialog.js';
import { on, toast, emit } from './ui.js';
import { GRANNY } from '../data/story.js';

const C = CONFIG;
let hooks;
const solvedN = () => Object.values(S.tasks).filter(t => t.stars).length;

// Поручения на сегодня: одни и те же весь день, выбираются по дате.
export function todayChores() {
  if (S.chore?.day === today() && S.chore.items) return S.chore;
  const list = C.chores.filter(c => solvedN() >= c.need && !(c.id === 'water' && S.decor.includes('autowater')));
  let d = today().split('-').reduce((a, b) => a * 31 + +b, 7);
  const items = [];
  while (items.length < Math.min(C.choresPerDay, list.length)) {
    const c = list[d % list.length];
    if (!items.some(x => x.id === c.id)) items.push({ id: c.id, n: 0 });
    d = d * 7 + 3;
  }
  S.chore = { day: today(), items, claimed: false, seen: false };
  save();
  return S.chore;
}
const choreDef = it => C.chores.find(c => c.id === it.id);
const itemDone = it => it.n >= choreDef(it).goal;
const allDone = () => todayChores().items.every(itemDone);

function progress(id) {
  const ch = todayChores(), it = ch.items.find(x => x.id === id);
  if (!it || ch.claimed || itemDone(it)) return;
  it.n++;
  save();
  if (itemDone(it)) { toast(allDone() ? 'Все поручения мамы выполнены! Зайди к ней за наградой 🥧' : `Поручение выполнено: ${choreDef(it).text.toLowerCase()} ✓`); hooks.onChange(); }
}

// Куда идти по поручению — для значка над целью и на миникарте. where: id зоны или персонажа.
const CHORE_GOAL = { harvest: ['🌾', 'beds'], plant: ['🌱', 'beds'], water: ['💧', 'beds'], feed: ['🐔', 'coop'], eggs: ['🥚', 'coop'], sell: ['💰', 'valya'],
  cows: ['🐄', 'barn'], milk: ['🥛', 'barn'], apples: ['🍎', 'garden'], bake: ['🍞', 'bakery'], honey: ['🍯', 'apiary'] };
export function choreGoal() {
  const ch = todayChores(), it = ch.items.find(x => !itemDone(x));
  if (!ch.seen || ch.claimed || !it) return null;
  const [icon, where] = CHORE_GOAL[it.id];
  return { icon, where: where === 'beds' && isLocked('beds') ? 'strip' : where };
}

// Мама ждёт: есть новые поручения или награда.
export const momHasNews = () => { const ch = todayChores(); return !ch.claimed && (allDone() || !ch.seen); };

export async function momTalk() {
  const ch = todayChores(), coins = C.choreCoins * ch.items.length;
  if (ch.claimed) {
    await talk('mom', ['Спасибо, помощник! Завтра будут новые поручения. А пока — беги решать задачи!']);
  } else if (allDone()) {
    ch.claimed = true;
    emit('chore');
    S.coins += coins;
    S.pieUntil = Date.now() + C.pieMinutes * 60000;
    save(); hooks.onChange();
    await talk('mom', [`Вот спасибо! Держи ${coins} монет и пирог. С пирогом ноги сами бегут — ${C.pieMinutes} минуты будешь самым быстрым на ферме!`]);
  } else {
    ch.seen = true; save(); hooks.onChange();
    const list = ch.items.map(it => `${itemDone(it) ? '✓' : '•'} ${choreDef(it).text.toLowerCase()} (${Math.min(it.n, choreDef(it).goal)} из ${choreDef(it).goal})`).join('; ');
    await talk('mom', [`Поручения на сегодня: ${list}. Сделаешь всё — испеку пирог и дам ${coins} монет!`]);
  }
}

// ---------- бабушка ----------
// Живёт в саду, когда он открыт. До этого — у дома рядом с дедушкой.
export const grannyPlace = () => isLocked('garden') ? { x: -4.6, z: 20.6 } : { x: 31.5, z: 5.5 };

export async function grannyTalk() {
  if (S.grannyGiven !== today()) {
    S.grannyGiven = today(); save(); hooks.onChange();
    await talk('grandma', GRANNY.give);
  } else await talk('grandma', GRANNY.used);
}
export const grannyHasNews = () => !!grannyPlace() && S.grannyGiven !== today();

export function initFamily(h) {
  hooks = h;
  on('harvest', () => progress('harvest'));
  on('plant', () => progress('plant'));
  on('sell', () => progress('sell'));
  on('water', () => progress('water'));
  on('feed', id => progress(id === 'coop' ? 'feed' : 'cows'));
  on('collect', p => progress({ egg: 'eggs', milk: 'milk', apple: 'apples', honey: 'honey' }[p]));
  on('bake', () => progress('bake'));
}
