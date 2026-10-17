// Общие окна: диалог с персонажем, модальное окно, клавиатура, конфетти.
import { CONFIG } from './config.js';
import { face } from './portraits.js';
import { $ } from './ui.js';

const N = CONFIG.names;
const veil = $('veil'), dlg = $('dlg');
let npcName = id => id;
export function setNameResolver(f) { npcName = f; }

// Подставить имена семьи в текст
export const fill = s => s.replace(/\{(\w+)\}/g, (m, k) => N[k] ?? m);
export const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
export const T = s => esc(fill(s));

export function open(html, cls = '') {
  dlg.className = 'dlg ' + cls;
  dlg.onclick = null;
  dlg.innerHTML = html;
  veil.hidden = false;
}
export function close() { veil.hidden = true; dlg.innerHTML = ''; }
export const isOpen = () => !veil.hidden;

export function keypad(extra = '') {
  return `<div class="ans" id="ans" aria-live="polite">?</div>
    <div class="keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => `<button data-k="${k}">${k}</button>`).join('')}
    <button data-k="del" aria-label="Стереть">⌫</button><button data-k="0">0</button>${extra}</div>`;
}
// Подключить клавиатуру; onEnter(строка) вызывается кнопкой «Проверить»/Enter.
let keyHandler = null;
export function bindKeys(maxLen, onEnter, mask = false) {
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

export function shake() { dlg.classList.remove('shake'); void dlg.offsetWidth; dlg.classList.add('shake'); }

// Реплики персонажа по очереди. Возвращает Promise.
export function talk(id, lines, name) {
  return new Promise(res => {
    let i = 0;
    const step = () => {
      if (i >= lines.length) { close(); res(); return; }
      open(`<div class="talk">${face(id)}<div class="talk-body"><b>${esc(name || npcName(id))}</b>
        <div class="say">${T(lines[i])}</div></div><button class="btn g next" id="next">${i < lines.length - 1 ? 'Дальше ▶' : 'Хорошо'}</button></div>`, 'bottom');
      $('next').onclick = e => { e.stopPropagation(); i++; step(); };
      dlg.onclick = () => { i++; step(); };
    };
    step();
  });
}

// ---------- конфетти ----------
export function confetti() {
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
