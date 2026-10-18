// Раздел для папы (по PIN): прогресс и трудности, лимиты, призы, своя задача, код сохранения, сброс.
import { TASKS } from '../data/tasks.js';
import { CONFIG } from './config.js';
import { S, save, exportCode, importCode, resetAll } from './save.js';
import { D, addMinutes } from './day.js';
import { BADGES } from './collection.js';
import { familyCode, createFamily, joinFamily, showCode } from './sync.js';
import { open, close, esc } from './dialog.js';
import { face } from './portraits.js';
import { $, toast } from './ui.js';

const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const hhmm = s => `${Math.floor(s / 3600)} ч ${Math.floor(s / 60) % 60} мин`;

// Где трудно, где легко, достижения — коротко над таблицей
function insights() {
  const done = TASKS.filter(t => S.tasks[t.id]?.stars).map(t => ({ t, r: S.tasks[t.id] }));
  const hardness = r => r.errors + r.hintsUsed + r.dadCalls * 2;
  const line = ({ t, r }) => `<div class="li"><span>№${t.id}: ${esc(t.q.slice(0, 70))}…<small>ошибок ${r.errors}, подсказок ${r.hintsUsed}${r.dadCalls ? `, звал папу ${r.dadCalls}` : ''}, время ${mmss(r.seconds)}</small></span></div>`;
  const hard = done.filter(d => hardness(d.r) > 0).sort((a, b) => hardness(b.r) - hardness(a.r) || b.r.seconds - a.r.seconds).slice(0, 3);
  const easy = done.filter(d => !hardness(d.r)).sort((a, b) => a.r.seconds - b.r.seconds).slice(0, 3);
  const avg = done.length ? mmss(done.reduce((s, d) => s + d.r.seconds, 0) / done.length) : '—';
  const badges = BADGES.filter(b => S.badges[b.id]);
  return `<div class="muted">Среднее время на задачу: ${avg}</div>
    <b>😓 Где было трудно</b><div class="list">${hard.map(line).join('') || '<div class="muted">Пока трудностей не было.</div>'}</div>
    <b>⚡ Решил быстро и сразу</b><div class="list">${easy.map(line).join('') || '<div class="muted">Пока нет задач без ошибок и подсказок.</div>'}</div>
    <b>🏅 Достижения: ${badges.length} из ${BADGES.length}</b>
    <div class="muted">${badges.map(b => `${b.icon} ${esc(b.name)}`).join(' · ') || 'Пока нет'}</div>`;
}

