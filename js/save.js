// Сохранение прогресса: localStorage + «код сохранения» для переноса на другое устройство.
const KEY = 'ferma-golovolomok-v1';

function fresh() {
  return {
    v: 1,
    coins: 0,
    stars: 0,
    pinHash: null,       // хэш родительского PIN
    tasks: {},           // id -> { stars, errors, dadCalls, hintsUsed, seconds }
    cur: null,           // текущая попытка: { id, twin, errors, hint1, hint2, granny, blocked, seconds }
    grannyDay: '',       // день, когда бабушкина подсказка уже потрачена
    unlocked: [],        // открытые зоны
    playSeconds: 0,
  };
}

export let S = load() || fresh();

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    return s && s.v === 1 ? { ...fresh(), ...s } : null;
  } catch { return null; }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* приватный режим — играем без сохранения */ }
}

export function resetAll() { const pin = S.pinHash; S = fresh(); S.pinHash = pin; save(); }

// Дата устройства в виде 2026-10-17
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Простой хэш, чтобы PIN не лежал в сохранении открытым текстом.
export function hashPin(pin) {
  let h = 2166136261;
  for (const c of 'ферма:' + pin) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36);
}
export const checkPin = pin => S.pinHash === hashPin(pin);

// ---------- код сохранения ----------
// Формат: FG1-<base64url(deflate(JSON))>-<контрольная сумма>. Сжатие — встроенное в браузер.
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const sum = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 1679616; return h.toString(36).padStart(4, '0'); };

async function pipe(bytes, stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

export async function exportCode() {
  const data = await pipe(new TextEncoder().encode(JSON.stringify(S)), new CompressionStream('deflate-raw'));
  const body = b64(data);
  return `FG1-${body}-${sum(body)}`;
}

// Возвращает true, если код подошёл и прогресс восстановлен.
export async function importCode(code) {
  const m = code.trim().replace(/\s+/g, '').match(/^FG1-([A-Za-z0-9_-]+)-([0-9a-z]{4})$/);
  if (!m || sum(m[1]) !== m[2]) return false;
  try {
    const json = new TextDecoder().decode(await pipe(unb64(m[1]), new DecompressionStream('deflate-raw')));
    const s = JSON.parse(json);
    if (s.v !== 1) return false;
    S = { ...fresh(), ...s };
    save();
    return true;
  } catch { return false; }
}
