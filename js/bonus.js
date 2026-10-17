// Дополнительные задачи: задача дня, письма от папы, сундуки с кодовыми замками.
import * as THREE from 'three';
import { DAILY, CHESTS } from '../data/tasks.js';
import { NPCS } from '../data/map.js';
import { CONFIG } from './config.js';
import { S, save } from './save.js';
import { D } from './day.js';
import { open, close, keypad, bindKeys, shake, confetti, T, esc } from './dialog.js';
import { face } from './portraits.js';
import { cloneModel, fitHeight, gltfOf } from './assets.js';
import { addPick } from './world.js';
import { blockRect } from './nav.js';
import { $, toast, emit, makeLabel } from './ui.js';

let hooks, scene;

// Общий экран маленькой задачи. o: { who, title, sub, q, hint, onCorrect(errors), onFail(), freeHint }
function puzzle(o) {
  let errors = 0, hintShown = false;
  const render = msg => {
    open(`<div class="l">
        <div class="who">${face(o.who, o.bg)}<div><b>${esc(o.title)}</b><span>${esc(o.sub || '')}</span></div></div>
        <div class="q">${T(o.q)}</div>
        ${hintShown ? `<div class="hint"><small>Подсказка</small>${T(o.hint)}</div>` : ''}
        <div class="msg" id="msg">${msg || ''}</div>
      </div>
      <div class="pad">${keypad('<button data-k="ok" class="g" aria-label="Проверить">✓</button>')}
        ${o.freeHint && !hintShown ? '<div class="row"><button class="btn y" id="hint">💡 Подсказка</button></div>' : ''}</div>
      <button class="x" id="x" aria-label="Закрыть">✕</button>`, 'task');
    $('x').onclick = close;
    if ($('hint')) $('hint').onclick = () => { hintShown = true; render(); };
    bindKeys(4, a => {
      if (Number(a) === o.a) return o.onCorrect(errors);
      errors++;
      if (o.maxErrors && errors >= o.maxErrors) return o.onFail();
      hintShown = true; render('Почти! Вот подсказка.'); shake();
    });
  };
  render();
}

function winScreen(title, text, sol) {
  open(`<div class="l win-box"><div class="win">${esc(title)}</div><div class="prize">${text}</div>
    ${sol ? `<div class="sol"><small>Как решать</small>${T(sol)}</div>` : ''}
    <div class="row"><button class="btn g" id="ok">Ура! ▶</button></div></div>`, 'win-dlg');
  confetti();
  $('ok').onclick = close;
}

// ---------- задача дня ----------
const DAILY_NPCS = NPCS.filter(n => !['baron', 'grandma'].includes(n.id)).map(n => n.id);
export function dailyInfo() {
  const d = D();
  if (!d.dailyId) {
    const unused = DAILY.filter(t => !S.dailyUsed.includes(t.id));
    const pool = unused.length ? unused : DAILY;
    const k = d.date.split('-').reduce((a, b) => a * 31 + +b, 3);
    d.dailyId = pool[k % pool.length].id;
    d.dailyNpc = DAILY_NPCS[k % DAILY_NPCS.length];
    save();
  }
  return { npc: d.dailyNpc, task: DAILY.find(t => t.id === d.dailyId), settled: !!d.daily };
}
export const dailyNpc = () => { const i = dailyInfo(); return i.settled ? null : i.npc; };

export function dailyScreen() {
  const { npc, task } = dailyInfo();
  puzzle({
    who: npc, title: 'Задача дня ⭐', sub: `Одна в день · бонус ${CONFIG.daily.coins} монет и звезда`, q: task.q, a: task.a, hint: task.hint, maxErrors: 2,
    onCorrect: errors => {
      const d = D(); d.daily = 'done'; S.dailyUsed.push(task.id);
      S.coins += CONFIG.daily.coins; S.stars += 1;
      S.counters.daily = (S.counters.daily || 0) + 1;
      save(); hooks.onChange(); emit('daily', errors);
      winScreen('Задача дня решена!', `+${CONFIG.daily.coins} <span class="coin"></span> · +1 ⭐`, task.sol);
    },
    onFail: () => {
      const d = D(); d.daily = 'failed'; S.dailyUsed.push(task.id); save(); hooks.onChange();
      open(`<div class="l"><div class="win" style="color:var(--clay)">Не беда!</div>
        <div class="q small">Ответ: ${task.a}. ${T(task.sol)}</div><div class="q small">Завтра будет новая задача дня.</div>
        <div class="row"><button class="btn g" id="ok">Хорошо</button></div></div>`, 'win-dlg');
      $('ok').onclick = close;
    },
  });
}

