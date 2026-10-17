// Точка входа: загрузка, сцена, Лев и персонажи, касания, связь всех частей игры, главный цикл.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { SPAWN, NPCS, NPC_COLORS, ZONES } from '../data/map.js';
import { CHESTS } from '../data/tasks.js';
import { loadAll } from './assets.js';
import { buildWorld, updateWorld, followSun, setDayPhase, pickables, addPick, unlockZone, isLocked, fireworks, setGrassCount } from './world.js';
import { findPath, blockCircle } from './nav.js';
import { Actor } from './actor.js';
import { CameraRig } from './controls.js';
import { Minimap } from './minimap.js';
import { $, toast, makeLabel, setCamera, emit, on } from './ui.js';
import { S, save } from './save.js';
import { makePortraits } from './portraits.js';
import { setNameResolver, isOpen, talk } from './dialog.js';
import { initQuest, tryTask, chat, npcWithTask, currentTask, solvedCount, pinSetup } from './quest.js';
import { initFarm, plotAt, actPlot, actPen, actMachine, grantItem, marketScreen, onZoneOpened, farmMarkers } from './farm.js';
import { initFamily, momTalk, momHasNews, grannyTalk, grannyPlace, grannyHasNews } from './family.js';
import { initStory, prologue, afterWin } from './story.js';
import { initDay, D, tickDay, dayPhase, canStartTask, onStorySolved, isEnded, evening } from './day.js';
import { initBonus, updateBonus, dailyNpc, dailyScreen, letterScreen, chestScreen, chestMarkers } from './bonus.js';
import { initPets, updatePets, refreshPets } from './pets.js';
import { initCollection, collectionScreen, flushPrizes, checkBadges } from './collection.js';
import { settingsScreen } from './settings.js';
import { initAudio, settings, step, sfx, moo, cluck, buzz, setTheme, musicQuiet } from './audio.js';
import { startTutorial, tutorialTick } from './tutorial.js';

const params = new URLSearchParams(location.search);
const qualityName = params.get('q') === 'eco' ? 'economy' : params.get('q') === 'high' ? 'high' : settings().quality;
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
initAudio();

// ---------- загрузка ----------
await Promise.all([document.fonts.load('700 20px Fredoka'), document.fonts.load('800 20px Nunito'), document.fonts.load('900 20px Nunito')]);
await loadAll(p => {
  $('loadBar').style.width = Math.round(p * 100) + '%';
  $('loadText').textContent = `Загружаю ферму… ${Math.round(p * 100)}%`;
});
buildWorld(scene, Q);
if (params.get('open') === 'all') ZONES.forEach(z => unlockZone(z.id)); // для проверки: ?open=all
S.unlocked.forEach(id => unlockZone(id));

// Имя персонажа: для семьи — из настроек
const npcName = id => CONFIG.names[id] || NPCS.find(n => n.id === id)?.name || id;
setNameResolver(npcName);

// Портреты для диалогов
makePortraits({
  ...Object.fromEntries(NPCS.map(n => [n.id, { model: n.model, hat: n.hat }])),
  dad: { model: 'character-male-f', hat: 'dad' },
  lev: { model: 'character-male-f', hat: 'cap' },
});

// ---------- персонажи ----------
const lev = new Actor('character-male-f', { hat: S.hat || 'cap' });
lev.speed = CONFIG.walkSpeed;
lev.root.position.set(SPAWN.x, 0, SPAWN.z);
lev.root.rotation.y = Math.PI;
scene.add(lev.root);
setCamera(camera);

const sprite = (text, bg) => makeLabel([[text, text === '!' ? '700 56px Fredoka, sans-serif' : '700 40px sans-serif']], 64, 64, bg, '#2b2a1f', 0.012);
const npcs = NPCS.map(n => {
  const a = new Actor(n.model, { hat: n.hat, height: n.id === 'baron' ? 1.8 : 1.75 });
  a.root.position.set(n.x, 0, n.z);
  a.root.rotation.y = n.rot;
  a.data = n;
  const name = npcName(n.id);
  const tag = makeLabel([[name, '800 24px Nunito, sans-serif']], name.length * 13 + 36, 40, '#ffffff', '#2b2a1f', 0.014);
  tag.position.y = 2.5;
  a.root.add(tag);
  // значки над головой: «!» — задача, «⭐» — задача дня, 🥧/💡 — у мамы и бабушки
  a.bang = sprite('!', '#ffc93c'); a.star = sprite('⭐', '#d0ebff');
  a.news = sprite(n.id === 'mom' ? '🥧' : '💡', '#ffe3ec');
  a.root.add(a.bang, a.star, a.news);
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
  if (isOpen() || isEnded()) return;
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
    goTo(o.x, o.z, 1.6, () => {
      lev.lookAt(o.x, o.z); lev.once('interact-right');
      const [kind, id] = u.id.split(':');
      if (kind === 'pen') actPen(id);
      else if (kind === 'machine') actMachine(id);
      else if (kind === 'chest') chestScreen(id);
      else if (kind === 'mail') letterScreen();
      else toast(u.name);
    });
    return;
  }
  if (!ray.ray.intersectPlane(plane, hitP)) return;
  ping(cx, cy);
  const plot = plotAt(hitP.x, hitP.z);
  if (plot) goTo(plot.x, plot.z, 1.2, () => { lev.lookAt(plot.x, plot.z); lev.once('interact-right'); actPlot(plot); });
  else goTo(hitP.x, hitP.z, 0, () => emit('walked'));
}

