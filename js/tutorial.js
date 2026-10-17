// Обучение (1–2 минуты): дедушка показывает, как ходить, собирать урожай, продавать и говорить с NPC.
import { S, save } from './save.js';
import { CONFIG } from './config.js';
import { face } from './portraits.js';
import { T } from './dialog.js';
import { $, on, makeLabel } from './ui.js';

let hooks, step = -1, arrow;
const STEPS = [
  { text: 'Нажми на землю — {lev} пойдёт туда. Потяни пальцем по экрану — камера повернётся, двумя пальцами — приблизится.', ev: 'walked' },
  { text: 'Видишь мою пшеничную полоску у рынка? Подойди и нажми на спелые колосья — соберёшь урожай!', ev: 'harvest', at: 'strip' },
  { text: 'Урожай можно продать тёте Вале на рынке. Нажми на неё!', ev: 'market', at: 'valya' },
  { text: 'Молодец! А теперь подойди ко мне — над головой «!». У меня первая задача!', ev: 'taskStarted', at: 'grandpa' },
];

function show() {
  const s = STEPS[step];
  $('coach').hidden = false;
  $('coach').innerHTML = `${face('grandpa')}<div class="coach-text"><b>${T(CONFIG.names.grandpa)}</b>${T(s.text)}</div><button class="link" id="skip">Пропустить</button>`;
  $('skip').onclick = finish;
  if (arrow) arrow.removeFromParent();
  arrow = null;
  const p = s.at && hooks.pointOf(s.at);
  if (p) {
    arrow = makeLabel([['⬇', '700 54px sans-serif']], 72, 72, '#ffc93c', '#2b2a1f', 0.016);
    arrow.position.set(p.x, 3.4, p.z);
    hooks.scene.add(arrow);
  }
}

function next(ev) {
  if (step < 0 || STEPS[step].ev !== ev) return;
  step++;
  if (step >= STEPS.length) return finish();
  show();
}

function finish() {
  step = -1;
  $('coach').hidden = true;
  arrow?.removeFromParent();
  S.story.tutorial = true; save();
}

export function startTutorial(h) {
  hooks = h;
  if (S.story.tutorial) return;
  for (const ev of ['walked', 'harvest', 'market', 'taskStarted']) on(ev, () => next(ev));
  step = 0;
  show();
}

export function tutorialTick(t) { if (arrow) arrow.position.y = 3.4 + Math.abs(Math.sin(t * 3)) * 0.4; }