// ---------- письма от папы ----------
export const dadLetter = () => S.dadTasks.find(t => !t.done);
let mailSign;
export function letterScreen() {
  const t = dadLetter();
  if (!t) return toast('Почтовый ящик пуст. Может, завтра будет письмо?');
  puzzle({
    who: 'dad', bg: '#c5f6fa', title: `Письмо от: ${CONFIG.names.dad}`, sub: 'Особая задача — двойная награда!', q: t.q, a: t.a, hint: t.hint || 'Подумай ещё — у тебя получится!', maxErrors: 2,
    onCorrect: errors => {
      t.done = true;
      const coins = errors ? 30 : 50, stars = errors ? 1 : 2;
      S.coins += coins; S.stars += stars;
      save(); hooks.onChange(); emit('letter');
      winScreen('Папа будет гордиться!', `+${coins} <span class="coin"></span> · +${stars} ⭐`);
    },
    onFail: () => {
      open(`<div class="l"><div class="win" style="color:var(--clay)">Хм, хитрая задача!</div>
        <div class="q small">Спроси папу — он её придумал. Письмо подождёт в ящике.</div>
        <div class="row"><button class="btn g" id="ok">Хорошо</button></div></div>`, 'win-dlg');
      $('ok').onclick = close;
    },
  });
}

// ---------- сундуки ----------
export const CHEST_REWARDS = {
  hat: { icon: '🤠', name: 'Ковбойская шляпа' },
  goldwheat: { icon: '✨', name: 'Редкие семена: золотая пшеница' },
  rooster: { icon: '🐓', name: 'Флюгер-петушок на крышу' },
  collar: { icon: '🎀', name: 'Бантик-ошейник для кошки' },
  coins: { icon: '💰', name: '150 монет' },
};
const chestObjs = {};

function placeChests() {
  for (const c of CHESTS) {
    const o = fitHeight(cloneModel('surv/chest'), 0.7);
    o.position.set(c.x, 0, c.z);
    o.rotation.y = Math.atan2(-c.x, -c.z); // повернуть к центру фермы
    scene.add(o);
    const mixer = new THREE.AnimationMixer(o);
    const clip = gltfOf('surv/chest').animations.find(a => a.name === 'open');
    const act = clip && mixer.clipAction(clip);
    if (act) { act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; }
    chestObjs[c.id] = { o, mixer, act };
    if (S.chests[c.id] && act) { act.play(); mixer.update(5); }
    blockRect(c.x, c.z, 0.9, 0.9);
    addPick(c.x, c.z, 1.1, 1.4, { type: 'object', id: 'chest:' + c.id, name: 'Сундук' });
  }
}

export function chestScreen(id) {
  const c = CHESTS.find(x => x.id === id), r = CHEST_REWARDS[c.reward];
  if (S.chests[id]) return toast(`Сундук пуст — внутри был ${T(r.name).toLowerCase()}.`);
  puzzle({
    who: 'lev', title: 'Сундук с кодовым замком 🔒', sub: 'Код замка — ответ на загадку', q: c.q, a: c.a, hint: c.hint, freeHint: true,
    onCorrect: () => {
      S.chests[id] = true;
      if (c.reward === 'coins') S.coins += 150;
      if (c.reward === 'hat') S.hat = 'cowboy';
      save(); hooks.onChange(); hooks.onChest(c.reward); emit('chest', id);
      const ch = chestObjs[id];
      ch.act?.reset().play();
      winScreen('Замок открыт!', `Внутри: ${r.icon} ${T(r.name)}`);
    },
  });
}
export const chestMarkers = () => CHESTS.filter(c => !S.chests[c.id]);

export function initBonus(sc, h) {
  scene = sc; hooks = h;
  placeChests();
  // почтовый ящик у дома
  const box = new THREE.Group();
  const m = (g, c, y) => { const x = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: c })); x.position.y = y; x.castShadow = true; return x; };
  box.add(m(new THREE.BoxGeometry(0.1, 1.1, 0.1), '#7a4b24', 0.55), m(new THREE.BoxGeometry(0.5, 0.35, 0.7), '#1c7ed6', 1.25));
  box.position.set(-2.6, 0, 18); scene.add(box);
  blockRect(-2.6, 18, 0.6, 0.8);
  addPick(-2.6, 18, 0.9, 1.6, { type: 'object', id: 'mail:dad', name: 'Почтовый ящик' });
  mailSign = makeLabel([['✉️', '700 40px sans-serif']], 64, 64, '#c5f6fa', '#2b2a1f', 0.012);
  mailSign.position.set(-2.6, 2.4, 18); scene.add(mailSign);
}

export function updateBonus(dt, t) {
  for (const c of Object.values(chestObjs)) c.mixer.update(dt);
  mailSign.visible = !!dadLetter();
  mailSign.position.y = 2.4 + Math.abs(Math.sin(t * 3)) * 0.2;
}
