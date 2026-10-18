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

// Поручение на сегодня: одно и то же весь день, выбирается по дате.
export function todayChore() {
  if (S.chore?.day === today()) return S.chore;
  const list = C.chores.filter(c => solvedN() >= c.need);
  const d = today().split('-').reduce((a, b) => a * 31 + +b, 7);
  const c = list[d % list.length];
  S.chore = { day: today(), id: c.id, n: 0, claimed: false };
  save();
  return S.chore;
}
const choreDef = ch => C.chores.find(c => c.id === ch.id);
const choreDone = ch => ch.n >= choreDef(ch).goal;

function progress(id) {
  const ch = todayChore();
  if (ch.id !== id || ch.claimed || choreDone(ch)) return;
  ch.n++;
  save();
  if (choreDone(ch)) { toast(`Поручение мамы выполнено! Зайди к ней за наградой 🥧`); hooks.onChange(); }
}

// Куда идти по поручению — для значка над целью и на миникарте. where: id зоны или персонажа.
const CHORE_GOAL = { harvest: ['🌾', 'beds'], plant: ['🌱', 'beds'], water: ['💧', 'beds'], feed: ['🐔', 'coop'], eggs: ['🥚', 'coop'], sell: ['💰', 'valya'] };
export function choreGoal() {
  const ch = todayChore();
  if (!ch.seen || ch.claimed || choreDone(ch)) return null;
  const [icon, where] = CHORE_GOAL[ch.id];
  return { icon, where: where === 'beds' && isLocked('beds') ? 'strip' : where };
}

// Мама ждёт: есть новое поручение или награда.
export const momHasNews = () => { const ch = todayChore(); return !ch.claimed && (choreDone(ch) || !ch.seen); };

export async function momTalk() {
  const ch = todayChore(), def = choreDef(ch);
  if (ch.claimed) {
    await talk('mom', ['Спасибо, помощник! Завтра будет новое поручение. А пока — беги решать задачи!']);
  } else if (choreDone(ch)) {
    ch.claimed = true;
    emit('chore');
    S.coins += C.choreCoins;
    S.pieUntil = Date.now() + C.pieMinutes * 60000;
    save(); hooks.onChange();
    await talk('mom', [`Вот спасибо! Держи ${C.choreCoins} монет и пирог. С пирогом ноги сами бегут — ${C.pieMinutes} минуты будешь самым быстрым на ферме!`]);
  } else {
    ch.seen = true; save(); hooks.onChange();
    await talk('mom', [`Поручение на сегодня: ${def.text.toLowerCase()}. Сделано ${ch.n} из ${def.goal}. Потом приходи — испеку пирог!`]);
  }
}

// ---------- бабушка ----------
// Живёт в саду, когда он открыт. До этого — приезжает на рынок по выходным.
export function grannyPlace() {
  if (!isLocked('garden')) return { x: 31.5, z: 5.5 };
  const d = new Date().getDay();
  return d === 0 || d === 6 ? { x: -3, z: 30.5 } : null;
}

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
  on('feed', id => id === 'coop' && progress('feed'));
  on('collect', p => p === 'egg' && progress('eggs'));
}
