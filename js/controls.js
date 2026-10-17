// Камера от 3-го лица и жесты: касание — идти, тянуть одним пальцем — повернуть камеру,
// двумя пальцами — приблизить/отдалить. На компьютере: мышь и колесо.
import * as THREE from 'three';
import { CONFIG } from './config.js';

const C = CONFIG.camera;

export class CameraRig {
  constructor(camera, dom, onTap) {
    this.camera = camera;
    this.yaw = C.startYaw;
    this.dist = C.startDist;
    this.target = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.onTap = onTap;
    this.enabled = true;
    const ptrs = new Map();
    let start = null, dragged = false, pinch0 = 0, dist0 = 0;

    dom.addEventListener('pointerdown', e => {
      if (!this.enabled) return;
      dom.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) { start = { x: e.clientX, y: e.clientY, t: performance.now() }; dragged = false; }
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = this.dist; dragged = true; }
    });
    dom.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 1) {
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 12) dragged = true;
        if (dragged) this.yaw -= dx * 0.006;
      } else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        this.setDist(dist0 * pinch0 / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)));
      }
    });
    const up = e => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size === 0 && start && !dragged && performance.now() - start.t < 600) this.onTap(e.clientX, e.clientY);
      if (ptrs.size === 0) start = null;
    };
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); start = null; });
    dom.addEventListener('wheel', e => { e.preventDefault(); this.setDist(this.dist * (1 + Math.sign(e.deltaY) * 0.1)); }, { passive: false });
  }

  setDist(d) { this.dist = Math.max(C.minDist, Math.min(C.maxDist, d)); }

  // Мгновенно поставить камеру к цели (при старте).
  snap(p) { this.target.copy(p); this.look.copy(p); this.update(1); }

  update(dt, p) {
    if (p) this.target.lerp(p, Math.min(1, dt * 4));
    const h = Math.sin(C.pitch) * this.dist, r = Math.cos(C.pitch) * this.dist;
    this.camera.position.set(this.target.x + Math.sin(this.yaw) * r, this.target.y + h, this.target.z + Math.cos(this.yaw) * r);
    this.look.lerp(this.target, Math.min(1, dt * 6));
    this.camera.lookAt(this.look.x, this.look.y + 1, this.look.z);
  }
}
