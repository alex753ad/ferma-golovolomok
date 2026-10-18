// Жизнь персонажей: ходят по своим делам, болтают друг с другом, замечают Льва.
import { findPath } from './nav.js';
import { makeLabel } from './ui.js';
import { fill, isOpen } from './dialog.js';

// Дела рядом с домом: [dx, dz от дома, анимация]. Анимация крутится, пока персонаж занят.
const SPOTS = {
  grandpa:   [[6.4, 0.6, 'interact-right'], [-9, -1.2, 'pick-up'], [-11, 8, 'pick-up']],   // трактор, дрова, полоска
  mom:       [[-11, 0.1, 'pick-up'], [-1, -0.9, 'interact-right'], [-20, 0.2, 'pick-up']], // грядки, дом, курятник
  petrovich: [[1.5, -0.1, 'interact-right'], [-2.5, -1.3, 'interact-left'], [-4.2, -0.5, 'interact-right']], // верстак, гараж, трактор
  valya:     [[1, 1.2, 'interact-right'], [-3, 2.2, 'pick-up'], [3, 0.6, 'holding-both']],  // прилавки, бочки
  miller:    [[2, 1.5, 'holding-both'], [-1.5, 2, 'pick-up'], [1, -2, 'interact-right']],
  beekeeper: [[2, 0.5, 'interact-right'], [-2, 1, 'pick-up'], [0.5, 2, 'idle']],
  grandma:   [[2, 1, 'pick-up'], [-2, 1.5, 'interact-right'], [1, -2, 'holding-both']],
  baron:     [[2, 0, 'idle'], [-2, 0.5, 'emote-no'], [0, 1.2, 'idle']],
};

// Приветствие, когда Лев подходит
const HELLO = {
  grandpa: ['Здорово, хозяин!', 'О, {lev}! Как дела?', 'Помощник пришёл!'],
  mom: ['Привет, сынок!', '{lev}, ты покушал?', 'Вот ты где!'],
  grandma: ['Внучек мой!', 'Иди обниму!', 'Ой, кто пришёл!'],
  petrovich: ['Здорово, инженер!', 'Ключ на 12 не видал?'],
  valya: ['Заходи, покупатель!', 'Свежее всё!'],
  miller: ['Мука сама не намелется!', 'Привет, привет.'],
  beekeeper: ['Тише, пчёлы спят…', 'Мёду хочешь?'],
  baron: ['Хм. Опять ты.', 'Ферма будет моей!'],
};

// Разговоры пар, когда оба свободны
const CHATS = [
  { pair: ['grandpa', 'mom'], talks: [
    [['grandpa', 'Трактор опять чихает!'], ['mom', 'Пусть {lev} посмотрит!']],
    [['mom', 'Пирог будешь?'], ['grandpa', 'Два куска! Я ж работаю.']],
    [['grandpa', 'Видела, как {lev} задачки щёлкает?'], ['mom', 'Весь в тебя!']],
  ] },
  { pair: ['grandpa', 'petrovich'], talks: [
    [['petrovich', 'Гайку на 12 не видел?'], ['grandpa', 'Под трактором поищи.']],
    [['grandpa', 'Ну что, заведём старика?'], ['petrovich', 'Заведём! Сперва чаю.']],
  ] },
  { pair: ['grandma', 'valya'], talks: [
    [['valya', 'Почём нынче яблоки?'], ['grandma', 'Для своих — даром!']],
    [['grandma', 'Внук-то какой умный!'], ['valya', 'Все задачки решает!']],
  ] },
  { pair: ['mom', 'valya'], talks: [
    [['valya', 'Яйца завтра привезёте?'], ['mom', 'Если куры не забастуют!']],
  ] },
];

const NEAR = 3, FAR = 4.5;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const dist = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);

let list = [], lev;
const byId = id => list.find(n => n.id === id);
const home = n => n.a.home || n.a.data;

export function initLife(npcs, player) {
  lev = player;
  list = npcs.map(a => ({ a, id: a.data.id, mode: 'rest', t: rnd(2, 6), away: false, helloT: 0 }));
  for (const n of list) n.a.speed = 1.6;
}

// Лев идёт к персонажу: пусть стоит и ждёт.
export function holdNpc(id) {
  const n = byId(id);
  if (!n) return;
  stopChat(n);
  stand(n, 'hold');
  n.met = false; n.t = 15;
}

function stand(n, mode) { n.a.stop(); n.mode = mode; }

function go(n, x, z, then) {
  const p = n.a.root.position, path = findPath(p.x, p.z, x, z);
  n.mode = 'walk';
  if (!path) { n.mode = 'rest'; n.t = rnd(3, 6); return; }
  n.a.walk(path, then);
}

