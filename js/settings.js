// Настройки: громкость музыки и звуков, «без звука», качество графики, вход для родителей.
import { save } from './save.js';
import { settings, setVolume, applyVolumes, sfx } from './audio.js';
import { askPin } from './day.js';
import { parentScreen } from './parent.js';
import { open, close } from './dialog.js';
import { $ } from './ui.js';

export function settingsScreen() {
  const s = settings();
  open(`<div class="l">
      <div class="who"><div class="face" style="background:#e7f5ff;display:flex;align-items:center;justify-content:center;font-size:44px">⚙️</div><div><b>Настройки</b><span>Звук, графика и раздел для родителей</span></div></div>
      <div class="list">
        <div class="li"><span>🎵 Музыка</span><input type="range" class="rng" id="vm" min="0" max="1" step="0.05" value="${s.music}"></div>
        <div class="li"><span>🔊 Звуки</span><input type="range" class="rng" id="vs" min="0" max="1" step="0.05" value="${s.sfx}"></div>
        <div class="li"><span>🔇 Без звука</span><button class="btn sm ${s.mute ? 'g' : ''}" id="mute">${s.mute ? 'Включено' : 'Выключено'}</button></div>
        <div class="li"><span>🖼️ Качество графики<small>${s.quality === 'high' ? 'тени, много травы, сглаживание' : 'быстрее и меньше греет планшет'}</small></span>
          <span class="step"><button class="btn sm ${s.quality === 'high' ? 'y' : ''}" data-q="high">Высокое</button><button class="btn sm ${s.quality === 'economy' ? 'y' : ''}" data-q="economy">Экономное</button></span></div>
        <div class="li"><span>👨 Для родителей<small>прогресс, лимиты, призы, PIN</small></span><button class="btn sm" id="parent">Войти по PIN</button></div>
      </div>
    </div><button class="x" id="x" aria-label="Закрыть">✕</button>`, 'market');
  $('x').onclick = close;
  $('vm').oninput = e => setVolume('music', +e.target.value);
  $('vs').oninput = e => setVolume('sfx', +e.target.value);
  $('vs').onchange = () => sfx('coins');
  $('mute').onclick = () => { s.mute = !s.mute; save(); applyVolumes(); settingsScreen(); };
  document.querySelectorAll('[data-q]').forEach(b => (b.onclick = () => {
    if (s.quality === b.dataset.q) return;
    s.quality = b.dataset.q; save();
    location.reload(); // тени и сглаживание меняются только при запуске
  }));
  $('parent').onclick = () => askPin(() => parentScreen());
}
