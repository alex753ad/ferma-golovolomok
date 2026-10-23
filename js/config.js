// Все настраиваемые числа игры — в одном месте.
export const CONFIG = {
  // Имена семьи (можно поменять)
  names: {
    lev: 'Лев',
    grandpa: 'Дедушка Сергей',
    mom: 'Мама Аня',
    dad: 'Папа Женя',
    grandma: 'Бабушка Оля',
    cat: 'Сима',
  },

  // PIN-коды хэшем (см. hashPin в save.js): вход в игру и раздел «Для папы»
  pinHash: 'mrjqze',
  dadPinHash: '1p26a74',
  reviewPinHash: '19fcj1b', // аккаунт просмотра всех задач (PIN 2025)

  // Время роста урожая, минуты (полив ускоряет в waterBoost раз)
  growMinutes: { wheat: 3, carrot: 5, sunflower: 15, greenhouse: 30 },
  waterBoost: 2,

  // Урожай: семена (цена посадки одной грядки), цена продажи, с какой задачи доступно.
  // grow — ключ из growMinutes. В теплице растёт только тыква.
  crops: {
    wheat:     { name: 'Пшеница',   icon: '🌾', seed: 3,  price: 8,  grow: 'wheat',      from: 0 },
    carrot:    { name: 'Морковь',   icon: '🥕', seed: 5,  price: 14, grow: 'carrot',     from: 2 },
    sunflower: { name: 'Подсолнух', icon: '🌻', seed: 10, price: 35, grow: 'sunflower',  from: 7 },
    pumpkin:   { name: 'Тыква',     icon: '🎃', seed: 15, price: 70, grow: 'greenhouse', from: 17 },
    goldwheat: { name: 'Золотая пшеница', icon: '✨', seed: 6, price: 30, grow: 'wheat', from: 'c2' }, // из сундука
  },

  // Животные: корм (монет), сколько минут ждать, что дают и сколько.
  animals: {
    coop:   { name: 'Куры',    feed: 5,  minutes: 4,  product: 'egg',   amount: 3 },
    barn:   { name: 'Коровы',  feed: 10, minutes: 8,  product: 'milk',  amount: 2 },
    apiary: { name: 'Пчёлы',   feed: 0,  minutes: 15, product: 'honey', amount: 2 },
    garden: { name: 'Яблони',  feed: 0,  minutes: 10, product: 'apple', amount: 4 },
  },

  // Товары на рынке (цена продажи)
  goods: {
    egg:   { name: 'Яйца',   icon: '🥚', price: 6 },
    milk:  { name: 'Молоко', icon: '🥛', price: 12 },
    honey: { name: 'Мёд',    icon: '🍯', price: 25 },
    apple: { name: 'Яблоки', icon: '🍎', price: 10 },
    bread:     { name: 'Хлеб',            icon: '🍞', price: 50 },
    pie:       { name: 'Яблочный пирог',  icon: '🥧', price: 90 },
    cake:      { name: 'Морковный торт',  icon: '🍰', price: 150 },
    honeycake: { name: 'Медовик',         icon: '🎂', price: 220 },
  },

  // Пекарня: что нужно на одну выпечку и сколько минут печётся. Готовое продаётся тёте Вале (цены в goods).
  bakery: [
    { id: 'bread',     need: { wheat: 3 },                   minutes: 3 },
    { id: 'pie',       need: { apple: 2, egg: 2, wheat: 1 }, minutes: 5 },
    { id: 'cake',      need: { carrot: 3, egg: 2, milk: 1 }, minutes: 8 },
    { id: 'honeycake', need: { honey: 2, milk: 1, wheat: 2 }, minutes: 12 },
  ],
  millBonus: 1.5,    // после починки мельницы пшеница дороже (мука!)
  truckBonus: 1.25,  // грузовик — лучшая цена на всё

  // Магазин тёти Вали. cost — монеты; stars — открывается при стольких звёздах (звёзды не тратятся).
  // pet — питомец, hat — шапка, once — можно покупать снова (салют).
  shop: [
    { id: 'dog',        name: 'Собака',            icon: '🐶', cost: 300,  pet: true },
    { id: 'goat',       name: 'Козлёнок',          icon: '🐐', cost: 600,  pet: true },
    { id: 'horse',      name: 'Конь — можно ездить верхом', icon: '🐴', cost: 1200, pet: true },
    { id: 'salute',     name: 'Салют',             icon: '🎆', cost: 100,  once: true },
    { id: 'birdhouse',  name: 'Скворечник',        icon: '🐦', cost: 150 },
    { id: 'cathouse',   name: 'Домик для кошки',   icon: '🏠', cost: 200 },
    { id: 'swing',      name: 'Качели',            icon: '🛝', cost: 300 },
    { id: 'bike',       name: 'Велосипед — ходить быстрее', icon: '🚲', cost: 400 },
    { id: 'telescope',  name: 'Телескоп',          icon: '🔭', cost: 500 },
    { id: 'trampoline', name: 'Батут',             icon: '🤸', cost: 600 },
    { id: 'autowater',  name: 'Автополив грядок',  icon: '💦', cost: 700 },
    { id: 'fountain',   name: 'Фонтан',            icon: '⛲', cost: 800 },
    { id: 'drone',      name: 'Кепка-дрон',        icon: '🚁', cost: 900,  hat: true },
    { id: 'balloon',    name: 'Воздушный шар',     icon: '🎈', cost: 1500 },
    { id: 'sz4',        name: 'Сеялка СЗ-4 — цепляется к трактору', icon: '🌱', cost: 800 },
    { id: 'paint-red',   name: 'Покрасить трактор: красный', icon: '🟥', cost: 200, paint: '#e03131' },
    { id: 'paint-blue',  name: 'Покрасить трактор: синий',   icon: '🟦', cost: 200, paint: '#1c7ed6' },
    { id: 'paint-green', name: 'Покрасить трактор: зелёный', icon: '🟩', cost: 200, paint: '#2f9e44' },
    { id: 'paint-gold',  name: 'Золотой трактор',            icon: '⭐', stars: 30, paint: '#ffd43b' },
    { id: 'gold-hen',    name: 'Золотая курица',             icon: '⭐', stars: 20 },
    { id: 'parrot',      name: 'Попугай Кеша',               icon: '⭐', stars: 40 },
    { id: 'collar-blue', name: 'Синий ошейник для кошки',     icon: '⭐', stars: 10, collar: '#1c7ed6' },
    { id: 'collar-gold', name: 'Золотой ошейник для кошки',  icon: '⭐', stars: 35, collar: '#ffd43b' },
  ],
  bikeSpeed: 1.3,    // велосипед: Лев ходит быстрее
  horseSpeed: 1.8,   // верхом на коне
  tractorSpeed: 1.6, // за рулём трактора
  balloonDist: 40,   // с воздушным шаром камеру можно отодвинуть дальше

  // Поручения мамы (без математики). need — с какой задачи доступно. Каждый день — choresPerDay разных.
  chores: [
    { id: 'harvest', text: 'Собери урожай 10 раз',        goal: 10, need: 0 },
    { id: 'plant',   text: 'Посади 8 грядок',             goal: 8, need: 1 },
    { id: 'sell',    text: 'Продай урожай тёте Вале 2 раза', goal: 2, need: 0 },
    { id: 'feed',    text: 'Покорми кур 2 раза',          goal: 2, need: 3 },
    { id: 'eggs',    text: 'Собери яйца 2 раза',          goal: 2, need: 3 },
    { id: 'water',   text: 'Полей 6 грядок',              goal: 6, need: 8 },
    { id: 'cows',    text: 'Покорми коров',               goal: 1, need: 10 },
    { id: 'milk',    text: 'Принеси молоко 2 раза',       goal: 2, need: 10 },
    { id: 'apples',  text: 'Собери яблоки 2 раза',        goal: 2, need: 11 },
    { id: 'bake',    text: 'Испеки 2 угощения в пекарне', goal: 2, need: 14 },
    { id: 'honey',   text: 'Собери мёд',                  goal: 1, need: 16 },
  ],
  choresPerDay: 2,
  choreCoins: 40,   // за каждое поручение
  daily: { coins: 25 },
  grandpaCoins: 30,       // задачка от дедушки сверх сюжета
  grandpaPerDay: 5,       // сколько задачек дедушка даёт в день
  grandpaHard: { coins: 100, stars: 1 }, // задача-босс дня от дедушки (одна в день)
  chestCoins: 30,         // сундук, открытый повторно (каждый день снова заперт)   // задача дня: монеты (+1 звезда)
  streakCoins: { 3: 100, 7: 250, 14: 500 }, // монеты за серию дней подряд
  pieMinutes: 3,     // пирог: Лев ходит быстрее
  pieSpeed: 1.5,

  // Камера
  camera: { minDist: 3, maxDist: 24, startDist: 13, pitch: 0.74, closePitch: 0.3, startYaw: 0 },

  // Скорость ходьбы Льва, м/с
  walkSpeed: 4.2,

  // Качество графики
  quality: {
    high:    { pixelRatio: 2,   shadows: true,  shadowMap: 2048, grass: 7000, antialias: true },
    economy: { pixelRatio: 1.25, shadows: false, shadowMap: 1024, grass: 1500, antialias: false },
  },
};