export function parentScreen(tab = 'progress') {
  let body = '';
  if (tab === 'progress') {
    const rows = TASKS.map(t => {
      const r = S.tasks[t.id], cur = S.cur?.id === t.id ? S.cur : null;
      if (!r && !cur) return `<tr class="dim"><td>${t.id}</td><td colspan="6">${t.id === (S.cur?.id) ? '' : 'ещё не начата'}</td></tr>`;
      if (!r) return `<tr><td>${t.id}</td><td>в работе${cur.blocked ? ' · <b>зовёт папу</b>' : ''}</td><td>${cur.totalErrors}</td><td>${cur.dadCalls}</td><td>${cur.hintsUsed}</td><td>${mmss(cur.seconds)}</td><td></td></tr>`;
      return `<tr><td>${t.id}${t.boss ? ' 🏆' : ''}</td><td>${'★'.repeat(r.stars)}</td><td>${r.errors}</td><td>${r.dadCalls ? '📞 ' + r.dadCalls : '—'}</td><td>${r.hintsUsed}</td><td>${mmss(r.seconds)}</td><td>${r.date || ''}</td></tr>`;
    }).join('');
    const done = Object.values(S.tasks).filter(r => r.stars);
    const sum = k => done.reduce((s, r) => s + (r[k] || 0), 0);
    body = `<div class="stats">
        <div><b>${done.length}/20</b>задач</div><div><b>${S.stars}</b>звёзд</div><div><b>${sum('errors')}</b>ошибок</div>
        <div><b>${sum('dadCalls')}</b>звонков папе</div><div><b>${hhmm(S.playSeconds)}</b>всего в игре</div><div><b>${hhmm(D().sec)}</b>сегодня</div>
        <div><b>${S.streak.count}</b>дней подряд</div><div><b>${S.counters.daily || 0}</b>задач дня</div></div>
      ${insights()}
      <table class="tbl"><tr><th>№</th><th>Звёзды</th><th>Ошибки</th><th>Папа</th><th>Подск.</th><th>Время</th><th>Дата</th></tr>${rows}</table>`;
  }
  if (tab === 'limits') {
    const p = S.parent;
    body = `<div class="list">
      <div class="li"><span>Сюжетных задач в день</span><span class="step"><button class="btn sm" id="tm">−</button><b>${p.tasksPerDay}</b><button class="btn sm" id="tp">+</button></span></div>
      <div class="li"><span>Минут игры в день<small>0 — без лимита</small></span><span class="step"><button class="btn sm" id="mm">−</button><b>${p.minutes}</b><button class="btn sm" id="mp">+</button></span></div>
      <div class="li"><span>Сегодня: сыграно ${mmss(D().sec)}${D().bonus ? `, добавлено ${D().bonus} мин` : ''}, решено ${D().solved}</span><button class="btn y sm" id="more">+15 минут сегодня</button></div>
      <div class="li"><span>Имена семьи и время роста урожая<small>меняются в файле js/config.js</small></span></div>
      <div class="li danger"><span>Сбросить весь прогресс<small>настройки останутся</small></span><button class="btn sm" id="reset">Сбросить…</button></div>
    </div>`;
  }
  if (tab === 'prizes') {
    body = `<div class="muted">Напишите настоящий приз за каждую главу — сын увидит его в карточке главы и в коллекции.</div>
      <div class="list">${S.parent.prizes.map((p, i) => `<div class="li col"><b>Глава ${i + 1}</b>
        <input class="inp" data-pz="${i}" maxlength="60" placeholder="например: поход в кино" value="${esc(p.text)}">
        <select class="inp" data-pc="${i}"><option value="stars" ${p.cond === 'stars' ? 'selected' : ''}>за 3 звезды во всех задачах главы</option>
        <option value="done" ${p.cond === 'done' ? 'selected' : ''}>за прохождение главы</option></select></div>`).join('')}</div>
      <div class="row"><button class="btn g" id="savePz">Сохранить призы</button></div>`;
  }
  if (tab === 'letter') {
    const list = S.dadTasks.map((t, i) => `<div class="li"><span>${t.done ? '✅' : '✉️'} ${esc(t.q.slice(0, 60))}${t.q.length > 60 ? '…' : ''} <small>ответ ${t.a}</small></span><button class="btn sm" data-del="${i}">Удалить</button></div>`).join('');
    body = `<div class="muted">Своя задача придёт сыну «Письмом от ${esc(CONFIG.names.dad)}» в почтовый ящик у дома. Награда: 50 монет и 2 звезды (или 30 и 1 звезда, если с ошибкой).</div>
      <div class="li col"><textarea class="inp" id="lq" rows="3" maxlength="400" placeholder="Условие задачи"></textarea>
        <input class="inp" id="la" inputmode="numeric" maxlength="4" placeholder="Ответ (целое число, до 4 цифр)">
        <input class="inp" id="lh" maxlength="200" placeholder="Подсказка (после первой ошибки)">
        <button class="btn g" id="addL">Отправить письмо</button></div>
      <div class="list">${list || '<div class="muted">Писем пока нет.</div>'}</div>`;
  }
  if (tab === 'save') {
    const fc = familyCode();
    body = `<div class="li col"><b>☁️ Синхронизация планшетов</b>${fc
      ? `<div class="muted">Включена. Код семьи: <b>${showCode(fc)}</b> — введите его на другом планшете.</div>`
      : `<div class="muted">Общий прогресс на всех планшетах. На первом нажмите «Включить», на остальных введите код семьи.</div>
        <button class="btn y" id="fcNew">Включить и получить код</button>
        <input class="inp" id="fcIn" maxlength="9" placeholder="Код семьи, например ABCD-2345"><button class="btn g" id="fcJoin">Подключить по коду</button>`}</div>
      <div class="muted">Код сохранения переносит весь прогресс на другое устройство. Скопируйте его и вставьте на новом планшете.</div>
      <div class="li col"><textarea class="inp" id="code" rows="3" readonly>создаю код…</textarea><button class="btn y" id="copy">Скопировать</button></div>
      <div class="li col"><textarea class="inp" id="icode" rows="3" placeholder="Вставьте код FG1-…"></textarea><button class="btn g" id="imp">Восстановить из кода</button></div>`;
  }
  const tabs = [['progress', 'Прогресс'], ['limits', 'Лимиты'], ['prizes', 'Призы'], ['letter', 'Своя задача'], ['save', 'Сохранение']];
  open(`<div class="l">
      <div class="who">${face('dad', '#c5f6fa')}<div><b>Для папы</b><span>Достижения, трудности и настройки</span></div></div>
      <div class="tabs">${tabs.map(([id, n]) => `<button class="tab ${tab === id ? 'on' : ''}" data-tab="${id}">${n}</button>`).join('')}</div>
      ${body}
    </div><button class="x" id="x" aria-label="Закрыть">✕</button>`, 'market parent');
  $('x').onclick = close;
  document.querySelectorAll('[data-tab]').forEach(b => (b.onclick = () => parentScreen(b.dataset.tab)));
  wire(tab);
}

