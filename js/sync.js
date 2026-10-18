// Синхронизация прогресса между планшетами через Firebase (Firestore + анонимный вход, через REST).
// Один документ families/<код семьи> = всё сохранение. Побеждает последняя запись.
import { S, setState } from './save.js';

const FB = { key: 'AIzaSyB2Oeb0Aj6FFHPWKXnwJ-RUM8Ctw1g81Tk', project: 'ferama-5eec6' };
const KEY = 'ferma-sync';      // { code, t, rt } — код семьи, время последней синхронизации, токен входа
const doc = code => `https://firestore.googleapis.com/v1/projects/${FB.project}/databases/(default)/documents/families/${code}`;

let cfg = {};
try { cfg = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { /* без сохранения — без синхронизации */ }
const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* приватный режим */ } };

export const familyCode = () => cfg.code;

// Анонимный вход: токен живёт час, обновляем по refresh-токену.
let token, tokenUntil = 0;
async function auth() {
  if (token && Date.now() < tokenUntil) return token;
  const r = cfg.rt
    ? await post(`https://securetoken.googleapis.com/v1/token?key=${FB.key}`, `grant_type=refresh_token&refresh_token=${cfg.rt}`, 'application/x-www-form-urlencoded')
    : await post(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FB.key}`, JSON.stringify({ returnSecureToken: true }), 'application/json');
  token = r.idToken || r.id_token;
  tokenUntil = Date.now() + ((r.expiresIn || r.expires_in) - 60) * 1000;
  cfg.rt = r.refreshToken || r.refresh_token; keep();
  return token;
}
async function post(url, body, type) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': type }, body });
  if (!r.ok) throw new Error('auth ' + r.status);
  return r.json();
}

async function pull(code) {
  const r = await fetch(doc(code), { headers: { Authorization: 'Bearer ' + await auth() } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('pull ' + r.status);
  const f = (await r.json()).fields;
  return { t: Number(f.t.integerValue), data: JSON.parse(f.data.stringValue) };
}

// Что считается изменением: всё, кроме тикающего времени (иначе планшет папы перезаписывал бы Лёвин прогресс).
const print = () => JSON.stringify({ ...S, playSeconds: 0, maxDay: '', day: S.day && { ...S.day, sec: 0 } });
let last, pushed = false, reloading = false;

async function push(keepalive) {
  if (reloading) return;
  const t = Date.now(), fp = print();
  cfg.t = t; keep(); // заранее: при закрытии игры ответа можно не дождаться
  await fetch(doc(cfg.code), {
    method: 'PATCH', keepalive,
    headers: { Authorization: 'Bearer ' + await auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { t: { integerValue: String(t) }, data: { stringValue: JSON.stringify(S) } } }),
  }).then(r => { if (!r.ok) throw new Error('push ' + r.status); });
  last = fp; pushed = true;
}

// Есть более свежий прогресс с другого планшета — берём его и перезапускаем игру.
async function check() {
  const r = await pull(cfg.code);
  if (r && r.t > (cfg.t || 0)) { reloading = true; setState(r.data); cfg.t = r.t; keep(); location.reload(); return; }
  if (!r || r.t < cfg.t) await push();
}

export function startSync() {
  if (!cfg.code) return;
  last = print();
  check().catch(() => {});
  setInterval(() => { if (print() !== last) push().catch(() => {}); }, 10000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (pushed || print() !== last) push(true).catch(() => {}); }
    else check().catch(() => {});
  });
}

// Включить на этом планшете: новый код семьи, прогресс уходит в облако.
export async function createFamily() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', rnd = crypto.getRandomValues(new Uint8Array(8));
  cfg.code = Array.from(rnd, b => abc[b % 32]).join('');
  await push();
  return cfg.code;
}

// Подключить планшет по коду: забираем прогресс семьи. false — код не найден.
export async function joinFamily(input) {
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const r = await pull(code);
  if (!r) return false;
  cfg.code = code; cfg.t = r.t; keep();
  setState(r.data);
  return true;
}

export const showCode = c => c.slice(0, 4) + '-' + c.slice(4);