function say(n, text, sec) {
  if (n.bubble) n.bubble.removeFromParent();
  const t = fill(text);
  n.bubble = makeLabel([[t, '700 22px Nunito, sans-serif']], t.length * 11 + 34, 44, '#ffffff', '#2b2a1f', 0.013);
  n.bubble.position.y = 2.5;
  n.a.root.add(n.bubble);
  if (n.a.tag) n.a.tag.visible = false;
  n.bt = sec;
}

// Следующее дело: домой → отдых → дело или разговор → домой
function next(n) {
  if (n.away) {
    const h = home(n);
    go(n, h.x, h.z, () => { n.away = false; n.mode = 'rest'; n.t = rnd(4, 9); n.a.targetRot = n.a.data.rot; });
    return;
  }
  if (Math.random() < 0.35 && tryChat(n)) return;
  const s = SPOTS[n.id] && pick(SPOTS[n.id]);
  if (!s) { n.t = rnd(4, 9); return; }
  const h = home(n);
  n.away = true;
  go(n, h.x + s[0], h.z + s[1], () => { n.mode = 'work'; n.t = rnd(4, 8); n.a.play(s[2]); });
}

function free(n) { return n.a.root.visible && (n.mode === 'rest' || n.mode === 'work'); }

function tryChat(n) {
  const c = CHATS.find(c => c.pair.includes(n.id) && (m => m && free(m) && dist(home(n), home(m)) < 16)(byId(c.pair.find(id => id !== n.id))));
  if (!c) return false;
  const m = byId(c.pair.find(id => id !== n.id)), p = m.a.root.position, q = n.a.root.position;
  const d = dist(p, q) || 1;
  stand(m, 'wait'); m.t = 20; m.partner = n;
  n.partner = m; n.away = true;
  go(n, p.x + (q.x - p.x) / d * 1.3, p.z + (q.z - p.z) / d * 1.3, () => {
    n.a.lookAt(p.x, p.z); m.a.lookAt(n.a.root.position.x, n.a.root.position.z);
    n.mode = 'chat'; m.mode = 'wait'; n.lines = pick(c.talks); n.k = 0; n.t = 0.3;
  });
  return true;
}

function stopChat(n) {
  const m = n.partner;
  if (!m) return;
  n.partner = m.partner = null;
  for (const k of [n, m]) if (k.mode === 'chat' || k.mode === 'wait' || k.mode === 'walk') { stand(k, 'rest'); k.t = rnd(1, 3); }
}

export function updateLife(dt) {
  const lp = lev.root.position;
  for (const n of list) {
    const a = n.a, p = a.root.position;
    if (!a.root.visible) continue;
    a.pick.position.x = p.x; a.pick.position.z = p.z;
    if (n.bubble && (n.bt -= dt) < 0) { n.bubble.removeFromParent(); n.bubble = null; if (a.tag) a.tag.visible = true; }
    n.helloT -= dt;
    const d = dist(p, lp);

    // Лев рядом — остановиться, повернуться, поздороваться
    if (n.mode === 'hold' || n.mode === 'near') {
      if (d < NEAR) n.met = true;
      if (d < FAR) a.lookAt(lp.x, lp.z);
      n.t -= dt;
      if (!isOpen() && d > FAR && (n.mode === 'near' || n.met || n.t < 0)) { n.mode = 'rest'; n.t = rnd(1, 3); }
      continue;
    }
    if (d < NEAR) {
      stopChat(n);
      stand(n, 'near');
      a.lookAt(lp.x, lp.z);
      if (n.helloT < 0 && HELLO[n.id] && !isOpen()) { a.once('emote-yes'); say(n, pick(HELLO[n.id]), 2.5); n.helloT = 40; }
      continue;
    }

    if (n.mode === 'walk') continue;
    if (n.mode === 'chat') {
      if ((n.t -= dt) > 0) continue;
      if (n.k < n.lines.length) {
        const [who, text] = n.lines[n.k++], s = byId(who);
        say(s, text, 2.6);
        if (n.k > 1) s.a.once('emote-yes');
        n.t = 2.9;
      } else stopChat(n);
      continue;
    }
    if (n.mode === 'wait') { if ((n.t -= dt) < 0) { n.partner = null; n.mode = 'rest'; } continue; }
    if ((n.t -= dt) > 0) continue;
    if (n.mode === 'work') { a.play('idle'); n.mode = 'rest'; n.t = rnd(0.5, 2); continue; }
    next(n);
  }
}
