// Задачи: диалоги NPC, экран задачи, правило попыток, «зови папу», близнецы, звёзды, PIN входа.
import { TASKS, COINS_BY_STARS } from '../data/tasks.js';
import { CONFIG } from './config.js';
import { S, save, today, checkPin } from './save.js';
import { face } from './portraits.js';
import { $, emit } from './ui.js';
import { sfx, setTheme } from './audio.js';
import { open, close, isOpen, keypad, bindKeys, shake, talk, confetti, esc, T } from './dialog.js';

const N = CONFIG.names;
const dlg = $('dlg');
let hooks = { onChange() {}, onReward() {}, onWinClosed() {}, npcName: id => id };

export function initQuest(h) { hooks = { ...hooks, ...h }; }
export { isOpen, close };


// Текущая сюжетная задача — первая нерешённая.
export const currentTask = () => TASKS.find(t => !S.tasks[t.id]?.stars);
export const solvedCount = () => TASKS.filter(t => S.tasks[t.id]?.stars).length;
export const npcWithTask = () => currentTask()?.npc;

const variant = c => { const t = TASKS.find(x => x.id === c.id); return c.twin < 0 ? t : t.twins[c.twin % t.twins.length]; };

// Сколько звёзд получит Лев, если ответит верно сейчас.
function starsNow(c) {
  if (c.dad) return 1;
  const p1 = c.errors >= 1 || (c.hint1 && !c.granny) ? 1 : 0;
  return Math.max(1, 3 - p1 - (c.hint2 ? 1 : 0));
}

// ---------- разговор с NPC ----------
const CHAT = {
  grandpa: ['Хозяйство — как задачка: сначала думаешь, потом делаешь.', 'Я в твои годы задачи решал на заборе. Мелом. Забор был против.'],
  mom: ['Не забудь пообедать, фермер!', 'Курицы сегодня какие-то задумчивые. Наверное, тоже задачи решают.'],
  petrovich: ['Любую технику можно починить. Кроме Хапкина.', 'Гаечный ключ на 13 никто не видел? Опять {cat} утащила.'],
  valya: ['Свежее молоко, свежие новости! Хапкин опять ходит важный.', 'Будет урожай — приходи на рынок, куплю по честной цене.'],
  miller: ['Мука — дело тонкое. А мельница — дело крылатое.', 'Эх, закрутились бы крылья…'],
  beekeeper: ['Ж-ж-ж. Это я тренируюсь разговаривать с пчёлами.', 'Мёд любит тишину. А Хапкин любит шуметь.'],
  baron: ['Ха-ха! К ярмарке эта ферма будет моя!', 'Я Барон Хапкин. Запомни это имя. И не перепутай с «Хапкинс».'],
};

// Если у персонажа есть сюжетная задача — начать её. Возвращает true, если начали.
export function tryTask(id) {
  const t = currentTask();
  if (!t || t.npc !== id || (hooks.canStart && !hooks.canStart(t))) return false;
  startTask(id, t);
  return true;
}

async function startTask(id, t) {
  emit('taskStarted');
  {
    if (S.cur?.id === t.id) {               // задача уже начата
      if (S.cur.blocked) return dadCall();
      await talk(id, ['Ну что, продолжим? Я в тебя верю!']);
      return taskScreen();
    }
    await talk(id, t.scene);
    S.cur = { id: t.id, twin: -1, errors: 0, hint1: false, hint2: false, granny: false, blocked: false, dad: false, totalErrors: 0, dadCalls: 0, hintsUsed: 0, seconds: 0 };
    save();
    return taskScreen();
  }
}

// Просто поболтать
export async function chat(id) {
  const t = currentTask();
  const lines = CHAT[id] || ['Привет!'];
  const tip = t ? ` Кстати, тебя ждёт ${hooks.npcName(t.npc)} — ищи «!» на карте.` : '';
  await talk(id, [lines[Math.floor(Math.random() * lines.length)] + (id === 'baron' ? '' : tip)]);
}

// ---------- экран задачи ----------
let timer;
function taskScreen(note = '') {
  const c = S.cur, t = TASKS.find(x => x.id === c.id), v = variant(c);
  const stars = starsNow(c);
  setTheme(t.boss ? 'boss' : 'farm');
  const grannyOk = !c.hint1 && S.grannyGiven === today() && S.grannyDay !== today();
  const hintBtn = !c.hint1 ? 'Подсказка −⭐' : !c.hint2 ? 'Подсказка 2 −⭐' : '';
  open(`<div class="l">
      <div class="who">${face(t.npc)}<div><b>${esc(hooks.npcName(t.npc))}</b>
        <span>${t.boss ? '🏆 Задача-босс · ' : ''}Задача ${t.id} из 20${c.twin >= 0 ? ' · похожая' : ''} · награда: ${esc(t.reward.text)}</span></div>
        <div class="stars" aria-label="Можно получить звёзд: ${stars}">${[1, 2, 3].map(i => `<i class="${i <= stars ? 'on' : ''}">★</i>`).join('')}</div></div>
      ${note ? `<div class="note">${T(note)}</div>` : ''}
      <div class="q">${T(v.q)}</div>
      <div id="hb">${hintsHtml(c, v)}</div>
      ${c.errors === 1 ? '<div class="note">📞 Ещё одна ошибка — и зовём папу!</div>' : ''}
      <div class="msg" id="msg"></div>
    </div>
    <div class="pad">${keypad('<button data-k="ok" class="g" aria-label="Проверить">✓</button>')}
      <div class="row">
        ${hintBtn ? `<button class="btn y" id="hint">💡 ${hintBtn}</button>` : ''}
        ${grannyOk ? `<button class="btn granny" id="granny" title="Одна бесплатная подсказка в день">👵 Бабушка</button>` : ''}
      </div>
    </div>
    <button class="x" id="x" aria-label="Закрыть">✕</button>`, 'task' + (t.boss ? ' boss' : ''));
  bindKeys(4, a => check(a));
  $('x').onclick = close;
  if ($('hint')) $('hint').onclick = () => {
    if (!c.hint1) c.hint1 = true; else c.hint2 = true;
    c.hintsUsed++; save(); taskScreen(note);
  };
  if ($('granny')) $('granny').onclick = () => {
    c.hint1 = true; c.granny = true; S.grannyDay = today(); save(); taskScreen(note);
  };
  clearInterval(timer);
  timer = setInterval(() => {
    if (!isOpen()) return clearInterval(timer);
    c.seconds++; if (c.seconds % 10 === 0) save();
  }, 1000);
}

