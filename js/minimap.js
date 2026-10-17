// Миникарта (вверху справа) и большая карта на весь экран.
import { BOUNDS, ZONES, ROADS } from '../data/map.js';
import { mapShapes, isLocked } from './world.js';
import { $ } from './ui.js';

const MW = BOUNDS.x1 - BOUNDS.x0, MD = BOUNDS.z1 - BOUNDS.z0;
const ZONE_COLORS = { field: '#a0703c', beds: '#a0703c', coop: '#e9d7a5', barn: '#d8c48a', garden: '#69b34c',
  mill: '#d8c48a', pond: '#e9c98a', apiary: '#d3e07a', greenhouse: '#c5e3f6' };

// Нарисовать неподвижную часть карты в контекст ctx масштабом s (пикселей на метр).
function drawBase(ctx, s, withNames) {
  const X = x => (x - BOUNDS.x0) * s, Z = z => (z - BOUNDS.z0) * s;
  const rect = (o, c) => { ctx.fillStyle = c; ctx.fillRect(X(o.x - o.w / 2), Z(o.z - o.d / 2), o.w * s, o.d * s); };
  ctx.fillStyle = '#86c34f'; ctx.fillRect(0, 0, MW * s, MD * s);
  for (const r of ROADS) rect(r, '#ecd29b');
  if (mapShapes.wheat) rect(mapShapes.wheat, '#e8c547');
  for (const zn of ZONES) rect(zn, ZONE_COLORS[zn.kind]);
  for (const w of mapShapes.water) {
    ctx.fillStyle = '#3d9be9'; ctx.beginPath();
    ctx.ellipse(X(w.x), Z(w.z), w.rx * s, w.rz * s, 0, 0, 7); ctx.fill();
  }
  ctx.fillStyle = '#4c8f2f';
  for (const t of mapShapes.trees) { ctx.beginPath(); ctx.arc(X(t.x), Z(t.z), Math.max(1.5, s * 0.9), 0, 7); ctx.fill(); }
  for (const b of mapShapes.buildings) rect(b, b.color);

  // закрытые зоны — штриховка
  for (const zn of ZONES) {
    if (!isLocked(zn.id)) continue;
    const x = X(zn.x - zn.w / 2), z = Z(zn.z - zn.d / 2), w = zn.w * s, d = zn.d * s;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, z, w, d); ctx.clip();
    ctx.fillStyle = 'rgba(60,50,40,.45)'; ctx.fillRect(x, z, w, d);
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(1, s * 0.35);
    for (let k = -d; k < w; k += Math.max(4, s * 2)) { ctx.beginPath(); ctx.moveTo(x + k, z + d); ctx.lineTo(x + k + d, z); ctx.stroke(); }
    ctx.restore();
  }
  if (withNames) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(s * 1.6)}px Nunito, sans-serif`;
    for (const zn of ZONES) {
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.fillStyle = '#fff';
      const label = (isLocked(zn.id) ? '🔒 ' : '') + zn.name;
      ctx.strokeText(label, X(zn.x), Z(zn.z)); ctx.fillText(label, X(zn.x), Z(zn.z));
    }
  }
}

// Подвижная часть: персонажи и значки.
function drawDynamic(ctx, s, player, markers) {
  const X = x => (x - BOUNDS.x0) * s, Z = z => (z - BOUNDS.z0) * s;
  const r = Math.max(3.5, s * 1.1);
  for (const m of markers) {
    ctx.fillStyle = m.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(X(m.x), Z(m.z), r, 0, 7); ctx.fill(); ctx.stroke();
    if (m.bang) {
      ctx.fillStyle = '#ffc93c'; ctx.beginPath(); ctx.arc(X(m.x), Z(m.z) - r * 2.2, r * 1.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#2b2a1f'; ctx.font = `900 ${Math.round(r * 2)}px Nunito, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', X(m.x), Z(m.z) - r * 2.1);
    }
  }
  // Лев — стрелка по направлению взгляда
  const a = player.rot, px = X(player.x), pz = Z(player.z), L = r * 2.2;
  ctx.save(); ctx.translate(px, pz); ctx.rotate(-a + Math.PI);
  ctx.fillStyle = '#1971c2'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -L); ctx.lineTo(L * 0.7, L * 0.7); ctx.lineTo(0, L * 0.3); ctx.lineTo(-L * 0.7, L * 0.7); ctx.closePath();
  ctx.fill(); ctx.stroke(); ctx.restore();
}

export class Minimap {
  // getState() -> { player: {x,z,rot}, markers: [...] }, onGo(x,z) — идти в точку
  constructor(getState, onGo) {
    this.getState = getState;
    this.canvas = $('minimap');
    this.s = 2;
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.canvas.width = MW * this.s * this.dpr; this.canvas.height = MD * this.s * this.dpr;
    this.canvas.style.width = MW * this.s + 'px'; this.canvas.style.height = MD * this.s + 'px';
    this.base = document.createElement('canvas');
    this.frame = 0;
    this.invalidate();

    const big = $('bigmap'), bc = $('bigmapCanvas');
    const open = () => { big.hidden = false; this.layoutBig(); };
    this.canvas.addEventListener('click', open);
    $('btnMap').addEventListener('click', open);
    $('bigmapClose').addEventListener('click', () => (big.hidden = true));
    bc.addEventListener('click', e => {
      const r = bc.getBoundingClientRect();
      const x = BOUNDS.x0 + (e.clientX - r.left) / r.width * MW, z = BOUNDS.z0 + (e.clientY - r.top) / r.height * MD;
      big.hidden = true;
      onGo(x, z);
    });
    addEventListener('resize', () => { if (!big.hidden) this.layoutBig(); });
  }

  // Перерисовать неподвижную часть (после открытия зоны).
  invalidate() {
    const k = this.s * this.dpr;
    this.base.width = MW * k; this.base.height = MD * k;
    drawBase(this.base.getContext('2d'), k, false);
  }

  layoutBig() {
    const bc = $('bigmapCanvas');
    const s = Math.min((innerWidth - 40) / MW, (innerHeight - 110) / MD);
    const dpr = this.dpr;
    bc.width = MW * s * dpr; bc.height = MD * s * dpr;
    bc.style.width = MW * s + 'px'; bc.style.height = MD * s + 'px';
    this.bigScale = s;
    this.drawBig();
  }

  drawBig() {
    const bc = $('bigmapCanvas'), ctx = bc.getContext('2d'), k = this.bigScale * this.dpr;
    drawBase(ctx, k, true);
    const st = this.getState();
    drawDynamic(ctx, k, st.player, st.markers);
  }

  update() {
    if (++this.frame % 3) return; // 20 раз в секунду достаточно
    const ctx = this.canvas.getContext('2d'), k = this.s * this.dpr;
    ctx.drawImage(this.base, 0, 0);
    const st = this.getState();
    drawDynamic(ctx, k, st.player, st.markers);
    if (!$('bigmap').hidden && this.frame % 6 === 0) this.drawBig();
  }
}
