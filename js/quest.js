// Задачи: диалоги NPC, экран задачи, правило попыток, звонок папе (PIN), близнецы, звёзды.
import { TASKS, COINS_BY_STARS } from '../data/tasks.js';
import { CONFIG } from './config.js';
import { S, save, today, hashPin, checkPin } from './save.js';
import { face } from './portraits.js';
import { $ } from './ui.js';

const N = CONFIG.names;
const veil = $('veil'), dlg = $('dlg');
let hooks = { onChange() {}, onReward() {}, npcName: id => id };

export function initQuest(h) { hooks = { ...hooks, ...h }; }

// Подставить имена семьи в текст
const fill = s => s.replace(/\{(\w+)\}/g, (m, k) => N[k] ?? m);
const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const T = s => esc(fill(s));

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

// ---------- общие куски интерфейса ----------
function open(html, cls = '') {
  dlg.className = 'dlg ' + cls;
  dlg.onclick = null;
  dlg.innerHTML = html;
  veil.hidden = false;
}
export function close() { veil.hidden = true; dlg.innerHTML = ''; clearInterval(timer); }
export const isOpen = () => !veil.hidden;

function keypad(extra = '') {
  return `<div class="ans" id="ans" aria-live="polite">?</div>
    <div class="keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => `<button data-k="${k}">${k}</button>`).join('')}
    <button data-k="del" aria-label="Стереть">⌫</button><button data-k="0">0</button>${extra}</div>`;
}
// Подключить клавиатуру; onEnter(строка) вызывается кнопкой «Проверить»/Enter.
let keyHandler = null;
function bindKeys(maxLen, onEnter, mask = false) {
  let v = '';
  const show = () => { $('ans').textContent = v ? (mask ? '●'.repeat(v.length) : v) : '?'; };
  const press = k => {
    if (k === 'del') v = v.slice(0, -1);
    else if (k === 'ok') { if (v) { const val = v; v = ''; show(); onEnter(val); } return; }
    else if (v.length < maxLen) v += k;
    show();
  };
  dlg.querySelectorAll('[data-k]').forEach(b => (b.onclick = () => press(b.dataset.k)));
  removeEventListener('keydown', keyHandler);
  keyHandler = e => {
    if (veil.hidden) return;
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
    else if (e.key === 'Enter') press('ok');
  };
  addEventListener('keydown', keyHandler);
  return { clear() { v = ''; show(); }, press };
}

function shake() { dlg.classList.remove('shake'); void dlg.offsetWidth; dlg.classList.add('shake'); }

