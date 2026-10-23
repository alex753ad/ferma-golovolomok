// Загрузка моделей с прогрессом, общие материалы, инстансинг.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { isStatic, buildStatic, dress } from './models.js';

THREE.Cache.enabled = true;

const models = {};      // 'pack/name' -> gltf
const materials = {};   // общий материал на пакет+имя

// Список нужных моделей: пакет -> имена файлов. Статичные строит models.js (файлы не грузим),
// у животных и сундука берём только узлы и анимации.
const LIST = {
  chars: ['character-male-a', 'character-male-b', 'character-male-c', 'character-male-d', 'character-male-e', 'character-male-f',
          'character-female-b', 'character-female-c', 'character-female-f'],
  pets: ['animal-cat', 'animal-dog', 'animal-chick', 'animal-cow', 'animal-bee', 'animal-parrot'],
  cars: ['tractor', 'truck', 'tractor-shovel'],
  town: ['windmill', 'stall', 'stall-red', 'stall-green', 'fence', 'tree-high-round', 'lantern'],
  surv: ['chest', 'barrel', 'signpost-single', 'workbench', 'box'],
  nature: ['crops_wheatStageB', 'crop_carrot', 'crop_pumpkin', 'crops_leafsStageA', 'crops_dirtRow', 'flower_redA', 'flower_yellowA', 'flower_purpleA',
           'plant_bush', 'tree_oak', 'tree_default', 'tree_fat', 'tree_pineRoundC', 'rock_largeA', 'stump_round', 'log_stack', 'lily_large'],
};

// Набор Nature Kit слишком бирюзовый — подкрашиваем под тёплый стиль игры.
const RECOLOR = {
  'nature/leafsGreen': '#5aa83a', 'nature/grass': '#5cb847', 'nature/_defaultMat': '#e8c040',
  'nature/woodInner': '#d9b26f', 'nature/leafsDark': '#3f8a2a',
  'nature/dirt': '#8b5e3c', 'nature/dirtDark': '#6b4428', 'nature/leafsFall': '#f08c2e', 'nature/colorYellow': '#ffd43b',
};

// Lambert дешевле PBR и для мультяшного стиля выглядит так же.
function shared(pack, m) {
  const key = pack + '/' + m.name;
  if (!materials[key]) {
    materials[key] = new THREE.MeshLambertMaterial({
      name: m.name, map: m.map, color: RECOLOR[key] ? new THREE.Color(RECOLOR[key]) : m.color, vertexColors: m.vertexColors,
      transparent: m.transparent, opacity: m.opacity, side: m.side,
    });
  }
  return materials[key];
}

export async function loadAll(onProgress) {
  const loader = new GLTFLoader();
  const all = Object.entries(LIST).flatMap(([pack, names]) => names.map(n => [pack, n]));
  for (const [pack, name] of all) if (isStatic(pack + '/' + name)) models[pack + '/' + name] = { scene: buildStatic(pack + '/' + name), animations: [] };
  const jobs = all.filter(([pack, name]) => !models[pack + '/' + name]);
  let done = 0;
  await Promise.all(jobs.map(async ([pack, name]) => {
    const gltf = await loader.loadAsync(`assets/models/${pack}/${name}.glb`);
    gltf.scene.traverse(o => {
      if (o.isMesh) {
        o.material = Array.isArray(o.material) ? o.material.map(m => shared(pack, m)) : shared(pack, o.material);
        o.castShadow = o.receiveShadow = true;
      }
    });
    dress(pack + '/' + name, gltf.scene);
    models[pack + '/' + name] = gltf;
    onProgress(++done / jobs.length);
  }));
}

export const gltfOf = key => models[key];

// Копия модели (со скелетом, если он есть).
export function cloneModel(key) {
  return SkeletonUtils.clone(models[key].scene);
}

// Размер модели в метрах (по рамке).
export function sizeOf(key) {
  return new THREE.Box3().setFromObject(models[key].scene).getSize(new THREE.Vector3());
}

// Много одинаковых статичных объектов → по одному InstancedMesh на каждую часть модели.
// items: [{ x, z, y?, rot?, s? }]. opts.height — привести высоту модели к этому значению.
export function instances(key, items, opts = {}) {
  const src = models[key].scene;
  src.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(src);
  const base = opts.height ? opts.height / (box.max.y - box.min.y) : (opts.scale || 1);
  const group = new THREE.Group();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  src.traverse(o => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, items.length);
    im.castShadow = opts.shadow !== false;
    im.receiveShadow = true;
    items.forEach((it, k) => {
      const s = base * (it.s || 1);
      q.setFromAxisAngle(up, it.rot || 0);
      m.compose(new THREE.Vector3(it.x, (it.y || 0) - box.min.y * s, it.z), q, new THREE.Vector3(s, s, s));
      im.setMatrixAt(k, m.multiply(o.matrixWorld));
    });
    im.computeBoundingSphere();
    group.add(im);
  });
  return group;
}

// Привести объект к нужной высоте и поставить на землю.
export function fitHeight(obj, height) {
  const box = new THREE.Box3().setFromObject(obj);
  const s = height / (box.max.y - box.min.y);
  obj.scale.multiplyScalar(s);
  obj.position.y -= box.min.y * s;
  return obj;
}
