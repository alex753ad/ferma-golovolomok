// Точка входа: загрузка, сцена, Лев, NPC, управление, главный цикл.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { SPAWN, NPCS, NPC_COLORS, ZONES } from '../data/map.js';
import { loadAll } from './assets.js';
import { buildWorld, updateWorld, followSun, setDayPhase, pickables, addPick, unlockZone } from './world.js';
import { findPath, blockCircle } from './nav.js';
import { Actor } from './actor.js';
import { CameraRig } from './controls.js';
import { Minimap } from './minimap.js';
import { $, toast, makeLabel, setCamera } from './ui.js';
import { S, save } from './save.js';
import { makePortraits } from './portraits.js';
import { initQuest, tryTask, chat, npcWithTask, solvedCount, pinSetup, isOpen } from './quest.js';
import { setNameResolver } from './dialog.js';
import { initFarm, plotAt, actPlot, actPen, actMachine, grantItem, marketScreen, onZoneOpened, farmMarkers } from './farm.js';
import { initFamily, momTalk, momHasNews, grannyTalk, grannyPlace, grannyHasNews } from './family.js';
import { initStory, prologue, afterWin } from './story.js';
import { isLocked, fireworks } from './world.js';

const params = new URLSearchParams(location.search);
const qualityName = params.get('q') === 'eco' ? 'economy' : 'high';
const Q = CONFIG.quality[qualityName];

// ---------- рендер ----------
const renderer = new THREE.WebGLRenderer({ antialias: Q.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, Q.pixelRatio));
renderer.shadowMap.enabled = Q.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.className = 'scene';
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.3, 220);
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- загрузка ----------
await Promise.all([document.fonts.load('700 20px Fredoka'), document.fonts.load('800 20px Nunito'), document.fonts.load('900 20px Nunito')]);
await loadAll(p => {
  $('loadBar').style.width = Math.round(p * 100) + '%';
  $('loadText').textContent = `Загружаю ферму… ${Math.round(p * 100)}%`;
});
buildWorld(scene, Q);
if (params.get('open') === 'all') ZONES.forEach(z => unlockZone(z.id)); // для проверки: ?open=all
S.unlocked.forEach(unlockZone);

// Имя персонажа: для семьи — из настроек
const npcName = id => CONFIG.names[id] || NPCS.find(n => n.id === id)?.name || id;
setNameResolver(npcName);

// Портреты для диалогов
makePortraits({
  ...Object.fromEntries(NPCS.map(n => [n.id, { model: n.model, hat: n.hat }])),
  dad: { model: 'character-male-f', hat: 'dad' },
  grandma: { model: 'character-female-c' },
  lev: { model: 'character-male-f', hat: 'cap' },
});

// ---------- персонажи ----------
const lev = new Actor('character-male-f', { hat: 'cap' });
lev.speed = CONFIG.walkSpeed;
lev.root.position.set(SPAWN.x, 0, SPAWN.z);
lev.root.rotation.y = Math.PI;
scene.add(lev.root);

const npcs = NPCS.map(n => {
  const a = new Actor(n.model, { hat: n.hat, height: n.id === 'baron' ? 1.8 : 1.75 });
  a.root.position.set(n.x, 0, n.z);
  a.root.rotation.y = n.rot;
  a.data = n;
  const name = npcName(n.id);
  const tag = makeLabel([[name, '800 24px Nunito, sans-serif']], name.length * 13 + 36, 40, '#ffffff', '#2b2a1f', 0.014);
  tag.position.y = 2.5;
  a.root.add(tag);
  // «!» над тем, у кого есть задача
  a.bang = makeLabel([['!', '700 56px Fredoka, sans-serif']], 64, 64, '#ffc93c', '#2b2a1f', 0.012);
  a.bang.position.y = 3.1;
  a.root.add(a.bang);
  scene.add(a.root);
  a.pick = addPick(n.x, n.z, 0.9, 2, { type: 'npc', id: n.id, actor: a });
  if (!n.dynamic) blockCircle(n.x, n.z, 0.55);
  return a;
});
const npcById = id => npcs.find(a => a.data.id === id);

// Персонажи, которые переезжают по сюжету
function moveNpc(id, p) {
  const a = npcById(id);
  a.root.visible = !!p;
  if (!p) { a.pick.position.y = -100; return; }
  a.root.position.set(p.x, 0, p.z);
  a.pick.position.set(p.x, 1, p.z);
}
function placeNpcs() {
  moveNpc('grandma', grannyPlace());
  if (!isLocked('apiary')) moveNpc('beekeeper', { x: 27, z: -11 });
}
placeNpcs();
setCamera(camera);

// ---------- касания ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitP = new THREE.Vector3();

function ping(x, y) {
  const d = document.createElement('div');
  d.className = 'ping'; d.style.left = x + 'px'; d.style.top = y + 'px';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 520);
}

// Подойти к точке (x,z) и остановиться на расстоянии stop.
function goTo(x, z, stop = 0, onArrive) {
  const p = lev.root.position;
  let tx = x, tz = z;
  if (stop) { const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz) || 1; tx = x + dx / d * stop; tz = z + dz / d * stop; }
  const path = findPath(p.x, p.z, tx, tz);
  if (!path) { toast('Туда не пройти'); return; }
  lev.walk(path, onArrive);
}