// Разговор: сюжетная задача → задача дня → дела персонажа → просто болтовня
async function npcTalk(id) {
  if (tryTask(id)) return;
  const t = currentTask();
  if (t && t.npc === id && !canStartTask()) {
    await talk(id, ['На сегодня задач хватит — голове нужен отдых! Приходи завтра, у меня кое-что интересное.']);
  } else if (dailyNpc() === id) return dailyScreen();
  if (id === 'valya') { emit('market'); return marketScreen(); }
  if (id === 'mom') return momTalk();
  if (id === 'grandma') return grannyTalk();
  if (!(t && t.npc === id)) chat(id);
}

const rig = new CameraRig(camera, renderer.domElement, onTap);
rig.snap(lev.root.position);

const minimap = new Minimap(
  () => ({
    player: { x: lev.root.position.x, z: lev.root.position.z, rot: lev.root.rotation.y },
    markers: [
      ...farmMarkers(),
      ...chestMarkers().filter(c => S.chestsSeen?.[c.id]).map(c => ({ x: c.x, z: c.z, color: '#8d5524', small: true })),
      ...npcs.filter(a => a.root.visible).map(a => ({ x: a.root.position.x, z: a.root.position.z, color: NPC_COLORS[a.data.id], bang: a.data.id === npcWithTask() && canStartTask() })),
    ],
  }),
  (x, z) => goTo(x, z),
);

// ---------- состояние и значки ----------
function refresh() {
  $('coins').textContent = S.coins;
  $('stars').textContent = S.stars;
  $('solved').textContent = solvedCount();
  const who = canStartTask() || S.cur ? npcWithTask() : null, daily = dailyNpc();
  for (const a of npcs) {
    a.bang.visible = a.data.id === who;
    a.star.visible = a.data.id === daily && !a.bang.visible;
    a.news.visible = (a.data.id === 'mom' && momHasNews()) || (a.data.id === 'grandma' && grannyHasNews());
    if (a.bang.visible || a.star.visible) a.news.visible = false;
  }
}
function showBanner() {
  const banner = makeLabel([['🏆 Лучшая ферма округа', '700 30px Fredoka, Nunito, sans-serif']], 380, 64, '#ffd43b', '#2b2a1f', 0.016);
  banner.position.set(-7, 7.5, 14);
  scene.add(banner);
}

initDay({
  noStoryLeft: () => !currentTask(),
  nextTaskId: () => currentTask()?.id,
  goHome: () => goTo(-7, 18.2),
});
initQuest({
  npcName,
  canStart: t => S.cur?.id === t.id || canStartTask(), // начатую задачу можно доделать
  onChange: refresh,
  onReward(t) {
    onStorySolved();
    if (t.reward.zone) { unlockZone(t.reward.zone, true); minimap.invalidate(); onZoneOpened(); placeNpcs(); sfx('latch'); }
    if (t.reward.item) grantItem(t.reward.item);
  },
  onWinClosed: t => afterWin(t),
});
initFarm(scene, { lev, onChange: refresh });
initFamily({ onChange: refresh });
initBonus(scene, {
  onChange: refresh,
  onChest(r) {
    if (r === 'rooster' && !S.decor.includes('rooster')) { S.decor.push('rooster'); save(); onZoneOpened(); }
    if (r === 'hat') lev.setHat('cowboy');
    if (r === 'collar') refreshPets();
  },
});
initPets(scene, {
  lev, onChange: refresh,
  isEvening: () => isEnded(),
  taskNpcPos: () => { const id = canStartTask() ? npcWithTask() : dailyNpc(); const a = id && npcById(id); return a?.root.visible ? { x: a.root.position.x + 1, z: a.root.position.z + 1 } : null; },
});
initCollection({ onHat: () => lev.setHat(S.hat) });
initStory({
  focus: id => { const a = npcById(id); if (a.root.visible) goTo(a.root.position.x, a.root.position.z, 1.6); },
  onFinal: () => { showBanner(); fireworks(lev.root.position.x, lev.root.position.z - 6, 10); setTheme('final'); },
});
if (S.story.final) { showBanner(); setTheme('final'); }

