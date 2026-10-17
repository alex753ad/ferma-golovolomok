// Портреты персонажей для диалогов: рисуем голову 3D-модели в картинку один раз при загрузке.
import * as THREE from 'three';
import { Actor } from './actor.js';

const cache = {};

// defs: { id: { model, hat, bg } }
export function makePortraits(defs) {
  const size = 256;
  const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setSize(size, size);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#b0a080', 2.2));
  const key = new THREE.DirectionalLight('#ffffff', 2);
  key.position.set(1, 2, 3);
  scene.add(key);
  const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 20);
  cam.position.set(0.35, 1.45, 3.1);
  cam.lookAt(0, 1.22, 0);

  for (const [id, d] of Object.entries(defs)) {
    const a = new Actor(d.model, { hat: d.hat, height: 1.7 });
    a.root.rotation.y = 0.15;
    a.mixer.update(0.5);
    scene.add(a.root);
    r.render(scene, cam);
    cache[id] = r.domElement.toDataURL('image/png');
    scene.remove(a.root);
  }
  r.dispose();
  r.forceContextLoss();
}

// HTML-картинка портрета в цветном круге
export function face(id, bg = '#ffe8a3') {
  return `<div class="face" style="background:${bg}"><img src="${cache[id] || ''}" alt=""></div>`;
}