function onTap(cx, cy) {
  if (isOpen()) return;
  ndc.set(cx / innerWidth * 2 - 1, -cy / innerHeight * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickables, false)[0];
  if (hit) {
    const u = hit.object.userData, o = hit.object.position;
    if (u.type === 'npc') {
      goTo(o.x, o.z, 1.4, () => {
        lev.lookAt(o.x, o.z);
        u.actor.lookAt(lev.root.position.x, lev.root.position.z);
        u.actor.once('emote-yes');
        npcTalk(u.id);
      });
      return;
    }
    goTo(o.x, o.z, 1.8, () => {
      lev.lookAt(o.x, o.z); lev.once('interact-right');
      const [kind, id] = u.id.split(':');
      if (kind === 'pen') actPen(id); else if (kind === 'machine') actMachine(id); else toast(u.name);
    });
    return;
  }
  if (!ray.ray.intersectPlane(plane, hitP)) return;
  ping(cx, cy);
  const plot = plotAt(hitP.x, hitP.z);
  if (plot) goTo(plot.x, plot.z, 1.2, () => { lev.lookAt(plot.x, plot.z); lev.once('interact-right'); actPlot(plot); });
  else goTo(hitP.x, hitP.z);
}

// Разговор: сначала сюжетная задача, потом — дела персонажа
function npcTalk(id) {
  if (tryTask(id)) return;
  if (id === 'valya') return marketScreen();
  if (id === 'mom') return momTalk();
  if (id === 'grandma') return grannyTalk();
  chat(id);
}

const rig = new CameraRig(camera, renderer.domElement, onTap);
rig.snap(lev.root.position);

const minimap = new Minimap(
  () => ({
    player: { x: lev.root.position.x, z: lev.root.position.z, rot: lev.root.rotation.y },
    markers: [...farmMarkers(), ...npcs.filter(a => a.root.visible).map(a => ({ x: a.root.position.x, z: a.root.position.z, color: NPC_COLORS[a.data.id], bang: a.data.id === npcWithTask() }))],
  }),
  (x, z) => goTo(x, z),
);

// ---------- задачи ----------
function refresh() {
  $('coins').textContent = S.coins;
  $('stars').textContent = S.stars;
  $('solved').textContent = solvedCount();
  const who = npcWithTask();
  for (const a of npcs) a.bang.visible = a.data.id === who;
  // мама и бабушка: значок, если есть поручение/подсказка
  npcById('mom').news.visible = momHasNews() && who !== 'mom';
  npcById('grandma').news.visible = grannyHasNews();
}
for (const id of ['mom', 'grandma']) {
  const a = npcById(id);
  a.news = makeLabel([[id === 'mom' ? '🥧' : '💡', '700 40px sans-serif']], 64, 64, '#ffe3ec', '#2b2a1f', 0.012);
  a.news.position.y = 3.1;
  a.root.add(a.news);
}
function showBanner() {
  const banner = makeLabel([['🏆 Лучшая ферма округа', '700 30px Fredoka, Nunito, sans-serif']], 380, 64, '#ffd43b', '#2b2a1f', 0.016);
  banner.position.set(-7, 7.5, 14);
  scene.add(banner);
}
initQuest({
  npcName,
  onChange: refresh,
  onReward(t) {
    if (t.reward.zone) { unlockZone(t.reward.zone, true); minimap.invalidate(); onZoneOpened(); placeNpcs(); }
    if (t.reward.item) grantItem(t.reward.item);
  },
  onWinClosed: t => afterWin(t),
});
initFarm(scene, { lev, onChange: refresh });
initFamily({ onChange: refresh });
initStory({
  focus: id => { const a = npcById(id); if (a.root.visible) goTo(a.root.position.x, a.root.position.z, 1.6); },
  onFinal: () => { showBanner(); fireworks(lev.root.position.x, lev.root.position.z - 6, 10); },
});
if (S.story.final) showBanner();
refresh();
setInterval(save, 30000); // время в игре и прочее — раз в полминуты

$('btnCollection').onclick = () => toast('Коллекция появится на этапе 4');
$('btnSettings').onclick = () => toast('Настройки появятся на этапе 5');

// ---------- главный цикл ----------
const clock = new THREE.Clock();
const dayOverride = params.has('day') ? +params.get('day') : null; // для проверки вечера: ?day=0.9
let playTime = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  playTime += dt;
  if (!document.hidden) S.playSeconds += dt;
  lev.speed = CONFIG.walkSpeed * (S.pieUntil > Date.now() ? CONFIG.pieSpeed : 1);
  lev.update(dt);
  for (const a of npcs) { a.update(dt); a.bang.position.y = 3.1 + Math.abs(Math.sin(t * 3)) * 0.25; if (a.news) a.news.position.y = a.bang.position.y; }
  rig.update(dt, lev.root.position);
  followSun(lev.root.position.x, lev.root.position.z);
  setDayPhase(dayOverride ?? playTime / 3600);
  updateWorld(dt, t);
  minimap.update();
  renderer.render(scene, camera);
});

window.game = { rig, lev, npcs, camera, scene, renderer, npcTalk, S: () => S }; // для отладки из консоли
$('load').remove();
if (!S.pinHash) await pinSetup();
await prologue();
toast('Нажми на землю — Лев пойдёт туда. Тяни пальцем — поверни камеру.', 4500);
