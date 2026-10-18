// Сохранение прогресса: localStorage + «код сохранения» для переноса на другое устройство.
import { CONFIG } from './config.js';

const KEY = 'ferma-golovolomok-v1';

function fresh() {
  return {
    v: 1,
    coins: 0,
    stars: 0,
    pinHash: null,       // хэш PIN, если на этом устройстве уже входили
    tasks: {},           // id -> { stars, errors, dadCalls, hintsUsed, seconds }
    cur: null,           // текущая попытка: { id, twin, errors, hint1, hint2, granny, blocked, seconds }
    grannyDay: '',       // день, когда бабушкина подсказка уже потрачена
    grannyGiven: '',     // день, когда бабушка дала подсказку
    items: {},           // полученная техника и т.п.: { tractor: true, ... }
    seed: 'wheat',       // выбранные семена
    plots: {},           // грядки: id -> { s: 'wild'|'dug'|'grow', crop, t0, water }
    inv: {},             // урожай и товары: { wheat: 3, egg: 6 }
    animals: {},         // coop/barn/apiary/garden -> { fedAt } или { readyAt }
    chore: null,         // поручение мамы на сегодня
    decor: [],           // купленные украшения
    paint: null,         // цвет трактора
    story: {},           // какие сюжетные сцены уже показаны
    pieUntil: 0,
    counters: {},        // счётчики для поручений и достижений
    maxDay: '',          // самая поздняя дата (защита от перевода часов назад)
    day: null,           // сегодняшний день: время, решённые задачи, вечер
    streak: { last: '', count: 0 },
    pets: {},            // питомцы за серию дней
    chests: {},          // открытые сундуки
    dailyUsed: [],       // какие задачи дня уже были
    dadTasks: [],        // задачи от папы: { q, a, hint, done }
    badges: {},          // достижения
    hat: 'cap',          // что надето у Льва
    collar: null,        // цвет ошейника Симы
    parent: { tasksPerDay: 3, minutes: 60, prizes: [{ text: '', cond: 'stars' }, { text: '', cond: 'stars' }, { text: '', cond: 'stars' }, { text: '', cond: 'stars' }] },
    unlocked: [],        // открытые зоны
    playSeconds: 0,
  };
}

export let S = load() || fresh();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    return s && s.v === 1 ? { ...fresh(), ...s, parent: { ...fresh().parent, ...s.parent } } : null;
  } catch { return null; }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* приватный режим — играем без сохранения */ }
}

// Заменить весь прогресс (код сохранения, синхронизация). PIN входа на этом устройстве не трогаем.
export function setState(s) { const pin = S.pinHash; S = { ...fresh(), ...s, parent: { ...fresh().parent, ...s.parent }, pinHash: pin }; save(); }

export function resetAll() { const pin = S.pinHash; S = fresh(); S.pinHash = pin; save(); }

// Дата устройства в виде 2026-10-17. Если часы перевели назад — остаёмся в самом позднем дне.
export const dateKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function today() {
  const real = dateKey(new Date());
  if (!S.maxDay || real > S.maxDay) S.maxDay = real;
  return S.maxDay;
}
export function yesterdayOf(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d - 1));
}

// Простой хэш, чтобы PIN не лежал в сохранении открытым текстом.
export function hashPin(pin) {
  let h = 2166136261;
  for (const c of 'ферма:' + pin) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36);
}
export const checkPin = (pin, hash = CONFIG.pinHash) => hashPin(pin) === hash;

// ---------- код сохранения ----------
// Формат: FG1-<base64url(deflate(JSON))>-<контрольная сумма>. Сжатие — встроенное в браузер
// (в старых браузерах — FG0, то же без сжатия).
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const sum = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 1679616; return h.toString(36).padStart(4, '0'); };

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

export async function exportCode() {
  if (typeof CompressionStream === 'undefined') { // старый браузер — без сжатия
    const body = b64(new TextEncoder().encode(JSON.stringify(S)));
    return `FG0-${body}-${sum(body)}`;
  }
  const data = await pipe(new TextEncoder().encode(JSON.stringify(S)), new CompressionStream('deflate-raw'));
  const body = b64(data);
  return `FG1-${body}-${sum(body)}`;
}

// Возвращает true, если код подошёл и прогресс восстановлен.
export async function importCode(code) {
  const m = code.trim().replace(/\s+/g, '').match(/^FG([01])-([A-Za-z0-9_-]+)-([0-9a-z]{4})$/);
  if (!m || sum(m[2]) !== m[3]) return false;
  try {
    const raw = unb64(m[2]);
    const json = new TextDecoder().decode(m[1] === '0' ? raw : await pipe(raw, new DecompressionStream('deflate-raw')));
    const s = JSON.parse(json);
    if (s.v !== 1) return false;
    setState(s);
    return true;
  } catch { return false; }
}