// Реплики персонажа по очереди. Возвращает Promise.
export function talk(id, lines, name) {
  return new Promise(res => {
    let i = 0;
    const step = () => {
      if (i >= lines.length) { close(); res(); return; }
      open(`<div class="talk">${face(id)}<div class="talk-body"><b>${esc(name || hooks.npcName(id))}</b>
        <div class="say">${T(lines[i])}</div></div><button class="btn g next" id="next">${i < lines.length - 1 ? 'Дальше ▶' : 'Хорошо'}</button></div>`, 'bottom');
      $('next').onclick = e => { e.stopPropagation(); i++; step(); };
      dlg.onclick = () => { i++; step(); };
    };
    step();
  });
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

export async function talkTo(id) {
  const t = currentTask();
  if (t && t.npc === id) {
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
  const lines = CHAT[id] || ['Привет!'];
  const tip = t ? ` Кстати, тебя ждёт ${hooks.npcName(t.npc)} — ищи «!» на карте.` : '';
  await talk(id, [lines[Math.floor(Math.random() * lines.length)] + (id === 'baron' ? '' : tip)]);
}

// ---------- экран задачи ----------
let timer;
function taskScreen(note = '') {
  const c = S.cur, t = TASKS.find(x => x.id === c.id), v = variant(c);
  const stars = starsNow(c);
  const grannyOk = !c.hint1 && S.grannyDay !== today();
  const hintBtn = !c.hint1 ? 'Подсказка −⭐' : !c.hint2 ? 'Подсказка 2 −⭐' : '';
  open(`<div class="l">
      <div class="who">${face(t.npc)}<div><b>${esc(hooks.npcName(t.npc))}</b>
        <span>${t.boss ? '🏆 Задача-босс · ' : ''}Задача ${t.id} из 20${c.twin >= 0 ? ' · похожая' : ''} · награда: ${esc(t.reward.text)}</span></div>
        <div class="stars" aria-label="Можно получить звёзд: ${stars}">${[1, 2, 3].map(i => `<i class="${i <= stars ? 'on' : ''}">★</i>`).join('')}</div></div>
      ${note ? `<div class="note">${T(note)}</div>` : ''}
      <div class="q">${T(v.q)}</div>
      <div id="hb">${hintsHtml(c, v)}</div>
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
  timer = setInterval(() => { c.seconds++; if (c.seconds % 10 === 0) save(); }, 1000);
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
  shake();
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
  open(`<div class="l win-box">
      <div class="win">Верно! Ответ: ${v.a}</div>
      <div class="big-stars">${[1, 2, 3].map(i => `<i class="${i <= stars ? 'on' : ''}" style="animation-delay:${i * 0.15}s">★</i>`).join('')}</div>
      <div class="prize">+${coins} <span class="coin"></span> · ${t.reward.zone ? 'Открыто' : 'Награда'}: ${esc(t.reward.text)}</div>
      <div class="sol"><small>Как решать</small>${T(v.sol)}</div>
      <div class="row"><button class="btn g" id="ok">На ферму ▶</button></div>
    </div>`, 'win-dlg');
  confetti();
  $('ok').onclick = close;
  hooks.onReward(t);
  hooks.onChange();
}

// ---------- звонок папе ----------
function dadCall() {
  clearInterval(timer);
  open(`<div class="phone">
      <div class="phone-top">📞 Звоним папе…</div>
      ${face('dad', '#c5f6fa')}
      <b class="phone-name">${esc(N.dad)}</b>
      <div class="phone-text">Даже лучшие фермеры зовут подмогу!<br>Покажи папе задачу — вместе разберётесь.</div>
      <div class="phone-pin">
        <div class="phone-label">Папа, введи PIN:</div>
        ${keypad('<button data-k="ok" class="g" aria-label="Готово">✓</button>')}
      </div>
      <button class="btn" id="later">Позвоню позже</button>
    </div>`, 'phone-dlg');
  hooks.onChange();
  bindKeys(4, pin => {
    if (!checkPin(pin)) { shake(); return; }
    dadExplain();
  }, true);
  $('later').onclick = close;
}

// После PIN: решение для папы, потом — задача-близнец.
function dadExplain() {
  const c = S.cur, v = variant(c);
  open(`<div class="l">
      <div class="who">${face('dad', '#c5f6fa')}<div><b>Для папы</b><span>Объясните идею, потом Лев решит похожую задачу сам</span></div></div>
      <div class="q small">${T(v.q)}</div>
      <div class="sol"><small>Ответ: ${v.a}</small>${T(v.sol)}</div>
      <div class="hint"><small>Подсказки</small>${T(v.hints[0])}<br>${T(v.hints[1])}</div>
      <div class="row"><button class="btn g" id="go">Объяснил — дать похожую задачу ▶</button></div>
    </div>`);
  $('go').onclick = () => {
    Object.assign(c, { twin: c.twin + 1, errors: 0, hint1: false, hint2: false, granny: false, blocked: false, dad: true });
    save();
    hooks.onChange();
    taskScreen(`${N.dad} помог разобраться! Теперь похожая задача — реши её сам.`);
  };
}

// ---------- PIN при первом запуске ----------
export function pinSetup() {
  return new Promise(res => {
    let first = '';
    const ask = (title, text) => {
      open(`<div class="l pin-box">
          <div class="win" style="color:var(--ink)">${title}</div>
          <div class="q small">${text}</div>
          <div class="msg" id="msg"></div>
        </div>
        <div class="pad">${keypad('<button data-k="ok" class="g" aria-label="Готово">✓</button>')}</div>`);
      bindKeys(4, pin => {
        if (pin.length !== 4) { $('msg').textContent = 'Нужно ровно 4 цифры.'; shake(); return; }
        if (!first) { first = pin; ask('Повторите PIN', 'Введите тот же PIN ещё раз.'); return; }
        if (pin !== first) { first = ''; ask('Не совпало', 'Придумайте PIN заново.'); shake(); return; }
        S.pinHash = hashPin(pin); save(); close(); res();
      }, true);
    };
    ask('Привет, родитель! 👋', `Придумайте PIN из 4 цифр. Он понадобится, когда ${esc(N.lev)} позовёт на помощь с трудной задачей. Ребёнку его не показывайте.`);
  });
}

// ---------- конфетти ----------
function confetti() {
  const cs = ['#ffc93c', '#e2622b', '#2f9e44', '#1c7ed6', '#e64980'];
  for (let i = 0; i < 90; i++) {
    const d = document.createElement('div');
    d.className = 'cf';
    d.style.background = cs[i % 5];
    d.style.left = innerWidth / 2 + 'px'; d.style.top = innerHeight / 2 + 'px';
    d.style.setProperty('--dx', (Math.random() - 0.5) * innerWidth + 'px');
    d.style.setProperty('--dy', (Math.random() * 0.6 - 0.1) * innerHeight + 'px');
    d.style.animationDelay = Math.random() * 0.2 + 's';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2100);
  }
}
