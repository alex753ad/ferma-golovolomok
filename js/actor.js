// Персонаж: модель со скелетом, анимации, ходьба по пути.
import * as THREE from 'three';
import { cloneModel, gltfOf, fitHeight } from './assets.js';

export class Actor {
  // model — имя в assets/models/chars, height — рост в метрах, hat — шапка
  constructor(model, { height = 1.7, hat } = {}) {
    const key = model.includes('/') ? model : 'chars/' + model;
    this.root = new THREE.Group();
    this.body = fitHeight(cloneModel(key), height);
    this.root.add(this.body);
    this.mixer = new THREE.AnimationMixer(this.body);
    this.actions = {};
    for (const clip of gltfOf(key).animations) this.actions[clip.name] = this.mixer.clipAction(clip);
    this.current = null;
    this.path = null;
    this.speed = 4;
    this.onArrive = null;
    if (hat) addHat(this.body, hat);
    this.play(this.actions.idle ? 'idle' : 'static');
  }

  play(name, fade = 0.2) {
    const next = this.actions[name];
    if (!next || next === this.current) return;
    next.reset().play();
    if (this.current) this.current.crossFadeTo(next, fade, false);
    this.current = next;
  }

  // Сыграть анимацию один раз и вернуться к idle.
  once(name) {
    const a = this.actions[name];
    if (!a) return;
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    this.play(name, 0.15);
    const back = e => { if (e.action === a) { this.mixer.removeEventListener('finished', back); if (!this.path) this.play('idle'); } };
    this.mixer.addEventListener('finished', back);
  }

  walk(path, onArrive) {
    this.path = path && path.length ? path : null;
    this.onArrive = onArrive || null;
    if (this.path) this.play(this.speed > 4.6 ? 'sprint' : 'walk');
    else if (onArrive) onArrive();
  }

  stop() { this.path = null; this.play('idle'); }

  lookAt(x, z) { this.targetRot = Math.atan2(x - this.root.position.x, z - this.root.position.z); }

  update(dt) {
    const p = this.root.position;
    if (this.path) {
      const t = this.path[0], dx = t.x - p.x, dz = t.z - p.z, d = Math.hypot(dx, dz), step = this.speed * dt;
      this.targetRot = Math.atan2(dx, dz);
      if (d <= step) {
        p.x = t.x; p.z = t.z;
        this.path.shift();
        if (!this.path.length) {
          this.path = null;
          this.play('idle');
          const cb = this.onArrive; this.onArrive = null;
          if (cb) cb();
        }
      } else { p.x += dx / d * step; p.z += dz / d * step; }
    }
    if (this.targetRot !== undefined) {
      let r = this.targetRot - this.root.rotation.y;
      r = Math.atan2(Math.sin(r), Math.cos(r));
      this.root.rotation.y += r * Math.min(1, dt * 10);
    }
    this.mixer.update(dt);
  }
}

// Простые шапки поверх модели (кепка Льва, соломенная шляпа деда и т.п.)
const hatMat = c => new THREE.MeshLambertMaterial({ color: c });
function addHat(body, kind) {
  const head = body.getObjectByName('head');
  if (!head) return;
  const g = new THREE.Group();
  // Размеры подобраны под голову Kenney mini-characters (в единицах модели):
  // голова от кости вверх на 0.32, ширина 0.45, глубина 0.34.
  const cyl = (r, h, c, y = 0, open = false) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20, 1, open), typeof c === 'string' ? hatMat(c) : c);
    m.position.y = y;
    return m;
  };
  if (kind === 'cap') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hatMat('#1971c2'));
    dome.scale.set(0.96, 0.42, 0.78);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.025, 0.16), hatMat('#1864ab'));
    visor.position.set(0, 0.01, 0.25);
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), hatMat('#ffd43b'));
    btn.position.y = 0.125;
    g.add(dome, visor, btn);
    g.position.y = 0.3;
  } else if (kind === 'straw') {
    g.add(cyl(0.4, 0.02, '#e9c46a'), cyl(0.22, 0.14, '#e9c46a', 0.07), cyl(0.225, 0.04, '#c0392b', 0.03));
    g.position.y = 0.3;
  } else if (kind === 'bee') {
    const net = new THREE.MeshLambertMaterial({ color: '#495057', transparent: true, opacity: 0.3, side: THREE.DoubleSide });
    g.add(cyl(0.4, 0.02, '#f1f3f5'), cyl(0.23, 0.16, '#f1f3f5', 0.08), cyl(0.36, 0.3, net, -0.15, true));
    g.position.y = 0.32;
  } else if (kind === 'dad') {
    // усы — чтобы папа отличался от Льва
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.03), hatMat('#4a2f1b'));
    m.position.set(0, -0.245, 0.175);
    g.add(m);
    g.position.y = 0.3;
  } else if (kind === 'top') {
    g.add(cyl(0.32, 0.02, '#212529'), cyl(0.2, 0.34, '#212529', 0.17), cyl(0.205, 0.06, '#7048e8', 0.04));
    g.position.y = 0.31;
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  head.add(g);
}