function hintsHtml(c, v) {
  let h = '';
  if (c.hint1) h += `<div class="hint"><small>${c.granny ? `${esc(N.grandma)} шепчет (бесплатно)` : 'Подсказка 1'}</small>${T(v.hints[0])}</div>`;
  if (c.hint2) h += `<div class="hint"><small>Подсказка 2</small>${T(v.hints[1])}</div>`;
  return h;
}

function check(str) {
  const c = S.cur, v = variant(c);
  if (Number(str) === v.a) return solved();
  c.errors++; c.totalErrors++;
  if (c.errors >= 2) {
    c.blocked = true; c.dadCalls++; save();
    return dadCall();
  }
  c.hint1 = true; save();
  taskScreen();
  shake(); sfx('soft');
  const m = $('msg');
  m.textContent = 'Почти! Вот подсказка — попробуй ещё раз.';
}

function solved() {
  const c = S.cur, t = TASKS.find(x => x.id === c.id), v = variant(c);
  const stars = starsNow(c), coins = COINS_BY_STARS[stars] * (t.boss ? 2 : 1);
  S.tasks[t.id] = { stars, errors: c.totalErrors, dadCalls: c.dadCalls, hintsUsed: c.hintsUsed, seconds: c.seconds, date: today() };
  S.stars += stars; S.coins += coins; S.cur = null;
  if (t.reward.zone && !S.unlocked.includes(t.reward.zone)) S.unlocked.push(t.reward.zone);
  save();
  clearInterval(timer);
  sfx(t.boss ? 'boss' : 'correct');
  emit('solved', { id: t.id, stars, errors: c.totalErrors, hintsUsed: c.hintsUsed, granny: c.granny });
  open(`<div class="l win-box">
      <div class="win">Верно! Ответ: ${v.a}</div>
      <div class="big-stars">${[1, 2, 3].map(i => `<i class="${i <= stars ? 'on' : ''}" style="animation-delay:${i * 0.15}s">★</i>`).join('')}</div>
      <div class="prize">+${coins} <span class="coin"></span> · ${t.reward.zone ? 'Открыто' : 'Награда'}: ${esc(t.reward.text)}</div>
      <div class="sol"><small>Как решать</small>${T(v.sol)}</div>
      <div class="row"><button class="btn g" id="ok">На ферму ▶</button></div>
    </div>`, 'win-dlg');
  confetti();
  $('ok').onclick = () => { close(); hooks.onWinClosed(t); };
  hooks.onReward(t);
  hooks.onChange();
}

// ---------- зови папу ----------
// После двух ошибок: никаких блокировок — подсказки, а потом похожая задача.
function dadCall() {
  clearInterval(timer);
  const c = S.cur, v = variant(c);
  open(`<div class="l">
      <div class="who">${face('dad', '#c5f6fa')}<div><b>📞 Зови папу — он поможет!</b><span>Даже лучшие фермеры зовут подмогу. Разберитесь вместе, а потом реши похожую задачу сам.</span></div></div>
      <div class="q small">${T(v.q)}</div>
      <div class="hint"><small>Подсказки</small>${T(v.hints[0])}<br>${T(v.hints[1])}</div>
      <div class="row"><button class="btn g" id="go">Разобрались — дать похожую задачу ▶</button></div>
    </div>
    <button class="x" id="x" aria-label="Закрыть">✕</button>`);
  hooks.onChange();
  $('x').onclick = close;
  $('go').onclick = () => {
    Object.assign(c, { twin: c.twin + 1, errors: 0, hint1: false, hint2: false, granny: false, blocked: false, dad: true });
    save();
    hooks.onChange();
    taskScreen(`${N.dad} помог разобраться! Теперь похожая задача — реши её сам.`);
  };
}

// ---------- PIN при входе (один раз на устройстве) ----------
export function pinGate() {
  return new Promise(res => {
    open(`<div class="l pin-box">
        <div class="win" style="color:var(--ink)">Ферма Головоломок 🔒</div>
        <div class="q small">Введите PIN, чтобы войти в игру.</div>
        <div class="msg" id="msg"></div>
      </div>
      <div class="pad">${keypad('<button data-k="ok" class="g" aria-label="Готово">✓</button>')}</div>`);
    bindKeys(4, pin => {
      if (!checkPin(pin)) { $('msg').textContent = 'Неверный PIN'; shake(); return; }
      S.pinHash = CONFIG.pinHash; save(); close(); res();
    }, true);
  });
}
