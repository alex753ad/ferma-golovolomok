// «Разглядеть» персонажа: камера подлетает к нему, тянуть пальцем (мышью) — крутить, «×» или Esc — назад к разговору.
import * as THREE from 'three';
import { toast } from './ui.js';

let H, cur = null, k = 0;
const pos = new THREE.Vector3(), look = new THREE.Vector3(), from = new THREE.Vector3(), fromLook = new THREE.Vector3();

// hooks: { camera, dom, rig, actors() — все персонажи сцены, actorOf(id) }
export function initInspect(hooks) {
  H = hooks;
  let x0 = null;
  H.dom.addEventListener('pointerdown', e => { if (cur && !cur.leaving) { x0 = e.clientX; H.dom.setPointerCapture(e.pointerId); } });
  H.dom.addEventListener('pointermove', e => {
    if (x0 === null || !cur) return;
    cur.rot += (e.clientX - x0) * 0.012;
    cur.a.targetRot = cur.rot;
    x0 = e.clientX;
  });
  const up = () => { x0 = null; };
  H.dom.addEventListener('pointerup', up);
  H.dom.addEventListener('pointercancel', up);
  addEventListener('keydown', e => { if (e.key === 'Escape' && cur) leave(); });
}

export const canInspect = id => !!H?.actorOf(id)?.root.visible;

// Начать осмотр; done() — когда камера вернулась
export function inspect(id, done) {
  const a = H.actorOf(id);
  const p = a.root.position, ry = a.root.rotation.y, h = new THREE.Box3().setFromObject(a.body).max.y - p.y;
  const d = h * 1.45;
  // остальных прячем, чтобы не загораживали
  const hidden = H.actors().filter(o => o !== a && o.root.visible);
  hidden.forEach(o => (o.root.visible = false));
  if (a.tag) a.tag.visible = false;
  cur = { a, rot: ry, old: a.targetRot ?? ry, hidden, done, leaving: false,
    pos: new THREE.Vector3(p.x + Math.sin(ry) * d, p.y + h * 0.62, p.z + Math.cos(ry) * d), look: new THREE.Vector3(p.x, p.y + h * 0.5, p.z) };
  H.rig.enabled = false;
  const btn = document.createElement('button');
  btn.className = 'x peek-x'; btn.textContent = '×'; btn.setAttribute('aria-label', 'Назад');
  btn.onclick = leave;
  document.body.append(btn);
  cur.btn = btn;
  toast('Тяни пальцем — покрутить', 2500);
}

function leave() {
  if (!cur || cur.leaving) return;
  cur.leaving = true;
  cur.btn.remove();
  cur.a.targetRot = cur.old;
}

// Вызывать после rig.update: камера плавно переходит между обычным видом и крупным планом
export function updateInspect(dt) {
  if (!cur) return;
  k = Math.max(0, Math.min(1, k + (cur.leaving ? -dt : dt) * 2));
  const e = k * k * (3 - 2 * k);
  from.copy(H.camera.position);
  fromLook.copy(H.rig.look).y += 1;
  pos.lerpVectors(from, cur.pos, e);
  look.lerpVectors(fromLook, cur.look, e);
  H.camera.position.copy(pos);
  H.camera.lookAt(look);
  if (cur.leaving && k === 0) {
    cur.hidden.forEach(o => (o.root.visible = true));
    if (cur.a.tag) cur.a.tag.visible = true;
    H.rig.enabled = true;
    const done = cur.done;
    cur = null;
    done();
  }
}
