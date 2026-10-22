// Собирает docs/ОТВЕТЫ_И_РЕШЕНИЯ.md — ответы и решения всех задач игры (для папы).
// Запуск: node tools/answers-md.mjs
import fs from 'fs';
import { TASKS, DAILY, HARD, CHESTS } from '../data/tasks.js';
import { TEMPLATES, HARD_TEMPLATES, genTask } from '../data/gen.js';

const CHAPTERS = { 1: 'Новый хозяин', 6: 'Кто сломал трактор?', 11: 'Тайна мельницы', 16: 'Большая ярмарка' };
const WHO = { grandpa: 'Дедушка Сергей', valya: 'Тётя Валя', beekeeper: 'Пасечник', petrovich: 'Механик Петрович', miller: 'Мельник' };
const txt = s => s.replace(/\{lev\}/g, 'Лев').replace(/\{cat\}/g, 'Сима').replace(/\{(\w+)\}/g, '$1');
const hints = h => h?.length ? `\n\nПодсказки: ${h.map((x, i) => `${i + 1}) ${txt(x)}`).join(' ')}` : '';
const block = (title, t) => `${title}\n\n${txt(t.q)}\n\n**Ответ: ${t.a}**\n\nРешение: ${txt(t.sol)}${hints(t.hints || (t.hint && [t.hint]))}\n`;

let md = '# Ответы и решения всех задач\n\nДля папы. Сюжетные задачи с «близнецами» (их игра даёт после помощи папы), задачи дня и загадки сундуков.\n';
for (const t of TASKS) {
  if (CHAPTERS[t.id]) md += `\n---\n\n# Глава ${Object.keys(CHAPTERS).indexOf(String(t.id)) + 1}. ${CHAPTERS[t.id]}\n`;
  md += '\n' + block(`## Задача ${t.id} — ${WHO[t.npc] || t.npc}${t.boss ? ' (босс)' : ''}`, t);
  t.twins?.forEach((w, i) => { md += '\n' + block(`### Похожая ${t.id}.${i + 1}`, w); });
}
md += '\n---\n\n# Задачи дня\n\nОдна в день у случайного персонажа. d16–d45 — посложнее.\n';
for (const t of DAILY) md += '\n' + block(`## ${t.id}`, t);
md += '\n---\n\n# Задачи-боссы дня (у дедушки)\n\nОдна в день, посложнее.\n';
for (const t of HARD) md += '\n' + block(`## ${t.id}`, t);
md += '\n---\n\n# Загадки сундуков\n\nКод замка — ответ на загадку.\n';
for (const t of CHESTS) md += '\n' + block(`## Сундук ${t.id}`, t);
md += `\n---\n\n# Шаблоны (числа случайные)\n\nКогда готовые задачи дня кончаются, игра берёт задачи из ${TEMPLATES.length} шаблонов. Ниже — по одному примеру каждого.\n`;
TEMPLATES.forEach((_, k) => { md += '\n' + block(`## Шаблон ${k + 1}`, genTask(`g${k}-example`)); });
md += `\n## Сложные шаблоны (для задачи-босса дня)\n`;
HARD_TEMPLATES.forEach((_, k) => { md += '\n' + block(`### Сложный шаблон ${k + 1}`, genTask(`x${k}-example`)); });
fs.writeFileSync(new URL('../docs/ОТВЕТЫ_И_РЕШЕНИЯ.md', import.meta.url), md);
console.log('docs/ОТВЕТЫ_И_РЕШЕНИЯ.md:', md.length, 'символов');
