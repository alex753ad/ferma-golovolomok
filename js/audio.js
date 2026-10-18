// Звук: эффекты (Kenney, CC0) и музыка, которая сочиняется прямо в браузере (Web Audio, без файлов).
// Темы: 'farm' — спокойная деревенская, 'boss' — задача-босс, 'final' — финал. Смена плавная.
import { S, save } from './save.js';

let ctx, master, musicBus, sfxBus, started = false;
const buffers = {};
const SFX = ['step1', 'step2', 'step3', 'pluck', 'dig', 'coins', 'latch', 'creak', 'click', 'tick', 'soft', 'badge', 'open', 'correct', 'boss', 'final', 'chapter'];

export const settings = () => (S.settings ||= { music: 0.5, sfx: 0.8, mute: false, quality: 'high' });

// Браузеры разрешают звук только после касания — запускаемся на первом.
export function initAudio() {
  const start = () => {
    if (started) return;
    started = true;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    applyVolumes();
    for (const n of SFX) fetch(`assets/sfx/${n}.wav`).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(b => (buffers[n] = b)).catch(() => {});
    setInterval(schedule, 100);
  };
  addEventListener('pointerdown', start, { capture: true });
  addEventListener('pointerup', () => ctx?.state === 'suspended' && !document.hidden && ctx.resume(), { capture: true });
  addEventListener('keydown', start, { capture: true });
  document.addEventListener('visibilitychange', () => ctx && (document.hidden ? ctx.suspend() : ctx.resume()));
}

export function applyVolumes() {
  const s = settings();
  if (!ctx) return;
  master.gain.value = s.mute ? 0 : 1;
  musicBus.gain.value = s.music * 0.35;
  sfxBus.gain.value = s.sfx;
}
export function setVolume(k, v) { settings()[k] = v; save(); applyVolumes(); }

// ---------- эффекты ----------
export function sfx(name, vol = 1, rate = 1) {
  if (!ctx || !buffers[name]) return;
  const s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = buffers[name]; s.playbackRate.value = rate; g.gain.value = vol;
  s.connect(g).connect(sfxBus); s.start();
}
export const step = () => sfx('step' + (1 + Math.floor(Math.random() * 3)), 0.35, 0.9 + Math.random() * 0.2);

// Простые синтезированные звуки
function tone(type, f0, f1, dur, vol, when = 0, filter = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); node = f; }
  node.connect(g).connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
}
export const moo = () => { tone('sawtooth', 130, 95, 1.1, 0.25, 0, 500); tone('sawtooth', 132, 97, 1.1, 0.15, 0, 400); };
export const cluck = () => { for (let i = 0; i < 3; i++) tone('square', 900 - i * 80, 500, 0.08, 0.08, i * 0.13, 1800); };
export const buzz = () => tone('sawtooth', 220, 230, 0.6, 0.05, 0, 900);
export const splash = () => { for (let i = 0; i < 5; i++) tone('triangle', 1400 + Math.random() * 800, 300, 0.15, 0.06, i * 0.04); };
export const meow = () => { tone('triangle', 700, 1100, 0.18, 0.12); tone('triangle', 1100, 600, 0.3, 0.12, 0.18); };

// Мотор техники
let engine;
export function motor(on) {
  if (!ctx) return;
  if (on && !engine) {
    const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = 55; lfo.frequency.value = 9; lg.gain.value = 8;
    f.type = 'lowpass'; f.frequency.value = 400; g.gain.value = 0.12;
    lfo.connect(lg).connect(o.frequency); o.connect(f).connect(g).connect(sfxBus); o.start(); lfo.start();
    engine = { o, lfo, g };
  } else if (!on && engine) {
    engine.g.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    const e = engine; engine = null;
    setTimeout(() => { e.o.stop(); e.lfo.stop(); }, 800);
  }
}

// ---------- музыка ----------
const NOTE = n => 440 * 2 ** ((n - 69) / 12);
const THEMES = {
  // аккорды (MIDI-ноты), темп, мелодическая гамма
  farm:  { bpm: 84,  chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], scale: [72, 74, 76, 79, 81, 84], wave: 'triangle', mel: 0.35 },
  boss:  { bpm: 104, chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]], scale: [69, 71, 72, 76, 77, 81], wave: 'square', mel: 0.5 },
  final: { bpm: 120, chords: [[55, 59, 62], [60, 64, 67], [62, 66, 69], [55, 59, 62]], scale: [74, 76, 78, 79, 81, 83, 86], wave: 'triangle', mel: 0.6 },
};
let theme = 'farm', themeGain = {}, nextTime = 0, step16 = 0, quiet = false;

export function setTheme(name) {
  if (!THEMES[name] || name === theme) return;
  theme = name;
  if (!ctx) return;
  // плавная смена: новая тема нарастает, старые затихают
  for (const [k, g] of Object.entries(themeGain)) if (k !== name) g.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
  const g = gainFor(name);
  g.gain.cancelScheduledValues(ctx.currentTime);
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.setTargetAtTime(1, ctx.currentTime, 0.9);
}
export const musicQuiet = q => { quiet = q; };

function gainFor(name) {
  if (!themeGain[name]) {
    const g = ctx.createGain(); g.gain.value = name === theme ? 1 : 0; g.connect(musicBus); themeGain[name] = g;
  }
  return themeGain[name];
}

function pluck(freq, t, dur, vol, wave, out) {
  const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
  o.type = wave; o.frequency.value = freq;
  f.type = 'lowpass'; f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(500, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
}

// Планировщик: ставит ноты чуть заранее, чтобы музыка шла ровно.
function schedule() {
  if (!ctx || ctx.state !== 'running' || settings().music === 0) return;
  const th = THEMES[theme], out = gainFor(theme), q = quiet ? 0.5 : 1;
  const sixteenth = 60 / th.bpm / 4;
  if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
  while (nextTime < ctx.currentTime + 0.3) {
    const bar = Math.floor(step16 / 16) % th.chords.length, pos = step16 % 16, ch = th.chords[bar];
    if (pos % 2 === 0) { // арпеджио «гитары»
      const n = ch[[0, 1, 2, 1, 0, 2, 1, 2][pos / 2]] + (pos >= 8 ? 12 : 0);
      pluck(NOTE(n), nextTime, 0.5, 0.18 * q, th.wave, out);
    }
    if (pos === 0 || pos === 8) pluck(NOTE(ch[0] - 24), nextTime, 1.2, 0.3 * q, 'sine', out); // бас
    if (theme === 'boss' && pos % 4 === 2) pluck(NOTE(ch[0] - 12), nextTime, 0.15, 0.12 * q, 'square', out);
    // мелодия — случайные ноты из гаммы, но «по сетке»
    if ((pos === 0 || pos === 6 || pos === 10) && Math.random() < th.mel) {
      const n = th.scale[Math.floor(Math.random() * th.scale.length)];
      pluck(NOTE(n), nextTime, 0.9, 0.12 * q, 'sine', out);
    }
    nextTime += sixteenth;
    step16++;
  }
}
