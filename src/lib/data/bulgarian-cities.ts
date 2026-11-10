/**
 * Bulgarian Cities Data and Transliteration Helpers for Veltrox.
 */

export const REGIONAL_CITIES = [
  "София",
  "Пловдив",
  "Варна",
  "Бургас",
  "Русе",
  "Стара Загора",
  "Плевен",
  "Сливен",
  "Добрич",
  "Шумен",
  "Перник",
  "Хасково",
  "Ямбол",
  "Пазарджик",
  "Благоевград",
  "Велико Търново",
  "Враца",
  "Габрово",
  "Видин",
  "Кърджали",
  "Кюстендил",
  "Монтана",
  "Търговище",
  "Силистра",
  "Ловеч",
  "Разград",
  "Смолян",
] as const;

export const ALL_BULGARIAN_CITIES: string[] = [
  // 1. All regional capitals (first for priority)
  ...REGIONAL_CITIES,
  // 2. All other towns and cities across Bulgaria
  "Айтос",
  "Аксаково",
  "Алфатар",
  "Антоново",
  "Априлци",
  "Ардино",
  "Асеновград",
  "Балчик",
  "Банкя",
  "Банско",
  "Баня",
  "Батак",
  "Белене",
  "Белица",
  "Белоградчик",
  "Белослав",
  "Берковица",
  "Бобов дол",
  "Божурище",
  "Бойчиновци",
  "Болярово",
  "Борово",
  "Ботевград",
  "Брацигово",
  "Брегово",
  "Брезник",
  "Брезово",
  "Брусинци",
  "Бухово",
  "Българово",
  "Бяла (Варна)",
  "Бяла (Русе)",
  "Бяла Слатина",
  "Велики Преслав",
  "Велинград",
  "Ветрен",
  "Вълчедръм",
  "Вълчи дол",
  "Върбица",
  "Вършец",
  "Генерал Тошево",
  "Главиница",
  "Глоджево",
  "Годеч",
  "Горна Оряховица",
  "Гоце Делчев",
  "Грамада",
  "Гулянци",
  "Гурково",
  "Гълъбово",
  "Две могили",
  "Дебелец",
  "Девин",
  "Девня",
  "Джебел",
  "Димитровград",
  "Димово",
  "Добринище",
  "Долна баня",
  "Долна Митрополия",
  "Долна Оряховица",
  "Долни Дъбник",
  "Долни чифлик",
  "Доспат",
  "Драгоман",
  "Дряново",
  "Дулово",
  "Дунавци",
  "Дупница",
  "Елена",
  "Елин Пелин",
  "Елхово",
  "Етрополе",
  "Завет",
  "Земен",
  "Златарица",
  "Златица",
  "Златоград",
  "Ивайловград",
  "Искър",
  "Исперих",
  "Ихтиман",
  "Каблешково",
  "Каварна",
  "Казанлък",
  "Калофер",
  "Камено",
  "Каолиново",
  "Карлово",
  "Карнобат",
  "Каспичан",
  "Кермен",
  "Килифарево",
  "Китен",
  "Клисура",
  "Кнежа",
  "Козлодуй",
  "Койнаре",
  "Копривщица",
  "Костандово",
  "Костенец",
  "Костинброд",
  "Котел",
  "Кресна",
  "Кричим",
  "Крумовград",
  "Кубрат",
  "Куклен",
  "Кула",
  "Левски",
  "Летница",
  "Лозен",
  "Лом",
  "Луковит",
  "Лъки",
  "Любимец",
  "Мадан",
  "Маджарово",
  "Мартен",
  "Мездра",
  "Мелник",
  "Меричлери",
  "Мизия",
  "Момин проход",
  "Момчилград",
  "Мъглиж",
  "Неделино",
  "Несебър",
  "Николаево",
  "Никопол",
  "Нова Загора",
  "Нови Искър",
  "Нови пазар",
  "Обзор",
  "Омуртаг",
  "Опака",
  "Оряхово",
  "Павел баня",
  "Павликени",
  "Панагюрище",
  "Перущица",
  "Петрич",
  "Пещера",
  "Пирдоп",
  "Плачковци",
  "Полски Тръмбеш",
  "Поморие",
  "Попово",
  "Правец",
  "Приморско",
  "Провадия",
  "Първомай",
  "Раднево",
  "Радомир",
  "Разлог",
  "Ракитово",
  "Раковски",
  "Рила",
  "Роман",
  "Рудозем",
  "Садово",
  "Самоков",
  "Сандански",
  "Сапарева баня",
  "Свети Влас",
  "Свиленград",
  "Свищов",
  "Своге",
  "Севлиево",
  "Сеново",
  "Септември",
  "Симитли",
  "Симеоновград",
  "Сливница",
  "Сливо поле",
  "Созопол",
  "Сопот",
  "Средец",
  "Стамболийски",
  "Стражица",
  "Стралджа",
  "Стрелча",
  "Суворово",
  "Сунгурларе",
  "Сухиндол",
  "Съединение",
  "Сърница",
  "Твърдица",
  "Тервел",
  "Тетевен",
  "Тополовград",
  "Троян",
  "Трън",
  "Тръстеник",
  "Трявна",
  "Тутракан",
  "Угърчин",
  "Хаджидимово",
  "Харманли",
  "Хисаря",
  "Цар Калоян",
  "Царево",
  "Чепеларе",
  "Червен бряг",
  "Черноморец",
  "Чипровци",
  "Чирпан",
  "Шабла",
  "Шивачево",
  "Шипка",
  "Ябланица",
  "Якоруда",
];