function wire(tab) {
  const p = S.parent, re = () => { save(); parentScreen(tab); };
  if (tab === 'limits') {
    $('tm').onclick = () => { p.tasksPerDay = Math.max(1, p.tasksPerDay - 1); re(); };
    $('tp').onclick = () => { p.tasksPerDay = Math.min(20, p.tasksPerDay + 1); re(); };
    const steps = [0, 15, 30, 45, 60, 75, 90, 120, 180];
    $('mm').onclick = () => { p.minutes = steps[Math.max(0, steps.indexOf(p.minutes) - 1)] ?? 60; re(); };
    $('mp').onclick = () => { p.minutes = steps[Math.min(steps.length - 1, steps.indexOf(p.minutes) + 1)] ?? 60; re(); };
    $('more').onclick = () => { addMinutes(15); toast('Добавлено 15 минут на сегодня'); };
    $('reset').onclick = () => {
      if (!confirm('Точно сбросить весь прогресс? Это нельзя отменить.')) return;
      resetAll(); location.reload();
    };
  }
  if (tab === 'prizes') $('savePz').onclick = () => {
    document.querySelectorAll('[data-pz]').forEach(i => (p.prizes[i.dataset.pz].text = i.value.trim()));
    document.querySelectorAll('[data-pc]').forEach(s => (p.prizes[s.dataset.pc].cond = s.value));
    save(); toast('Призы сохранены');
  };
  if (tab === 'letter') {
    $('addL').onclick = () => {
      const q = $('lq').value.trim(), a = $('la').value.trim();
      if (!q || !/^\d{1,4}$/.test(a)) return toast('Нужно условие и ответ — целое число до 4 цифр');
      S.dadTasks.push({ q, a: Number(a), hint: $('lh').value.trim(), done: false });
      re(); toast('Письмо отправлено в почтовый ящик!');
    };
    document.querySelectorAll('[data-del]').forEach(b => (b.onclick = () => { S.dadTasks.splice(+b.dataset.del, 1); re(); }));
  }
  if (tab === 'save') {
    if ($('fcNew')) $('fcNew').onclick = () => createFamily().then(() => location.reload(), () => toast('Нет связи с облаком — проверьте интернет'));
    if ($('fcJoin')) $('fcJoin').onclick = () => joinFamily($('fcIn').value).then(
      ok => ok ? (toast('Подключено! Загружаю прогресс…'), setTimeout(() => location.reload(), 800)) : toast('Такой код не найден'),
      () => toast('Нет связи с облаком — проверьте интернет'));
    exportCode().then(c => { if ($('code')) $('code').value = c; });
    $('copy').onclick = async () => {
      try { await navigator.clipboard.writeText($('code').value); toast('Код скопирован'); }
      catch { $('code').select(); toast('Выделите код и скопируйте вручную'); }
    };
    $('imp').onclick = async () => {
      if (await importCode($('icode').value)) { toast('Прогресс восстановлен!'); setTimeout(() => location.reload(), 800); }
      else toast('Код не подошёл — проверьте, что он скопирован целиком');
    };
  }
}
