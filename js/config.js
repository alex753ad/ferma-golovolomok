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