// Alphabetical distinct list of all cities:
export const SORTED_BULGARIAN_CITIES = Array.from(
  new Set(ALL_BULGARIAN_CITIES)
).sort((a, b) => a.localeCompare(b, "bg"));

/**
 * Transliteration dictionary for fuzzy matching latin search inputs
 * to cyrillic Bulgarian city names (e.g. "Targovishte" -> "Търговище").
 */
const LATIN_TO_CYRILLIC_MAP: Record<string, string> = {
  sht: "щ",
  sh: "ш",
  ch: "ч",
  zh: "ж",
  tz: "ц",
  ts: "ц",
  yu: "ю",
  ya: "я",
  a: "а",
  b: "б",
  v: "в",
  w: "в",
  g: "г",
  d: "д",
  e: "е",
  z: "з",
  i: "и",
  j: "й",
  y: "й",
  k: "к",
  l: "л",
  m: "м",
  n: "н",
  o: "о",
  p: "п",
  r: "р",
  s: "с",
  t: "т",
  u: "у",
  f: "ф",
  h: "х",
  c: "к",
  x: "кс",
  q: "к",
};

/**
 * Normalizes user search input by converting latin transliteration to cyrillic.
 */
export function normalizeSearchQuery(input: string): string {
  let low = input.trim().toLowerCase();
  if (!low) return "";

  // Replace multi-char latin combos first
  low = low
    .replace(/sht/g, "щ")
    .replace(/sh/g, "ш")
    .replace(/ch/g, "ч")
    .replace(/zh/g, "ж")
    .replace(/tz/g, "ц")
    .replace(/ts/g, "ц")
    .replace(/yu/g, "ю")
    .replace(/ya/g, "я");

  let result = "";
  for (const char of low) {
    result += LATIN_TO_CYRILLIC_MAP[char] || char;
  }

  return result;
}

/**
 * Matches a city against a search term, checking both raw string and transliterated match.
 */
export function matchesCity(cityName: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const target = cityName.toLowerCase();
  if (target.includes(q)) return true;

  // Try latin-to-cyrillic match
  const cyrillicQuery = normalizeSearchQuery(q);
  if (cyrillicQuery && target.includes(cyrillicQuery)) return true;

  // Handle special cases: 'targovishte' -> 'търговище', 'veliko tarnovo' -> 'велико търново'
  const targetReplaced = target.replace(/ъ/g, "a").replace(/ъ/g, "u");
  if (targetReplaced.includes(q)) return true;

  return false;
}

