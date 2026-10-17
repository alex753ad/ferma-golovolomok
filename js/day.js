// Игровой день: не больше N сюжетных задач и M минут, вечер на ферме, серия дней подряд.
import { S, save, today, yesterdayOf, checkPin } from './save.js';
import { CONFIG } from './config.js';
import { TEASERS } from '../data/story.js';
import { open, close, isOpen, talk, keypad, bindKeys, shake, T, esc } from './dialog.js';
import { face } from './portraits.js';
import { $, toast, emit } from './ui.js';

let hooks;
export function initDay(h) { hooks = h; D(); }

// Состояние сегодняшнего дня (создаётся при первом обращении в новый день)
export function D() {
  if (S.day?.date !== today()) newDay();
  return S.day;
}

function newDay() {
  const d = today();
  // серия дней подряд
  if (S.streak.last !== d) {
    S.streak.count = S.streak.last === yesterdayOf(d) ? S.streak.count + 1 : 1;
    S.streak.last = d;
  }
  S.day = { date: d, sec: 0, solved: 0, daily: null, bonus: 0, warned: false, ended: false, doneAt: 0 };
  save();
  emit('newday', S.streak.count);
}

const P = () => S.parent;
const limitSec = () => P().minutes > 0 ? (P().minutes + D().bonus) * 60 : 0;
export const canStartTask = () => D().solved < P().tasksPerDay;
export const tasksLeftToday = () => Math.max(0, P().tasksPerDay - D().solved);
export function onStorySolved() { D().solved++; save(); }
export const isEnded = () => D().ended;

// Фаза солнца: к концу лимита наступает вечер. Без лимита — всегда день.
export function dayPhase() {
  const l = limitSec();
  return l ? Math.min(1, D().sec / l) : 0.2;
}

// Вызывается каждый кадр
export function tickDay(dt) {
  const d = D();
  if (d.ended || document.hidden) return;
  d.sec += dt;
  const l = limitSec();
  if (!l) return;
  // всё на сегодня сделано: задачи дня + задача дня
  const storyDone = d.solved >= P().tasksPerDay || hooks.noStoryLeft();
  if (!d.doneAt && storyDone && d.daily) d.doneAt = d.sec;
  if (isOpen()) return; // не прерываем задачу или разговор
  if (!d.warned && (d.sec >= l - 600 || (d.doneAt && d.sec >= d.doneAt))) {
    d.warned = true; save();
    talk('mom', [d.sec >= l - 600
      ? `${CONFIG.names.lev}, через 10 минут ужинать! Доделывай дела на ферме.`
      : `Молодец, на сегодня задачи решены! Ещё 10 минут погуляй по ферме — и ужинать.`]);
    return;
  }
  if (d.sec >= l || (d.doneAt && d.sec >= d.doneAt + 600)) evening();
}

// ---------- вечер ----------
let timer;
export function evening() {
  const d = D();
  d.ended = true; save();
  hooks.goHome();
  const next = hooks.nextTaskId();
  const teaser = TEASERS[next] || TEASERS.done;
  open(`<div class="evening">
      <div class="ev-sky">🌅</div>
      <div class="ch-title">Вечер на ферме</div>
      <div class="talk">${face('mom')}<div class="talk-body"><b>${esc(CONFIG.names.mom)}</b>
        <div class="say">Всё, ужинать! ${T('{cat}')} уже спит на крылечке 😴 Приходи завтра.</div></div></div>
      <div class="note">Завтра: ${T(teaser)}</div>
      <div class="ev-timer">Новый день через <b id="evT"></b></div>
      <button class="link" id="more">Для родителей: ещё 15 минут</button>
    </div>`, 'chapter-dlg ev-dlg');
  const tick = () => {
    const now = new Date(), mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const s = Math.max(0, Math.floor((mid - now) / 1000));
    if ($('evT')) $('evT').textContent = `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    if (today() !== d.date) location.reload(); // наступил новый день
  };
  tick();
  clearInterval(timer);
  timer = setInterval(tick, 1000);
  $('more').onclick = () => askPin(() => { addMinutes(15); toast('Ещё 15 минут! Мама разрешила.'); });
}

export function addMinutes(m) {
  const d = D();
  d.bonus += m; d.ended = false; d.warned = false; d.doneAt = 0;
  save(); clearInterval(timer); close();
}

// Запросить PIN, потом вызвать ok()
export function askPin(ok, title = 'PIN родителя') {
  open(`<div class="l pin-box"><div class="win" style="color:var(--ink)">${title}</div><div class="msg" id="msg"></div>
    <button class="btn" id="back">Назад</button></div>
    <div class="pad">${keypad('<button data-k="ok" class="g" aria-label="Готово">✓</button>')}</div>`);
  const was = D().ended;
  bindKeys(4, pin => { if (checkPin(pin)) { close(); ok(); } else { shake(); $('msg').textContent = 'Неверный PIN'; } }, true);
  $('back').onclick = () => { close(); if (was && D().ended) evening(); };
}
