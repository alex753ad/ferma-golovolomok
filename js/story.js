// Сюжетные сцены: пролог, карточки глав, интриги, финал.
import { PROLOGUE, CHAPTERS, CHAPTER_END, FINAL } from '../data/story.js';
import { S, save } from './save.js';
import { talk, open, close, confetti, T } from './dialog.js';
import { $ } from './ui.js';
import { sfx, setTheme } from './audio.js';
import { prizeLine } from './collection.js';

let hooks;
export function initStory(h) { hooks = h; }

// Несколько реплик разных персонажей подряд
async function scene(lines) { for (const [who, text] of lines) await talk(who, [text]); }

export function chapterCard(ch) {
  return new Promise(res => {
    const prize = prizeLine(CHAPTERS.indexOf(ch));
    open(`<div class="chapter"><div class="ch-title">${T(ch.title)}</div><div class="ch-text">${T(ch.text)}</div>
      ${prize ? `<div class="note">${T(prize)}</div>` : ''}
      <button class="btn g" id="go">Вперёд ▶</button></div>`, 'chapter-dlg');
    sfx('chapter');
    $('go').onclick = () => { close(); res(); };
  });
}

export async function prologue() {
  if (S.story.prologue) return;
  hooks.focus?.('grandpa');
  await scene(PROLOGUE);
  await chapterCard(CHAPTERS[0]);
  S.story.prologue = true; save();
}

// После экрана победы
export async function afterWin(t) {
  if (CHAPTER_END[t.id]) {
    await scene(CHAPTER_END[t.id]);
    const ch = CHAPTERS.find(c => c.from === t.id + 1);
    if (ch) await chapterCard(ch);
  }
  if (t.id === 20) await finale();
}

export async function finale() {
  hooks.focus?.('valya');
  await scene(FINAL);
  S.story.final = true; save();
  hooks.onFinal();
  sfx('final'); setTheme('final');
  open(`<div class="chapter final"><div class="trophy">🏆</div><div class="ch-title">Лучшая ферма округа!</div>
    <div class="ch-text">${T('{lev}, ты решил все 20 задач и спас ферму. Хапкин посрамлён, дедушка гордится, а мама уже печёт праздничный пирог!')}</div>
    <button class="btn g" id="go">Ура! ▶</button></div>`, 'chapter-dlg');
  confetti(); setTimeout(confetti, 700); setTimeout(confetti, 1400);
  $('go').onclick = close;
}