// Звуки событий
on('harvest', () => sfx('pluck'));
on('dig', () => sfx('dig', 0.6));
on('plant', () => sfx('pluck', 0.5, 0.8));
on('sell', () => sfx('coins'));
on('feed', () => sfx('dig', 0.4, 1.3));
on('collect', p => { sfx('coins', 0.6); if (p === 'egg') cluck(); if (p === 'milk') moo(); if (p === 'honey') buzz(); });
on('chest', () => sfx('creak'));
on('buy', () => sfx('coins'));
on('newday', refresh);
on('buy', id => id.startsWith('collar') && refreshPets());

refresh();
setInterval(save, 30000); // время в игре и прочее — раз в полминуты

$('btnCollection').onclick = () => { if (!isEnded()) collectionScreen(); };
$('btnSettings').onclick = () => settingsScreen();

// Звуки животных рядом
let animalT = 5;
function animalSounds(dt) {
  if ((animalT -= dt) > 0) return;
  animalT = 8 + Math.random() * 8;
  const p = lev.root.position, near = id => !isLocked(id) && (z => Math.hypot(p.x - z.x, p.z - z.z) < 12)(ZONES.find(z => z.id === id));
  if (near('coop')) cluck(); else if (near('barn')) moo(); else if (near('apiary')) buzz();
}

// Отметить сундуки, мимо которых прошёл Лев (появятся на миникарте)
function seeChests() {
  const p = lev.root.position;
  for (const c of CHESTS) if (!S.chestsSeen?.[c.id] && Math.hypot(p.x - c.x, p.z - c.z) < 8) { (S.chestsSeen ||= {})[c.id] = true; save(); }
}

// ---------- главный цикл ----------
const clock = new THREE.Clock();
const dayOverride = params.has('day') ? +params.get('day') : null; // для проверки вечера: ?day=0.9
let stepT = 0, slow = 0, frames = 0, fpsT = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  if (!document.hidden) { S.playSeconds += dt; tickDay(dt); }
  lev.speed = CONFIG.walkSpeed * (S.pieUntil > Date.now() ? CONFIG.pieSpeed : 1);
  lev.update(dt);
  if (lev.path && (stepT -= dt) < 0) { stepT = 0.32; step(); }
  for (const a of npcs) {
    a.update(dt);
    const y = 3.1 + Math.abs(Math.sin(t * 3)) * 0.25;
    a.bang.position.y = a.star.position.y = a.news.position.y = y;
  }
  rig.update(dt, lev.root.position);
  followSun(lev.root.position.x, lev.root.position.z);
  setDayPhase(dayOverride ?? dayPhase());
  updateWorld(dt, t);
  updateBonus(dt, t);
  updatePets(dt);
  tutorialTick(t);
  animalSounds(dt);
  minimap.update();
  if (frames % 30 === 0) { seeChests(); flushPrizes(isOpen); refresh(); }
  musicQuiet(isOpen());
  if (!isOpen() && !S.story.final) setTheme('farm');
  renderer.render(scene, camera);
  // Автозащита скорости: если долго меньше 25 кадров/с — уменьшаем траву
  frames++; fpsT += dt;
  if (fpsT > 5) { if (frames / fpsT < 25 && ++slow === 2) { setGrassCount(Math.floor(Q.grass / 3)); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25)); } frames = 0; fpsT = 0; }
});

// Офлайн-режим и «на главный экран» (на локальном компьютере не включаем, чтобы правки были видны сразу)
if ('serviceWorker' in navigator && (!/^(localhost|127\.)/.test(location.hostname) || params.has('sw'))) navigator.serviceWorker.register('sw.js').catch(() => {});

window.game = { rig, lev, npcs, camera, scene, renderer, npcTalk, S: () => S, D }; // для отладки из консоли
$('load').remove();
if (!S.pinHash) await pinSetup();
if (isEnded()) evening();
else {
  await prologue();
  startTutorial({ scene, pointOf: id => id === 'strip' ? ZONES.find(z => z.id === 'strip') : npcById(id)?.root.position });
  if (S.story.tutorial) toast('Нажми на землю — Лев пойдёт туда. Тяни пальцем — поверни камеру.', 3500);
}
checkBadges();
