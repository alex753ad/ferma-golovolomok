// Карта фермы. Координаты в метрах: x — восток, z — юг. Центр (0,0).
// Зоны с lock > 0 закрыты забором, пока не решена задача с этим номером.
// gate — сторона ворот: 'n' | 's' | 'e' | 'w'.

export const BOUNDS = { x0: -44, x1: 44, z0: -34, z1: 38 };

export const SPAWN = { x: 0, z: 21 };

export const ZONES = [
  { id: 'strip',      name: 'Дедова полоска', x: -14, z: 29, w: 9,  d: 3,  lock: 0,  gate: 's', kind: 'beds' },
  { id: 'beds',       name: 'Грядки',      x: -17, z: 15,  w: 6,  d: 5,  lock: 1,  gate: 's', kind: 'beds' },
  { id: 'coop',       name: 'Курятник',    x: -27, z: 15,  w: 7,  d: 6,  lock: 3,  gate: 's', kind: 'coop' },
  { id: 'field1',     name: 'Поле 1',      x: -14, z: 1,   w: 14, d: 9,  lock: 4,  gate: 'e', kind: 'field' },
  { id: 'field2',     name: 'Поле 2',      x: -14, z: -15, w: 14, d: 9,  lock: 6,  gate: 'e', kind: 'field' },
  { id: 'barn',       name: 'Коровник',    x: -33, z: 1,   w: 9,  d: 8,  lock: 10, gate: 'e', kind: 'barn' },
  { id: 'garden',     name: 'Сад',         x: 33,  z: 1,   w: 10, d: 10, lock: 11, gate: 'w', kind: 'garden' },
  { id: 'mill',       name: 'Мельница',    x: -33, z: -15, w: 9,  d: 9,  lock: 12, gate: 'e', kind: 'mill' },
  { id: 'bakery',     name: 'Пекарня',     x: -33, z: -27, w: 9,  d: 6,  lock: 14, gate: 'e', kind: 'bakery' },
  { id: 'field3',     name: 'Поле 3',      x: 14,  z: 1,   w: 14, d: 9,  lock: 13, gate: 'w', kind: 'field' },
  { id: 'pond',       name: 'Пруд',        x: 33,  z: 16,  w: 12, d: 9,  lock: 15, gate: 'w', kind: 'pond' },
  { id: 'apiary',     name: 'Пасека',      x: 33,  z: -15, w: 10, d: 9,  lock: 16, gate: 'w', kind: 'apiary' },
  { id: 'greenhouse', name: 'Теплица',     x: 0,   z: -26, w: 10, d: 6,  lock: 17, gate: 'n', kind: 'greenhouse' },
  { id: 'field4',     name: 'Поле 4',      x: 14,  z: -15, w: 14, d: 9,  lock: 19, gate: 'w', kind: 'field' },
];

// Дороги: прямоугольники { x, z, w, d }
export const ROADS = [
  { x: 0,   z: 24,  w: 84, d: 2.4 },  // главная (восток–запад)
  { x: 0,   z: -7,  w: 84, d: 2.4 },  // северная
  { x: 0,   z: 4,   w: 2.4, d: 60 },  // центральная (север–юг)
  { x: 0,   z: 31,  w: 2.4, d: 12 },  // к рынку
  { x: -24, z: 8.5, w: 2,  d: 31 },   // западная
  { x: 24,  z: 8.5, w: 2,  d: 31 },   // восточная
];

// Постройки: тип и место. rot — поворот в радианах.
export const BUILDINGS = [
  { type: 'house',   x: -7,  z: 14,  w: 8, d: 6, color: '#f4dcae', roof: '#c0392b', chimney: true },
  { type: 'garage',  x: 8,   z: 14,  w: 6, d: 5, color: '#b8c4cc', roof: '#4d6a85' },
  { type: 'hut',     x: 22,  z: 20,  w: 3, d: 3, color: '#c8a26a', roof: '#7a5a2a' },   // шалаш Пасечника
  { type: 'manor',   x: 0,   z: -42, w: 12, d: 7, color: '#d9c7f0', roof: '#5f3dc4' },  // усадьба Хапкина (за забором)
];

// Персонажи. model — файл из assets/models/chars, look — внешность из js/looks.js.
export const NPCS = [
  { id: 'grandpa',  name: 'Дедушка Сергей',  model: 'character-male-b',   x: -3,  z: 19,  rot: 0.6,  hat: 'capBrown', look: 'grandpa' },
  { id: 'mom',      name: 'Мама Аня',        model: 'character-female-f', x: -6,  z: 18.5, rot: 0.2, look: 'mom' },
  { id: 'petrovich',name: 'Механик Петрович',model: 'character-male-e',   x: 10.5,z: 18.5, rot: -0.5 },
  { id: 'valya',    name: 'Тётя Валя',       model: 'character-female-f', x: 3,   z: 31,  rot: -0.8 },
  { id: 'miller',   name: 'Мельник',         model: 'character-male-a',   x: -26, z: -12, rot: 1.3 },
  { id: 'beekeeper',name: 'Пасечник',        model: 'character-male-c',   x: 22,  z: 22.5, rot: 0,   hat: 'bee' },
  { id: 'grandma',  name: 'Бабушка Оля',     model: 'character-female-c', x: -3,  z: 30.5, rot: 0.6, look: 'grandma' },
  { id: 'baron',    name: 'Барон Хапкин',    model: 'character-male-d',   x: 7,   z: -31, rot: 0,   hat: 'top' },
];

// Цвет точки NPC на миникарте
export const NPC_COLORS = {
  grandpa: '#1c7ed6', mom: '#e64980', petrovich: '#f76707', valya: '#ae3ec9',
  miller: '#868e96', beekeeper: '#fab005', baron: '#5f3dc4', grandma: '#f06595',
};
