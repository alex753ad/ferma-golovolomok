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
  },
  millBonus: 1.5,    // после починки мельницы пшеница дороже (мука!)
  truckBonus: 1.25,  // грузовик — лучшая цена на всё

  // Магазин тёти Вали. cost — монеты; stars — открывается при стольких звёздах (звёзды не тратятся).
  shop: [
    { id: 'scarecrow', name: 'Пугало',         icon: '🧑‍🌾', cost: 40 },
    { id: 'flowerbed', name: 'Клумба',         icon: '🌷', cost: 30 },
    { id: 'bench',     name: 'Скамейка',       icon: '🪑', cost: 50 },
    { id: 'flags',     name: 'Флажки',         icon: '🎏', cost: 60 },
    { id: 'lanterns',  name: 'Фонари',         icon: '🏮', cost: 80 },
    { id: 'paint-red',   name: 'Покрасить трактор: красный', icon: '🟥', cost: 50, paint: '#e03131' },
    { id: 'paint-blue',  name: 'Покрасить трактор: синий',   icon: '🟦', cost: 50, paint: '#1c7ed6' },
    { id: 'paint-green', name: 'Покрасить трактор: зелёный', icon: '🟩', cost: 50, paint: '#2f9e44' },
    { id: 'paint-gold',  name: 'Золотой трактор',            icon: '⭐', stars: 30, paint: '#ffd43b' },
    { id: 'gold-hen',    name: 'Золотая курица',             icon: '⭐', stars: 20 },
    { id: 'parrot',      name: 'Попугай Кеша',               icon: '⭐', stars: 40 },
    { id: 'collar-blue', name: 'Синий ошейник для кошки',     icon: '⭐', stars: 10, collar: '#1c7ed6' },
    { id: 'collar-gold', name: 'Золотой ошейник для кошки',  icon: '⭐', stars: 35, collar: '#ffd43b' },
  ],

  // Поручения мамы (без математики). need — с какой задачи доступно.
  chores: [
    { id: 'harvest', text: 'Собери урожай 5 раз',        goal: 5, need: 0 },
    { id: 'plant',   text: 'Посади 4 грядки',            goal: 4, need: 1 },
    { id: 'sell',    text: 'Продай что-нибудь тёте Вале', goal: 1, need: 0 },
    { id: 'feed',    text: 'Покорми кур',                 goal: 1, need: 3 },
    { id: 'eggs',    text: 'Собери яйца',                 goal: 1, need: 3 },
    { id: 'water',   text: 'Полей 3 грядки',              goal: 3, need: 8 },
  ],
  choreCoins: 25,
  daily: { coins: 25 },   // задача дня: монеты (+1 звезда)
  streakPets: { dog: 3, goat: 7, horse: 14 }, // питомцы за серию дней
  pieMinutes: 3,     // пирог: Лев ходит быстрее
  pieSpeed: 1.5,

  // Камера
  camera: { minDist: 8, maxDist: 24, startDist: 13, pitch: 0.74, startYaw: 0 },

  // Скорость ходьбы Льва, м/с
  walkSpeed: 4.2,

  // Качество графики
  quality: {
    high:    { pixelRatio: 2,   shadows: true,  shadowMap: 2048, grass: 7000, antialias: true },
    economy: { pixelRatio: 1.25, shadows: false, shadowMap: 1024, grass: 1500, antialias: false },
  },
};
